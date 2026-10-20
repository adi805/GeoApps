import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Affine6 } from "./geopdf-affine";
import {
  MemoryTileCacheTable,
  TableTileCache,
  createGeoPdfTileCacheStore,
  parseTileKey,
  tileCacheKey,
  tileCachePrefix,
  type GeoPdfTileScope,
} from "./geopdf-tile-cache";
import {
  GeoPdfTileRenderer,
  MAX_CANVAS_SIDE,
  MAX_LIVE_CANVASES,
  MAX_LIVE_TILES,
  latToMercatorY,
  lonToMercatorX,
  pageToMercatorAffine,
  type CanvasFactory,
} from "./geopdf-tiles";

/** Two 64-byte tiles' worth of bytes, distinguishable by length. */
function bytes(length: number): ArrayBuffer {
  return new ArrayBuffer(length);
}

/** A project hash, shaped like the SHA-256 the renderer computes. */
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function store(budgetBytes?: number): {
  table: MemoryTileCacheTable;
  cache: ReturnType<typeof createGeoPdfTileCacheStore>;
} {
  const table = new MemoryTileCacheTable();
  const backend = budgetBytes === undefined ? new TableTileCache(table) : new TableTileCache(table, budgetBytes);
  return { table, cache: createGeoPdfTileCacheStore(backend) };
}

void describe("geopdf tile cache keys", () => {
  void it("builds the key the issue asks for", () => {
    assert.equal(tileCacheKey("ABC123", 7, 3, 4), "abc123/7/3/4");
    assert.equal(tileCachePrefix("ABC123"), "abc123/");
    assert.deepEqual(parseTileKey("abc123/7/3/4"), { fileHash: "abc123", z: 7, x: 3, y: 4 });
    assert.equal(parseTileKey("abc123"), null);
  });

  void it("stores and returns a tile through its scope", async () => {
    const { cache } = store();
    const scope = cache.scope(HASH_A);
    const written = bytes(64);
    await scope.set(3, 1, 2, written);
    const read = await scope.get(3, 1, 2);
    assert.ok(read instanceof ArrayBuffer);
    assert.equal(read.byteLength, 64);
    assert.equal(await scope.get(3, 1, 3), null, "a tile never written must read as absent");
  });

  void it("keeps each project's keys under its own hash", async () => {
    const { cache } = store();
    await cache.scope(HASH_A).set(1, 0, 0, bytes(10));
    await cache.scope(HASH_A).set(2, 1, 1, bytes(10));
    await cache.scope(HASH_B).set(1, 0, 0, bytes(10));
    assert.deepEqual((await cache.keys(HASH_A)).sort(), [`${HASH_A}/1/0/0`, `${HASH_A}/2/1/1`]);
    assert.deepEqual(await cache.keys(HASH_B), [`${HASH_B}/1/0/0`]);
  });
});

void describe("geopdf tile cache deletion", () => {
  void it("deletes one project and leaves the other untouched", async () => {
    const { cache } = store();
    for (let z = 0; z <= 2; z += 1) {
      await cache.scope(HASH_A).set(z, 0, 0, bytes(16));
      await cache.scope(HASH_B).set(z, 0, 0, bytes(16));
    }
    const removed = await cache.deleteProject(HASH_A);
    assert.equal(removed, 3);
    assert.deepEqual(await cache.keys(HASH_A), []);
    assert.equal((await cache.keys(HASH_B)).length, 3);
    assert.ok(await cache.scope(HASH_B).get(2, 0, 0), "project B must still answer");
    assert.equal(await cache.scope(HASH_A).get(0, 0, 0), null);
  });

  void it("sweeps a tile the manifest never recorded", async () => {
    const { table, cache } = store();
    await cache.scope(HASH_A).set(1, 0, 0, bytes(8));
    // A write that died before the manifest was rewritten leaves this behind.
    await table.put(`${HASH_A}/9/9/9`, bytes(8));
    assert.equal(await cache.deleteProject(HASH_A), 2);
    assert.deepEqual(await cache.keys(HASH_A), []);
  });

  void it("deleteAll empties the table", async () => {
    const { cache } = store();
    await cache.scope(HASH_A).set(0, 0, 0, bytes(8));
    await cache.scope(HASH_B).set(0, 0, 0, bytes(8));
    await cache.deleteAll();
    assert.deepEqual(await cache.keys(), []);
  });
});

void describe("geopdf tile cache budget", () => {
  void it("drops the oldest tiles once a project passes its byte budget", async () => {
    const { cache } = store(100);
    const scope = cache.scope(HASH_A);
    await scope.set(0, 0, 0, bytes(50));
    await scope.set(1, 0, 0, bytes(50));
    await scope.set(2, 0, 0, bytes(50));
    const keys = await cache.keys(HASH_A);
    assert.equal(keys.length, 2, `expected the budget to hold two 50-byte tiles, saw ${keys.length}`);
    assert.ok(!keys.includes(`${HASH_A}/0/0/0`), "the oldest tile must be the one evicted");
    assert.ok(keys.includes(`${HASH_A}/2/0/0`), "the newest tile must survive");
  });

  void it("keeps one tile even when it alone exceeds the budget", async () => {
    const { cache } = store(10);
    await cache.scope(HASH_A).set(0, 0, 0, bytes(64));
    assert.deepEqual(await cache.keys(HASH_A), [`${HASH_A}/0/0/0`]);
  });

  void it("counts a project separately from its neighbour", async () => {
    const { cache } = store(100);
    await cache.scope(HASH_A).set(0, 0, 0, bytes(60));
    await cache.scope(HASH_B).set(0, 0, 0, bytes(60));
    await cache.scope(HASH_B).set(1, 0, 0, bytes(60));
    assert.equal((await cache.keys(HASH_A)).length, 1, "project A must not be evicted by B");
    assert.equal((await cache.keys(HASH_B)).length, 1);
  });
});

/**
 * The renderer half of issue #66: a closed project must come back without
 * rendering its tiles again, and the two-tile memory bound must survive that.
 */

/** An A1 sheet, the size issue #8 measures. */
const A1_WIDTH = 2384;
const A1_HEIGHT = 3370;
const WEST = 106.7;
const EAST = 106.9;
const SOUTH = -6.3;
const NORTH = -6.1;

const A1_AFFINE: Affine6 = [
  (EAST - WEST) / A1_WIDTH,
  0,
  0,
  (SOUTH - NORTH) / A1_HEIGHT,
  WEST,
  NORTH,
];

/** Every tile the sheet's extent touches at a zoom. */
function tileCover(z: number): Array<{ x: number; y: number }> {
  const count = 2 ** z;
  const clamp = (value: number): number => Math.max(0, Math.min(count - 1, value));
  const x0 = clamp(Math.floor(lonToMercatorX(WEST) * count));
  const x1 = clamp(Math.ceil(lonToMercatorX(EAST) * count) - 1);
  const y0 = clamp(Math.floor(latToMercatorY(NORTH) * count));
  const y1 = clamp(Math.ceil(latToMercatorY(SOUTH) * count) - 1);
  const tiles: Array<{ x: number; y: number }> = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) tiles.push({ x, y });
  }
  return tiles;
}

/** A canvas factory that counts what is alive, like the renderer test's. */
function trackingCanvasFactory(): { factory: CanvasFactory; peak: () => number } {
  let live = 0;
  let peak = 0;
  const factory = (width: number, height: number): HTMLCanvasElement => {
    live += 1;
    peak = Math.max(peak, live);
    const canvas = {
      width,
      height,
      getContext: () => ({
        clearRect: () => undefined,
        setTransform: () => undefined,
        drawImage: () => undefined,
      }),
    };
    Object.defineProperty(canvas, "width", {
      get: () => width,
      set: (value: number) => {
        if (value === 0) live -= 1;
      },
    });
    return canvas as unknown as HTMLCanvasElement;
  };
  return { factory: factory as CanvasFactory, peak: () => peak };
}

/** Build a renderer over the synthetic sheet, optionally with a persistent cache. */
function a1Renderer(options: {
  cache?: GeoPdfTileScope;
  rasterize?: () => Promise<void>;
}): { renderer: GeoPdfTileRenderer; peak: () => number; rasterized: () => number } {
  const affine = pageToMercatorAffine(A1_AFFINE, A1_WIDTH, A1_HEIGHT);
  assert.ok(affine, "the synthetic A1 georeference must fit an affine");
  const canvases = trackingCanvasFactory();
  let rasterized = 0;
  const renderer = new GeoPdfTileRenderer({
    pageWidth: A1_WIDTH,
    pageHeight: A1_HEIGHT,
    pageAffine: affine,
    rasterize: async () => {
      rasterized += 1;
      await options.rasterize?.();
    },
    createCanvas: canvases.factory,
    encode: async () => new ArrayBuffer(16),
    ...(options.cache ? { cache: options.cache } : {}),
  });
  return { renderer, peak: canvases.peak, rasterized: () => rasterized };
}

void describe("geopdf tile cache across sessions", () => {
  void it("reopens a project without rendering a single tile again", async () => {
    const { cache } = store();
    const scope = cache.scope(HASH_A);
    const tiles = tileCover(13);
    assert.ok(tiles.length > 0, "zoom 13 must cover the sheet");

    const first = a1Renderer({ cache: scope });
    for (const { x, y } of tiles) await first.renderer.render(13, x, y);
    assert.equal(first.renderer.stats.rendered, tiles.length);
    assert.equal(first.renderer.stats.persistentWrites, tiles.length);

    // A new renderer over the same store is what opening the project again is.
    const second = a1Renderer({ cache: scope });
    for (const { x, y } of tiles) await second.renderer.render(13, x, y);
    const stats = second.renderer.stats;
    assert.equal(stats.rendered, 0, `expected zero re-renders, saw ${stats.rendered}`);
    assert.equal(stats.persistentHits, tiles.length);
    assert.equal(stats.cacheHits, tiles.length);
    assert.equal(second.rasterized(), 0, "a cache hit must not touch the PDF");
  });

  void it("keeps two live tiles and two canvases while serving a warm cache", async () => {
    const { cache } = store();
    const scope = cache.scope(HASH_A);
    const tiles = tileCover(13);
    const warm = a1Renderer({ cache: scope });
    const warmed = tiles.slice(0, 12);
    for (const { x, y } of warmed) await warm.renderer.render(13, x, y);
    assert.ok(warm.renderer.stats.rendered > 0, "the first pass must render tiles");

    const reopened = a1Renderer({ cache: scope });
    for (const { x, y } of tiles) await reopened.renderer.render(13, x, y);
    const stats = reopened.renderer.stats;
    assert.equal(stats.rendered, tiles.length - warmed.length);
    assert.ok(stats.peakLiveTiles <= MAX_LIVE_TILES, `peak live tiles ${stats.peakLiveTiles}`);
    assert.ok(reopened.peak() <= MAX_LIVE_CANVASES, `canvas peak ${reopened.peak()}`);
    assert.ok(stats.maxCanvasSide <= MAX_CANVAS_SIDE);
  });

  void it("holds the two-tile bound across zoom 0 to 12 with a warm cache", async () => {
    const { cache } = store();
    const scope = cache.scope(HASH_A);
    const swept: number[] = [];
    for (let z = 0; z <= 12; z += 1) {
      const cover = tileCover(z);
      assert.ok(cover.length > 0, `zoom ${z} must cover the sheet`);
      // Warm the cache for this zoom first, so the measured pass is a hit pass.
      const warm = a1Renderer({ cache: scope });
      for (const { x, y } of cover) await warm.renderer.render(z, x, y);

      const { renderer } = a1Renderer({ cache: scope });
      for (const { x, y } of cover) await renderer.render(z, x, y);
      assert.equal(renderer.stats.rendered, 0, `zoom ${z} re-rendered ${renderer.stats.rendered} tiles`);
      assert.equal(renderer.stats.persistentHits, cover.length);
      assert.ok(
        renderer.stats.peakLiveTiles <= MAX_LIVE_TILES,
        `zoom ${z} peak live tiles ${renderer.stats.peakLiveTiles} exceeds ${MAX_LIVE_TILES}`,
      );
      assert.ok(renderer.stats.peakLiveCanvases <= MAX_LIVE_CANVASES);
      swept.push(renderer.stats.peakLiveTiles);
    }
    assert.equal(Math.max(...swept), MAX_LIVE_TILES, `peak per zoom: ${swept.join(",")}`);
  });

  void it("renders anyway when the cache throws", async () => {
    const broken: GeoPdfTileScope = {
      get: async () => {
        throw new Error("cache read failed");
      },
      set: async () => {
        throw new Error("cache write failed");
      },
    };
    const { renderer } = a1Renderer({ cache: broken });
    const tiles = tileCover(13);
    const first = tiles[0];
    assert.ok(first);
    const bytes = await renderer.render(13, first.x, first.y);
    assert.ok(bytes.byteLength > 0);
    assert.equal(renderer.stats.rendered, 1);
    assert.ok(renderer.stats.cacheErrors >= 1, "the failure must be counted, not hidden");
  });

  void it("does not let one project's cache answer for another", async () => {
    const { cache } = store();
    const tiles = tileCover(13);
    const first = tiles[0];
    assert.ok(first);
    const writer = a1Renderer({ cache: cache.scope(HASH_A) });
    await writer.renderer.render(13, first.x, first.y);

    const other = a1Renderer({ cache: cache.scope(HASH_B) });
    await other.renderer.render(13, first.x, first.y);
    assert.equal(other.renderer.stats.rendered, 1, "project B must render its own tile");
    assert.equal(other.renderer.stats.persistentHits, 0);
  });
});
