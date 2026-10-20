/**
 * Bundle operations over a manifest (issue #11): import, close, reopen, and
 * delete.
 *
 * Everything runs against an in-memory `BundleStore`, because the rules under
 * test are about the manifest, not about a filesystem: a file copied in is
 * recorded with the hash of the bytes actually written, a missing file is
 * reported rather than thrown, and deleting a project cannot reach outside its
 * own directory. Two stores over two separate maps stand in for two project
 * directories.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PROJECT_MANIFEST_FILE,
  UnsafeBundlePathError,
  createManifest,
  isSafeBundlePath,
  readManifest,
  sha256Hex,
  writeManifest,
  type BundleStore,
  type ProjectManifest,
} from "./project-manifest";
import { deleteBundle, importBundleFile, openBundle, verifyBundle } from "./project-bundle";

type Disk = Map<string, Uint8Array>;

function memoryStore(disk: Disk = new Map()): BundleStore & { disk: Disk } {
  return {
    disk,
    write: async (path, bytes) => {
      disk.set(path, new Uint8Array(bytes));
    },
    read: async (path) => {
      const bytes = disk.get(path);
      if (!bytes) throw new Error(`ENOENT: ${path}`);
      return new Uint8Array(bytes);
    },
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

describe("impor, tutup, buka lagi", () => {
  it("berkas dan sha256 tetap cocok setelah proyek dibuka ulang", async () => {
    const disk: Disk = new Map();
    const first = memoryStore(disk);

    // Sesi pertama: impor tiga berkas, tulis manifes, lalu "tutup".
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
      manifest = (await importBundleFile(first, manifest, { ...item, now: NOW })).manifest;
    }
    await writeManifest(first, manifest);
    const beforeClose = await first.list();

    // Sesi kedua: store baru di atas disk yang sama, seperti proses baru.
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
    // Yang disimpan jalur relatif: tidak ada absolut, tidak ada content://.
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

  it("menolak impor ke atas manifes sendiri dan jalur yang keluar direktori", async () => {
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

describe("berkas hilang dan berubah", () => {
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
    // Entri yang hilang tetap di manifes: itu yang ditawarkan untuk dicari ulang.
    assert.equal(opened.manifest.files.length, manifest.files.length);
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

  it("verifikasi langsung menghitung ok/missing/mismatched tanpa melempar", async () => {
    const { disk, store, manifest } = await seeded();
    disk.delete("peta/a.pdf");
    disk.set("foto/b.jpg", encoder.encode("berubah"));

    const verification = await verifyBundle(store, manifest);
    assert.equal(verification.ok, 0);
    assert.deepEqual(verification.missing.map((entry) => entry.path), ["peta/a.pdf"]);
    assert.deepEqual(verification.mismatched.map((item) => item.entry.path), ["foto/b.jpg"]);
  });
});

describe("hapus proyek", () => {
  it("menghapus seluruh isi direktorinya dan tidak menyentuh proyek lain", async () => {
    const target: Disk = new Map();
    const sibling: Disk = new Map();
    const targetStore = memoryStore(target);
    const siblingStore = memoryStore(sibling);

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
    // Tetangga utuh, byte-nya masih cocok.
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
    const store: BundleStore = {
      ...base,
      list: async () => ["../proyek-lain/project.json", "/etc/passwd", PROJECT_MANIFEST_FILE],
    };
    const removed = await deleteBundle(store);
    assert.deepEqual(removed, [PROJECT_MANIFEST_FILE]);
  });
});
