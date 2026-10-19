/**
 * Uji prototipe bundel proyek (issue #11, lane `offline`).
 *
 * Modul yang diuji sengaja tidak menyentuh Tauri/DOM/React, jadi seluruh aturan
 * (manifes, jalur aman, verifikasi, hapus) bisa diuji di Node biasa dengan
 * penyimpanan di memori. Dijalankan:
 *
 *   node --import tsx --test factory/bahan/offline-bundle.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ManifestError,
  PROJECT_MANIFEST_FILE,
  UnsafeBundlePathError,
  bundleFileKind,
  createManifest,
  deleteBundle,
  importBundleFile,
  isSafeBundlePath,
  openBundle,
  parseManifest,
  projectSlug,
  readManifest,
  serializeManifest,
  sha256Hex,
  verifyBundle,
  withOfflineRegions,
  writeManifest,
  type BundleStore,
  type ProjectManifest,
} from "../../apps/geolibre-desktop/src/lib/offline-bundle";

/** Direktori proyek di "disk" palsu: path relatif → byte. */
type Disk = Map<string, Uint8Array>;

/**
 * `BundleStore` di atas satu Map, plus penanda direktori induknya supaya uji
 * "hapus tidak menyentuh proyek lain" memakai dua store yang benar-benar
 * terpisah.
 */
function memoryStore(disk: Disk = new Map()): BundleStore & { disk: Disk } {
  const require = (path: string): Uint8Array => {
    const bytes = disk.get(path);
    if (!bytes) throw new Error(`ENOENT: ${path}`);
    return bytes;
  };
  return {
    disk,
    write: async (path, bytes) => {
      disk.set(path, new Uint8Array(bytes));
    },
    read: async (path) => new Uint8Array(require(path)),
    list: async () => [...disk.keys()].sort(),
    remove: async (path) => {
      if (!disk.delete(path)) throw new Error(`ENOENT: ${path}`);
    },
  };
}

const NOW = "2026-10-19T22:00:00.000Z";
const LATER = "2026-10-19T22:04:11.000Z";
const encoder = new TextEncoder();

function pdfBytes(): Uint8Array {
  return encoder.encode("%PDF-1.7\npeta desa sukamaju\n%%EOF\n");
}

function photoBytes(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
}

describe("jalur bundel", () => {
  it("menerima jalur relatif POSIX yang wajar", () => {
    for (const path of ["peta/scan.pdf", "a.pdf", "foto/2026/IMG_0042.jpg", "x/y/z.tif"]) {
      assert.equal(isSafeBundlePath(path), true, path);
    }
  });

  it("menolak jalur yang keluar dari direktori proyek", () => {
    const rejected = [
      "",
      "/etc/passwd",
      "C:\\Windows\\system.ini",
      "../lain/project.json",
      "peta/../../lain/project.json",
      "./peta/scan.pdf",
      "peta//scan.pdf",
      "peta\\scan.pdf",
      "a\0b.pdf",
      "x".repeat(513),
    ];
    for (const path of rejected) {
      assert.equal(isSafeBundlePath(path), false, path);
      assert.throws(() => {
        if (!isSafeBundlePath(path)) throw new UnsafeBundlePathError(path);
      }, UnsafeBundlePathError);
    }
  });

  it("slug direktori deterministik dan aman", () => {
    assert.equal(projectSlug("Survei Desa Sukamaju"), "survei-desa-sukamaju");
    assert.equal(projectSlug("  Peta/Pantai  "), "peta-pantai");
    assert.equal(projectSlug("Café Résumé"), "cafe-resume");
    assert.equal(projectSlug("日本語"), "project");
    assert.equal(projectSlug("日本語", "proyek"), "proyek");
    assert.ok(projectSlug("a".repeat(200)).length <= 64);
    assert.equal(projectSlug("---"), "project");
  });

  it("jenis berkas ditebak dari ekstensi", () => {
    assert.equal(bundleFileKind("peta/scan.PDF"), "map");
    assert.equal(bundleFileKind("raster/dem.tif"), "raster");
    assert.equal(bundleFileKind("ubin/peta.mbtiles"), "raster");
    assert.equal(bundleFileKind("foto/IMG_0042.JPG"), "photo");
    assert.equal(bundleFileKind("catatan.txt"), "other");
  });
});

describe("manifes", () => {
  it("serialisasi → parse menghasilkan isi yang sama, totals dihitung ulang", async () => {
    const manifest = createManifest({ projectId: "survei", name: "Survei", now: NOW });
    const store = memoryStore();
    const { manifest: withFile } = await importBundleFile(store, manifest, {
      path: "peta/scan.pdf",
      bytes: pdfBytes(),
      now: NOW,
    });
    const parsed = parseManifest(serializeManifest(withFile));
    assert.deepEqual(parsed.files, withFile.files);
    assert.equal(parsed.totals.files, 1);
    assert.equal(parsed.totals.bytes, pdfBytes().byteLength);
    assert.equal(parsed.schema, "geolibre.project.manifest");
    assert.equal(parsed.version, 1);
  });

  it("totals yang salah di disk diabaikan, bukan dipercaya", async () => {
    const manifest = createManifest({
      projectId: "survei",
      name: "Survei",
      now: NOW,
      files: [
        {
          path: "peta/scan.pdf",
          bytes: 3,
          sha256: await sha256Hex(encoder.encode("abc")),
          kind: "map",
          importedAt: NOW,
        },
      ],
    });
    const text = serializeManifest({ ...manifest, totals: { files: 99, bytes: 1, offlineRegionBytes: 0 } });
    const parsed = parseManifest(text);
    assert.deepEqual(parsed.totals, { files: 1, bytes: 3, offlineRegionBytes: 0 });
  });

  it("menolak JSON yang bukan manifes GeoLibre", () => {
    assert.throws(() => parseManifest("{}"), ManifestError);
    assert.throws(
      () => parseManifest(JSON.stringify({ schema: "sesuatu.lain", version: 1 })),
      /Not a GeoLibre project manifest/,
    );
    assert.throws(() => parseManifest("bukan json"), /not valid JSON/);
  });

  it("menolak manifes dari versi yang lebih baru", () => {
    const manifest = createManifest({ projectId: "survei", name: "Survei", now: NOW });
    const newer = JSON.parse(serializeManifest(manifest));
    newer.version = 2;
    assert.throws(() => parseManifest(JSON.stringify(newer)), /newer than this build understands/);
  });

  it("menolak entri berkas yang tidak bisa dipercaya", () => {
    const base = JSON.parse(serializeManifest(createManifest({ projectId: "s", name: "S", now: NOW })));
    const bad = (patch: Record<string, unknown>) => ({
      ...base,
      files: [{ path: "a.pdf", bytes: 1, sha256: "0".repeat(64), kind: "map", importedAt: NOW, ...patch }],
    });
    assert.throws(() => parseManifest(JSON.stringify(bad({ path: "../a.pdf" }))), /unsafe path/);
    assert.throws(() => parseManifest(JSON.stringify(bad({ bytes: -1 }))), /no usable size/);
    assert.throws(() => parseManifest(JSON.stringify(bad({ sha256: "xyz" }))), /no usable sha256/);
    assert.throws(() => parseManifest(JSON.stringify(bad({ kind: "video" }))), /unknown kind/);
    const duplicated = { ...base, files: [bad({}).files[0], bad({}).files[0]] };
    assert.throws(() => parseManifest(JSON.stringify(duplicated)), /Duplicate file path/);
  });
});

describe("impor, tutup, buka lagi", () => {
  it("berkas dan sha256 tetap cocok setelah proyek dibuka ulang", async () => {
    const disk: Disk = new Map();
    const first = memoryStore(disk);

    // --- sesi pertama: impor tiga berkas, tulis manifes, "tutup" ---
    let manifest: ProjectManifest = createManifest({
      projectId: "survei-sukamaju",
      name: "Survei Sukamaju",
      now: NOW,
    });
    const imports = [
      { path: "peta/scan-desa.pdf", bytes: pdfBytes(), kind: "map" as const, source: "content://downloads/1" },
      { path: "foto/IMG_0042.jpg", bytes: photoBytes(), kind: "photo" as const, source: "IMG_0042.jpg" },
      { path: "raster/dem.tif", bytes: encoder.encode("II*\0dem"), kind: "raster" as const, source: "dem.tif" },
    ];
    for (const item of imports) {
      const result = await importBundleFile(first, manifest, { ...item, now: NOW });
      manifest = result.manifest;
    }
    await writeManifest(first, manifest);
    const beforeClose = await first.list();

    // --- sesi kedua: store baru di atas disk yang sama ---
    const second = memoryStore(disk);
    const opened = await openBundle(second);

    assert.equal(opened.status, "ok");
    assert.equal(opened.verification.ok, 3);
    assert.deepEqual(opened.verification.missing, []);
    assert.deepEqual(opened.verification.mismatched, []);
    assert.deepEqual(await second.list(), beforeClose);
    assert.deepEqual(
      opened.manifest.files.map((file) => file.path),
      ["peta/scan-desa.pdf", "foto/IMG_0042.jpg", "raster/dem.tif"].sort(),
    );
    for (const entry of opened.manifest.files) {
      const bytes = await second.read(entry.path);
      assert.equal(await sha256Hex(bytes), entry.sha256, entry.path);
      assert.equal(bytes.byteLength, entry.bytes, entry.path);
    }
    // Jalur yang disimpan relatif: tidak ada yang absolut atau `content://`.
    for (const entry of opened.manifest.files) {
      assert.equal(isSafeBundlePath(entry.path), true);
      assert.ok(!entry.path.startsWith("/"));
      assert.ok(!entry.path.includes("://"));
    }
  });

  it("impor ulang path yang sama mengganti entri, tidak menumpuk", async () => {
    const store = memoryStore();
    const manifest = createManifest({ projectId: "s", name: "S", now: NOW });
    const first = await importBundleFile(store, manifest, { path: "peta/a.pdf", bytes: encoder.encode("v1"), now: NOW });
    const second = await importBundleFile(store, first.manifest, {
      path: "peta/a.pdf",
      bytes: encoder.encode("versi dua"),
      now: LATER,
    });
    assert.equal(second.manifest.files.length, 1);
    assert.equal(second.manifest.files[0].bytes, encoder.encode("versi dua").byteLength);
    assert.equal(second.manifest.updatedAt, LATER);
    await writeManifest(store, second.manifest);
    assert.equal((await openBundle(store)).status, "ok");
  });

  it("menolak impor ke atas manifes sendiri", async () => {
    const store = memoryStore();
    const manifest = createManifest({ projectId: "s", name: "S", now: NOW });
    await assert.rejects(
      importBundleFile(store, manifest, { path: PROJECT_MANIFEST_FILE, bytes: encoder.encode("{}"), now: NOW }),
      UnsafeBundlePathError,
    );
    await assert.rejects(
      importBundleFile(store, manifest, { path: "../lain.pdf", bytes: encoder.encode("x"), now: NOW }),
      UnsafeBundlePathError,
    );
  });
});

describe("berkas hilang dan rusak", () => {
  async function seeded() {
    const disk: Disk = new Map();
    const store = memoryStore(disk);
    let manifest = createManifest({ projectId: "s", name: "S", now: NOW });
    manifest = (await importBundleFile(store, manifest, { path: "peta/a.pdf", bytes: pdfBytes(), now: NOW })).manifest;
    manifest = (await importBundleFile(store, manifest, { path: "foto/b.jpg", bytes: photoBytes(), now: NOW })).manifest;
    await writeManifest(store, manifest);
    return { disk, store, manifest };
  }

  it("berkas hilang dilaporkan sebagai incomplete, bukan proyek kosong", async () => {
    const { disk, manifest } = await seeded();
    disk.delete("foto/b.jpg");

    const opened = await openBundle(memoryStore(disk));
    assert.equal(opened.status, "incomplete");
    assert.deepEqual(opened.verification.missing.map((entry) => entry.path), ["foto/b.jpg"]);
    assert.equal(opened.verification.ok, 1);
    // Entri yang hilang tetap ada di manifes: itu yang ditawarkan untuk dicari ulang.
    assert.equal(opened.manifest.files.length, manifest.files.length);
    assert.equal(opened.verification.missing[0].source, undefined);
  });

  it("berkas yang berubah di luar aplikasi dilaporkan sebagai mismatched", async () => {
    const { disk } = await seeded();
    disk.set("peta/a.pdf", encoder.encode("%PDF-1.7\nisi lain\n"));

    const opened = await openBundle(memoryStore(disk));
    assert.equal(opened.status, "incomplete");
    assert.deepEqual(opened.verification.missing, []);
    assert.equal(opened.verification.mismatched.length, 1);
    assert.equal(opened.verification.mismatched[0].entry.path, "peta/a.pdf");
    assert.equal(
      opened.verification.mismatched[0].actualSha256,
      await sha256Hex(encoder.encode("%PDF-1.7\nisi lain\n")),
    );
  });

  it("direktori tanpa manifes adalah error, bukan proyek kosong", async () => {
    const disk: Disk = new Map([["peta/a.pdf", pdfBytes()]]);
    await assert.rejects(openBundle(memoryStore(disk)), /ENOENT: project.json/);
    await assert.rejects(readManifest(memoryStore(new Map())), /ENOENT/);
  });
});

describe("hapus proyek", () => {
  it("menghapus seluruh isi direktorinya dan tidak menyentuh proyek lain", async () => {
    const target: Disk = new Map();
    const sibling: Disk = new Map();

    const targetStore = memoryStore(target);
    const siblingStore = memoryStore(sibling);

    // Proyek yang akan dihapus.
    let manifest = createManifest({ projectId: "survei", name: "Survei", now: NOW });
    manifest = (await importBundleFile(targetStore, manifest, { path: "peta/a.pdf", bytes: pdfBytes(), now: NOW })).manifest;
    manifest = (await importBundleFile(targetStore, manifest, { path: "foto/b.jpg", bytes: photoBytes(), now: NOW })).manifest;
    await writeManifest(targetStore, manifest);

    // Proyek tetangga dengan nama berkas yang sama persis.
    let other = createManifest({ projectId: "lain", name: "Lain", now: NOW });
    other = (await importBundleFile(siblingStore, other, { path: "peta/a.pdf", bytes: pdfBytes(), now: NOW })).manifest;
    await writeManifest(siblingStore, other);

    const before = await targetStore.list();
    const siblingBefore = await siblingStore.list();
    assert.deepEqual(before, ["foto/b.jpg", "peta/a.pdf", PROJECT_MANIFEST_FILE]);

    const removed = await deleteBundle(targetStore);

    assert.deepEqual(removed, [...before].sort());
    assert.deepEqual(await targetStore.list(), []);
    // Tetangga utuh, byte-nya sama.
    assert.deepEqual(await siblingStore.list(), siblingBefore);
    const reopenedSibling = await openBundle(memoryStore(sibling));
    assert.equal(reopenedSibling.status, "ok");
    assert.equal(reopenedSibling.verification.ok, 1);
  });

  it("melanjutkan saat satu berkas gagal dihapus dan melaporkan sisanya", async () => {
    const disk: Disk = new Map([
      ["peta/a.pdf", pdfBytes()],
      ["foto/b.jpg", photoBytes()],
      [PROJECT_MANIFEST_FILE, encoder.encode("{}")],
    ]);
    const base = memoryStore(disk);
    const store: BundleStore = {
      ...base,
      remove: async (path) => {
        if (path === "foto/b.jpg") throw new Error("EBUSY");
        disk.delete(path);
      },
    };
    const removed = await deleteBundle(store);
    assert.deepEqual(removed, ["peta/a.pdf", PROJECT_MANIFEST_FILE]);
    assert.deepEqual(await base.list(), ["foto/b.jpg"]);
  });

  it("tidak pernah menghapus jalur di luar direktori proyek", async () => {
    // Store yang jahat: list() mengembalikan jalur keluar direktori.
    const disk: Disk = new Map([[PROJECT_MANIFEST_FILE, encoder.encode("{}")]]);
    const base = memoryStore(disk);
    const store: BundleStore = { ...base, list: async () => ["../proyek-lain/project.json", "/etc/passwd", PROJECT_MANIFEST_FILE] };
    const removed = await deleteBundle(store);
    assert.deepEqual(removed, [PROJECT_MANIFEST_FILE]);
  });
});

describe("region offline di manifes", () => {
  it("mencatat region dan menjumlahkan ukurannya", async () => {
    const store = memoryStore();
    let manifest = createManifest({ projectId: "s", name: "S", now: NOW });
    manifest = (await importBundleFile(store, manifest, { path: "peta/a.pdf", bytes: pdfBytes(), now: NOW })).manifest;

    manifest = withOfflineRegions(
      manifest,
      [
        {
          id: "reg_01",
          name: "Sukamaju",
          bbox: [106.7, -6.9, 106.9, -6.7],
          minZoom: 10,
          maxZoom: 16,
          tileCount: 4211,
          hosts: ["tile.openstreetmap.org"],
          bytes: 188_743_680,
        },
        {
          id: "reg_02",
          name: "Pantai",
          bbox: [106.9, -6.9, 107.1, -6.7],
          minZoom: 10,
          maxZoom: 14,
          tileCount: 900,
          hosts: ["tile.openstreetmap.org"],
        },
      ],
      LATER,
    );

    assert.equal(manifest.totals.offlineRegionBytes, 188_743_680);
    assert.equal(manifest.totals.bytes, pdfBytes().byteLength);
    assert.equal(manifest.totals.files, 1);
    assert.equal(manifest.updatedAt, LATER);

    const parsed = parseManifest(serializeManifest(manifest));
    assert.equal(parsed.offlineRegions.length, 2);
    assert.deepEqual(parsed.offlineRegions[0].bbox, [106.7, -6.9, 106.9, -6.7]);
    assert.equal(parsed.offlineRegions[1].bytes, undefined);
    assert.equal(parsed.totals.offlineRegionBytes, 188_743_680);
  });

  it("menolak region tanpa bbox yang bisa dipakai", () => {
    const base = JSON.parse(serializeManifest(createManifest({ projectId: "s", name: "S", now: NOW })));
    assert.throws(
      () => parseManifest(JSON.stringify({ ...base, offlineRegions: [{ id: "r", bbox: [1, 2, 3] }] })),
      /no usable bbox/,
    );
    assert.throws(
      () => parseManifest(JSON.stringify({ ...base, offlineRegions: [{ bbox: [1, 2, 3, 4] }] })),
      /no id/,
    );
  });
});

describe("verifikasi langsung", () => {
  it("menghitung ok/missing/mismatched tanpa melempar", async () => {
    const disk: Disk = new Map();
    const store = memoryStore(disk);
    let manifest = createManifest({ projectId: "s", name: "S", now: NOW });
    manifest = (await importBundleFile(store, manifest, { path: "a.pdf", bytes: pdfBytes(), now: NOW })).manifest;
    manifest = (await importBundleFile(store, manifest, { path: "b.pdf", bytes: photoBytes(), now: NOW })).manifest;

    disk.delete("a.pdf");
    disk.set("b.pdf", encoder.encode("berubah"));

    const verification = await verifyBundle(store, manifest);
    assert.equal(verification.ok, 0);
    assert.deepEqual(verification.missing.map((entry) => entry.path), ["a.pdf"]);
    assert.deepEqual(verification.mismatched.map((item) => item.entry.path), ["b.pdf"]);
  });
});
