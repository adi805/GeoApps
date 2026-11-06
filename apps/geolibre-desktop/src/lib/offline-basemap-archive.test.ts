/**
 * Penyimpanan byte basemap offline yang tahan restart (issue #11, lane `offline`).
 *
 * Kenapa uji ini ada: audit `factory/bahan/lane-offline-audit-20261106.md` menunjukkan
 * bahwa arsip `.pmtiles` hasil ekstrak hanya hidup di memori WebView. Di Android
 * `savedPath` berupa URI `content://` yang grant-nya mati bersama proses, dan di web
 * `savedPath` selalu `null`, jadi setelah app ditutup tidak ada yang bisa dibaca lagi.
 * Uji di bawah memakukan penggantinya: byte disimpan di tabel device (IndexedDB) untuk
 * platform yang tidak punya path tahan-restart, dan pemulihannya memilih sumber yang
 * benar per platform.
 *
 * Yang diuji adalah aturan, bukan IndexedDB-nya: tabel disuntikkan seperti
 * `project-bundle-web.test.ts` memperlakukan bundel proyek. Perilaku WebView Android
 * yang sebenarnya belum teruji di perangkat.
 */

/* `it()` dari node:test mengembalikan promise yang dilacak runner, bukan promise
 * yang menunggu di-await di sini. Aturan no-floating-promises tidak bisa tahu itu. */
/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BundleFileTable } from "./project-bundle-web";
import {
  OFFLINE_ARCHIVE_KEY_PREFIX,
  deleteOfflineArchiveBytes,
  listStoredOfflineArchiveIds,
  offlineArchiveIdFromKey,
  offlineArchiveKey,
  persistOfflineArchiveIfNeeded,
  pruneOfflineArchiveBytes,
  readOfflineArchiveBytes,
  resolveOfflineBasemapArchive,
  shouldStoreOfflineArchive,
  storeOfflineArchiveBytes,
} from "./offline-basemap-archive";

/** Tabel Map biasa: aturan modul diuji tanpa IndexedDB ikut campur. */
function memoryTable(): BundleFileTable & { raw: Map<string, Uint8Array> } {
  const raw = new Map<string, Uint8Array>();
  return {
    raw,
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

const bytesOf = (...values: number[]) => new Uint8Array(values);

describe("offlineArchiveKey", () => {
  it("memakai kunci datar berkas .pmtiles di dalam satu prefix", () => {
    assert.equal(offlineArchiveKey("basemap-extract-abc"), "basemap/basemap-extract-abc.pmtiles");
    assert.equal(OFFLINE_ARCHIVE_KEY_PREFIX, "basemap/");
  });

  it("menolak id kosong, karena satu record tanpa id menimpa basemap lain", () => {
    assert.throws(() => offlineArchiveKey(""), /id/);
    assert.throws(() => offlineArchiveKey("   "), /id/);
  });

  it("bolak-balik dengan offlineArchiveIdFromKey, dan mengabaikan kunci asing", () => {
    assert.equal(offlineArchiveIdFromKey(offlineArchiveKey("zona-utara")), "zona-utara");
    // Kunci di luar prefix tidak boleh terbaca sebagai basemap: katalog perangkat
    // memisahkan basemap dari hal lain, jadi menebak akan mencampur keduanya.
    assert.equal(offlineArchiveIdFromKey("proyek/peta.pdf"), null);
    assert.equal(offlineArchiveIdFromKey(`${OFFLINE_ARCHIVE_KEY_PREFIX}bukan-arsip.bin`), null);
  });
});

describe("shouldStoreOfflineArchive", () => {
  it("menyimpan ketika tidak ada path yang bisa dibaca ulang (web, atau dialog dibatalkan)", () => {
    assert.equal(shouldStoreOfflineArchive(null), true);
    assert.equal(shouldStoreOfflineArchive(undefined), true);
    assert.equal(shouldStoreOfflineArchive("   "), true);
  });

  it("menyimpan untuk URI content:// Android, yang grant-nya mati bersama proses", () => {
    assert.equal(shouldStoreOfflineArchive("content://com.android.providers.downloads/document/42"), true);
  });

  it("tidak menyalin ketika path filesystem-nya sendiri sudah tahan restart", () => {
    // Menyalin arsip 100 MB ke IndexedDB padahal path-nya bisa dibaca lagi hanya
    // menggandakan pemakaian disk, jadi desktop tidak ikut disimpan.
    assert.equal(shouldStoreOfflineArchive("/home/adit/peta/desa.pmtiles"), false);
    assert.equal(shouldStoreOfflineArchive("C:\\peta\\desa.pmtiles"), false);
  });
});

describe("penyimpanan byte arsip", () => {
  it("menulis, membaca, dan menghapus satu arsip", async () => {
    const table = memoryTable();
    await storeOfflineArchiveBytes("zona-utara", bytesOf(1, 2, 3), table);

    assert.deepEqual([...(await readOfflineArchiveBytes("zona-utara", table))!], [1, 2, 3]);

    await deleteOfflineArchiveBytes("zona-utara", table);
    assert.equal(await readOfflineArchiveBytes("zona-utara", table), null);
  });

  it("mengembalikan null, bukan melempar, untuk arsip yang tidak ada", async () => {
    const table = memoryTable();
    assert.equal(await readOfflineArchiveBytes("tidak-pernah-ada", table), null);
  });

  it("mendaftar id basemap saja, tanpa prefix dan tanpa kunci asing", async () => {
    const table = memoryTable();
    await storeOfflineArchiveBytes("zona-utara", bytesOf(1), table);
    await storeOfflineArchiveBytes("zona-selatan", bytesOf(2), table);
    await table.put("bukan-basemap.txt", bytesOf(3));

    assert.deepEqual((await listStoredOfflineArchiveIds(table)).sort(), ["zona-selatan", "zona-utara"]);
  });

  it("menimpa arsip lama dengan id yang sama, tidak menumpuk dua salinan", async () => {
    const table = memoryTable();
    await storeOfflineArchiveBytes("zona-utara", bytesOf(1, 2), table);
    await storeOfflineArchiveBytes("zona-utara", bytesOf(9), table);

    assert.equal(table.raw.size, 1);
    assert.deepEqual([...(await readOfflineArchiveBytes("zona-utara", table))!], [9]);
  });
});

describe("pruneOfflineArchiveBytes", () => {
  it("menghapus arsip yang basemapnya sudah tidak ada di katalog", async () => {
    const table = memoryTable();
    await storeOfflineArchiveBytes("masih-ada", bytesOf(1), table);
    await storeOfflineArchiveBytes("sudah-dihapus", bytesOf(2), table);

    assert.deepEqual(await pruneOfflineArchiveBytes(["masih-ada"], table), ["sudah-dihapus"]);
    assert.deepEqual([...(await readOfflineArchiveBytes("masih-ada", table))!], [1]);
    assert.equal(await readOfflineArchiveBytes("sudah-dihapus", table), null);
  });

  it("tidak melakukan apa pun ketika setiap arsip masih terdaftar", async () => {
    const table = memoryTable();
    await storeOfflineArchiveBytes("a", bytesOf(1), table);
    await storeOfflineArchiveBytes("b", bytesOf(2), table);

    assert.deepEqual(await pruneOfflineArchiveBytes(["a", "b"], table), []);
    assert.equal(table.raw.size, 2);
  });
});

describe("persistOfflineArchiveIfNeeded", () => {
  it("menyimpan arsip Android yang hanya punya URI content://", async () => {
    const table = memoryTable();
    const result = await persistOfflineArchiveIfNeeded(
      { id: "extrak-1", savedPath: "content://downloads/document/7" },
      bytesOf(4, 5),
      table,
    );

    assert.equal(result, "stored");
    assert.deepEqual([...(await readOfflineArchiveBytes("extrak-1", table))!], [4, 5]);
  });

  it("menyimpan arsip web yang tidak punya savedPath sama sekali", async () => {
    const table = memoryTable();
    assert.equal(
      await persistOfflineArchiveIfNeeded({ id: "extrak-2", savedPath: null }, bytesOf(6), table),
      "stored",
    );
    assert.equal(table.raw.size, 1);
  });

  it("melewati arsip desktop yang path-nya bisa dibaca lagi", async () => {
    const table = memoryTable();
    assert.equal(
      await persistOfflineArchiveIfNeeded(
        { id: "extrak-3", savedPath: "/home/adit/peta/desa.pmtiles" },
        bytesOf(7),
        table,
      ),
      "skipped",
    );
    assert.equal(table.raw.size, 0);
  });
});

describe("resolveOfflineBasemapArchive", () => {
  it("memakai arsip yang sudah terdaftar di sesi ini tanpa membaca tabel", async () => {
    const registered = new Set(["extrak-1.pmtiles"]);
    let tableReads = 0;
    const table = memoryTable();
    const countingTable: BundleFileTable = {
      ...table,
      get: async (key) => {
        tableReads += 1;
        return table.get(key);
      },
    };

    const restored = await resolveOfflineBasemapArchive(
      { id: "extrak-1", savedPath: null },
      {
        isRegistered: (key) => registered.has(key),
        register: () => assert.fail("register tidak boleh dipanggil untuk arsip sesi"),
        table: countingTable,
      },
    );

    assert.deepEqual(restored, { kind: "session", url: "pmtiles://extrak-1.pmtiles" });
    assert.equal(tableReads, 0);
  });

  it("memulihkan arsip tersimpan sesudah restart, lalu mendaftarkannya sekali", async () => {
    const table = memoryTable();
    // Sesi pertama: ekstrak di Android, byte-nya disimpan di device.
    await persistOfflineArchiveIfNeeded(
      { id: "extrak-1", savedPath: "content://downloads/document/9" },
      bytesOf(10, 20, 30),
      table,
    );

    // Sesi kedua: registry pmtiles kosong (globalThis hilang bersama proses), URI
    // content:// di savedPath sudah mati, dan hanya tabel device yang tersisa.
    const registered = new Set<string>();
    // Byte yang benar-benar diserahkan ke protokol pmtiles, bukan byte yang dibaca.
    const seen: number[] = [];
    const restored = await resolveOfflineBasemapArchive(
      { id: "extrak-1", savedPath: "content://downloads/document/9" },
      {
        isRegistered: (key) => registered.has(key),
        register: (key, bytes) => {
          registered.add(key);
          seen.push(...bytes);
          return `pmtiles://${key}`;
        },
        table,
        readFile: () => assert.fail("URI content:// tidak boleh dibaca; grant-nya sudah mati"),
      },
    );

    assert.deepEqual(restored, { kind: "device-store", url: "pmtiles://extrak-1.pmtiles" });
    assert.deepEqual(seen, [10, 20, 30]);
    assert.deepEqual([...registered], ["extrak-1.pmtiles"]);
  });

  it("membaca path filesystem desktop apa adanya ketika tidak ada salinan device", async () => {
    const table = memoryTable();
    const restored = await resolveOfflineBasemapArchive(
      { id: "extrak-2", savedPath: "/home/adit/peta/desa.pmtiles" },
      {
        isRegistered: () => false,
        register: (key) => `pmtiles://${key}`,
        table,
        readFile: async (path) => {
          assert.equal(path, "/home/adit/peta/desa.pmtiles");
          return bytesOf(99);
        },
      },
    );

    assert.deepEqual(restored, { kind: "file", url: "pmtiles://extrak-2.pmtiles" });
  });

  it("melaporkan tidak ada sumber, bukan menebak, ketika salinan device hilang", async () => {
    // Inilah keadaan hari ini di Android sesudah app ditutup: katalog masih
    // mencatat entri, tapi tidak ada byte yang bisa dibaca.
    const restored = await resolveOfflineBasemapArchive(
      { id: "extrak-3", savedPath: "content://downloads/document/11" },
      {
        isRegistered: () => false,
        register: () => assert.fail("register tidak boleh dipanggil tanpa byte"),
        table: memoryTable(),
        readFile: () => assert.fail("URI content:// tidak boleh dibaca; grant-nya sudah mati"),
      },
    );

    assert.deepEqual(restored, { kind: "missing" });
  });

  it("tidak memakai pemilih berkas sebagai sumber implisit di web", async () => {
    const restored = await resolveOfflineBasemapArchive(
      { id: "extrak-4", savedPath: null },
      { isRegistered: () => false, register: () => "pmtiles://x", table: memoryTable() },
    );

    assert.deepEqual(restored, { kind: "missing" });
  });
});