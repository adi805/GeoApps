/**
 * Raw georeferencing dictionaries read out of a PDF page.
 *
 * `pdfjs-dist` exposes rendered pixels and Info/XMP metadata, but not the page
 * dictionaries where georeferencing actually lives, so this layer walks the
 * object graph with `pdf-lib` instead: `/VP` → `/Measure` for Adobe/ISO and
 * ESRI output, `/LGIDict` for OGC Best Practice (TerraGo) output.
 *
 * Nothing in this file interprets coordinates. It only turns PDF objects into
 * plain JavaScript values, so the projection math stays testable without a PDF.
 */
import { PDFArray, PDFDict, PDFName, PDFNumber, PDFRef, PDFString } from "pdf-lib";
import type { PDFDocument, PDFPage } from "pdf-lib";

/** A dictionary value after reference resolution. */
export type Resolved = unknown;

export interface MeasureDict {
  /** `/GPTS` as (lat, lon) pairs, or (northing, easting) when the CRS is projected. */
  gpts: number[];
  /** `/LPTS` as normalized (u, v) pairs inside the viewport bounding box. */
  lpts: number[];
  /** `/GCS` dictionary contents, already unwrapped. */
  gcs: {
    type: string | null;
    epsg: number | null;
    wkt: string | null;
  };
}

export interface ViewportDict {
  /** `/BBox` in PDF user space, `[x0, yTop0, x1, yTop1]` measured from the page top. */
  bbox: [number, number, number, number];
  measure: MeasureDict | null;
  name: string | null;
}

export interface ProjectionDict {
  wkt: string | null;
  datum: string | null;
  projectionType: string | null;
  zone: number | null;
  hemisphere: string | null;
}

export interface LgiDict {
  /** `/CTM`: `[a, b, c, d, e, f]` mapping user space to map coordinates. */
  ctm: number[] | null;
  /** `/Neatline` in user space, as flat (x, y) pairs. */
  neatline: number[] | null;
  projection: ProjectionDict | null;
  description: string | null;
}

/** Resolve a value that may be an indirect reference. */
export function resolve(ctx: PDFDocument["context"], value: Resolved): Resolved {
  return value instanceof PDFRef ? ctx.lookup(value) : value;
}

function asNumber(value: Resolved): number | null {
  if (value instanceof PDFNumber) return value.asNumber();
  if (value instanceof PDFString || (value && typeof (value as { decodeText?: unknown }).decodeText === "function")) {
    // Some producers write numeric entries as strings, e.g. `/CTM [(0.05) 0 0 ...]`.
    const text = (value as PDFString).decodeText().trim();
    if (!text) return null;
    const parsed = Number.parseFloat(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asNumberArray(ctx: PDFDocument["context"], value: Resolved): number[] | null {
  const resolved = resolve(ctx, value);
  if (!(resolved instanceof PDFArray)) return null;
  const out: number[] = [];
  for (let i = 0; i < resolved.size(); i++) {
    const n = asNumber(resolve(ctx, resolved.get(i)));
    if (n === null) return null;
    out.push(n);
  }
  return out;
}

function asName(value: Resolved): string | null {
  return value instanceof PDFName ? value.asString() : null;
}

function asText(value: Resolved): string | null {
  return value instanceof PDFString ? value.decodeText() : null;
}

function asDict(ctx: PDFDocument["context"], value: Resolved): PDFDict | null {
  const resolved = resolve(ctx, value);
  return resolved instanceof PDFDict ? resolved : null;
}

function get(dict: PDFDict, key: string): Resolved {
  return dict.get(PDFName.of(key));
}

/** Read one `/VP` array element. */
function readViewport(ctx: PDFDocument["context"], element: Resolved): ViewportDict | null {
  const dict = asDict(ctx, element);
  if (!dict) return null;

  const bbox = asNumberArray(ctx, get(dict, "BBox"));
  if (!bbox || bbox.length !== 4) return null;

  return {
    bbox: [bbox[0], bbox[1], bbox[2], bbox[3]],
    measure: readMeasure(ctx, get(dict, "Measure")),
    name: asText(resolve(ctx, get(dict, "Name"))),
  };
}

/** Read a `/Measure` dictionary; only `/Subtype /GEO` is georeferencing. */
function readMeasure(ctx: PDFDocument["context"], value: Resolved): MeasureDict | null {
  const dict = asDict(ctx, value);
  if (!dict) return null;
  if (asName(resolve(ctx, get(dict, "Subtype"))) !== "/GEO") return null;

  // `lgit:` prefixed keys carry more precision when both are present; GDAL
  // prefers them, so the parser does too.
  const gpts =
    asNumberArray(ctx, get(dict, "lgit:GPTS")) ?? asNumberArray(ctx, get(dict, "GPTS"));
  const lpts =
    asNumberArray(ctx, get(dict, "lgit:LPTS")) ?? asNumberArray(ctx, get(dict, "LPTS"));
  if (!gpts || !lpts) return null;
  if (gpts.length < 6 || gpts.length % 2 !== 0) return null;
  if (lpts.length !== gpts.length) return null;

  const gcsDict = asDict(ctx, get(dict, "GCS"));
  const gcs = {
    type: gcsDict ? asName(resolve(ctx, get(gcsDict, "Type"))) : null,
    epsg: gcsDict ? asNumber(resolve(ctx, get(gcsDict, "EPSG"))) : null,
    wkt: gcsDict ? asText(resolve(ctx, get(gcsDict, "WKT"))) : null,
  };

  return { gpts, lpts, gcs };
}

/** Read a `/Projection` dictionary from an OGC `/LGIDict`. */
function readProjection(ctx: PDFDocument["context"], value: Resolved): ProjectionDict | null {
  const dict = asDict(ctx, value);
  if (!dict) return null;
  return {
    wkt: asText(resolve(ctx, get(dict, "WKT"))),
    datum: asText(resolve(ctx, get(dict, "Datum"))),
    projectionType: asText(resolve(ctx, get(dict, "ProjectionType"))),
    zone: asNumber(resolve(ctx, get(dict, "Zone"))),
    hemisphere: asText(resolve(ctx, get(dict, "Hemisphere"))),
  };
}

/** Read one `/LGIDict` dictionary. */
function readLgiDict(ctx: PDFDocument["context"], value: Resolved): LgiDict | null {
  const dict = asDict(ctx, value);
  if (!dict) return null;
  const ctm = asNumberArray(ctx, get(dict, "CTM"));
  return {
    ctm: ctm && ctm.length === 6 ? ctm : null,
    neatline: asNumberArray(ctx, get(dict, "Neatline")),
    projection: readProjection(ctx, get(dict, "Projection")),
    description: asText(resolve(ctx, get(dict, "Description"))),
  };
}

/**
 * Every `/VP` viewport on a page, in document order.
 *
 * ESRI output commonly carries several viewports (a main map plus an inset),
 * so the caller picks one; GDAL picks the largest BBox and this parser matches
 * that, because the largest viewport is the map the user sees.
 */
export function readViewports(page: PDFPage): ViewportDict[] {
  const ctx = page.doc.context;
  const value = resolve(ctx, page.node.get(PDFName.of("VP")));
  if (!(value instanceof PDFArray)) return [];

  const out: ViewportDict[] = [];
  for (let i = 0; i < value.size(); i++) {
    const viewport = readViewport(ctx, value.get(i));
    if (viewport) out.push(viewport);
  }
  return out;
}

/** Every `/LGIDict` on a page. The key is either one dictionary or an array. */
export function readLgiDicts(page: PDFPage): LgiDict[] {
  const ctx = page.doc.context;
  const value = resolve(ctx, page.node.get(PDFName.of("LGIDict")));
  if (value instanceof PDFDict) {
    const single = readLgiDict(ctx, value);
    return single ? [single] : [];
  }
  if (value instanceof PDFArray) {
    const out: LgiDict[] = [];
    for (let i = 0; i < value.size(); i++) {
      const dict = readLgiDict(ctx, value.get(i));
      if (dict) out.push(dict);
    }
    return out;
  }
  return [];
}

/** True when the page carries no `/VP` and no `/LGIDict` at all. */
export function hasGeoreferenceDictionaries(page: PDFPage): boolean {
  return readViewports(page).length > 0 || readLgiDicts(page).length > 0;
}

/** Page geometry in points, before `/Rotate` is applied. */
export interface PageGeometry {
  /** MediaBox origin and size, in points. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** `/Rotate` in degrees, normalized to 0, 90, 180 or 270. */
  rotation: number;
  /** `/UserUnit`, defaulting to 1. */
  userUnit: number;
}

export function readPageGeometry(page: PDFPage): PageGeometry {
  const media = page.getMediaBox();
  const raw = page.getRotation().angle;
  const rotation = ((Math.round(raw / 90) * 90) % 360 + 360) % 360;
  const userUnit = asNumber(resolve(page.doc.context, page.node.get(PDFName.of("UserUnit"))));
  return {
    x: media.x,
    y: media.y,
    width: media.width,
    height: media.height,
    rotation,
    userUnit: userUnit && userUnit > 0 ? userUnit : 1,
  };
}
