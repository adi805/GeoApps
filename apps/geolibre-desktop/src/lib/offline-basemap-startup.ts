/**
 * Memulihkan basemap offline yang dirujuk sebuah proyek saat app dibuka.
 *
 * KENAPA terpisah dari BasemapExtractPanel: panel itu hanya hidup selama panelnya
 * terbuka, sedangkan pemulihan harus berjalan di jalur startup sebelum shell
 * dirender. Aturan "dari mana byte-nya dibaca" tetap di `offline-basemap-restore.ts`
 * (murni, teruji di Node); berkas ini hanya menyambungkannya ke store, protokol
 * pmtiles, dan gaya Protomaps.
 *
 * Gejala yang diperbaiki: proyek menyimpan SENTINEL
 * `geolibre://offline-basemap/<id>/<nomor>`, bukan gaya inline. Registri gaya
 * hidup di memori dan hilang bersama proses, jadi setelah restart
 * `resolveMapStyle` tidak menemukan apa pun untuk sentinel itu dan peta
 * diam-diam kembali ke basemap default. Bagi pengguna itu terbaca sebagai
 * "basemap offline-nya hilang", padahal arsipnya masih ada di perangkat.
 */

import { useAppStore } from "@geolibre/core";
import {
  buildProtomapsBasemapStyle,
  getOfflineBasemapStyle,
  hasPMTilesArchive,
  OFFLINE_BASEMAP_SENTINEL_PREFIX,
  registerOfflineBasemapStyle,
  registerPMTilesArchive,
  type ProtomapsFlavor,
} from "@geolibre/map";
import i18next from "i18next";
import { basemapAssetsBase } from "./basemap-assets";
import { notify } from "./notify";
import { pruneOfflineArchiveBytes } from "./offline-basemap-archive";
import { restoreOfflineBasemapForStyleUrl } from "./offline-basemap-restore";
import { loadOfflineBasemaps } from "./offline-basemaps";
import { isTauri, readLocalFileBytes } from "./tauri-io";

/** Sentinel yang sudah dicoba di proses ini, supaya pemanggilan berulang tidak
 * mengulang pembacaan IndexedDB untuk hasil yang sudah diketahui. */
const attemptedStyleUrls = new Set<string>();

/**
 * Memulihkan basemap offline milik proyek yang baru dimuat, bila ada.
 *
 * Aman dipanggil kapan saja: URL yang bukan sentinel basemap offline langsung
 * keluar tanpa menyentuh store, jadi proyek biasa tidak terpengaruh.
 *
 * @returns `true` bila basemap benar-benar dipulihkan dan dipasang.
 */
export async function restoreStartupOfflineBasemap(): Promise<boolean> {
  const styleUrl = useAppStore.getState().basemapStyleUrl;
  // Gaya untuk sentinel ini sudah terdaftar (mis. baru dipulihkan di jalur
  // startup): tidak ada yang perlu dikerjakan, dan memasang ulang hanya
  // membuat peta berganti gaya tanpa manfaat.
  if (getOfflineBasemapStyle(styleUrl)) return false;
  // Satu sentinel dicoba sekali per proses. Pemanggilnya adalah efek yang jalan
  // pada setiap pemuatan proyek dan setiap inisialisasi ulang peta, sedangkan
  // hasil untuk URL yang sama tidak akan berubah di tengah sesi.
  if (attemptedStyleUrls.has(styleUrl)) return false;
  attemptedStyleUrls.add(styleUrl);

  const entries = loadOfflineBasemaps();

  // Sapuan byte yatim: katalog dan tabel byte adalah dua tempat berbeda, dan
  // tombol hapus hanya menyentuh katalog. Best-effort — storage yang ditolak
  // (mode privat, kuota habis) tidak boleh menghalangi pemulihan basemap.
  void pruneOfflineArchiveBytes(entries.map((entry) => entry.id)).catch((error: unknown) => {
    console.warn("[offline-basemap] sapuan byte yatim gagal", error);
  });

  const outcome = await restoreOfflineBasemapForStyleUrl(styleUrl, {
    sentinelPrefix: OFFLINE_BASEMAP_SENTINEL_PREFIX,
    entries,
    deps: {
      isRegistered: hasPMTilesArchive,
      register: registerPMTilesArchive,
      ...(isTauri() ? { readFile: readLocalFileBytes } : {}),
    },
  });

  if (outcome.kind === "restored") {
    const style = buildProtomapsBasemapStyle({
      sourceUrl: outcome.url,
      flavor: outcome.entry.flavor as ProtomapsFlavor,
      assetsBaseUrl: basemapAssetsBase(),
    });
    useAppStore.getState().setBasemapStyleUrl(
      registerOfflineBasemapStyle(outcome.entry.id, style),
    );
    return true;
  }

  if (outcome.kind === "missing" || outcome.kind === "unreadable") {
    // Jujur ke pengguna: peta akan tampil dengan basemap default. Tanpa pesan
    // ini kejadiannya terbaca sebagai bug, bukan arsip yang tidak ada di
    // perangkat. Satu kali saja per sesi, karena kasusnya tidak akan sembuh
    // sendiri kalau pemulihan dicoba berulang.
    notify.warning(i18next.t("notifications.offlineBasemapRestoreFailed"), {
      dedupeKey: "offline-basemap-restore",
    });
  }

  // `not-offline`: proyek memakai basemap biasa.
  // `unknown-entry`/`unsupported`: katalog tidak lagi punya basemap bergaya itu,
  // jadi tidak ada yang bisa dipasang dan tidak ada yang bisa disalahkan.
  return false;
}