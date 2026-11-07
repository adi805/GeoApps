/**
 * Kapan shell ditahan sebelum peta dibuat, karena proyek membawa basemap offline
 * yang gayanya belum terdaftar di proses ini.
 *
 * KENAPA perlu ditahan. `MapCanvas` membuat peta sekali saat shell mount, dan
 * gaya awalnya dibaca dari `basemapStyleUrl` di store. Projektor gaya hidup di
 * memori, jadi proyek yang membawa sentinel `geolibre://offline-basemap/<id>/<n>`
 * belum punya gaya apa pun di detik itu: `resolveMapStyle` tidak menemukan
 * sentinelnya lalu meminta basemap default ke jaringan. Dua kerugian nyata:
 *
 *   1. di lapangan tanpa sinyal, peta tampil kosong sampai pemulihan selesai;
 *   2. dengan sinyal, basemap default sempat menimpa peta offline pengguna.
 *
 * Urutan yang benar adalah proyek dimuat -> gaya didaftarkan -> baru peta dibuat.
 * Berkas ini hanya memutuskan "masih perlu ditahan atau tidak", tanpa React dan
 * tanpa menyentuh IndexedDB, supaya bisa diuji di Node.
 */

import { offlineBasemapIdFromSentinel } from "./offline-basemap-restore";

export interface OfflineBasemapPrewarmInput {
  /**
   * Hanya selama startup. Sesudah peta pernah siap, menahan shell berarti
   * melepas peta yang sedang dipakai pengguna, jadi pemulihan sesudah itu
   * diserahkan ke `useOfflineBasemapRestore` yang mengganti gaya di tempat.
   */
  enabled: boolean;
  /** Batas waktu tunggu sudah habis (storage perangkat menggantung). */
  timedOut: boolean;
  /**
   * URL gaya yang pemulihannya sudah selesai dicoba di proses ini. Disimpan
   * sebagai URL, bukan boolean, supaya proyek lain yang dibuka belakangan tetap
   * mendapat pemulihannya sendiri.
   */
  settledStyleUrl: string | null;
  /** `basemapStyleUrl` di store saat ini. */
  styleUrl: string;
  /** Prefix sentinel (`OFFLINE_BASEMAP_SENTINEL_PREFIX`), disuntik agar modul bebas impor. */
  sentinelPrefix: string;
  /** `getOfflineBasemapStyle(url) !== null`: gaya untuk URL itu sudah terdaftar. */
  isRegistered: (styleUrl: string) => boolean;
}

export function needsOfflineBasemapPrewarm(input: OfflineBasemapPrewarmInput): boolean {
  if (!input.enabled || input.timedOut) return false;
  // Bukan sentinel basemap offline: proyek memakai gaya biasa, tidak ada yang
  // perlu ditunggu dan shell boleh langsung mount.
  if (offlineBasemapIdFromSentinel(input.styleUrl, input.sentinelPrefix) === null) return false;
  // Gaya sudah terdaftar (mis. proyek dibuka ulang di sesi yang sama): peta bisa
  // langsung memakainya tanpa menunggu apa pun.
  if (input.isRegistered(input.styleUrl)) return false;
  // Percobaan untuk URL ini sudah selesai; mengulanginya hanya menahan shell
  // tanpa hasil baru.
  return input.settledStyleUrl !== input.styleUrl;
}
