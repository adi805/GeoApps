/**
 * GeoPDF georeferencing parser.
 *
 * Reads the page dictionaries that actually carry georeferencing — `/VP` →
 * `/Measure` (Adobe/ISO 32000-2, ESRI) and `/LGIDict` (OGC Best Practice,
 * TerraGo) — through `pdf-lib`, because `pdfjs-dist` exposes rendered pixels
 * and Info/XMP metadata but no public API for raw dictionaries.
 *
 * Every page is treated as its own map, the way Avenza does it: a single PDF
 * can hold several maps, and each one has its own viewport and CRS.
 *
 * Rendering stays out of this module; `geopdf-render.ts` keeps using
 * `pdfjs-dist` for pixels.
 */
import { PDFDocument } from "pdf-lib";
import type { Affine6 } from "./geopdf-affine";
import {
  georefFromLgiDict,
  georefFromViewport,
  renderedPageSize,
  type GeoBounds,
  type LngLat,
  type PageGeoref,
} from "./geopdf-derive";
import {
  readLgiDicts,
  readPageGeometry,
  readViewports,
  type PageGeometry,
  type ViewportDict,
} from "./geopdf-structure";

/**
 * Outcome of parsing a PDF.
 *
 * - `ok`: at least one page carries a usable georeference.
 * - `no-georeference`: readable PDF with no `/VP` and no `/LGIDict` on any
 *   page. Not an error: `GeoreferencerDialog` can place control points.
 * - `unsupported-crs`: dictionaries exist but the CRS cannot be resolved.
 *   Refusing beats silently treating projected metres as degrees.
 * - `encrypted`: the document is encrypted, so dictionary values cannot be
 *   trusted (string entries come back as ciphertext).
 * - `unreadable`: not a PDF, or the object graph could not be parsed.
 */
export type GeoPdfStatus = "ok" | "no-georeference" | "unsupported-crs" | "encrypted" | "unreadable";

/** Per-page outcome; mirrors the document status without the I/O failures. */
export type GeoPdfPageStatus = "ok" | "no-georeference" | "unsupported-crs";

/** One page of a PDF, georeferenced or not. */
export interface GeoPdfPage {
  /** Zero-based page index, matching `pdfjs-dist` page numbers minus one. */
  index: number;
  /** Page size in points, before `/Rotate`. */
  width: number;
  height: number;
  /** `/Rotate`, normalized to 0, 90, 180 or 270. */
  rotation: number;
  /** Size the renderer will produce, after `/Rotate` and `/UserUnit`. */
  renderedWidth: number;
  renderedHeight: number;
  status: GeoPdfPageStatus;
  /** Which dictionary the georeference came from, when there is one. */
  source: "vp" | "lgidict" | null;
  /** CRS label, e.g. `EPSG:32748`, or `unknown`. */
  crs: string;
  /** Axis-aligned WGS84 extent, or null when the page is not georeferenced. */
  bounds: GeoBounds | null;
  /** Four WGS84 corners, TL/TR/BR/BL. Use these when the map is rotated. */
  corners: LngLat[] | null;
  /** Page points (top-left origin) → source CRS. */
  affine: Affine6 | null;
  /** Page points → WGS84 degrees. */
  affineWgs84: Affine6 | null;
  /** Why the page has no georeference, when `status` is not `ok`. */
  message: string | null;
}

/** Whole-document parse result. */
export interface GeoPdfDocument {
  status: GeoPdfStatus;
  /** Human-readable explanation, always set when `status` is not `ok`. */
  message: string | null;
  encrypted: boolean;
  pageCount: number;
  pages: GeoPdfPage[];
}

/** True when the file carries a PDF header, even if `pdf-lib` rejects the body. */
export function looksLikePdf(data: Uint8Array | ArrayBuffer): boolean {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < 5) return false;
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

function isEncryptionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /encrypted/i.test(message);
}

function emptyPage(
  index: number,
  geometry: PageGeometry,
  status: GeoPdfPageStatus,
  message: string | null,
): GeoPdfPage {
  const size = renderedPageSize(geometry);
  return {
    index,
    width: geometry.width,
    height: geometry.height,
    rotation: geometry.rotation,
    renderedWidth: size.width,
    renderedHeight: size.height,
    status,
    source: null,
    crs: "unknown",
    bounds: null,
    corners: null,
    affine: null,
    affineWgs84: null,
    message,
  };
}

/** Pick the viewport with the largest bounding box, matching GDAL. */
function largestViewport(viewports: ViewportDict[]): ViewportDict | null {
  let best: ViewportDict | null = null;
  let bestArea = -1;
  for (const viewport of viewports) {
    if (!viewport.measure) continue;
    const [x0, y0, x1, y1] = viewport.bbox;
    const area = Math.abs(x1 - x0) * Math.abs(y1 - y0);
    if (area > bestArea) {
      bestArea = area;
      best = viewport;
    }
  }
  return best;
}

function pageFromGeoref(index: number, geometry: PageGeometry, georef: PageGeoref): GeoPdfPage {
  const size = renderedPageSize(geometry);
  return {
    index,
    width: geometry.width,
    height: geometry.height,
    rotation: geometry.rotation,
    renderedWidth: size.width,
    renderedHeight: size.height,
    status: "ok",
    source: georef.source,
    crs: georef.crs.label,
    bounds: georef.bounds,
    corners: georef.corners,
    affine: georef.affine,
    affineWgs84: georef.affineWgs84,
    message: null,
  };
}

/** Parse every page of a PDF and report each one separately. */
export async function parseGeoPdfDocument(data: Uint8Array | ArrayBuffer): Promise<GeoPdfDocument> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  if (!looksLikePdf(bytes)) {
    return {
      status: "unreadable",
      message: "Berkas ini bukan PDF: penanda %PDF- tidak ditemukan.",
      encrypted: false,
      pageCount: 0,
      pages: [],
    };
  }

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: false });
  } catch (error) {
    if (isEncryptionError(error)) {
      return {
        status: "encrypted",
        message: "PDF terenkripsi: kata sandi diperlukan sebelum georeferensi bisa dibaca.",
        encrypted: true,
        pageCount: 0,
        pages: [],
      };
    }
    return {
      status: "unreadable",
      message: `Struktur PDF tidak bisa dibaca: ${error instanceof Error ? error.message : String(error)}`,
      encrypted: false,
      pageCount: 0,
      pages: [],
    };
  }

  const pages: GeoPdfPage[] = [];
  for (let index = 0; index < doc.getPageCount(); index++) {
    const page = doc.getPage(index);
    const geometry = readPageGeometry(page);

    const viewport = largestViewport(readViewports(page));
    if (viewport) {
      const { georef, reason } = georefFromViewport(viewport, geometry);
      if (georef) {
        pages.push(pageFromGeoref(index, geometry, georef));
      } else {
        pages.push(
          emptyPage(
            index,
            geometry,
            "unsupported-crs",
            reason === "degenerate"
              ? "Titik kontrol pada /Measure tidak bisa membentuk transformasi affine."
              : reason === "no-measure"
                ? "Viewport /VP ditemukan tanpa /Measure bertipe /GEO; georeferensi tidak bisa dibaca."
                : "Georeferensi /VP ditemukan, tetapi sistem koordinatnya tidak dikenali.",
          ),
        );
      }
      continue;
    }

    const lgiDicts = readLgiDicts(page);
    if (lgiDicts.length > 0) {
      let resolved: GeoPdfPage | null = null;
      let failure: string | null = null;
      for (const lgi of lgiDicts) {
        const { georef, reason } = georefFromLgiDict(lgi, geometry);
        if (georef) {
          resolved = pageFromGeoref(index, geometry, georef);
          break;
        }
        failure =
          reason === "no-ctm"
            ? "Georeferensi /LGIDict ditemukan tanpa /CTM; pasangan /Registration belum didukung."
            : "Georeferensi /LGIDict ditemukan, tetapi sistem koordinatnya tidak dikenali.";
      }
      pages.push(resolved ?? emptyPage(index, geometry, "unsupported-crs", failure));
      continue;
    }

    pages.push(
      emptyPage(
        index,
        geometry,
        "no-georeference",
        "Halaman ini tidak memuat /VP maupun /LGIDict. Gunakan GeoreferencerDialog untuk menempatkan dua titik kontrol.",
      ),
    );
  }

  const georeferenced = pages.filter((page) => page.status === "ok");
  if (georeferenced.length > 0) {
    return { status: "ok", message: null, encrypted: false, pageCount: pages.length, pages };
  }

  const unsupported = pages.some((page) => page.status === "unsupported-crs");
  return {
    status: unsupported ? "unsupported-crs" : "no-georeference",
    message: unsupported
      ? "PDF ini memuat kamus georeferensi, tetapi sistem koordinatnya tidak bisa diselesaikan."
      : "PDF ini tidak bergeoreferensi. Gunakan GeoreferencerDialog dengan dua titik kontrol.",
    encrypted: false,
    pageCount: pages.length,
    pages,
  };
}

/** First page that carries a usable georeference, if any. */
export function firstGeoreferencedPage(document: GeoPdfDocument): GeoPdfPage | null {
  return document.pages.find((page) => page.status === "ok") ?? null;
}

// ---------------------------------------------------------------------------
// Legacy surface, kept for `geopdf-render.ts` until the tiling work lands (#8).
// ---------------------------------------------------------------------------

export interface GeoPdfInfo {
  width: number;
  height: number;
  /**
   * Affine in Adobe `/A` order: `[x0, xscale, xrot, y0, yrot, yscale]`, i.e.
   * `x = x0 + xscale·px + xrot·py` and `y = y0 + yrot·px + yscale·py`.
   * That is the order `affineToBounds` and the pre-rewrite parser use; the
   * internal `Affine6` order (`a, b, c, d, e, f`) is different, so the
   * conversion happens below.
   */
  affine: [number, number, number, number, number, number];
  crs: string;
  geoOk: boolean;
}

/** Best-effort affine from Info/XMP text; kept for callers that only have text. */
export function parseAffineFromText(text: string): number[] | null {
  const params: Record<string, number> = {};
  const aMatch = text.match(/A(\d)\s*=\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gi);
  if (aMatch && aMatch.length >= 6) {
    for (const match of aMatch) {
      const parts = match.match(/A(\d)\s*=\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i);
      if (parts) params[parts[1]] = Number.parseFloat(parts[2]);
    }
    if (params["0"] !== undefined && params["1"] !== undefined && params["3"] !== undefined) {
      return [params["0"], params["1"], params["2"] ?? 0, params["3"], params["4"] ?? 0, params["5"] ?? 0];
    }
  }
  const ctp = text.match(/CTP\s*:\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i);
  if (ctp) {
    return [Number.parseFloat(ctp[1]), 1, 0, Number.parseFloat(ctp[2]), 0, 1];
  }
  return null;
}

/**
 * Legacy single-page entry point.
 *
 * Returns the first georeferenced page with its WGS84 affine, so the existing
 * renderer keeps working unchanged. New code should call `parseGeoPdfDocument`
 * and handle each page on its own.
 */
export async function parseGeoPdf(data: ArrayBuffer | Uint8Array): Promise<GeoPdfInfo | null> {
  const parsed = await parseGeoPdfDocument(data);
  const page = firstGeoreferencedPage(parsed);
  if (!page) return null;
  const affine = page.affineWgs84 ?? page.affine;
  if (!affine) return null;
  // `Affine6` is `[a, b, c, d, e, f]`; `affineToBounds` expects Adobe's
  // `[x0, xscale, xrot, y0, yrot, yscale]`, so reorder on the way out.
  const [a, b, c, d, e, f] = affine;
  return {
    width: page.width,
    height: page.height,
    affine: [e, a, c, f, b, d],
    crs: page.crs,
    geoOk: true,
  };
}

/** Convert a GDAL-style affine to north-up raster bounds. */
export function affineToBounds(affine: number[], w: number, h: number) {
  const [x0, px, rx, y0, ry, py] = affine;
  const x1 = x0 + px * w + rx * h;
  const y1 = y0 + ry * w + py * h;
  return {
    west: Math.min(x0, x1),
    east: Math.max(x0, x1),
    south: Math.min(y0, y1),
    north: Math.max(y0, y1),
    pixelX: Math.abs(px),
    pixelY: Math.abs(py),
  };
}
