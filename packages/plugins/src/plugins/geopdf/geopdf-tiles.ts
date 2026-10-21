/**
 * Tile geometry and memory budget for the GeoPDF renderer.
 *
 * A georeferenced page used to be rendered into one canvas at `scale = 2`. An
 * A1 sheet that way is about 4768 x 6740 px, roughly 128 MB as RGBA, and the
 * `image` source MapLibre builds for it wants one texture for the whole sheet,
 * which the device caps at `MAX_TEXTURE_SIZE` (often 4096). On an Android
 * WebView the allocation kills the process before the texture limit is even
 * reached (issue #8).
 *
 * This module turns the page into slippy-map tiles instead: every tile is
 * `TILE_SIZE` square, rendered from the PDF at the scale the current zoom asks
 * for, and only `MAX_LIVE_TILES` encoded tiles are kept. Everything here is
 * arithmetic over an affine, so the grid can be checked without a browser, a
 * PDF or a DOM.
 */
import { applyAffine, fitAffine, type Affine6, type ControlPoint } from "./geopdf-affine";
import type { GeoPdfTileScope } from "./geopdf-tile-cache";

/** Tile edge in pixels. MapLibre's raster source takes it as `tileSize`. */
export const TILE_SIZE = 512;

/** Hard ceiling for any canvas this module creates, per issue #8. */
export const MAX_CANVAS_SIDE = 1024;

/** Encoded tiles kept at once. Anything else is re-rendered on demand. */
export const MAX_LIVE_TILES = 2;

/**
 * Canvases that may exist at once: the reusable scratch canvas plus the tile
 * being encoded. The renderer is single-flight, so these are the only two.
 */
export const MAX_LIVE_CANVASES = 2;

/**
 * Upper bound on the render scale. Past this the PDF carries no more detail,
 * and a deeper zoom upsamples the tile it already has.
 */
export const MAX_RENDER_SCALE = 8;

const DEG = Math.PI / 180;
const MAX_MERCATOR_LAT = 85.05112877980659;

/** A rectangle in page points (top-left origin). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** How one tile maps onto the page. */
export interface TilePlan {
  z: number;
  x: number;
  y: number;
  /** Page-point rectangle the tile shows, clamped to the page. */
  pageRect: Rect;
  /** Page points → scratch-canvas pixels. */
  scale: number;
  /** Scratch canvas size. Never above {@link MAX_CANVAS_SIDE}. */
  renderWidth: number;
  renderHeight: number;
  /** Page points → tile pixels, applied before drawing the scratch canvas. */
  transform: Affine6;
}

/** Longitude → Web Mercator world x in [0, 1]. */
export function lonToMercatorX(lon: number): number {
  return (lon + 180) / 360;
}

/** Latitude → Web Mercator world y in [0, 1], clamped to the usable band. */
export function latToMercatorY(lat: number): number {
  const clamped = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const sin = Math.sin(clamped * DEG);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

/** Web Mercator world x → longitude. */
export function mercatorXToLon(x: number): number {
  return x * 360 - 180;
}

/** Web Mercator world y → latitude. */
export function mercatorYToLat(y: number): number {
  return (2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) / DEG;
}

/** Inverse of a 6-parameter affine, or null when it is singular. */
export function invertAffine(affine: Affine6): Affine6 | null {
  const [a, b, c, d, e, f] = affine;
  const det = a * d - b * c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-18) return null;
  const ia = d / det;
  const ib = -b / det;
  const ic = -c / det;
  const id = a / det;
  return [ia, ib, ic, id, -(ia * e + ic * f), -(ib * e + id * f)];
}

/**
 * Fit the page-points → Web-Mercator affine.
 *
 * The georeference is linear in degrees, while Mercator is not linear in
 * latitude. Fitting over the four page corners reproduces exactly what an
 * `image` source does with the same sheet, so tiled and untiled rendering
 * place the page the same way.
 *
 * @param affineWgs84 - Page points → WGS84 degrees, from the parser.
 * @param pageWidth - Page width in points.
 * @param pageHeight - Page height in points.
 * @returns The fitted affine, or null when the corners are degenerate.
 */
export function pageToMercatorAffine(
  affineWgs84: Affine6,
  pageWidth: number,
  pageHeight: number,
): Affine6 | null {
  const corners: Array<[number, number]> = [
    [0, 0],
    [pageWidth, 0],
    [pageWidth, pageHeight],
    [0, pageHeight],
  ];
  const points: ControlPoint[] = corners.map(([px, py]) => {
    const [lon, lat] = applyAffine(affineWgs84, px, py);
    return { px, py, X: lonToMercatorX(lon), Y: latToMercatorY(lat) };
  });
  return fitAffine(points);
}

/**
 * Plan the render for one tile.
 *
 * The tile's Mercator rectangle is mapped back into page points; the axis
 * aligned bounding box of that quad is what gets rendered, and the resulting
 * image is drawn through the full affine, so a rotated map keeps its rotation.
 *
 * @returns The plan, or null when the tile does not intersect the page.
 */
export function planTile(
  pageAffine: Affine6,
  pageWidth: number,
  pageHeight: number,
  z: number,
  x: number,
  y: number,
): TilePlan | null {
  if (z < 0 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) return null;
  const inverse = invertAffine(pageAffine);
  if (!inverse) return null;

  const span = 1 / 2 ** z;
  const left = x * span;
  const top = y * span;
  const corners = [
    [left, top],
    [left + span, top],
    [left + span, top + span],
    [left, top + span],
  ].map(([mx, my]) => applyAffine(inverse, mx, my));

  const xs = corners.map((corner) => corner[0]);
  const ys = corners.map((corner) => corner[1]);
  const minX = Math.max(0, Math.min(...xs));
  const maxX = Math.min(pageWidth, Math.max(...xs));
  const minY = Math.max(0, Math.min(...ys));
  const maxY = Math.min(pageHeight, Math.max(...ys));
  if (!(maxX > minX) || !(maxY > minY)) return null;

  const width = maxX - minX;
  const height = maxY - minY;
  // Fill the tile without ever exceeding it, and stop scaling once the page
  // runs out of detail.
  const scale = Math.min(TILE_SIZE / width, TILE_SIZE / height, MAX_RENDER_SCALE);
  const renderWidth = Math.min(MAX_CANVAS_SIDE, Math.max(1, Math.ceil(width * scale)));
  const renderHeight = Math.min(MAX_CANVAS_SIDE, Math.max(1, Math.ceil(height * scale)));

  const [a, b, c, d, e, f] = pageAffine;
  const world = TILE_SIZE * 2 ** z;
  return {
    z,
    x,
    y,
    pageRect: { x: minX, y: minY, width, height },
    scale,
    renderWidth,
    renderHeight,
    transform: [a * world, b * world, c * world, d * world, e * world - x * TILE_SIZE, f * world - y * TILE_SIZE],
  };
}

/** Creates the canvas a tile is drawn into. Injected so tests need no DOM. */
export type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;

/** Encodes a finished tile canvas. Injected so tests need no image encoder. */
export type CanvasEncoder = (canvas: HTMLCanvasElement) => Promise<ArrayBuffer>;

/** Renders a page region into a canvas. */
export type RegionRasterizer = (request: {
  pageRect: Rect;
  scale: number;
  canvas: HTMLCanvasElement;
  signal?: AbortSignal;
}) => Promise<void>;

/** What the renderer measured, for the memory test and for diagnostics. */
export interface TileStats {
  /** Largest number of encoded tiles held at once. */
  peakLiveTiles: number;
  /** Largest number of canvases alive at once. */
  peakLiveCanvases: number;
  /** Largest canvas edge created, in pixels. */
  maxCanvasSide: number;
  /** Tiles rendered from the page (cache misses). */
  rendered: number;
  /** Tiles served from either cache. */
  cacheHits: number;
  /** Tiles served from the persistent cache after a restart. */
  persistentHits: number;
  /** Tiles written to the persistent cache. */
  persistentWrites: number;
  /** Persistent cache failures. A failure never fails a tile. */
  cacheErrors: number;
}

export interface TileRendererOptions {
  pageWidth: number;
  pageHeight: number;
  /** Page points → Web Mercator, from {@link pageToMercatorAffine}. */
  pageAffine: Affine6;
  rasterize: RegionRasterizer;
  createCanvas: CanvasFactory;
  encode: CanvasEncoder;
  /**
   * Persistent tiles for this page, keyed by zoom and index. Absent keeps the
   * renderer memory-only, which is what the geometry tests use.
   */
  cache?: GeoPdfTileScope;
}

function abortError(): Error {
  const error = new Error("The GeoPDF tile render was aborted.");
  error.name = "AbortError";
  return error;
}

/**
 * Renders one page on demand, one tile at a time.
 *
 * Renders are serialized: a tile needs a scratch canvas and a tile canvas at
 * the same time, so running two renders concurrently would put four canvases
 * on the heap. The queue is what keeps {@link MAX_LIVE_CANVASES} true, and it
 * also keeps a fast pan from stacking work on the PDF worker.
 */
export class GeoPdfTileRenderer {
  private readonly options: TileRendererOptions;
  private readonly cache = new Map<string, ArrayBuffer>();
  private scratch: HTMLCanvasElement | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private liveCanvases = 0;
  private emptyTile: Promise<ArrayBuffer> | null = null;
  private readonly counters: TileStats = {
    peakLiveTiles: 0,
    peakLiveCanvases: 0,
    maxCanvasSide: 0,
    rendered: 0,
    cacheHits: 0,
    persistentHits: 0,
    persistentWrites: 0,
    cacheErrors: 0,
  };

  constructor(options: TileRendererOptions) {
    this.options = options;
  }

  /** A snapshot of the renderer's memory and work counters. */
  get stats(): TileStats {
    return { ...this.counters };
  }

  /** Encoded tiles currently held. */
  get liveTiles(): number {
    return this.cache.size;
  }

  /**
   * Render one tile.
   *
   * @param z - Tile zoom.
   * @param x - Tile column.
   * @param y - Tile row.
   * @param signal - Aborted when MapLibre drops the tile, e.g. after a pan.
   * @returns PNG bytes.
   */
  async render(z: number, x: number, y: number, signal?: AbortSignal): Promise<ArrayBuffer> {
    const key = `${z}/${x}/${y}`;
    const hit = this.cache.get(key);
    if (hit) {
      // Refresh recency: Map is insertion-ordered.
      this.cache.delete(key);
      this.cache.set(key, hit);
      this.counters.cacheHits += 1;
      return hit;
    }
    if (signal?.aborted) throw abortError();
    // The persistent lookup is I/O, not canvas work, so it runs before the
    // render queue: a warm cache answers while another tile is still drawing.
    const stored = await this.readPersisted(z, x, y);
    if (stored) {
      this.remember(key, stored);
      this.counters.persistentHits += 1;
      this.counters.cacheHits += 1;
      return stored;
    }
    if (signal?.aborted) throw abortError();
    return this.runExclusive(() => this.renderUncached(key, z, x, y, signal));
  }

  /** Drop every cached tile. */
  clear(): void {
    this.cache.clear();
    this.scratch = null;
    this.emptyTile = null;
  }

  private runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async renderUncached(
    key: string,
    z: number,
    x: number,
    y: number,
    signal?: AbortSignal,
  ): Promise<ArrayBuffer> {
    if (signal?.aborted) throw abortError();
    const plan = planTile(
      this.options.pageAffine,
      this.options.pageWidth,
      this.options.pageHeight,
      z,
      x,
      y,
    );
    // A tile outside the page still has to answer, or MapLibre logs a load
    // error for every tile the bounds rectangle covers but the sheet does not.
    if (!plan) return this.transparentTile();

    const scratch = this.scratchCanvas(plan.renderWidth, plan.renderHeight);
    await this.options.rasterize({
      pageRect: plan.pageRect,
      scale: plan.scale,
      canvas: scratch,
      ...(signal ? { signal } : {}),
    });
    if (signal?.aborted) throw abortError();

    const tile = this.trackCanvas(this.options.createCanvas(TILE_SIZE, TILE_SIZE));
    try {
      const context = tile.getContext("2d");
      if (!context) throw new Error("Could not get a 2D context for a GeoPDF tile.");
      context.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
      const [a, b, c, d, e, f] = plan.transform;
      context.setTransform(a, b, c, d, e, f);
      context.drawImage(
        scratch,
        plan.pageRect.x,
        plan.pageRect.y,
        plan.pageRect.width,
        plan.pageRect.height,
      );
      const encoded = await this.options.encode(tile);
      this.remember(key, encoded);
      this.counters.rendered += 1;
      // Await the write before answering: a project closed right after a tile
      // is drawn must not lose that tile, and the queue keeps writes ordered.
      await this.persist(z, x, y, encoded);
      return encoded;
    } finally {
      this.releaseCanvas(tile);
    }
  }

  private scratchCanvas(width: number, height: number): HTMLCanvasElement {
    if (this.scratch && this.scratch.width === width && this.scratch.height === height) {
      const context = this.scratch.getContext("2d");
      context?.clearRect(0, 0, width, height);
      return this.scratch;
    }
    if (this.scratch) this.releaseCanvas(this.scratch);
    this.scratch = this.trackCanvas(this.options.createCanvas(width, height));
    return this.scratch;
  }

  private trackCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
    this.liveCanvases += 1;
    this.counters.peakLiveCanvases = Math.max(this.counters.peakLiveCanvases, this.liveCanvases);
    this.counters.maxCanvasSide = Math.max(
      this.counters.maxCanvasSide,
      canvas.width,
      canvas.height,
    );
    return canvas;
  }

  private releaseCanvas(canvas: HTMLCanvasElement): void {
    this.liveCanvases = Math.max(0, this.liveCanvases - 1);
    // Drop the backing store now rather than at the next GC: on a WebView the
    // allocation is what kills the process, and zeroing the size frees it.
    canvas.width = 0;
    canvas.height = 0;
  }

  private remember(key: string, encoded: ArrayBuffer): void {
    this.cache.set(key, encoded);
    while (this.cache.size > MAX_LIVE_TILES) {
      const oldest = this.cache.keys().next();
      if (oldest.done) break;
      this.cache.delete(oldest.value);
    }
    this.counters.peakLiveTiles = Math.max(this.counters.peakLiveTiles, this.cache.size);
  }

  /** Read a tile from the persistent cache; a failure reads as a miss. */
  private async readPersisted(z: number, x: number, y: number): Promise<ArrayBuffer | null> {
    if (!this.options.cache) return null;
    try {
      return await this.options.cache.get(z, x, y);
    } catch {
      this.counters.cacheErrors += 1;
      return null;
    }
  }

  /** Write a tile to the persistent cache; a failure never fails the tile. */
  private async persist(z: number, x: number, y: number, encoded: ArrayBuffer): Promise<void> {
    if (!this.options.cache) return;
    try {
      await this.options.cache.set(z, x, y, encoded);
      this.counters.persistentWrites += 1;
    } catch {
      this.counters.cacheErrors += 1;
    }
  }

  private transparentTile(): Promise<ArrayBuffer> {
    this.emptyTile ??= (async () => {
      const canvas = this.trackCanvas(this.options.createCanvas(TILE_SIZE, TILE_SIZE));
      try {
        return await this.options.encode(canvas);
      } finally {
        this.releaseCanvas(canvas);
      }
    })().catch((error: unknown) => {
      this.emptyTile = null;
      throw error;
    });
    return this.emptyTile;
  }
}
