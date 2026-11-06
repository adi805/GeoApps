/**
 * Menyalakan kembali basemap offline sesudah app ditutup.
 *
 * KENAPA modul ini ada. `offline-basemap-archive.ts` sudah bisa menyimpan byte
 * arsip dan membacanya kembali, tetapi tidak ada kode produksi yang memanggilnya:
 * `grep` hanya menemukan berkas ujinya. Akibatnya, di web dan di APK, basemap yang
 * sudah diunduh hilang setiap kali app dibuka ulang — katalognya masih mencatat
 * entri, tetapi tidak ada byte yang bisa dipakai.
 *
 * Yang menghubungkan keduanya ada dua tempat:
 *   - ekstraksi baru  → `persistOfflineArchiveIfNeeded` (dipanggil BasemapExtractPanel);
 *   - proyek dibuka   → modul ini.
 *
 * Modul ini sengaja tidak mengimpor React, store, atau `@geolibre/map`. Tugasnya
 * hanya menjawab satu pertanyaan: "untuk sentinel basemap ini, dari mana byte-nya
 * bisa dibaca?" Semua efek (mendaftarkan protokol, menyusun gaya, menulis store)
 * tetap di pemanggil. Dengan begitu aturannya bisa diuji di Node.
 */

import {
  resolveOfflineBasemapArchive,
  type RestoredOfflineArchive,
  type RestoreOfflineArchiveDeps,
} from "./offline-basemap-archive";
import type { OfflineBasemap } from "./offline-basemaps";

/** Dari mana byte basemap yang dipulihkan berasal (`session`/`device-store`/`file`). */
export type OfflineBasemapRestoreSource = RestoredOfflineArchive["kind"];

/** Hasil satu percobaan memulihkan basemap dari sebuah `basemapStyleUrl`. */
export type OfflineBasemapRestoreOutcome =
  /** Bukan sentinel basemap offline: tidak ada yang perlu dikerjakan. */
  | { kind: "not-offline" }
  /** Sentinel menunjuk id yang tidak ada di katalog perangkat (entri sudah dihapus). */
  | { kind: "unknown-entry"; id: string }
  /** Entri ada tetapi bukan basemap bergaya (overlay, atau flavor null). */
  | { kind: "unsupported"; id: string }
  /** Tidak ada sumber byte yang bisa dibaca: pengguna harus memilih berkas lagi. */
  | { kind: "missing"; id: string }
  /** Sumber ada tetapi gagal dibaca (mis. path desktop sudah dipindahkan). */
  | { kind: "unreadable"; id: string; error: string }
  | { kind: "restored"; entry: OfflineBasemap; url: string; source: OfflineBasemapRestoreSource };

/**
 * Id basemap dari sebuah sentinel `geolibre://offline-basemap/<id>/<nomor>`, atau
 * `null` bila URL itu bukan sentinel.
 *
 * Nomor urut di belakang id dibuat `registerOfflineBasemapStyle` supaya setiap
 * penerapan gaya menghasilkan URL yang berbeda (peta perlu melihat "berubah" agar
 * mau memasang gayanya). Saat memulihkan, nomor itu tidak berarti apa-apa: yang
 * dicari hanya id-nya. Sentinel tanpa nomor tetap diterima, karena gaya yang
 * dipulihkan bukan sumber kebenaran untuk format URL.
 */
export function offlineBasemapIdFromSentinel(
  styleUrl: string | null | undefined,
  sentinelPrefix: string,
): string | null {
  if (!styleUrl || sentinelPrefix === "" || !styleUrl.startsWith(sentinelPrefix)) return null;
  const rest = styleUrl.slice(sentinelPrefix.length);
  const slash = rest.indexOf("/");
  const id = slash === -1 ? rest : rest.slice(0, slash);
  return id === "" ? null : id;
}

/**
 * Apakah entri katalog ini bisa dipasang kembali sebagai basemap bergaya.
 *
 * Aturannya sama dengan `applySaved` di BasemapExtractPanel: hanya arsip vektor
 * dengan flavor yang punya gaya Protomaps. Entri overlay (`flavor === null`)
 * dipaksa lewat `buildProtomapsBasemapStyle` akan menghasilkan basemap kosong,
 * jadi lebih jujur tidak menyentuhnya.
 */
export function isReapplicableOfflineBasemap(entry: OfflineBasemap): boolean {
  return entry.tileType === "vector" && entry.flavor !== null;
}

export interface RestoreOfflineBasemapOptions {
  /** Prefix sentinel (`OFFLINE_BASEMAP_SENTINEL_PREFIX`), disuntik agar modul bebas impor. */
  sentinelPrefix: string;
  /** Katalog perangkat saat ini (`loadOfflineBasemaps()`). */
  entries: readonly OfflineBasemap[];
  /** Sumber byte: pendaftar pmtiles, tabel perangkat, dan pembaca path opsional. */
  deps: RestoreOfflineArchiveDeps;
}

/**
 * Memulihkan basemap yang dirujuk sebuah `basemapStyleUrl` tersimpan.
 *
 * Proyek menyimpan sentinel, bukan gaya inline: registri gaya hidup di memori dan
 * hilang bersama proses. Tanpa pemulihan, `resolveMapStyle` tidak menemukan gaya
 * untuk sentinel itu dan peta diam-diam kembali ke basemap default — persis
 * keluhan "basemap offline hilang setelah app ditutup".
 *
 * Urutan sumber byte didelegasikan ke `resolveOfflineBasemapArchive` (sesi ini →
 * storage perangkat → path filesystem), karena urutan itu sudah dipakai jalur
 * "pakai sebagai basemap" dan tidak boleh bercabang dua aturan.
 */
export async function restoreOfflineBasemapForStyleUrl(
  styleUrl: string | null | undefined,
  options: RestoreOfflineBasemapOptions,
): Promise<OfflineBasemapRestoreOutcome> {
  const id = offlineBasemapIdFromSentinel(styleUrl, options.sentinelPrefix);
  if (id === null) return { kind: "not-offline" };

  const entry = options.entries.find((candidate) => candidate.id === id);
  if (!entry) return { kind: "unknown-entry", id };
  if (!isReapplicableOfflineBasemap(entry)) return { kind: "unsupported", id };

  let resolved: RestoredOfflineArchive;
  try {
    resolved = await resolveOfflineBasemapArchive(entry, options.deps);
  } catch (error) {
    // Path desktop yang sudah dipindah/dihapus melempar di sini. Dibedakan dari
    // `missing` supaya pemanggil bisa memberi pesan yang benar, bukan menyuruh
    // pengguna memilih berkas untuk basemap yang sebenarnya masih terdaftar.
    return { kind: "unreadable", id, error: error instanceof Error ? error.message : String(error) };
  }

  if (resolved.kind === "missing") return { kind: "missing", id };
  return { kind: "restored", entry, url: resolved.url, source: resolved.kind };
}