/**
 * Angka dan kalimat yang tampil di panel geofence, dipisah dari React supaya
 * bisa diuji tanpa merender apa pun.
 *
 * Satu alasan praktis: unit test frontend di repo ini berjalan di `node --test`
 * tanpa DOM, jadi apa pun yang butuh `document` tidak bisa diperiksa. Semua
 * perhitungan yang menentukan isi layar (berapa zona aktif, berapa peringatan
 * hari ini, seberapa jauh dari batas) ditaruh di sini, dan komponen tinggal
 * memanggilnya.
 */

import type { GeofenceEvent, GeofenceZone } from "@geolibre/plugins";

/** Radius terkecil yang bisa dibuat pengguna, meter. Sama dengan plugin. */
export const GEOFENCE_MIN_RADIUS_M = 20;

/**
 * Bulatkan radius ke batas yang bisa dipakai di lapangan.
 *
 * Radius di bawah {@link GEOFENCE_MIN_RADIUS_M} lebih kecil dari galat GPS, jadi
 * peringatannya akan salah terus: lebih baik ditahan di batas daripada
 * menyimpan batas yang tidak bisa dipercaya.
 *
 * Args:
 *   value: Radius yang diketik pengguna, meter.
 *
 * Returns:
 *   Radius bulat, minimal {@link GEOFENCE_MIN_RADIUS_M}.
 */
export function clampRadiusM(value: number): number {
  if (!Number.isFinite(value)) return GEOFENCE_MIN_RADIUS_M;
  return Math.max(GEOFENCE_MIN_RADIUS_M, Math.round(value));
}

/** Ikut diawasi atau tidak. Bidang ini opsional, absen berarti aktif. */
export function isZoneEnabled(zone: GeofenceZone): boolean {
  return zone.enabled !== false;
}

/** Bentuk zona dalam satu frasa: "radius 250 m" atau "poligon 6 titik". */
export function zoneShapeLabel(zone: GeofenceZone): string {
  if (zone.kind === "circle") return `radius ${Math.round(zone.radiusM)} m`;
  const ring = zone.rings[0] ?? [];
  return `poligon ${ring.length} titik`;
}

/** Apakah dua waktu jatuh di hari yang sama menurut waktu perangkat. */
function sameLocalDay(iso: string, reference: Date): boolean {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return false;
  return (
    at.getFullYear() === reference.getFullYear() &&
    at.getMonth() === reference.getMonth() &&
    at.getDate() === reference.getDate()
  );
}

/** Jam:menit waktu setempat untuk sebuah stempel waktu ISO. */
export function formatClock(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "--:--";
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Jumlah peringatan sebuah zona pada hari ini.
 *
 * Jurnal menyimpan NAMA area, bukan id, jadi pencocokannya lewat nama persis
 * seperti yang ditulis pengguna (itulah yang juga muncul di CSV).
 */
export function countZoneEventsToday(
  events: readonly GeofenceEvent[],
  zone: GeofenceZone,
  reference: Date,
): number {
  let count = 0;
  for (const event of events) {
    if (event.area === zone.name && sameLocalDay(event.at, reference)) count += 1;
  }
  return count;
}

/** "2 aktif dari 3" untuk kepala daftar. */
export function zonesSummary(zones: readonly GeofenceZone[]): string {
  const active = zones.filter(isZoneEnabled).length;
  return `${active} aktif dari ${zones.length}`;
}

/** Keterangan satu baris zona: bentuknya dan peringatannya hari ini. */
export function zoneRowCaption(
  zone: GeofenceZone,
  events: readonly GeofenceEvent[],
  reference: Date,
): string {
  const today = countZoneEventsToday(events, zone, reference);
  const peringatan =
    today === 0 ? "tidak ada peringatan hari ini" : `${today} peringatan hari ini`;
  return `${zoneShapeLabel(zone)} · ${peringatan}`;
}

/** Judul satu baris peringatan: "Masuk Blok C". */
export function eventTitle(event: GeofenceEvent): string {
  return `${event.kind === "masuk" ? "Masuk" : "Keluar"} ${event.area}`;
}

/**
 * Sisi mana yang sedang di tempati pengguna, meter.
 *
 * Positif berarti di luar batas, negatif di dalam, nol tepat di batas. Tanda
 * ini datang dari mesin geofence, jadi panel tidak menghitungnya sendiri.
 */
export function describeBoundarySide(distanceToBoundaryM: number): string {
  const rounded = Math.abs(Math.round(distanceToBoundaryM));
  if (rounded === 0) return "tepat di batas";
  return distanceToBoundaryM > 0 ? `${rounded} m di luar batas` : `${rounded} m di dalam batas`;
}

/** Keterangan satu baris peringatan: jamnya dan sisinya. */
export function eventCaption(event: GeofenceEvent): string {
  return `${formatClock(event.at)} · ${describeBoundarySide(event.distanceToBoundaryM)}`;
}

/**
 * Id zona baru yang belum dipakai.
 *
 * Dipisah dari komponennya supaya bisa diuji: id yang bentrok membuat zona
 * kedua menimpa zona pertama tanpa pesan apa pun.
 *
 * Args:
 *   existing: Id yang sudah ada.
 *   seed: Waktu pembuatan dalam milidetik; dipakai uji supaya hasilnya pasti.
 *
 * Returns:
 *   Id yang belum ada di `existing`.
 */
export function newZoneId(existing: readonly string[], seed: number = Date.now()): string {
  const taken = new Set(existing);
  let attempt = 0;
  for (;;) {
    const candidate = `zona-${seed.toString(36)}${attempt === 0 ? "" : `-${attempt}`}`;
    if (!taken.has(candidate)) return candidate;
    attempt += 1;
  }
}