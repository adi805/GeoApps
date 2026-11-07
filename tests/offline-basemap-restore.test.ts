/**
 * Pemulihan basemap offline sesudah app ditutup (issue #11, lane `offline`).
 *
 * Kenapa uji ini ada: proyek hanya menyimpan SENTINEL
 * `geolibre://offline-basemap/<id>/<nomor>`, sedangkan registri gaya hidup di
 * memori dan hilang bersama proses. Tanpa pemulihan, `resolveMapStyle` tidak
 * menemukan gaya untuk sentinel itu dan peta diam-diam kembali ke basemap
 * default — bagi pengguna terbaca sebagai "basemap offline-nya hilang".
 *
 * Yang diuji adalah aturannya (sentinel mana yang dipulihkan, dari sumber byte
 * mana), bukan IndexedDB atau WebView-nya. Tabel byte disuntikkan seperti di
 * `offline-basemap-archive.test.ts`.
 */

/* `it()` di node:test mengembalikan promise yang dilacak runner, bukan promise
 * yang menunggu di-await di sini, jadi aturan no-floating-promises tidak bisa
 * tahu itu. */
/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BundleFileTable } from "../apps/geolibre-desktop/src/lib/project-bundle-web";
import { storeOfflineArchiveBytes } from "../apps/geolibre-desktop/src/lib/offline-basemap-archive";
import type { OfflineBasemap } from "../apps/geolibre-desktop/src/lib/offline-basemaps";
import {
  isReapplicableOfflineBasemap,
  offlineBasemapIdFromSentinel,
  restoreOfflineBasemapForStyleUrl,
  type RestoreOfflineBasemapOptions,
} from "../apps/geolibre-desktop/src/lib/offline-basemap-restore";

const SENTINEL_PREFIX = "geolibre://offline-basemap/";

/** Tabel Map biasa: aturan modul diuji tanpa IndexedDB ikut campur. */
function memoryTable(): BundleFileTable {
  const raw = new Map<string, Uint8Array>();
  return {
    put: async (key, bytes) => {
      raw.set(key, bytes);
    },
    get: async (key) => raw.get(key),
    keys: async (prefix) => [...raw.keys()].filter((key) => key.startsWith(prefix)),
    delete: async (key) => {
      raw.delete(key);
    },
  };
}

function makeEntry(overrides: Partial<OfflineBasemap> = {}): OfflineBasemap {
  return {
    id: "zona-utara",
    name: "Zona Utara",
    bbox: [95, -11, 141, 6],
    minZoom: 0,
    maxZoom: 14,
    flavor: "light",
    tileType: "vector",
    bytes: 1024,
    savedPath: null,
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

/** Dependensi tiruan yang mencatat pendaftaran, supaya sumber byte bisa dibuktikan. */
function makeDeps(overrides: Partial<RestoreOfflineBasemapOptions["deps"]> = {}) {
  const registered: string[] = [];
  const deps: RestoreOfflineBasemapOptions["deps"] = {
    isRegistered: () => false,
    register: (key) => {
      registered.push(key);
      return `pmtiles://${key}`;
    },
    ...overrides,
  };
  return { deps, registered };
}

describe("offlineBasemapIdFromSentinel", () => {
  it("mengambil id dan membuang nomor urut yang dipakai untuk memaksa ganti gaya", () => {
    assert.equal(offlineBasemapIdFromSentinel(`${SENTINEL_PREFIX}zona-utara/7`, SENTINEL_PREFIX), "zona-utara");
  });

  it("tetap menerima sentinel tanpa nomor urut", () => {
    // Nomor urut itu detail format internal; id-nya yang menentukan arsip mana
    // yang dibaca, jadi bentuk tanpa nomor tidak boleh dianggap rusak.
    assert.equal(offlineBasemapIdFromSentinel(`${SENTINEL_PREFIX}zona-utara`, SENTINEL_PREFIX), "zona-utara");
  });

  it("menolak URL yang bukan sentinel basemap offline", () => {
    assert.equal(offlineBasemapIdFromSentinel("https://example.com/style.json", SENTINEL_PREFIX), null);
    assert.equal(offlineBasemapIdFromSentinel("geolibre://material-basemap/zona-utara", SENTINEL_PREFIX), null);
    assert.equal(offlineBasemapIdFromSentinel(null, SENTINEL_PREFIX), null);
    assert.equal(offlineBasemapIdFromSentinel(undefined, SENTINEL_PREFIX), null);
    assert.equal(offlineBasemapIdFromSentinel("", SENTINEL_PREFIX), null);
  });

  it("menolak prefix kosong, yang akan membuat setiap URL terlihat seperti sentinel", () => {
    assert.equal(offlineBasemapIdFromSentinel("https://example.com/style.json", ""), null);
  });

  it("mengembalikan null ketika sentinel tidak membawa id", () => {
    assert.equal(offlineBasemapIdFromSentinel(SENTINEL_PREFIX, SENTINEL_PREFIX), null);
    assert.equal(offlineBasemapIdFromSentinel(`${SENTINEL_PREFIX}/3`, SENTINEL_PREFIX), null);
  });
});

describe("isReapplicableOfflineBasemap", () => {
  it("menerima arsip vektor yang punya flavor Protomaps", () => {
    assert.equal(isReapplicableOfflineBasemap(makeEntry()), true);
  });

  it("menolak entri overlay, karena flavor null akan menghasilkan basemap kosong", () => {
    assert.equal(isReapplicableOfflineBasemap(makeEntry({ flavor: null })), false);
  });

  it("menolak arsip raster, yang tidak punya gaya Protomaps", () => {
    assert.equal(isReapplicableOfflineBasemap(makeEntry({ tileType: "raster" })), false);
  });
});

describe("restoreOfflineBasemapForStyleUrl", () => {
  it("tidak menyentuh apa pun ketika proyek memakai basemap biasa", async () => {
    const { deps, registered } = makeDeps();
    const outcome = await restoreOfflineBasemapForStyleUrl("https://example.com/style.json", {
      sentinelPrefix: SENTINEL_PREFIX,
      entries: [makeEntry()],
      deps,
    });

    assert.deepEqual(outcome, { kind: "not-offline" });
    assert.deepEqual(registered, []);
  });

  it("melaporkan unknown-entry ketika katalog tidak lagi punya id itu", async () => {
    // Entri sudah dihapus pengguna lain di perangkat ini: tidak ada arsip yang
    // bisa dipakai, tapi juga tidak ada yang rusak.
    const { deps } = makeDeps();
    const outcome = await restoreOfflineBasemapForStyleUrl(`${SENTINEL_PREFIX}hantu/1`, {
      sentinelPrefix: SENTINEL_PREFIX,
      entries: [makeEntry()],
      deps,
    });

    assert.deepEqual(outcome, { kind: "unknown-entry", id: "hantu" });
  });

  it("melaporkan unsupported untuk entri overlay, bukan memasang gaya kosong", async () => {
    const { deps, registered } = makeDeps();
    const outcome = await restoreOfflineBasemapForStyleUrl(`${SENTINEL_PREFIX}overlay/1`, {
      sentinelPrefix: SENTINEL_PREFIX,
      entries: [makeEntry({ id: "overlay", flavor: null })],
      deps,
    });

    assert.deepEqual(outcome, { kind: "unsupported", id: "overlay" });
    assert.deepEqual(registered, []);
  });

  it("memakai arsip sesi ini tanpa membaca storage lagi", async () => {
    const { deps, registered } = makeDeps({ isRegistered: (key) => key === "zona-utara.pmtiles" });
    const outcome = await restoreOfflineBasemapForStyleUrl(`${SENTINEL_PREFIX}zona-utara/2`, {
      sentinelPrefix: SENTINEL_PREFIX,
      entries: [makeEntry()],
      deps,
    });

    assert.equal(outcome.kind, "restored");
    if (outcome.kind !== "restored") return;
    assert.equal(outcome.source, "session");
    assert.equal(outcome.url, "pmtiles://zona-utara.pmtiles");
    // Sudah terdaftar: mendaftar ulang hanya menggandakan byte yang sama.
    assert.deepEqual(registered, []);
  });

  it("membaca byte dari storage perangkat, jalur yang selamat dari restart", async () => {
    const table = memoryTable();
    await storeOfflineArchiveBytes("zona-utara", new Uint8Array([1, 2, 3]), table);

    const { deps, registered } = makeDeps({ table });
    const outcome = await restoreOfflineBasemapForStyleUrl(`${SENTINEL_PREFIX}zona-utara/4`, {
      sentinelPrefix: SENTINEL_PREFIX,
      entries: [makeEntry()],
      deps,
    });

    assert.equal(outcome.kind, "restored");
    if (outcome.kind !== "restored") return;
    assert.equal(outcome.source, "device-store");
    assert.equal(outcome.entry.id, "zona-utara");
    assert.deepEqual(registered, ["zona-utara.pmtiles"]);
  });

  it("membaca path filesystem ketika tidak ada byte perangkat (desktop)", async () => {
    const read: string[] = [];
    const { deps, registered } = makeDeps({
      table: memoryTable(),
      readFile: async (path) => {
        read.push(path);
        return new Uint8Array([9]);
      },
    });

    const outcome = await restoreOfflineBasemapForStyleUrl(`${SENTINEL_PREFIX}zona-utara/5`, {
      sentinelPrefix: SENTINEL_PREFIX,
      entries: [makeEntry({ savedPath: "/home/adijr/peta/zona-utara.pmtiles" })],
      deps,
    });

    assert.equal(outcome.kind, "restored");
    if (outcome.kind !== "restored") return;
    assert.equal(outcome.source, "file");
    assert.deepEqual(read, ["/home/adijr/peta/zona-utara.pmtiles"]);
    assert.deepEqual(registered, ["zona-utara.pmtiles"]);
  });

  it("tidak pernah membaca URI content://, karena grant-nya mati bersama proses", async () => {
    // Membacanya akan gagal di tengah pemuatan gaya basemap dan tampak seperti
    // bug yang tidak bisa dijelaskan pengguna; lebih jujur bilang missing.
    const read: string[] = [];
    const { deps } = makeDeps({
      table: memoryTable(),
      readFile: async (path) => {
        read.push(path);
        return new Uint8Array([9]);
      },
    });

    const outcome = await restoreOfflineBasemapForStyleUrl(`${SENTINEL_PREFIX}zona-utara/6`, {
      sentinelPrefix: SENTINEL_PREFIX,
      entries: [
        makeEntry({
          savedPath: "content://com.android.providers.downloads/document/42",
        }),
      ],
      deps,
    });

    assert.deepEqual(outcome, { kind: "missing", id: "zona-utara" });
    assert.deepEqual(read, []);
  });

  it("melaporkan missing ketika tidak ada satu pun sumber byte yang bisa dibaca", async () => {
    const { deps } = makeDeps({ table: memoryTable() });
    const outcome = await restoreOfflineBasemapForStyleUrl(`${SENTINEL_PREFIX}zona-utara/7`, {
      sentinelPrefix: SENTINEL_PREFIX,
      entries: [makeEntry({ savedPath: null })],
      deps,
    });

    assert.deepEqual(outcome, { kind: "missing", id: "zona-utara" });
  });

  it("membedakan unreadable dari missing ketika path desktop sudah dipindahkan", async () => {
    // `missing` berarti pengguna harus memilih berkas lagi; `unreadable` berarti
    // entrinya masih terdaftar tapi berkasnya bermasalah. Pesannya berbeda.
    const { deps } = makeDeps({
      table: memoryTable(),
      readFile: async () => {
        throw new Error("ENOENT: tidak ada berkas");
      },
    });

    const outcome = await restoreOfflineBasemapForStyleUrl(`${SENTINEL_PREFIX}zona-utara/8`, {
      sentinelPrefix: SENTINEL_PREFIX,
      entries: [makeEntry({ savedPath: "/home/adijr/peta/hilang.pmtiles" })],
      deps,
    });

    assert.equal(outcome.kind, "unreadable");
    if (outcome.kind !== "unreadable") return;
    assert.equal(outcome.id, "zona-utara");
    assert.match(outcome.error, /ENOENT/);
  });
});