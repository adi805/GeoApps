/**
 * UTM (Universal Transverse Mercator) converter: lat/lng -> UTM zone,
 * easting, northing. Standard WGS84 UTM (Karvonen / Karney formulas,
 * simplified transverse Mercator with ellipsoid WGS84).
 */

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);

export interface UtmResult {
  zone: number;
  band: string;
  easting: number;
  northing: number;
  /** UTM south-hemisphere 10,000 km false northing applied? */
  south: boolean;
}

const BANDS = "CDEFGHJKLMNPQRSTUVWXX";
function bandForLat(lat: number): string {
  const idx = Math.min(
    BANDS.length - 1,
    Math.max(0, Math.floor((lat + 80) / 8))
  );
  return BANDS[idx];
}

export function latLngToUtm(lng: number, lat: number): UtmResult {
  const zone = Math.floor((lng + 180) / 6) + 1;
  const band = bandForLat(lat);
  const south = lat < 0;

  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  // central meridian of the zone
  const cm = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  const dLng = lngRad - cm;

  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = (WGS84_E2 / (1 - WGS84_E2)) * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * dLng;

  // meridional arc
  const e2 = WGS84_E2;
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const e8 = e6 * e2;
  const m =
    WGS84_A *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256 - (175 * e8) / 16384) * latRad -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024 + (105 * e8) / 4096) *
        Math.sin(2 * latRad) +
      ((15 * e4) / 256 + (45 * e6) / 1024 + (525 * e8) / 16384) *
        Math.sin(4 * latRad) -
      ((35 * e6) / 3072 + (175 * e8) / 12288) * Math.sin(6 * latRad) +
      ((315 * e8) / 131072) * Math.sin(8 * latRad));

  const easting =
    0.9996 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * C * C) * A ** 5) / 120) +
    500000;
  const northing =
    0.9996 *
      (m +
        N *
          Math.tan(latRad) *
          (A ** 2 / 2 +
            ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * C * C) * A ** 6) / 720)) +
    (south ? 10000000 : 0);

  return { zone, band, easting, northing, south };
}

export function formatUtm(r: UtmResult, decimals = 3): string {
  return `${r.zone}${r.band} ${r.easting.toFixed(decimals)} ${r.northing.toFixed(decimals)}`;
}
