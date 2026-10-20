/**
 * Manifest rules for portable project bundles (issue #11).
 *
 * `project.json` is the only way into a bundle, so the rules that decide what
 * it may contain are worth testing on their own: path safety, version
 * rejection, duplicate detection, and the fact that `totals` on disk is never
 * trusted. Nothing here touches a filesystem.
 */

/* `it()` dari node:test mengembalikan promise yang dilacak runner, bukan promise
 * yang menunggu di-await di sini. Aturan no-floating-promises tidak bisa tahu itu. */
/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ManifestError,
  PROJECT_MANIFEST_FILE,
  PROJECT_MANIFEST_SCHEMA,
  PROJECT_MANIFEST_VERSION,
  UnsafeBundlePathError,
  assertSafeBundlePath,
  bundleFileKind,
  bundleTotals,
  createManifest,
  isSafeBundlePath,
  parseManifest,
  projectSlug,
  serializeManifest,
  sha256Hex,
  withOfflineRegions,
  type BundleFileEntry,
  type ProjectManifest,
} from "./project-manifest";

const NOW = "2026-10-19T22:00:00.000Z";
const LATER = "2026-10-19T22:04:11.000Z";
const encoder = new TextEncoder();

async function entry(path: string, bytes: Uint8Array): Promise<BundleFileEntry> {
  return {
    path,
    bytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    kind: bundleFileKind(path),
    importedAt: NOW,
  };
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
      assert.throws(() => assertSafeBundlePath(path), UnsafeBundlePathError, path);
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
  it("serialisasi lalu parse mengembalikan isi yang sama", async () => {
    const files = [await entry("peta/scan.pdf", encoder.encode("%PDF-1.7\n")), await entry("foto/a.jpg", encoder.encode("jpg"))];
    const manifest = createManifest({ projectId: "survei", name: "Survei", now: NOW, files });

    const parsed = parseManifest(serializeManifest(manifest));
    // `createManifest` menyimpan urutan pemanggil; serialisasi yang mengurutkan.
    assert.deepEqual(parsed.files, [...manifest.files].sort((a, b) => a.path.localeCompare(b.path)));
    assert.equal(parsed.schema, PROJECT_MANIFEST_SCHEMA);
    assert.equal(parsed.version, PROJECT_MANIFEST_VERSION);
    assert.equal(parsed.projectId, "survei");
    assert.equal(parsed.totals.files, 2);
  });

  it("serialisasi mengurutkan berkas per path supaya diff-nya stabil", async () => {
    const files = [await entry("z.pdf", encoder.encode("z")), await entry("a.pdf", encoder.encode("a"))];
    const manifest = createManifest({ projectId: "s", name: "S", now: NOW, files });
    const written = JSON.parse(serializeManifest(manifest)) as ProjectManifest;
    assert.deepEqual(written.files.map((file) => file.path), ["a.pdf", "z.pdf"]);
  });

  it("totals yang salah di disk dihitung ulang, bukan dipercaya", async () => {
    const manifest = createManifest({
      projectId: "survei",
      name: "Survei",
      now: NOW,
      files: [await entry("peta/scan.pdf", encoder.encode("abc"))],
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
    newer.version = PROJECT_MANIFEST_VERSION + 1;
    assert.throws(() => parseManifest(JSON.stringify(newer)), /newer than this build understands/);
  });

  it("menolak entri berkas yang tidak bisa dipercaya", async () => {
    const base = JSON.parse(serializeManifest(createManifest({ projectId: "s", name: "S", now: NOW })));
    const good = await entry("a.pdf", encoder.encode("a"));
    const bad = (patch: Record<string, unknown>) => ({ ...base, files: [{ ...good, ...patch }] });
    assert.throws(() => parseManifest(JSON.stringify(bad({ path: "../a.pdf" }))), /unsafe path/);
    assert.throws(() => parseManifest(JSON.stringify(bad({ bytes: -1 }))), /no usable size/);
    assert.throws(() => parseManifest(JSON.stringify(bad({ sha256: "xyz" }))), /no usable sha256/);
    assert.throws(() => parseManifest(JSON.stringify(bad({ kind: "video" }))), /unknown kind/);
    assert.throws(
      () => parseManifest(JSON.stringify({ ...base, files: [good, good] })),
      /Duplicate file path/,
    );
  });

  it("tidak membiarkan impor menimpa manifes sendiri", async () => {
    // project.json adalah nama yang sah secara bentuk, jadi aturannya ada di
    // pemanggil (importBundleFile) dan di sini hanya dipastikan nama itu tetap
    // konstanta yang dikenal.
    assert.equal(PROJECT_MANIFEST_FILE, "project.json");
    assert.equal(isSafeBundlePath(PROJECT_MANIFEST_FILE), true);
  });
});

describe("region offline di manifes", () => {
  it("mencatat region dan menjumlahkan ukurannya", async () => {
    const manifest = createManifest({
      projectId: "s",
      name: "S",
      now: NOW,
      files: [await entry("peta/a.pdf", encoder.encode("%PDF"))],
    });

    const next = withOfflineRegions(
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

    assert.equal(next.totals.offlineRegionBytes, 188_743_680);
    assert.equal(next.totals.bytes, encoder.encode("%PDF").byteLength);
    assert.equal(next.totals.files, 1);
    assert.equal(next.updatedAt, LATER);

    const parsed = parseManifest(serializeManifest(next));
    assert.equal(parsed.offlineRegions.length, 2);
    assert.deepEqual(parsed.offlineRegions[0].bbox, [106.7, -6.9, 106.9, -6.7]);
    assert.equal(parsed.offlineRegions[1].bytes, undefined);
    assert.equal(parsed.totals.offlineRegionBytes, 188_743_680);
  });

  it("menolak region tanpa bbox atau id yang bisa dipakai", () => {
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

describe("total ukuran", () => {
  it("menjumlahkan berkas dan region tanpa saling menimpa", () => {
    const manifest: Pick<ProjectManifest, "files" | "offlineRegions"> = {
      files: [
        { path: "a.pdf", bytes: 100, sha256: "0".repeat(64), kind: "map", importedAt: NOW },
        { path: "b.tif", bytes: 250, sha256: "0".repeat(64), kind: "raster", importedAt: NOW },
      ],
      offlineRegions: [
        { id: "r1", name: "Satu", bbox: [0, 0, 1, 1], minZoom: 0, maxZoom: 1, tileCount: 4, hosts: [], bytes: 1000 },
        { id: "r2", name: "Dua", bbox: [0, 0, 1, 1], minZoom: 0, maxZoom: 1, tileCount: 4, hosts: [] },
      ],
    };
    assert.deepEqual(bundleTotals(manifest), { files: 2, bytes: 350, offlineRegionBytes: 1000 });
  });
});
