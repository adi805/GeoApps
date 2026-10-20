import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Affine6 } from "./geopdf-affine";
import {
  GeoPdfTileRenderer,
  MAX_CANVAS_SIDE,
  MAX_LIVE_CANVASES,
  MAX_LIVE_TILES,
  TILE_SIZE,
  latToMercatorY,
  lonToMercatorX,
  mercatorXToLon,
  mercatorYToLat,
  pageToMercatorAffine,
  planTile,
  type CanvasFactory,
  type TileRendererOptions,
} from "./geopdf-tiles";

/**
 * An A1 sheet as issue #8 measures it: 2384 x 3370 points, which the old
 * single-canvas renderer turned into 4768 x 6740 px at `scale = 2`.
 */
const A1_WIDTH = 2384;
const A1_HEIGHT = 3370;

/** A 0.2 deg square of ground, so the sheet covers a realistic extent. */
const WEST = 106.7;
const EAST = 106.9;
const SOUTH = -6.3;
const NORTH = -6.1;

/** Page points → WGS84 for the synthetic sheet: no rotation, y down. */
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

interface FakeCanvas {
  width: number;
  height: number;
  getContext: (kind: "2d") => Record<string, unknown> | null;
}

interface CanvasLog {
  peakLive: number;
  maxSide: number;
  created: number;
}

/** A canvas factory that records how many canvases exist at once. */
function trackingCanvasFactory(): { factory: CanvasFactory; log: CanvasLog } {
  const log: CanvasLog = { peakLive: 0, maxSide: 0, created: 0 };
  let live = 0;
  const factory = (width: number, height: number): HTMLCanvasElement => {
    live += 1;
    log.created += 1;
    log.peakLive = Math.max(log.peakLive, live);
    log.maxSide = Math.max(log.maxSide, width, height);
    const canvas: FakeCanvas = {
      width,
      height,
      getContext: () => ({
        clearRect: () => undefined,
        setTransform: () => undefined,
        drawImage: () => undefined,
      }),
    };
    return canvas as unknown as HTMLCanvasElement;
  };
  // A released canvas is zeroed by the renderer; mirror that by watching the
  // property so the live count stays honest.
  const wrapped = (width: number, height: number): HTMLCanvasElement => {
    const canvas = factory(width, height);
    let released = false;
    Object.defineProperty(canvas, "width", {
      get: () => (released ? 0 : width),
      set: (value: number) => {
        if (value === 0 && !released) {
          released = true;
          live -= 1;
        }
      },
    });
    Object.defineProperty(canvas, "height", {
      get: () => height,
      set: () => undefined,
    });
    return canvas;
  };
  return { factory: wrapped as CanvasFactory, log };
}

function rendererOptions(
  factory: CanvasFactory,
  overrides: Partial<TileRendererOptions> = {},
): TileRendererOptions {
  const affine = pageToMercatorAffine(A1_AFFINE, A1_WIDTH, A1_HEIGHT);
  assert.ok(affine, "the synthetic A1 georeference must fit an affine");
  return {
    pageWidth: A1_WIDTH,
    pageHeight: A1_HEIGHT,
    pageAffine: affine,
    rasterize: async () => undefined,
    createCanvas: factory,
    encode: async () => new ArrayBuffer(8),
    ...overrides,
  };
}

void describe("geopdf tile geometry", () => {
  void it("keeps every A1 canvas at or below the 1024 px ceiling", () => {
    const affine = pageToMercatorAffine(A1_AFFINE, A1_WIDTH, A1_HEIGHT);
    assert.ok(affine);
    let planned = 0;
    for (let z = 0; z <= 4; z += 1) {
      for (const { x, y } of tileCover(z)) {
        const plan = planTile(affine, A1_WIDTH, A1_HEIGHT, z, x, y);
        if (!plan) continue;
        planned += 1;
        assert.ok(
          plan.renderWidth <= MAX_CANVAS_SIDE && plan.renderHeight <= MAX_CANVAS_SIDE,
          `z${z}/${x}/${y} would create a ${plan.renderWidth}x${plan.renderHeight} canvas`,
        );
        assert.ok(plan.renderWidth <= TILE_SIZE && plan.renderHeight <= TILE_SIZE);
        assert.ok(plan.scale > 0, "a planned tile must ask for a positive scale");
      }
    }
    assert.ok(planned > 0, "the tile cover must intersect the sheet");
  });

  void it("maps the sheet corners back through Mercator", () => {
    const affine = pageToMercatorAffine(A1_AFFINE, A1_WIDTH, A1_HEIGHT);
    assert.ok(affine);
    const [a, b, c, d, e, f] = affine;
    const corner = (px: number, py: number): [number, number] => [
      mercatorXToLon(a * px + c * py + e),
      mercatorYToLat(b * px + d * py + f),
    ];
    const [west, north] = corner(0, 0);
    const [east, south] = corner(A1_WIDTH, A1_HEIGHT);
    assert.ok(Math.abs(west - WEST) < 1e-6, `west ${west}`);
    assert.ok(Math.abs(north - NORTH) < 1e-6, `north ${north}`);
    assert.ok(Math.abs(east - EAST) < 1e-6, `east ${east}`);
    assert.ok(Math.abs(south - SOUTH) < 1e-6, `south ${south}`);
  });

  void it("rejects a tile outside the sheet", () => {
    const affine = pageToMercatorAffine(A1_AFFINE, A1_WIDTH, A1_HEIGHT);
    assert.ok(affine);
    assert.equal(planTile(affine, A1_WIDTH, A1_HEIGHT, 12, 0, 0), null);
  });
});

void describe("geopdf tile renderer memory budget", () => {
  void it("holds at most two tiles and two canvases across zoom 0 to 4", async () => {
    const { factory, log } = trackingCanvasFactory();
    const renderer = new GeoPdfTileRenderer(rendererOptions(factory));
    for (let z = 0; z <= 4; z += 1) {
      for (const { x, y } of tileCover(z)) {
        await renderer.render(z, x, y);
      }
    }
    const stats = renderer.stats;
    assert.ok(
      stats.peakLiveTiles <= MAX_LIVE_TILES,
      `peak live tiles ${stats.peakLiveTiles} exceeds ${MAX_LIVE_TILES}`,
    );
    assert.ok(
      stats.peakLiveCanvases <= MAX_LIVE_CANVASES,
      `peak live canvases ${stats.peakLiveCanvases} exceeds ${MAX_LIVE_CANVASES}`,
    );
    assert.ok(
      log.peakLive <= MAX_LIVE_CANVASES,
      `the canvas factory saw ${log.peakLive} canvases alive at once`,
    );
    assert.ok(
      stats.maxCanvasSide <= MAX_CANVAS_SIDE,
      `largest canvas side ${stats.maxCanvasSide} exceeds ${MAX_CANVAS_SIDE}`,
    );
    assert.ok(renderer.liveTiles <= MAX_LIVE_TILES);
  });

  void it("holds the same budget at zoom 12", async () => {
    const { factory, log } = trackingCanvasFactory();
    const renderer = new GeoPdfTileRenderer(rendererOptions(factory));
    for (const { x, y } of tileCover(12)) {
      await renderer.render(12, x, y);
    }
    const stats = renderer.stats;
    assert.ok(stats.rendered > 0, "zoom 12 must have rendered at least one tile");
    assert.ok(stats.peakLiveTiles <= MAX_LIVE_TILES);
    assert.ok(stats.peakLiveCanvases <= MAX_LIVE_CANVASES);
    assert.ok(log.peakLive <= MAX_LIVE_CANVASES);
    assert.ok(stats.maxCanvasSide <= MAX_CANVAS_SIDE);
  });

  void it("serves a repeated tile from the cache instead of re-rendering", async () => {
    const { factory } = trackingCanvasFactory();
    const renderer = new GeoPdfTileRenderer(rendererOptions(factory));
    // Pick a tile from the middle of the sheet's cover: an edge tile can still
    // miss the sheet once the aligned bounding box is intersected.
    const cover = tileCover(13);
    assert.ok(cover.length > 0, "zoom 13 must cover the sheet");
    const middle = cover[Math.floor(cover.length / 2)];
    assert.ok(middle, "the middle of the cover must exist");
    const first = await renderer.render(13, middle.x, middle.y);
    const second = await renderer.render(13, middle.x, middle.y);
    assert.equal(renderer.stats.rendered, 1);
    assert.equal(renderer.stats.cacheHits, 1);
    assert.equal(first.byteLength, second.byteLength);
  });

  void it("aborts before touching the page", async () => {
    const { factory } = trackingCanvasFactory();
    let rasterized = 0;
    const renderer = new GeoPdfTileRenderer(
      rendererOptions(factory, {
        rasterize: async () => {
          rasterized += 1;
        },
      }),
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(() => renderer.render(12, 3275, 2140, controller.signal), {
      name: "AbortError",
    });
    assert.equal(rasterized, 0);
  });

  void it("answers a tile outside the sheet with a transparent tile", async () => {
    const { factory } = trackingCanvasFactory();
    let rasterized = 0;
    const renderer = new GeoPdfTileRenderer(
      rendererOptions(factory, {
        rasterize: async () => {
          rasterized += 1;
        },
      }),
    );
    const tile = await renderer.render(12, 0, 0);
    assert.ok(tile.byteLength > 0);
    assert.equal(rasterized, 0);
    assert.equal(renderer.stats.rendered, 0);
  });
});
