import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import type { GeoLibreAppAPI, GeoLibrePlugin } from "../types";
import { GEOFENCE_PLUGIN_ID } from "../plugin-ids";

/**
 * Geofence plugin: define zones (polygons/circles) on the map, monitor the
 * device position, and record enter/exit events.
 *
 * Kenapa berkas ini memuat jarak ke batas, bukan sekadar "di dalam / di luar":
 * di lapangan penerimaan GPS di bawah tajuk bergerak beberapa meter tiap detik,
 * dan titik yang kebetulan tepat di batas akan memicu masuk-keluar berulang
 * kalau keputusannya hanya tanda dari uji titik-dalam-poligon. Setiap zona
 * karenanya punya pita histeresis: status hanya berubah setelah posisi melewati
 * batas sejauh ambang itu, bukan saat menyentuhnya.
 *
 * Notifikasi saja tidak cukup, jadi tiap perubahan status juga ditulis ke
 * jurnal peristiwa (area, jenis, waktu, lat, lon, jarak ke batas) yang bisa
 * dibaca ulang dan diekspor CSV. Notifikasi hilang saat layar mati; jurnal
 * tidak.
 */

export const GEOFENCE_SOURCE_KIND = "geofence";
const GEOFENCE_STATUS_ID = "geolibre-geofence-status";
const STORAGE_ZONES = "geokebun:geofences";
const STORAGE_EVENTS = "geokebun:geofence-events";

const DEFAULT_RADIUS_M = 50;

/** Bawaan yang dipakai kalau pemanggil tidak menyebut angka. */
export const GEOFENCE_DEFAULTS = {
  /** Lebar pita histeresis di tiap sisi batas, meter. */
  hysteresisM: 10,
  /** Posisi baru diperiksa setelah bergerak sejauh ini, meter. */
  minDistanceM: 10,
  /** ...atau setelah selang waktu ini, milidetik. */
  minIntervalMs: 15000,
  /** Jumlah peristiwa yang disimpan sebelum yang tertua dibuang. */
  maxEvents: 500,
} as const;

/** Titik dalam derajat desimal. */
export interface GeofencePoint {
  lat: number;
  lng: number;
}

/** Satu peristiwa masuk/keluar, satu baris di jurnal dan di CSV. */
export interface GeofenceEvent {
  /** Nama area seperti yang ditulis pengguna. */
  area: string;
  /** `masuk` atau `keluar`. */
  kind: "masuk" | "keluar";
  /** Waktu kejadian, ISO 8601 UTC. */
  at: string;
  lat: number;
  lng: number;
  /**
   * Jarak ke batas area, meter. Bertanda: positif di luar area, negatif di
   * dalam. Nol berarti tepat di batas.
   */
  distanceToBoundaryM: number;
}

/** Zona yang bisa diperiksa: poligon GeoJSON atau lingkaran (pusat + radius). */
export type GeofenceZone =
  | { id: string; name: string; kind: "polygon"; rings: Position[][] }
  | { id: string; name: string; kind: "circle"; center: Position; radiusM: number };

const EARTH_RADIUS_M = 6371008.8;
const DEG = Math.PI / 180;

/** Jarak dua titik di permukaan bumi (meter), rumus haversine. */
export function haversineM(a: Position, b: Position): number {
  const dLat = (b[1] - a[1]) * DEG;
  const dLng = (b[0] - a[0]) * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * DEG) * Math.cos(b[1] * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Geser bujur supaya berada dalam 180 derajat dari `ref`, sehingga zona yang
 * melintasi garis tanggal (179,9 ke -179,9) tidak dianggap membentang 360
 * derajat ke arah yang salah.
 */
export function unwrapLongitude(lng: number, ref: number): number {
  let value = lng;
  while (value - ref > 180) value -= 360;
  while (value - ref < -180) value += 360;
  return value;
}

/** Uji titik-dalam-cincin (ray casting), di ruang bujur yang sudah digeser. */
export function pointInRing(point: Position, ring: Position[], refLng = point[0]): boolean {
  const x = unwrapLongitude(point[0], refLng);
  const y = point[1];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = unwrapLongitude(ring[i][0], refLng);
    const yi = ring[i][1];
    const xj = unwrapLongitude(ring[j][0], refLng);
    const yj = ring[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Jarak titik ke satu segmen garis, meter.
 *
 * Dihitung pada proyeksi datar lokal yang berpusat di titik itu (meter per
 * derajat dikoreksi kosinus lintang). Untuk bentang sejauh beberapa kilometer
 * galatnya di bawah satu persen, dan itu jauh di bawah akurasi GPS di kebun;
 * rumus geodesik penuh untuk tiap segmen tidak membeli ketelitian yang berguna.
 */
export function distanceToSegmentM(point: Position, a: Position, b: Position): number {
  const ref = point[0];
  const ax = unwrapLongitude(a[0], ref);
  const bx = unwrapLongitude(b[0], ref);
  const mPerDegLat = 111132.92;
  const mPerDegLng = 111320 * Math.cos(point[1] * DEG);
  const x1 = (ax - ref) * mPerDegLng;
  const y1 = (a[1] - point[1]) * mPerDegLat;
  const x2 = (bx - ref) * mPerDegLng;
  const y2 = (b[1] - point[1]) * mPerDegLat;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(x1, y1);
  // Titik acuan ada di (0, 0) karena proyeksi dipusatkan di titik itu.
  const t = Math.max(0, Math.min(1, (-x1 * dx - y1 * dy) / lengthSq));
  return Math.hypot(x1 + t * dx, y1 + t * dy);
}

/** Jarak titik ke batas terdekat dari semua cincin, meter (tanpa tanda). */
export function distanceToBoundaryM(rings: Position[][], point: Position): number {
  let best = Number.POSITIVE_INFINITY;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const distance = distanceToSegmentM(point, ring[j], ring[i]);
      if (distance < best) best = distance;
    }
  }
  return best;
}

/**
 * Posisi titik terhadap satu zona: di dalam atau tidak, dan jarak bertanda ke
 * batas (positif di luar, negatif di dalam).
 *
 * Lubang (cincin kedua dan seterusnya) sengaja tidak dipakai: zona kebun adalah
 * blok tanpa lubang, dan memperlakukannya sebagai lubang akan menambah jalur
 * yang tidak pernah diuji di lapangan.
 */
export function zoneSignedDistance(
  zone: GeofenceZone,
  point: Position,
): { inside: boolean; signedM: number } {
  if (zone.kind === "circle") {
    const distance = haversineM(point, zone.center);
    return { inside: distance <= zone.radiusM, signedM: distance - zone.radiusM };
  }
  const inside = pointInRing(point, zone.rings[0], point[0]);
  const distance = distanceToBoundaryM(zone.rings, point);
  return { inside, signedM: inside ? -distance : distance };
}

/** Titik dari dua nilai mentah; null kalau salah satunya bukan angka. */
function toPosition(lng: unknown, lat: unknown): Position | null {
  const x = Number(lng);
  const y = Number(lat);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

/** Radius dari nilai mentah; null kalau bukan angka positif. */
function positiveMeters(value: unknown): number | null {
  const meters = Number(value);
  return Number.isFinite(meters) && meters > 0 ? meters : null;
}

/**
 * Baca zona dari feature GeoJSON yang disimpan lapisan peta.
 *
 * Bentuk `Circle` tidak seragam: ada yang menyimpan pusat saja (`[lng, lat]`),
 * ada yang menyimpan pusat beserta radiusnya (`[[lng, lat], radius]`). Keduanya
 * harus terbaca, jadi bentuknya ditentukan dari elemen pertama: pasangan
 * berarti bentuk kedua, angka berarti bentuk pertama.
 *
 * Sebelumnya keduanya dipaksa menjadi `Position[]`, sehingga bentuk pertama
 * mengambil radius dari lintang (mis. -6,2 meter): zona lingkaran tidak pernah
 * memuat titik apa pun.
 */
export function zoneFromFeature(feature: Feature<Geometry>): GeofenceZone | null {
  const name = String(feature.properties?.name ?? feature.id ?? "zona");
  const id = String(feature.id ?? name);
  const geometry = feature.geometry as unknown as {
    type?: string;
    coordinates?: unknown;
  } | null;
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  const coordinates: unknown[] = geometry.coordinates;

  if (geometry.type === "Polygon") {
    return { id, name, kind: "polygon", rings: coordinates as Position[][] };
  }
  if (geometry.type !== "Circle") return null;

  const first = coordinates[0];
  const center = Array.isArray(first)
    ? toPosition(first[0], first[1])
    : toPosition(coordinates[0], coordinates[1]);
  if (!center) return null;

  const radiusM =
    positiveMeters(Array.isArray(first) ? coordinates[1] : undefined) ??
    positiveMeters(feature.properties?.geofence_radius_m) ??
    DEFAULT_RADIUS_M;
  return { id, name, kind: "circle", center, radiusM };
}

/**
 * Jurnal peristiwa: daftar yang bisa dilihat, disimpan, dan diekspor CSV, lalu
 * dibaca balik tanpa kolom bergeser.
 *
 * CSV dipakai, bukan JSON, karena hasilnya dibuka di spreadsheet oleh orang
 * kebun. Karena itu kutipan RFC 4180 wajib benar: satu nama area yang memuat
 * koma tidak boleh menggeser kolom sesudahnya.
 */

/** Urutan kolom CSV; nama di sini adalah kepala kolom yang ditulis. */
export const GEOFENCE_CSV_COLUMNS = [
  "area",
  "jenis",
  "waktu",
  "lat",
  "lon",
  "jarak_ke_batas_m",
] as const;

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Tulis peristiwa sebagai CSV (satu baris kepala, lalu satu baris peristiwa). */
export function eventsToCsv(events: readonly GeofenceEvent[]): string {
  const lines = [GEOFENCE_CSV_COLUMNS.join(",")];
  for (const event of events) {
    lines.push(
      [
        csvCell(event.area),
        csvCell(event.kind),
        csvCell(event.at),
        csvCell(event.lat),
        csvCell(event.lng),
        csvCell(event.distanceToBoundaryM),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** Pecah satu baris CSV menjadi sel, menghormati kutip dan kutip ganda. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * Baca CSV hasil {@link eventsToCsv} kembali jadi peristiwa.
 *
 * Melempar galat kalau kepala kolomnya tidak dikenal atau jumlah selnya tidak
 * sama dengan kepala. Diam-diam mengisi kolom yang bergeser lebih buruk
 * daripada menolak berkasnya: jarak ke batas yang tertukar dengan lintang
 * terlihat seperti data yang sah.
 */
export function eventsFromCsv(text: string): GeofenceEvent[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  const index = new Map(header.map((name, position) => [name.trim(), position]));
  for (const column of GEOFENCE_CSV_COLUMNS) {
    if (!index.has(column)) throw new Error(`CSV tidak memuat kolom "${column}"`);
  }
  return lines.slice(1).map((line, lineNumber) => {
    const cells = parseCsvLine(line);
    if (cells.length !== header.length) {
      throw new Error(
        `baris ${lineNumber + 2}: ${cells.length} sel, kepala kolom ${header.length} kolom`,
      );
    }
    const cell = (name: string) => cells[index.get(name) as number];
    const lat = Number(cell("lat"));
    const lng = Number(cell("lon"));
    const distance = Number(cell("jarak_ke_batas_m"));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(distance)) {
      throw new Error(`baris ${lineNumber + 2}: angka tidak terbaca`);
    }
    const kind = cell("jenis");
    if (kind !== "masuk" && kind !== "keluar") {
      throw new Error(`baris ${lineNumber + 2}: jenis tidak dikenal "${kind}"`);
    }
    return { area: cell("area"), kind, at: cell("waktu"), lat, lng, distanceToBoundaryM: distance };
  });
}

export interface GeofenceMonitorOptions {
  /** Lebar pita histeresis di tiap sisi batas, meter. Bawaan 10. */
  hysteresisM?: number;
  /** Pemeriksaan baru dilakukan setelah bergerak sejauh ini, meter. Bawaan 10. */
  minDistanceM?: number;
  /** ...atau setelah selang waktu ini, milidetik. Bawaan 15.000. */
  minIntervalMs?: number;
  /** Jumlah peristiwa yang disimpan sebelum yang tertua dibuang. Bawaan 500. */
  maxEvents?: number;
}

/**
 * Mesin status geofence: histeresis, penjarangan pemeriksaan, dan jurnal.
 *
 * Dipisahkan dari `navigator.geolocation` supaya perilakunya bisa diuji tanpa
 * perangkat: pemanggil memberi posisi dan waktu, kelas ini memutuskan.
 */
export class GeofenceMonitor {
  private zones: GeofenceZone[] = [];
  private status = new Map<string, "inside" | "outside">();
  private journal: GeofenceEvent[] = [];
  private lastChecked: { pos: Position; atMs: number } | null = null;
  private readonly hysteresisM: number;
  private readonly minDistanceM: number;
  private readonly minIntervalMs: number;
  private readonly maxEvents: number;

  constructor(options: GeofenceMonitorOptions = {}) {
    this.hysteresisM = Math.max(0, options.hysteresisM ?? GEOFENCE_DEFAULTS.hysteresisM);
    this.minDistanceM = Math.max(0, options.minDistanceM ?? GEOFENCE_DEFAULTS.minDistanceM);
    this.minIntervalMs = Math.max(0, options.minIntervalMs ?? GEOFENCE_DEFAULTS.minIntervalMs);
    this.maxEvents = Math.max(1, Math.floor(options.maxEvents ?? GEOFENCE_DEFAULTS.maxEvents));
  }

  /**
   * Ganti daftar zona yang dipantau. Zona yang hilang membuang statusnya, jadi
   * zona yang ditambahkan kembali mulai dari keadaan awal lagi, bukan dari
   * status basi yang mungkin sudah tidak sesuai.
   */
  setZones(zones: readonly GeofenceZone[]): void {
    this.zones = [...zones];
    const ids = new Set(zones.map((zone) => zone.id));
    for (const id of [...this.status.keys()]) {
      if (!ids.has(id)) this.status.delete(id);
    }
  }

  getZones(): readonly GeofenceZone[] {
    return this.zones;
  }

  /**
   * Perlu memeriksa posisi ini sekarang?
   *
   * Pemeriksaan tiap detik membakar baterai tanpa menambah ketepatan: posisi
   * GPS bergerak beberapa meter, dan zona kebun lebarnya ratusan meter. Jadi
   * posisi baru diperiksa setelah alat benar-benar berpindah atau setelah
   * selang waktu terlampaui, mana yang lebih dulu.
   */
  shouldEvaluate(pos: Position, atMs: number): boolean {
    if (!this.lastChecked) return true;
    if (atMs - this.lastChecked.atMs >= this.minIntervalMs) return true;
    return haversineM(this.lastChecked.pos, pos) >= this.minDistanceM;
  }

  /**
   * Periksa posisi terhadap semua zona dan kembalikan peristiwa yang lahir dari
   * pemeriksaan ini.
   *
   * Posisi pertama hanya menetapkan status awal tanpa menulis peristiwa:
   * pengguna yang membuka aplikasi di dalam zona tidak sedang "masuk" saat itu.
   */
  update(pos: Position, atMs: number = Date.now()): GeofenceEvent[] {
    if (!this.shouldEvaluate(pos, atMs)) return [];
    this.lastChecked = { pos, atMs };
    const fresh: GeofenceEvent[] = [];
    for (const zone of this.zones) {
      const { inside, signedM } = zoneSignedDistance(zone, pos);
      const previous = this.status.get(zone.id);
      if (previous === undefined) {
        this.status.set(zone.id, inside ? "inside" : "outside");
        continue;
      }
      // Di dalam pita histeresis tidak ada perubahan status: tepat di batas
      // tidak memicu apa pun, ke arah mana pun.
      let next = previous;
      if (previous === "outside" && signedM <= -this.hysteresisM) next = "inside";
      else if (previous === "inside" && signedM >= this.hysteresisM) next = "outside";
      if (next === previous) continue;
      this.status.set(zone.id, next);
      const event: GeofenceEvent = {
        area: zone.name,
        kind: next === "inside" ? "masuk" : "keluar",
        at: new Date(atMs).toISOString(),
        lat: pos[1],
        lng: pos[0],
        distanceToBoundaryM: Math.round(signedM * 100) / 100,
      };
      this.journal.push(event);
      fresh.push(event);
    }
    if (this.journal.length > this.maxEvents) {
      this.journal.splice(0, this.journal.length - this.maxEvents);
    }
    return fresh;
  }

  /** Status zona saat ini, untuk ditampilkan di panel. */
  getStatus(zoneId: string): "inside" | "outside" | "unknown" {
    return this.status.get(zoneId) ?? "unknown";
  }

  events(): readonly GeofenceEvent[] {
    return this.journal;
  }

  /** Isi jurnal dari penyimpanan (mis. setelah aplikasi dibuka lagi). */
  loadEvents(events: readonly GeofenceEvent[]): void {
    this.journal = [...events].slice(-this.maxEvents);
  }

  clearEvents(): void {
    this.journal = [];
  }

  toCsv(): string {
    return eventsToCsv(this.journal);
  }
}

// ---------------------------------------------------------------------------
// Bagian yang menyentuh perangkat: penyimpanan lokal, geolokasi, notifikasi.
// Semuanya dijaga `typeof` supaya modul ini tetap bisa diimpor di Node (uji).
// ---------------------------------------------------------------------------

function loadZones(): FeatureCollection {
  try {
    if (typeof localStorage === "undefined") return { type: "FeatureCollection", features: [] };
    const raw = localStorage.getItem(STORAGE_ZONES);
    if (raw) return JSON.parse(raw) as FeatureCollection;
  } catch {
    /* penyimpanan rusak atau diblokir: mulai dari kosong */
  }
  return { type: "FeatureCollection", features: [] };
}

function saveZones(fc: FeatureCollection): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_ZONES, JSON.stringify(fc));
    }
  } catch {
    /* penyimpanan penuh: bukan kegagalan fatal, zona tetap hidup di sesi ini */
  }
}

function loadEvents(): GeofenceEvent[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_EVENTS);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GeofenceEvent[]) : [];
  } catch {
    return [];
  }
}

function saveEvents(events: readonly GeofenceEvent[]): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_EVENTS, JSON.stringify(events));
    }
  } catch {
    /* jurnal tetap ada di memori */
  }
}

function monitoredZones(fc: FeatureCollection): GeofenceZone[] {
  const zones: GeofenceZone[] = [];
  for (const feature of fc.features) {
    if (!feature.properties?.geofence_monitor) continue;
    const zone = zoneFromFeature(feature as Feature<Geometry>);
    if (zone) zones.push(zone);
  }
  return zones;
}

function notify(event: GeofenceEvent): void {
  const message = `Geofence "${event.area}": ${event.kind.toUpperCase()} zona`;
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("GeoLibre", { body: message });
    }
  } catch {
    /* notifikasi tidak didukung: jurnal tetap mencatat */
  }
  if (typeof console !== "undefined") console.log(`[geofence] ${message}`);
  if (typeof document !== "undefined") {
    const statusEl = document.getElementById(GEOFENCE_STATUS_ID);
    if (statusEl) statusEl.textContent = message;
  }
}

let watchId: number | null = null;

/**
 * Mulai memantau. `monitor` boleh diberikan supaya pemanggil (panel) memakai
 * mesin yang sama dan bisa menampilkan jurnal yang sedang berjalan.
 */
export function startGeofenceMonitor(
  monitor: GeofenceMonitor = new GeofenceMonitor(),
  options: { enableHighAccuracy?: boolean } = {},
): GeofenceMonitor | null {
  if (watchId !== null) return monitor;
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    console.warn("[geofence] Geolokasi tidak tersedia di perangkat ini");
    return null;
  }
  monitor.setZones(monitoredZones(loadZones()));
  monitor.loadEvents(loadEvents());
  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const point: Position = [position.coords.longitude, position.coords.latitude];
      const fresh = monitor.update(point, position.timestamp || Date.now());
      if (fresh.length === 0) return;
      saveEvents(monitor.events());
      for (const event of fresh) notify(event);
    },
    (error) => console.warn("[geofence] posisi gagal", error.code, error.message),
    {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      maximumAge: 5000,
      timeout: 15000,
    },
  );
  return monitor;
}

export function stopGeofenceMonitor(): void {
  if (watchId !== null && typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
}

/** Jurnal peristiwa yang tersimpan, untuk panel dan ekspor CSV. */
export function getGeofenceEvents(): GeofenceEvent[] {
  return loadEvents();
}

/** Ekspor jurnal tersimpan sebagai CSV siap tempel ke spreadsheet. */
export function exportGeofenceEventsCsv(): string {
  return eventsToCsv(loadEvents());
}

export function registerGeofencePlugin(api: GeoLibreAppAPI): GeoLibrePlugin {
  void api;
  return {
    id: GEOFENCE_PLUGIN_ID,
    name: "Geofence",
    version: "0.1.0",
    activeByDefault: false,
    activate: () => {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      startGeofenceMonitor();
    },
    deactivate: () => {
      stopGeofenceMonitor();
    },
  };
}
