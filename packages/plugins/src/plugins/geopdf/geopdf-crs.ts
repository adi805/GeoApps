/**
 * CRS resolution for GeoPDF georeferencing dictionaries.
 *
 * Two PDF dialects carry the CRS, and they disagree on how to express it:
 *
 * - Adobe/ISO `/Measure` → `/GCS` dictionary with `/Type /PROJCS|/GEOGCS`,
 *   `/EPSG`, `/WKT`.
 * - OGC Best Practice `/LGIDict` → `/Projection` dictionary with `/Datum`,
 *   `/ProjectionType`, `/Zone`, `/Hemisphere`, and (GDAL extension) `/WKT`.
 *
 * Nothing here guesses: an unresolvable CRS returns `def: null` and the caller
 * reports `unsupported-crs` instead of pretending the coordinates are WGS84.
 */
import proj4 from "proj4";
import type { Converter } from "proj4";

/** A CRS as far as the parser needs to know it. */
export interface CrsInfo {
  /** Human-readable label, e.g. `EPSG:32748`. */
  label: string;
  /** True when coordinates are linear (metres, feet), not degrees. */
  projected: boolean;
  /** True when the CRS is WGS84 geographic: no reprojection is needed. */
  isWgs84Geographic: boolean;
  /** Definition proj4 accepts: `EPSG:xxxx` or a WKT string. Null when unknown. */
  def: string | null;
}

/** Fallback used when a PDF carries no usable CRS information. */
export const UNKNOWN_CRS: CrsInfo = {
  label: "unknown",
  projected: false,
  isWgs84Geographic: false,
  def: null,
};

export const WGS84: CrsInfo = {
  label: "EPSG:4326",
  projected: false,
  isWgs84Geographic: true,
  def: "EPSG:4326",
};

/** Datum codes from OGC Best Practice Annex A, as GDAL reads them. */
const DATUM_TO_EPSG: Record<string, number> = {
  WE: 4326,
  WGE: 4326,
  NAR: 4269,
  NAS: 4267,
  GDS: 4283,
  "ING-A": 4131,
};

/** WGS84 UTM EPSG ranges. */
const UTM_NORTH_BASE = 32600;
const UTM_SOUTH_BASE = 32700;

/**
 * Build a CRS from an EPSG code.
 *
 * Codes >= 100000 are in the ESRI namespace; they are passed through to proj4
 * as `ESRI:xxxxx` and left unresolved when proj4 has no definition, which is
 * the honest answer rather than a WGS84 assumption.
 */
export function crsFromEpsg(epsg: number, projected?: boolean): CrsInfo {
  if (epsg === 4326) return WGS84;
  const def = epsg >= 100000 ? `ESRI:${epsg}` : `EPSG:${epsg}`;
  const label = def;
  const isProjected = projected ?? (epsg === 3857 || isUtmEpsg(epsg));
  return {
    label,
    projected: isProjected,
    isWgs84Geographic: false,
    def: isResolvable(def) ? def : null,
  };
}

function isUtmEpsg(epsg: number): boolean {
  return (epsg >= 32601 && epsg <= 32660) || (epsg >= 32701 && epsg <= 32760);
}

/** Build a CRS from a WKT string. */
export function crsFromWkt(wkt: string): CrsInfo {
  const trimmed = wkt.trim();
  if (!trimmed) return UNKNOWN_CRS;
  const projected = /^\s*(PROJCS|PROJCRS)\s*\[/i.test(trimmed);
  const isWgs84Geographic =
    !projected &&
    /^\s*(GEOGCS|GEOGCRS)\s*\[\s*"(?:WGS[ _]?(?:19)?84|WGS_1984)"/i.test(trimmed);
  return {
    label: projected ? `WKT:${wktName(trimmed)}` : "EPSG:4326",
    projected,
    isWgs84Geographic,
    def: isResolvable(trimmed) ? trimmed : null,
  };
}

function wktName(wkt: string): string {
  const match = wkt.match(/^\s*(?:PROJCS|PROJCRS)\s*\[\s*"([^"]+)"/i);
  return match ? match[1] : "unnamed";
}

/**
 * Build the CRS for an OGC `/LGIDict` `/Projection` dictionary.
 *
 * Order follows GDAL: an explicit WKT wins, then the datum plus projection
 * type. Anything outside the supported set resolves to a null definition.
 */
export function crsFromProjectionDict(projection: {
  // `null` is what `readProjection` produces for an absent entry, so the
  // parameter accepts it rather than forcing every caller to normalise first.
  wkt?: string | null;
  datum?: string | null;
  projectionType?: string | null;
  zone?: number | null;
  hemisphere?: string | null;
}): CrsInfo {
  if (projection.wkt) return crsFromWkt(projection.wkt);

  const datumKey = (projection.datum ?? "").trim().toUpperCase();
  const datumEpsg = DATUM_TO_EPSG[datumKey];
  const type = (projection.projectionType ?? "").trim().toUpperCase();

  if (type === "GEOGRAPHIC" || type === "GEODETIC") {
    if (datumEpsg === 4326) return WGS84;
    if (datumEpsg) return crsFromEpsg(datumEpsg, false);
    return UNKNOWN_CRS;
  }

  if (type === "UT" && projection.zone && projection.zone >= 1 && projection.zone <= 60) {
    const north = (projection.hemisphere ?? "").trim().toUpperCase() === "N";
    if (datumEpsg === 4326) {
      return crsFromEpsg((north ? UTM_NORTH_BASE : UTM_SOUTH_BASE) + projection.zone, true);
    }
    return UNKNOWN_CRS;
  }

  return UNKNOWN_CRS;
}

function isResolvable(def: string): boolean {
  try {
    proj4(def);
    return true;
  } catch {
    return false;
  }
}

const converters = new Map<string, Converter | null>();

function converterFor(crs: CrsInfo): Converter | null {
  if (!crs.def) return null;
  const key = `to-wgs84:${crs.def}`;
  if (converters.has(key)) return converters.get(key) ?? null;
  try {
    const converter = proj4(crs.def, "EPSG:4326");
    converters.set(key, converter);
    return converter;
  } catch {
    converters.set(key, null);
    return null;
  }
}

const inverseConverters = new Map<string, Converter | null>();

function inverseConverterFor(crs: CrsInfo): Converter | null {
  if (!crs.def) return null;
  const key = `from-wgs84:${crs.def}`;
  if (inverseConverters.has(key)) return inverseConverters.get(key) ?? null;
  try {
    const converter = proj4("EPSG:4326", crs.def);
    inverseConverters.set(key, converter);
    return converter;
  } catch {
    inverseConverters.set(key, null);
    return null;
  }
}

/** Convert a point in `crs` to WGS84 `[lon, lat]`. Null when the CRS is unknown. */
export function toWgs84(crs: CrsInfo, x: number, y: number): [number, number] | null {
  if (crs.isWgs84Geographic) return [x, y];
  const converter = converterFor(crs);
  if (!converter) return null;
  const [lon, lat] = converter.forward([x, y]);
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

/** Convert WGS84 `[lon, lat]` into `crs`. Null when the CRS is unknown. */
export function fromWgs84(crs: CrsInfo, lon: number, lat: number): [number, number] | null {
  if (crs.isWgs84Geographic) return [lon, lat];
  const converter = inverseConverterFor(crs);
  if (!converter) return null;
  const [x, y] = converter.forward([lon, lat]);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}
