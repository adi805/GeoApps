/**
 * Penyimpanan byte arsip basemap offline yang tetap ada sesudah app ditutup.
 *
 * KENAPA modul ini ada. Ekstraksi PMTiles (BasemapExtractPanel) sudah berjalan di
 * Android: arsipnya dibuat di memori dan langsung dipakai pada sesi itu. Yang tidak
 * bertahan adalah berkasnya. `saveBinaryFileWithFallback` membuka dialog save sistem,
 * dan di Android dialog itu mengembalikan URI `content://` yang grant bacanya mati
 * bersama proses (lihat `android-content-uri.ts` dan `startup-project-snapshot.ts`);
 * di web tidak ada path sama sekali, jadi `savedPath` selalu null. Akibatnya, sesudah
 * app dibuka lagi, katalog perangkat masih mencatat basemapnya tetapi tidak ada byte
 * yang bisa dibaca, dan pengguna harus memilih ulang berkas `.pmtiles` secara manual.
 *
 * Yang disimpan di sini adalah BYTE arsipnya, di storage milik WebView sendiri
 * (IndexedDB). Ini satu-satunya tempat yang bisa ditulis tanpa izin tambahan, sama di
 * web maupun di APK, dan tidak bergantung pada service worker: protokol `pmtiles://`
 * menyelesaikan arsip dari `FileSource` di memori (`packages/map/src/pmtiles-archive.ts`),
 * jadi begitu byte-nya ada, basemap langsung bisa dipakai.
 *
 * FAKTA PLATFORM yang menentukan aturannya:
 *   - Android: `savedPath` = `content://…` → grant mati bersama proses → harus disalin.
 *   - Web: `savedPath` = null → tidak pernah ada berkas → harus disalin.
 *   - Desktop: `savedPath` = path filesystem biasa → masih terbaca sesudah restart →
 *     TIDAK disalin, karena menyalin arsip 100 MB ke IndexedDB hanya menggandakan
 *     pemakaian disk tanpa menambah kemampuan apa pun.
 *
 * Tabel byte-nya memakai adapter IndexedDB yang sudah dipakai bundel proyek web
 * (`project-bundle-web.ts`), disuntikkan lewat antarmuka `BundleFileTable` supaya
 * aturannya bisa diuji di Node tanpa browser. Tidak ada impor Tauri, DOM, atau React
 * di berkas ini.
 */

import { isAndroidContentUri } from "./android-content-uri";
import type { OfflineBasemap } from "./offline-basemaps";
import { type BundleFileTable, indexedDbBundleFiles } from "./project-bundle-web";

/**
 * Database IndexedDB khusus arsip basemap, terpisah dari bundel proyek.
 *
 * Dipisah supaya menghapus semua bundel proyek (atau membersihkan database bundel
 * karena rusak) tidak ikut membuang basemap offline yang sudah diunduh. Versi
 * database ditentukan adapter (`indexedDbBundleFiles`, saat ini 1) dan tidak perlu
 * disebut di sini: satu store, tanpa index, jadi tidak ada migrasi yang mungkin
 * dibutuhkan sampai bentuk recordnya berubah.
 */
export const OFFLINE_ARCHIVE_DB_NAME = "geolibre-offline-basemaps-archive";

/**
 * Prefix semua kunci arsip basemap. Kunci berbentuk datar (`basemap/<id>.pmtiles`)
 * dan bukan bertingkat seperti bundel proyek: satu basemap satu arsip, jadi tidak
 * ada pohon yang perlu dipindai per proyek.
 */
export const OFFLINE_ARCHIVE_KEY_PREFIX = "basemap/";

/**
 * Kunci record byte untuk satu basemap.
 *
 * Id yang kosong ditolak, bukan dirapikan: dengan kunci datar, id kosong akan
 * menghasilkan satu record `basemap/.pmtiles` yang dipakai bergantian oleh setiap
 * basemap tanpa id — satu ekstrak menimpa arsip basemap lain tanpa jejak.
 */
export function offlineArchiveKey(id: string): string {
  const trimmed = id.trim();
  if (trimmed === "") throw new Error("Basemap id tidak boleh kosong untuk menyimpan arsip.");
  return `${OFFLINE_ARCHIVE_KEY_PREFIX}${trimmed}.pmtiles`;
}

/**
 * Kunci registrasi arsip di protokol `pmtiles://` untuk satu basemap.
 *
 * Sengaja BUKAN {@link offlineArchiveKey}: yang itu kunci record di IndexedDB dan
 * memakai prefix `basemap/` supaya tidak bercampur dengan data lain. Kunci protokol
 * tetap `<id>.pmtiles` karena itulah yang sudah dipakai BasemapExtractPanel untuk
 * `registerPMTilesArchive`, gaya basemap tersimpan, dan URL overlay — menggantinya
 * akan membuat basemap yang sedang dipakai di sesi ini tidak lagi cocok dengan
 * entri katalognya.
 */
export function offlineArchiveRegistrationKey(id: string): string {
  return `${id}.pmtiles`;
}

/**
 * Kebalikan {@link offlineArchiveKey}: id basemap dari sebuah kunci, atau null bila
 * kunci itu bukan arsip basemap (prefix lain, atau ekstensinya bukan `.pmtiles`).
 *
 * Sengaja menolak kunci bertingkat (`basemap/a/b.pmtiles`): adapter IndexedDB tidak
 * pernah membuatnya, jadi kunci seperti itu berarti data dari tempat lain, dan
 * menerimanya akan membuat daftar basemap menampilkan entri yang tidak bisa dipulihkan.
 */
export function offlineArchiveIdFromKey(key: string): string | null {
  if (!key.startsWith(OFFLINE_ARCHIVE_KEY_PREFIX)) return null;
  const rest = key.slice(OFFLINE_ARCHIVE_KEY_PREFIX.length);
  if (!rest.endsWith(".pmtiles") || rest.includes("/")) return null;
  const id = rest.slice(0, -".pmtiles".length);
  return id === "" ? null : id;
}

/**
 * Tabel byte arsip di IndexedDB perangkat.
 *
 * `factory`/`dbName` disuntikkan hanya untuk uji; pemanggil produksi memakai
 * default. Tabel ini dipakai berulang, jadi koneksi IndexedDB-nya dipegang oleh
 * adapter (lihat `indexedDbBundleFiles`).
 */
export function createOfflineArchiveTable(
  options: { factory?: IDBFactory; dbName?: string } = {},
): BundleFileTable {
  return indexedDbBundleFiles({
    dbName: options.dbName ?? OFFLINE_ARCHIVE_DB_NAME,
    ...(options.factory ? { factory: options.factory } : {}),
  });
}

let deviceTable: BundleFileTable | undefined;

/**
 * Tabel default (satu instance per proses). Dibuat malas, bukan saat modul
 * diimpor, supaya impor modul ini tidak menyentuh `indexedDB` sama sekali — Node
 * tidak punya IndexedDB, dan modul yang dipakai bersama web/APK tidak boleh gagal
 * hanya karena diimpor.
 */
function defaultTable(): BundleFileTable {
  deviceTable ??= createOfflineArchiveTable();
  return deviceTable;
}

let persistenceRequested = false;

/**
 * Minta storage-nya dijadikan persisten, sekali per proses, best-effort.
 *
 * KENAPA: IndexedDB bisa diusir browser di bawah tekanan penyimpanan. Pada APK data
 * WebView ada di direktori app, tapi tanpa `persist()` tidak ada jaminan apa pun.
 * Kegagalan (browser menolak, API tidak ada) diabaikan: menolak menyimpan arsip hanya
 * karena permintaan ini ditolak akan membuat fitur offline mati di perangkat yang
 * sebenarnya sanggup menyimpannya.
 */
async function requestPersistentStorage(): Promise<void> {
  if (persistenceRequested) return;
  persistenceRequested = true;
  try {
    await globalThis.navigator?.storage?.persist?.();
  } catch {
    // Best-effort: lihat komentar di atas.
  }
}

/**
 * Menyimpan byte satu arsip basemap. Menimpa arsip lama dengan id yang sama.
 *
 * `table` hanya diisi oleh uji; pemanggil produksi membiarkannya kosong.
 */
export async function storeOfflineArchiveBytes(
  id: string,
  bytes: Uint8Array,
  table?: BundleFileTable,
): Promise<void> {
  if (!table) await requestPersistentStorage();
  await (table ?? defaultTable()).put(offlineArchiveKey(id), bytes);
}

/**
 * Byte satu arsip basemap, atau null bila tidak ada (belum pernah disimpan, sudah
 * dihapus, atau arsipnya bukan milik id ini).
 */
export async function readOfflineArchiveBytes(
  id: string,
  table?: BundleFileTable,
): Promise<Uint8Array | null> {
  const key = offlineArchiveKey(id);
  const stored = await (table ?? defaultTable()).get(key);
  // Adapter mengembalikan undefined untuk record yang hilang dan untuk nilai yang
  // bukan byte (mis. record rusak dari versi lain). Dua-duanya berarti "tidak bisa
  // dipakai", yang bagi pemanggil sama saja dengan tidak ada.
  return stored ?? null;
}

/** Menghapus byte satu arsip basemap. Tidak melempar bila memang belum ada. */
export async function deleteOfflineArchiveBytes(
  id: string,
  table?: BundleFileTable,
): Promise<void> {
  await (table ?? defaultTable()).delete(offlineArchiveKey(id));
}

/** Id basemap yang byte-nya benar-benar tersimpan di perangkat ini. */
export async function listStoredOfflineArchiveIds(table?: BundleFileTable): Promise<string[]> {
  const keys = await (table ?? defaultTable()).keys(OFFLINE_ARCHIVE_KEY_PREFIX);
  return keys
    .map((key) => offlineArchiveIdFromKey(key))
    .filter((id): id is string => id !== null)
    .sort();
}

/**
 * Menghapus byte arsip yang basemapnya sudah tidak ada di katalog perangkat.
 *
 * KENAPA perlu: katalog (`offline-basemaps.ts`) dan tabel byte ini dua tempat yang
 * berbeda, dan tombol hapus di UI hanya menyentuh katalog. Tanpa sapuan ini, setiap
 * basemap yang dihapus meninggalkan arsipnya di storage dan pemakaian disk tumbuh
 * diam-diam sampai kuota habis. Aman dijalankan kapan saja: id yang masih ada di
 * katalog tidak pernah disentuh.
 *
 * @param knownIds - Id yang masih terdaftar di katalog perangkat.
 * @returns Id yang byte-nya benar-benar dihapus, urut abjad (untuk log/diagnostik).
 */
export async function pruneOfflineArchiveBytes(
  knownIds: readonly string[],
  table?: BundleFileTable,
): Promise<string[]> {
  const keep = new Set(knownIds);
  const stored = await listStoredOfflineArchiveIds(table);
  const removed: string[] = [];
  for (const id of stored) {
    if (keep.has(id)) continue;
    await deleteOfflineArchiveBytes(id, table);
    removed.push(id);
  }
  return removed;
}

/**
 * Apakah arsip basemap ini harus disalin ke storage perangkat?
 *
 * Lihat "FAKTA PLATFORM" di kepala berkas: tanpa path (web) atau dengan URI
 * `content://` (Android) berarti tidak ada berkas yang bisa dibaca ulang sesudah
 * proses mati, jadi byte-nya wajib disalin. Path filesystem biasa tidak.
 */
export function shouldStoreOfflineArchive(savedPath: string | null | undefined): boolean {
  if (savedPath === null || savedPath === undefined) return true;
  if (savedPath.trim() === "") return true;
  return isAndroidContentUri(savedPath);
}

/**
 * Menyalin byte arsip ke storage perangkat bila platform ini membutuhkannya.
 *
 * Dipanggil tepat sesudah ekstraksi, sebelum katalog perangkat mencatat entri, supaya
 * entri yang tercatat selalu punya byte yang bisa dipulihkan. Mengembalikan "stored"
 * atau "skipped" (desktop) agar pemanggil bisa memberi tahu pengguna dengan jujur
 * apakah basemap ini akan hidup lagi tanpa memilih berkas.
 */
export async function persistOfflineArchiveIfNeeded(
  entry: Pick<OfflineBasemap, "id" | "savedPath">,
  bytes: Uint8Array,
  table?: BundleFileTable,
): Promise<"stored" | "skipped"> {
  if (!shouldStoreOfflineArchive(entry.savedPath)) return "skipped";
  await storeOfflineArchiveBytes(entry.id, bytes, table);
  return "stored";
}

/** Sumber byte yang dipakai untuk memulihkan satu basemap, dan dari mana asalnya. */
export type RestoredOfflineArchive =
  /** Sudah terdaftar di protokol pmtiles sesi ini (ekstrak baru, belum ditutup). */
  | { kind: "session"; url: string }
  /** Dibaca dari storage perangkat (jalur web + Android). */
  | { kind: "device-store"; url: string }
  /** Dibaca dari path filesystem (jalur desktop). */
  | { kind: "file"; url: string }
  /** Tidak ada sumber yang bisa dibaca: pemanggil harus menawarkan pemilih berkas. */
  | { kind: "missing" };

/** Ketergantungan pemulihan, disuntikkan supaya aturannya bisa diuji di Node. */
export interface RestoreOfflineArchiveDeps {
  /** Apakah kunci ini sudah terdaftar di protokol pmtiles (`hasPMTilesArchive`). */
  isRegistered: (key: string) => boolean;
  /** Mendaftarkan byte dan mengembalikan URL `pmtiles://…` (`registerPMTilesArchive`). */
  register: (key: string, bytes: Uint8Array) => string;
  /** Tabel byte perangkat; default tabel IndexedDB. */
  table?: BundleFileTable;
  /**
   * Pembaca path filesystem (`readLocalFileBytes`). Tidak diisi di web, dan tidak
   * pernah dipakai untuk URI `content://` meskipun diisi.
   */
  readFile?: (path: string) => Promise<Uint8Array>;
}

/**
 * Memulihkan arsip satu basemap tersimpan dan mengembalikan URL siap pakai.
 *
 * Urutannya menentukan perilaku per platform:
 *   1. arsip sudah terdaftar di sesi ini → tidak perlu baca apa pun;
 *   2. byte ada di storage perangkat → dipakai (web + Android: satu-satunya sumber
 *      yang selamat dari restart);
 *   3. path filesystem yang masih hidup → dibaca (desktop, tanpa menggandakan byte);
 *   4. selain itu `missing` — JANGAN menebak, karena URI `content://` yang grant-nya
 *      sudah mati akan gagal di tengah pemuatan gaya basemap dan tampak seperti bug
 *      yang tidak bisa dijelaskan pengguna.
 */
export async function resolveOfflineBasemapArchive(
  entry: Pick<OfflineBasemap, "id" | "savedPath">,
  deps: RestoreOfflineArchiveDeps,
): Promise<RestoredOfflineArchive> {
  const key = offlineArchiveRegistrationKey(entry.id);
  if (deps.isRegistered(key)) return { kind: "session", url: `pmtiles://${key}` };

  const stored = await readOfflineArchiveBytes(entry.id, deps.table);
  if (stored) return { kind: "device-store", url: deps.register(key, stored) };

  const path = entry.savedPath;
  if (path && path.trim() !== "" && !isAndroidContentUri(path) && deps.readFile) {
    const bytes = await deps.readFile(path);
    return { kind: "file", url: deps.register(key, bytes) };
  }

  return { kind: "missing" };
}