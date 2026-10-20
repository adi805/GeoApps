/**
 * Turn raw GeoPDF dictionaries into page-space affine transforms and WGS84 bounds.
 *
 * Two dialects, one output:
 *
 * - Adobe/ISO and ESRI `/VP` → `/Measure`: ground control points in `/GPTS`
 *   paired with normalized page positions in `/LPTS`. An affine is fitted from
 *   those pairs in the *source* CRS, exactly as GDAL does, then the four page
 *   corners are reprojected one by one.
 * - OGC Best Practice `/LGIDict`: a `/CTM` matrix that already maps user space
 *   to map coordinates, so no fit is needed and the corners come straight from
 *   the matrix.
 *
 * Fitting before reprojecting is not a detail. A projected CRS makes the
 * page→geographic mapping non-affine, so a fit performed in degrees drifts at
 * the corners; GDAL fits in the source CRS and so does this module.
 */
import { applyAffine, fitAffine, rotatedSize, type Affine6, type ControlPoint } from "./geopdf-affine";
import {
  crsFromEpsg,
  crsFromProjectionDict,
  crsFromWkt,
  fromWgs84,
  toWgs84,
  type CrsInfo,
} from "./geopdf-crs";
import type { LgiDict, PageGeometry, ViewportDict } from "./geopdf-structure";

/** A WGS84 corner. */
export interface LngLat {
  lon: number;
  lat: number;
}

/** Axis-aligned WGS84 extent, ready for MapLibre `image` bounds. */
export interface GeoBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

export interface PageGeoref {
  /** Which dictionary the georeference came from. */
  source: "vp" | "lgidict";
  crs: CrsInfo;
  /** Page points (top-left origin) → source CRS. */
  affine: Affine6;
  /** Same mapping expressed in WGS84 degrees, fitted separately. */
  affineWgs84: Affine6 | null;
  /** Four WGS84 corners in rendered order: top-left, top-right, bottom-right, bottom-left. */
  corners: [LngLat, LngLat, LngLat, LngLat];
  bounds: GeoBounds;
}

/** Why a page could not be georeferenced. */
export type GeorefFailure = "no-measure" | "no-ctm" | "unsupported-crs" | "degenerate";

/** True when the CRS makes the `/GPTS` values non-degrees, i.e. (northing, easting). */
function gptsAreProjected(gpts: number[], crs: CrsInfo): boolean {
  if (!crs.projected) return false;
  for (let i = 0; i < gpts.length / 2; i++) {
    if (Math.abs(gpts[2 * i]) > 91 || Math.abs(gpts[2 * i + 1]) > 361) return true;
  }
  return false;
}

/**
 * GDAL nullifies rotation/shear terms that are negligible against the pixel
 * size, because they are usually reprojection noise rather than real rotation.
 * Reproducing that keeps our bounds equal to `gdalinfo` on north-up maps while
 * leaving genuinely rotated scans untouched.
 */
function normalizeRotationTerms(affine: Affine6, width: number, height: number): Affine6 {
  const [a, b, c, d, e, f] = affine;
  const pixelSize = Math.min(Math.abs(a), Math.abs(d));
  const rotation = Math.max(Math.abs(b), Math.abs(c));
  if (!(pixelSize > 0) || rotation >= 1e-5 * pixelSize) return affine;

  const rightX = a * width + c * height + e;
  const bottomY = b * width + d * height + f;
  return [(rightX - e) / width, 0, 0, (bottomY - f) / height, e, f];
}

/** Corner page points in rendered order: TL, TR, BR, BL. */
function cornersFor(width: number, height: number): Array<[number, number]> {
  return [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
}

/**
 * Reorder page-space corners (TL, TR, BR, BL) into the order the renderer sees.
 *
 * A `/Rotate 90` page is displayed turned 90° clockwise, so the corner shown at
 * the top-left of the rendered image is the page's bottom-left. MapLibre's
 * `image` source expects exactly this rendered order, so the reorder happens
 * here rather than at every call site.
 */
function rotateCornerOrder(
  corners: [LngLat, LngLat, LngLat, LngLat],
  rotation: number,
): [LngLat, LngLat, LngLat, LngLat] {
  const shift = (4 - (rotation / 90) % 4) % 4;
  if (shift === 0) return corners;
  return [0, 1, 2, 3].map((i) => corners[(i + shift) % 4]) as [LngLat, LngLat, LngLat, LngLat];
}

/** Build corners, bounds and the WGS84 affine from a source-CRS affine. */
function fromAffine(
  affine: Affine6,
  crs: CrsInfo,
  width: number,
  height: number,
  rotation: number,
): Pick<PageGeoref, "affine" | "affineWgs84" | "corners" | "bounds"> | null {
  const pageCorners = cornersFor(width, height);
  const geographic = pageCorners.map(([px, py]) => {
    const [x, y] = applyAffine(affine, px, py);
    return toWgs84(crs, x, y);
  });
  if (geographic.some((point) => point === null)) return null;

  const corners = geographic as Array<[number, number]>;
  const lons = corners.map(([lon]) => lon);
  const lats = corners.map(([, lat]) => lat);

  const wgs84Points: ControlPoint[] = corners.map(([lon, lat], index) => ({
    px: pageCorners[index][0],
    py: pageCorners[index][1],
    X: lon,
    Y: lat,
  }));

  const lngLatCorners = corners.map(([lon, lat]) => ({ lon, lat })) as PageGeoref["corners"];

  return {
    affine,
    affineWgs84: fitAffine(wgs84Points),
    corners: rotateCornerOrder(lngLatCorners, rotation),
    bounds: {
      west: Math.min(...lons),
      east: Math.max(...lons),
      south: Math.min(...lats),
      north: Math.max(...lats),
    },
  };
}

/**
 * Map one `/GPTS` pair into the CRS the affine is fitted in.
 *
 * ISO order is `(lat, lon)`. When the CRS is projected, the standard order
 * still holds and the values are projected into metres, because an affine is
 * only linear there; the projected `(northing, easting)` variant is handled by
 * the caller.
 */
function gptsPairToSource(crs: CrsInfo, lat: number, lon: number): [number, number] | null {
  if (!crs.projected) return [lon, lat];
  return fromWgs84(crs, lon, lat);
}

/** Georeference from an Adobe/ISO viewport. */
export function georefFromViewport(
  viewport: ViewportDict,
  geometry: PageGeometry,
): { georef: PageGeoref | null; reason: GeorefFailure | null } {
  const measure = viewport.measure;
  if (!measure) return { georef: null, reason: "no-measure" };

  const crs = measure.gcs.wkt
    ? crsFromWkt(measure.gcs.wkt)
    : measure.gcs.epsg
      ? crsFromEpsg(measure.gcs.epsg, measure.gcs.type === "/PROJCS")
      : null;

  if (!crs || !crs.def) return { georef: null, reason: "unsupported-crs" };

  const projectedGpts = gptsAreProjected(measure.gpts, crs);
  const [bx0, byTop0, bx1, byTop1] = viewport.bbox;
  const unit = geometry.userUnit;

  const points: ControlPoint[] = [];
  for (let i = 0; i < measure.gpts.length / 2; i++) {
    const first = measure.gpts[2 * i];
    const second = measure.gpts[2 * i + 1];
    const u = measure.lpts[2 * i];
    const v = measure.lpts[2 * i + 1];

    // `/BBox` is `[left, top, right, bottom]` in PDF user space (y up), and
    // `/LPTS` runs from that top edge towards the bottom, which is why GDAL
    // computes `line = mediaHeight - (bboxTop + (bboxBottom - bboxTop) * v)`.
    // Convert to the module-wide page convention: origin top-left, y down.
    const xUser = bx0 + (bx1 - bx0) * u;
    const yUser = byTop0 + (byTop1 - byTop0) * v;
    const px = (xUser - geometry.x) * unit;
    const py = (geometry.y + geometry.height - yUser) * unit;

    const pair = projectedGpts ? [second, first] : gptsPairToSource(crs, first, second);
    if (!pair || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1])) {
      return { georef: null, reason: "unsupported-crs" };
    }
    points.push({ px, py, X: pair[0], Y: pair[1] });
  }

  const fitted = fitAffine(points);
  if (!fitted) return { georef: null, reason: "degenerate" };

  const width = geometry.width * unit;
  const height = geometry.height * unit;
  const derived = fromAffine(
    normalizeRotationTerms(fitted, width, height),
    crs,
    width,
    height,
    geometry.rotation,
  );
  if (!derived) return { georef: null, reason: "unsupported-crs" };

  return { georef: { source: "vp", crs, ...derived }, reason: null };
}

/**
 * Georeference from an OGC `/LGIDict`.
 *
 * The `/CTM` maps user space directly, so no fit is needed. When `/CTM` is
 * absent the dictionary is unusable: `/Registration` pairs are GDAL's fallback,
 * but no fixture in the corpus needs them yet and guessing there would hide the
 * gap, so that case reports `no-ctm` instead.
 */
export function georefFromLgiDict(
  lgi: LgiDict,
  geometry: PageGeometry,
): { georef: PageGeoref | null; reason: GeorefFailure | null } {
  const crs = lgi.projection ? crsFromProjectionDict(lgi.projection) : null;
  if (!crs || !crs.def) return { georef: null, reason: "unsupported-crs" };
  if (!lgi.ctm) return { georef: null, reason: "no-ctm" };

  const unit = geometry.userUnit;
  const top = geometry.y + geometry.height;
  const [a, b, c, d, e, f] = lgi.ctm;

  // `/CTM` is applied in PDF user space (y up). Converting to page points
  // (y down) negates the y column and re-anchors the origin at the page top.
  const affine: Affine6 = [
    a / unit,
    b / unit,
    -c / unit,
    -d / unit,
    e + c * top + a * geometry.x,
    f + d * top + b * geometry.x,
  ];

  const width = geometry.width * unit;
  const height = geometry.height * unit;
  const derived = fromAffine(affine, crs, width, height, geometry.rotation);
  if (!derived) return { georef: null, reason: "unsupported-crs" };

  return { georef: { source: "lgidict", crs, ...derived }, reason: null };
}

/** Rendered size for a page, honouring `/Rotate` and `/UserUnit`. */
export function renderedPageSize(geometry: PageGeometry): { width: number; height: number } {
  const base = rotatedSize(geometry.width, geometry.height, geometry.rotation);
  return { width: base.width * geometry.userUnit, height: base.height * geometry.userUnit };
}
