/**
 * Konversi koordinat untuk kerja lapangan: DD (derajat desimal), DMS (derajat,
 * menit, detik), dan UTM (zona + huruf pita + easting/northing).
 *
 * Kenapa berkas ini ada: petani dan surveyor di kebun menulis koordinat dalam
 * tiga bentuk berbeda, dan Avenza menampilkan ketiganya. Tanpa konversi dua
 * arah, satu titik yang dicatat di lapangan tidak bisa dicocokkan kembali
 * dengan peta atau dengan catatan orang lain.
 *
 * Proyeksi memakai proj4 dengan definisi zona yang sama persis dengan
 * `maplibre-graticule.ts` (`+proj=utm +zone=<n> [+south] +datum=WGS84`), supaya
 * angka di panel konversi dan angka di label grid tidak pernah berbeda.
 */

import proj4 from "proj4";

/** Titik dalam derajat desimal. */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface UtmResult {
  zone: number;
  /** Huruf pita lintang (C-X, tanpa I dan O); "" di luar jangkauan UTM. */
  band: string;
  easting: number;
  northing: number;
  /** Northing belahan selatan (false northing 10.000 km sudah diterapkan)? */
  south: boolean;
}

/** Pita lintang UTM, 8 derajat per huruf. I dan O dilewati; X 12 derajat. */
const BANDS = "CDEFGHJKLMNPQRSTUVWX";

/** Batas lintang UTM yang sah: 80°S sampai 84°U. */
export const UTM_MIN_LAT = -80;
export const UTM_MAX_LAT = 84;

/**
 * Zona UTM (1-60) untuk sebuah bujur.
 *
 * Bujur dinormalkan ke [0, 360) lebih dulu, jadi nilai yang belum dibungkus
 * (mis. 190 atau -190 dari perhitungan lintas garis tanggal) tetap jatuh di
 * zona yang sah, bukan zona 62 atau 0.
 */
export function utmZoneForLongitude(lng: number): number {
  if (!Number.isFinite(lng)) return 0;
  const normalized = (((lng + 180) % 360) + 360) % 360; // 0..360
  return Math.min(60, Math.floor(normalized / 6) + 1);
}

/**
 * Huruf pita lintang untuk sebuah lintang, atau "" di luar -80..84.
 *
 * Indonesia memakai pita K (16°S-24°S), L (8°S-16°S), M (8°S-0°), dan N
 * (0°-8°U). Lintang 0 tepat masuk N, sesuai batas pita resmi.
 */
export function utmBandForLatitude(lat: number): string {
  if (!Number.isFinite(lat) || lat < UTM_MIN_LAT || lat > UTM_MAX_LAT) return "";
  const index = Math.min(Math.floor((lat - UTM_MIN_LAT) / 8), BANDS.length - 1);
  return BANDS[index];
}

/** Definisi proj4 untuk satu zona UTM WGS84; satu sumber dengan grid plugin. */
function utmProjDef(zone: number, south: boolean): string {
  return `+proj=utm +zone=${zone}${south ? " +south" : ""} +datum=WGS84 +units=m +no_defs +type=crs`;
}

/**
 * Proyeksikan derajat desimal ke UTM pada zona alaminya.
 *
 * Mengembalikan null untuk koordinat yang tidak sah (bukan angka, atau lintang
 * di luar batas UTM) alih-alih angka sampah.
 */
export function latLngToUtm(lng: number, lat: number): UtmResult | null {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const band = utmBandForLatitude(lat);
  if (!band) return null;
  const zone = utmZoneForLongitude(lng);
  const south = lat < 0;
  try {
    const [easting, northing] = proj4("EPSG:4326", utmProjDef(zone, south), [lng, lat]) as [
      number,
      number,
    ];
    if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;
    return { zone, band, easting, northing, south };
  } catch {
    return null;
  }
}

/**
 * Kebalikan {@link latLngToUtm}: UTM (zona + belahan) kembali ke derajat desimal.
 *
 * Huruf pita tidak ikut dipakai karena northing sudah membawa belahannya;
 * memakai huruf pita sebagai penentu belahan akan salah untuk titik yang pita
 * lintangnya ditulis tangan.
 */
export function utmToLatLng(
  zone: number,
  south: boolean,
  easting: number,
  northing: number,
): LatLng | null {
  if (!Number.isInteger(zone) || zone < 1 || zone > 60) return null;
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null;
  if (easting < 100000 || easting > 1000000) return null;
  if (northing < 0 || northing > 10000000) return null;
  try {
    const [lng, lat] = proj4(utmProjDef(zone, south), "EPSG:4326", [easting, northing]) as [
      number,
      number,
    ];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/** Satu titik UTM dalam bentuk teks, mis. `48M 703260.512 9243078.119`. */
export function formatUtm(r: UtmResult, decimals = 3): string {
  return `${r.zone}${r.band} ${r.easting.toFixed(decimals)} ${r.northing.toFixed(decimals)}`;
}

/** `6.209600, 106.845600` — urutan lat, lng seperti kebiasaan alat lapangan. */
export function formatDd(lat: number, lng: number, decimals = 6): string {
  return `${lat.toFixed(decimals)}, ${lng.toFixed(decimals)}`;
}

function formatDmsComponent(
  value: number,
  hemisphere: [string, string],
  secondsDecimals: number,
): string {
  const hemi = value < 0 ? hemisphere[1] : hemisphere[0];
  const abs = Math.abs(value);
  let deg = Math.floor(abs);
  let min = Math.floor((abs - deg) * 60);
  let sec = (abs - deg - min / 60) * 3600;
  // Pembulatan detik bisa menghasilkan 60.000; bawa ke menit/derajat, bukan
  // mencetak "60 detik" yang terbaca sebagai nilai di luar rentang.
  const factor = 10 ** secondsDecimals;
  sec = Math.round(sec * factor) / factor;
  if (sec >= 60) {
    sec -= 60;
    min += 1;
  }
  if (min >= 60) {
    min -= 60;
    deg += 1;
  }
  const secText = sec.toFixed(secondsDecimals).padStart(secondsDecimals > 0 ? 3 + secondsDecimals : 2, "0");
  return `${deg}°${String(min).padStart(2, "0")}'${secText}"${hemi}`;
}

/**
 * `6°12'34.56"S 106°50'44.16"E` — derajat, menit, detik dengan arah mata angin.
 *
 * Urutannya lat lalu lng, sama seperti {@link formatDd} dan seperti yang dibaca
 * orang dari papan petunjuk di kebun.
 */
export function formatDms(lat: number, lng: number, secondsDecimals = 2): string {
  return `${formatDmsComponent(lat, ["N", "S"], secondsDecimals)} ${formatDmsComponent(lng, ["E", "W"], secondsDecimals)}`;
}

const NUMBER = "[-+]?\\d+(?:\\.\\d+)?";
const DMS_PART = new RegExp(
  `^(${NUMBER})\\s*(?:°|d|deg)?\\s*(?:(\\d+(?:\\.\\d+)?)\\s*(?:'|m|min)?\\s*)?(?:(\\d+(?:\\.\\d+)?)\\s*(?:"|s|sec)?\\s*)?([NSEW])?$`,
  "i",
);

/** Pecah satu komponen (`6°12'34.5"S`) jadi derajat bertanda, atau null. */
function parseDmsPart(text: string): number | null {
  const match = DMS_PART.exec(text.trim());
  if (!match) return null;
  const deg = Number(match[1]);
  const min = match[2] === undefined ? 0 : Number(match[2]);
  const sec = match[3] === undefined ? 0 : Number(match[3]);
  const hemi = match[4]?.toUpperCase();
  if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) return null;
  if (min >= 60 || sec >= 60) return null;
  const sign = deg < 0 || hemi === "S" || hemi === "W" ? -1 : 1;
  return sign * (Math.abs(deg) + min / 60 + sec / 3600);
}

/**
 * Baca satu titik dari teks: DD (`-6.2096, 106.8456`), DMS
 * (`6°12'34.5"S 106°50'44.2"E`), atau campuran keduanya.
 *
 * Arah mata angin menentukan sumbu: N/S = lintang, E/W = bujur. Tanpa arah,
 * urutannya dianggap lat lalu lng, sama seperti keluaran {@link formatDd}.
 * Mengembalikan null kalau teks tidak bisa dibaca, bukan menebak.
 */
export function parseCoordinate(text: string): LatLng | null {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  // Pisah pada koma, atau pada angka berikutnya ketika DMS ditulis tanpa koma.
  const pieces = cleaned.split(/\s*,\s*|\s+(?=[-+]?\d)/).filter(Boolean);
  if (pieces.length !== 2) return null;
  const first = parseDmsPart(pieces[0]);
  const second = parseDmsPart(pieces[1]);
  if (first === null || second === null) return null;
  const firstHemi = /[NSEW]\s*$/i.exec(pieces[0])?.[0].trim().toUpperCase();
  const secondHemi = /[NSEW]\s*$/i.exec(pieces[1])?.[0].trim().toUpperCase();
  const firstIsLng = firstHemi === "E" || firstHemi === "W";
  const secondIsLat = secondHemi === "N" || secondHemi === "S";
  const lat = firstIsLng || secondIsLat ? second : first;
  const lng = firstIsLng || secondIsLat ? first : second;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
