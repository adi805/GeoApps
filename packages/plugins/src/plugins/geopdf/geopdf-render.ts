/**
 * Render GeoPDF → MapLibre raster tiles.
 *
 * The page is never drawn into one canvas. Each `geopdf://` tile request is
 * rendered from the PDF at the scale that zoom needs, through
 * {@link GeoPdfTileRenderer}, and MapLibre composes the tiles. That keeps every
 * canvas at or below `MAX_CANVAS_SIDE` and every texture at `TILE_SIZE`, which
 * is what an Android WebView can survive (issue #8).
 */
import { addProtocol, type RequestParameters } from "maplibre-gl";
import * as pdfjs from "pdfjs-dist";
import type { GeoLibreAppAPI } from "../../types";
import { firstGeoreferencedPage, parseGeoPdfDocument, type GeoPdfPage } from "./geopdf-parser";
import {
  GeoPdfTileRenderer,
  MAX_RENDER_SCALE,
  TILE_SIZE,
  pageToMercatorAffine,
  type CanvasEncoder,
  type RegionRasterizer,
} from "./geopdf-tiles";

/** MapLibre protocol scheme for GeoPDF tiles. */
export const GEOPDF_PROTOCOL = "geopdf";

/** Renderers by content hash, so a saved project can re-register its own. */
const renderers = new Map<string, GeoPdfTileRenderer>();
let registered = false;

/** A tile set registered for one PDF. */
export interface GeoPdfTileSetInfo {
  /** SHA-256 of the PDF bytes, hex. The tile URL carries it. */
  hash: string;
  page: GeoPdfPage;
  renderer: GeoPdfTileRenderer;
}

/** Options for {@link addGeoPdfToMap}. */
export interface GeoPdfImportOptions {
  /** Layer name. Defaults to the file name without `.pdf`. */
  name?: string;
  /** Absolute path the file was read from, so a saved project can reload it. */
  localPath?: string;
  /** Insert the layer beneath this existing layer. */
  beforeId?: string;
  /** Fit the map to the sheet after adding it. */
  zoomTo?: boolean;
}

/**
 * Register the `geopdf://` protocol with MapLibre. Idempotent, and safe to call
 * before any tile set exists: the handler resolves the set per request.
 */
export function registerGeoPdfProtocol(): void {
  if (registered) return;
  addProtocol(GEOPDF_PROTOCOL, async (params: RequestParameters, controller: AbortController) => {
    const request = parseTileUrl(params.url);
    if (!request) throw new Error(`Invalid GeoPDF tile URL: ${params.url}`);
    const renderer = renderers.get(request.hash);
    if (!renderer) {
      throw new Error(`The GeoPDF tile set "${request.hash}" is not loaded.`);
    }
    return { data: await renderer.render(request.z, request.x, request.y, controller.signal) };
  });
  registered = true;
}

/** Parse `geopdf://<hash>/<z>/<x>/<y>`. */
export function parseTileUrl(
  url: string,
): { hash: string; z: number; x: number; y: number } | null {
  const match = /^geopdf:\/\/([0-9a-f]+)\/(\d+)\/(\d+)\/(\d+)$/i.exec(url.trim());
  if (!match) return null;
  return {
    hash: match[1].toLowerCase(),
    z: Number(match[2]),
    x: Number(match[3]),
    y: Number(match[4]),
  };
}

/** Hex SHA-256 of the PDF bytes; the tile key the issue asks for. */
export async function hashPdfBytes(data: ArrayBuffer | Uint8Array): Promise<string> {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data);
  // Copy into a plain ArrayBuffer-backed view: `crypto.subtle.digest` rejects
  // the `ArrayBufferLike` (possibly shared) that a caller's view may carry.
  const bytes = new Uint8Array(view.byteLength);
  bytes.set(view);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Register a tile set without adding a layer, e.g. when a saved project is
 * reopened and its `geopdf://` URLs have to resolve again.
 *
 * @param file - The PDF, re-read from the recorded path.
 * @param expectedHash - The hash the saved layer already carries.
 * @returns The tile set, or null when the file is no longer georeferenced.
 */
export async function registerGeoPdfTileSet(
  file: File,
  expectedHash?: string,
): Promise<GeoPdfTileSetInfo | null> {
  const data = await file.arrayBuffer();
  const page = await resolvePage(data);
  if (!page) return null;
  const hash = expectedHash ?? (await hashPdfBytes(data));
  const existing = renderers.get(hash);
  if (existing) return { hash, page, renderer: existing };
  const renderer = createRenderer(data, page);
  renderers.set(hash, renderer);
  registerGeoPdfProtocol();
  return { hash, page, renderer };
}

/**
 * Import a GeoPDF and add it to the map as a tiled raster layer.
 *
 * @param app - The GeoLibre app API; `addTileLayer` is required.
 * @param file - The PDF the host read.
 * @param options - Name, path and placement.
 * @returns The store layer id.
 * @throws When the PDF carries no usable georeference, or the host cannot add
 *   tile layers.
 */
export async function addGeoPdfToMap(
  app: GeoLibreAppAPI,
  file: File,
  options: GeoPdfImportOptions = {},
): Promise<string> {
  if (!app.addTileLayer) {
    throw new Error("This build cannot add GeoPDF layers: the tile layer API is unavailable.");
  }
  const data = await file.arrayBuffer();
  const parsed = await parseGeoPdfDocument(data);
  const page = firstGeoreferencedPage(parsed);
  if (!page || !page.affineWgs84 || !page.bounds) {
    throw new Error(importFailureMessage(parsed.status, parsed.message));
  }
  const hash = await hashPdfBytes(data);
  if (!renderers.has(hash)) {
    renderers.set(hash, createRenderer(data, page));
  }
  registerGeoPdfProtocol();

  const bounds: [number, number, number, number] = [
    page.bounds.west,
    page.bounds.south,
    page.bounds.east,
    page.bounds.north,
  ];
  const name = options.name ?? file.name.replace(/\.pdf$/i, "");
  const layerId = app.addTileLayer(name, `${GEOPDF_PROTOCOL}://${hash}/{z}/{x}/{y}`, {
    tileSize: TILE_SIZE,
    bounds,
    minzoom: 0,
    maxzoom: maxZoomFor(page),
    metadata: {
      geopdfFileHash: hash,
      geopdfPage: page.index,
      geopdfSource: page.source,
      ...(options.localPath ? { localFilePath: options.localPath } : {}),
    },
    ...(options.beforeId ? { beforeLayerId: options.beforeId } : {}),
  });
  if (options.zoomTo) app.fitBounds?.(bounds);
  return layerId;
}

/** Whether a tile set is currently registered. */
export function hasGeoPdfTileSet(hash: string): boolean {
  return renderers.has(hash);
}

/** Drop a tile set and its cached tiles. */
export function releaseGeoPdfTileSet(hash: string): void {
  renderers.get(hash)?.clear();
  renderers.delete(hash);
}

function importFailureMessage(status: string, detail: string | null): string {
  if (status === "encrypted") {
    return (
      "This PDF is encrypted, so its georeferencing cannot be read. " +
      "Remove the password and try again."
    );
  }
  if (status === "unsupported-crs") {
    return `This PDF is georeferenced in a coordinate system GeoLibre cannot reproject${
      detail ? ` (${detail})` : ""
    }. Convert it to GeoTIFF or to WGS84.`;
  }
  if (status === "unreadable") {
    return "This file is not a readable PDF.";
  }
  return (
    "This PDF is not a GeoPDF or carries no georeferencing. Export it from Avenza, " +
    "ArcMap or another GIS with georeferencing embedded, or convert it to GeoTIFF."
  );
}

/** Highest zoom whose render scale still adds detail. */
function maxZoomFor(page: GeoPdfPage): number {
  if (!page.bounds) return 0;
  const west = (page.bounds.west + 180) / 360;
  const east = (page.bounds.east + 180) / 360;
  const mercatorWidth = Math.max(1e-9, Math.abs(east - west));
  const limit = Math.log2((MAX_RENDER_SCALE * page.width) / (TILE_SIZE * mercatorWidth));
  if (!Number.isFinite(limit)) return 0;
  return Math.max(0, Math.min(18, Math.floor(limit)));
}

async function resolvePage(data: ArrayBuffer): Promise<GeoPdfPage | null> {
  const parsed = await parseGeoPdfDocument(data);
  const page = firstGeoreferencedPage(parsed);
  return page && page.affineWgs84 && page.bounds ? page : null;
}

function createRenderer(data: ArrayBuffer, page: GeoPdfPage): GeoPdfTileRenderer {
  const affineWgs84 = page.affineWgs84;
  if (!affineWgs84) throw new Error("The GeoPDF page carries no WGS84 georeference.");
  const affine = pageToMercatorAffine(affineWgs84, page.width, page.height);
  if (!affine) throw new Error("The GeoPDF georeference is degenerate and cannot be tiled.");
  return new GeoPdfTileRenderer({
    pageWidth: page.width,
    pageHeight: page.height,
    pageAffine: affine,
    rasterize: createPdfRasterizer(data, page.index),
    createCanvas: (width, height) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    encode: encodePng,
  });
}

/**
 * Rasterize a page region through `pdfjs-dist`.
 *
 * The viewport is built at the region's scale and offset so the canvas only
 * ever covers that region: asking pdf.js for the whole page at a high zoom
 * would size its internal surfaces by the page, which is the allocation this
 * issue exists to remove.
 */
function createPdfRasterizer(data: ArrayBuffer, pageIndex: number): RegionRasterizer {
  let documentPromise: Promise<pdfjs.PDFDocumentProxy> | null = null;
  const open = (): Promise<pdfjs.PDFDocumentProxy> => {
    // `getDocument` may transfer the buffer to its worker, so hand it a copy:
    // the same bytes are still needed for the hash and for a later re-register.
    if (!documentPromise) {
      const created = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
      documentPromise = created;
      return created;
    }
    return documentPromise;
  };
  return async ({ pageRect, scale, canvas, signal }) => {
    if (signal?.aborted) throw abortNamed();
    const document_ = await open();
    const page = await document_.getPage(pageIndex + 1);
    const viewport = page.getViewport({
      scale,
      rotation: 0,
      offsetX: -pageRect.x * scale,
      offsetY: -pageRect.y * scale,
    });
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not get a 2D context for a GeoPDF page region.");
    const parameters = { canvas, canvasContext: context, viewport } as unknown as Parameters<
      typeof page.render
    >[0];
    const task = page.render(parameters);
    const onAbort = (): void => task.cancel();
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      await task.promise;
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
    if (signal?.aborted) throw abortNamed();
  };
}

function abortNamed(): Error {
  const error = new Error("The GeoPDF page render was aborted.");
  error.name = "AbortError";
  return error;
}

const encodePng: CanvasEncoder = async (canvas) => {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) throw new Error("Could not encode a GeoPDF tile as PNG.");
  return blob.arrayBuffer();
};
