/**
 * Gerbang "tahan shell sampai basemap offline pulih" (issue #11).
 *
 * Kenapa uji ini ada: `MapCanvas` membuat peta sekali saat shell mount dan
 * membaca `basemapStyleUrl` pada detik itu. Proyek yang membawa sentinel
 * `geolibre://offline-basemap/<id>/<nomor>` belum punya gaya terdaftar di proses
 * baru, jadi peta meminta basemap default ke jaringan lebih dulu. Di lapangan
 * tanpa sinyal hasilnya peta kosong; dengan sinyal, basemap default sempat
 * menimpa peta offline pengguna.
 *
 * Yang diuji hanya keputusan "masih perlu ditahan atau tidak". Efek sampingnya
 * (pembacaan IndexedDB, pendaftaran protokol, penulisan store) ada di
 * `offline-basemap-startup.ts` dan tidak dijalankan di sini.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { needsOfflineBasemapPrewarm } from "../apps/geolibre-desktop/src/lib/offline-basemap-prewarm";

const SENTINEL_PREFIX = "geolibre://offline-basemap/";
const LIBERTY = "https://tiles.openfreemap.org/styles/liberty";

/** Input dasar: startup, sentinel proyek, belum terdaftar, belum pernah dicoba. */
function input(overrides: Partial<Parameters<typeof needsOfflineBasemapPrewarm>[0]> = {}) {
  return {
    enabled: true,
    timedOut: false,
    settledStyleUrl: null,
    styleUrl: `${SENTINEL_PREFIX}zona-utara/7`,
    sentinelPrefix: SENTINEL_PREFIX,
    isRegistered: () => false,
    ...overrides,
  };
}

describe("needsOfflineBasemapPrewarm", () => {
  it("menahan shell untuk sentinel offline yang gayanya belum terdaftar", () => {
    assert.equal(needsOfflineBasemapPrewarm(input()), true);
  });

  it("sentinel tanpa nomor urut tetap dianggap basemap offline", () => {
    // Format nomor itu milik `registerOfflineBasemapStyle`, bukan bagian dari
    // kontrak proyek; pemulihan tidak boleh bergantung padanya.
    assert.equal(
      needsOfflineBasemapPrewarm(input({ styleUrl: `${SENTINEL_PREFIX}zona-utara` })),
      true,
    );
  });

  it("proyek dengan gaya biasa tidak pernah ditahan", () => {
    // Basemap default bukan alasan menahan startup: tidak ada arsip yang perlu
    // dibaca, jadi shell boleh langsung mount.
    assert.equal(needsOfflineBasemapPrewarm(input({ styleUrl: LIBERTY })), false);
  });

  it("gaya yang sudah terdaftar tidak ditahan lagi", () => {
    assert.equal(needsOfflineBasemapPrewarm(input({ isRegistered: () => true })), false);
  });

  it("URL yang pemulihannya sudah dicoba tidak diulang", () => {
    assert.equal(
      needsOfflineBasemapPrewarm(
        input({ settledStyleUrl: `${SENTINEL_PREFIX}zona-utara/7` }),
      ),
      false,
    );
  });

  it("proyek lain tetap mendapat pemulihannya sendiri", () => {
    // Penanda disimpan sebagai URL, bukan boolean, supaya membuka proyek kedua
    // di sesi yang sama tidak ikut dilewati.
    assert.equal(
      needsOfflineBasemapPrewarm(
        input({ settledStyleUrl: `${SENTINEL_PREFIX}zona-selatan/3` }),
      ),
      true,
    );
  });

  it("batas waktu habis berarti shell dilepas", () => {
    assert.equal(needsOfflineBasemapPrewarm(input({ timedOut: true })), false);
  });

  it("sesudah peta pernah siap, shell tidak boleh dilepas lagi", () => {
    assert.equal(needsOfflineBasemapPrewarm(input({ enabled: false })), false);
  });
});
