/**
 * Saving a project into its bundle and opening it back (issue #11, points 1-3).
 *
 * The rules under test are the ones the merged bundle library deliberately does
 * not own: which `sourcePath` values point outside the bundle, where their
 * copies land, and that the project JSON handed back carries relative paths.
 * Everything runs against an in-memory `BundleStore` and an injected source
 * reader, because the subject is the rewriting, not a filesystem.
 *
 * The reopen cases matter most: a save that copies bytes but leaves the project
 * pointing at the old absolute path passes a naive "files were copied" test and
 * still opens an empty project on Android, so the assertions read the layer's
 * `sourcePath`, not only the disk.
 */

/* `it()` dari node:test mengembalikan promise yang dilacak runner, bukan promise
 * yang menunggu di-await di sini. Aturan no-floating-promises tidak bisa tahu itu. */
/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PROJECT_MANIFEST_FILE,
  createManifest,
  readManifest,
  sha256Hex,
  writeManifest,
  type BundleStore,
} from "./project-manifest";
import {
  BundleProjectError,
  PROJECT_DATA_FILE,
  bundlePathForSource,
  collectExternalFiles,
  isExternalProjectPath,
  missingProjectLayers,
  openProjectFromBundle,
  saveProjectToBundle,
} from "./offline-project-bundle";

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

const NOW = "2026-10-20T22:00:00.000Z";
const LATER = "2026-10-20T22:04:11.000Z";
const encoder = new TextEncoder();

function sourceReader(files: Record<string, string>) {
  return async (sourcePath: string): Promise<Uint8Array> => {
    const text = files[sourcePath];
    if (text === undefined) throw new Error(`ENOENT: ${sourcePath}`);
    return encoder.encode(text);
  };
}

function makeProject(layers: unknown[]): unknown {
  return {
    version: "1",
    name: "Survei Desa Sukamaju",
    mapView: { center: [106.8, -6.8], zoom: 12 },
    layers,
    styles: {},
    preferences: {},
  };
}

function layerAt(project: unknown, index: number): Record<string, unknown> {
  const layers = (project as { layers: unknown[] }).layers;
  return layers[index] as Record<string, unknown>;
}

describe("isExternalProjectPath", () => {
  it("menerima jalur absolut, drive Windows, dan URI berkas", () => {
    assert.equal(isExternalProjectPath("/storage/emulated/0/Download/scan.pdf"), true);
    assert.equal(isExternalProjectPath("content://media/external/document/1234"), true);
    assert.equal(isExternalProjectPath("file:///home/adi/peta/dem.tif"), true);
    assert.equal(isExternalProjectPath("C:\\data\\peta.tif"), true);
    assert.equal(isExternalProjectPath("\\\\server\\share\\peta.tif"), true);
  });

  it("menolak URL remote, data URL, dan jalur yang sudah relatif", () => {
    assert.equal(isExternalProjectPath("https://example.com/peta.pdf"), false);
    assert.equal(isExternalProjectPath("http://example.com/peta.pdf"), false);
    assert.equal(isExternalProjectPath("data:image/png;base64,AAAA"), false);
    assert.equal(isExternalProjectPath("blob:http://localhost/abc"), false);
    assert.equal(isExternalProjectPath("peta/scan-desa.pdf"), false);
    assert.equal(isExternalProjectPath(""), false);
    assert.equal(isExternalProjectPath("   "), false);
  });
});

describe("bundlePathForSource", () => {
  it("menaruh salinan di subdirektori sesuai jenis", () => {
    assert.equal(bundlePathForSource("/a/scan.pdf", "map"), "peta/scan.pdf");
    assert.equal(bundlePathForSource("/a/dem.tif", "raster"), "raster/dem.tif");
    assert.equal(bundlePathForSource("/a/IMG_0042.jpg", "photo"), "foto/IMG_0042.jpg");
    assert.equal(bundlePathForSource("/a/catatan.txt", "other"), "berkas/catatan.txt");
  });

  it("membuang query URI dan membersihkan nama berkas", () => {
    assert.equal(
      bundlePathForSource("content://media/external/scan%20desa.pdf?token=x", "map"),
      "peta/scan-desa.pdf",
    );
    assert.equal(bundlePathForSource("/a/scan desa (final).pdf", "map"), "peta/scan-desa-final-.pdf");
  });

  it("menghindari nama yang sudah dipakai dalam satu bundel", () => {
    const taken = new Set(["peta/scan.pdf"]);
    assert.equal(bundlePathForSource("/a/scan.pdf", "map", taken), "peta/scan-2.pdf");
    taken.add("peta/scan-2.pdf");
    assert.equal(bundlePathForSource("/b/scan.pdf", "map", taken), "peta/scan-3.pdf");
  });
});

describe("collectExternalFiles", () => {
  it("hanya mengumpulkan lapisan yang menunjuk berkas di luar bundel", () => {
    const project = makeProject([
      { id: "l1", name: "Peta scan", sourcePath: "/data/scan.pdf" },
      { id: "l2", name: "Foto", sourcePath: "content://media/photo/1" },
      { id: "l3", name: "Sudah dibundel", sourcePath: "peta/lama.pdf" },
      { id: "l4", name: "Remote", sourcePath: "https://example.com/x.pdf" },
    ]);
    const found = collectExternalFiles(project);
    assert.deepEqual(
      found.map((file) => [file.layerIndex, file.layerId, file.kind]),
      [
        [0, "l1", "map"],
        [1, "l2", "other"],
      ],
    );
  });

  it("menjaga indeks lapisan walau ada entri yang bukan objek", () => {
    const found = collectExternalFiles(makeProject([null, { sourcePath: "/data/scan.pdf" }]));
    assert.equal(found.length, 1);
    assert.equal(found[0].layerIndex, 1);
  });

  it("mengembalikan daftar kosong untuk proyek tanpa lapisan", () => {
    assert.deepEqual(collectExternalFiles({}), []);
    assert.deepEqual(collectExternalFiles(null), []);
  });
});

describe("saveProjectToBundle", () => {
  const sources = {
    "/data/scan-desa.pdf": "isi peta scan",
    "/data/dem.tif": "isi raster dem",
  };

  it("menyalin berkas dan menulis jalur relatif ke proyek", async () => {
    const store = memoryStore();
    const project = makeProject([
      { id: "l1", name: "Peta scan", sourcePath: "/data/scan-desa.pdf" },
      { id: "l2", name: "DEM", sourcePath: "/data/dem.tif" },
    ]);

    const result = await saveProjectToBundle({
      project,
      store,
      readSource: sourceReader(sources),
      now: NOW,
    });

    assert.equal(result.copied, 2);
    assert.equal(layerAt(result.project, 0).sourcePath, "peta/scan-desa.pdf");
    assert.equal(layerAt(result.project, 1).sourcePath, "raster/dem.tif");
    assert.equal(store.disk.has("peta/scan-desa.pdf"), true);
    assert.equal(store.disk.has("raster/dem.tif"), true);
    assert.equal(store.disk.has(PROJECT_DATA_FILE), true);
  });

  it("mencatat setiap salinan di manifes, termasuk salinan proyeknya", async () => {
    const store = memoryStore();
    const project = makeProject([{ sourcePath: "/data/scan-desa.pdf" }]);
    await saveProjectToBundle({ project, store, readSource: sourceReader(sources), now: NOW });

    const manifest = await readManifest(store);
    assert.equal(manifest.projectId, "survei-desa-sukamaju");
    assert.deepEqual(
      manifest.files.map((file) => file.path).sort(),
      [PROJECT_DATA_FILE, "peta/scan-desa.pdf"].sort(),
    );
    const copy = manifest.files.find((file) => file.path === "peta/scan-desa.pdf");
    assert.equal(copy?.sha256, await sha256Hex(encoder.encode(sources["/data/scan-desa.pdf"])));
    assert.equal(copy?.source, "/data/scan-desa.pdf");
    assert.equal(manifest.totals.files, 2);
  });

  it("tidak mengubah proyek yang diberikan pemanggil", async () => {
    const store = memoryStore();
    const project = makeProject([{ sourcePath: "/data/scan-desa.pdf" }]);
    await saveProjectToBundle({ project, store, readSource: sourceReader(sources), now: NOW });
    assert.equal(layerAt(project, 0).sourcePath, "/data/scan-desa.pdf");
  });

  it("tidak menulis ulang salinan yang isinya tidak berubah", async () => {
    const store = memoryStore();
    const project = makeProject([{ sourcePath: "/data/scan-desa.pdf" }]);
    const first = await saveProjectToBundle({
      project,
      store,
      readSource: sourceReader(sources),
      now: NOW,
    });
    const second = await saveProjectToBundle({
      project: first.project,
      store,
      readSource: sourceReader(sources),
      now: LATER,
      manifest: first.manifest,
    });

    assert.equal(second.copied, 0);
    assert.equal(layerAt(second.project, 0).sourcePath, "peta/scan-desa.pdf");
    const manifest = await readManifest(store);
    assert.equal(manifest.updatedAt, LATER);
  });

  it("menulis ulang salinan yang isinya berubah", async () => {
    const store = memoryStore();
    const project = makeProject([{ sourcePath: "/data/scan-desa.pdf" }]);
    const first = await saveProjectToBundle({
      project,
      store,
      readSource: sourceReader(sources),
      now: NOW,
    });
    const changed = { ...sources, "/data/scan-desa.pdf": "isi peta scan versi dua" };
    const second = await saveProjectToBundle({
      project,
      store,
      readSource: sourceReader(changed),
      now: LATER,
      manifest: first.manifest,
    });

    assert.equal(second.copied, 1);
    const manifest = await readManifest(store);
    const copy = manifest.files.find((file) => file.path === "peta/scan-desa.pdf");
    assert.equal(copy?.sha256, await sha256Hex(encoder.encode(changed["/data/scan-desa.pdf"])));
  });

  it("menyimpan ulang proyek hasil tulis ulang tanpa menyalin apa pun", async () => {
    const store = memoryStore();
    const project = makeProject([{ sourcePath: "/data/scan-desa.pdf" }]);
    const first = await saveProjectToBundle({
      project,
      store,
      readSource: sourceReader(sources),
      now: NOW,
    });
    // The rewritten project holds relative paths only, so a second save sees no
    // external source at all: idempotent by construction, not by a cache check.
    const second = await saveProjectToBundle({
      project: first.project,
      store,
      readSource: sourceReader(sources),
      now: LATER,
      manifest: first.manifest,
    });

    assert.equal(second.copied, 0);
    assert.deepEqual(second.files, []);
    assert.equal(layerAt(second.project, 0).sourcePath, "peta/scan-desa.pdf");
  });

  it("memberi nama berbeda untuk dua berkas yang namanya sama", async () => {
    const store = memoryStore();
    const project = makeProject([
      { id: "a", sourcePath: "/data/a/scan.pdf" },
      { id: "b", sourcePath: "/data/b/scan.pdf" },
    ]);
    const result = await saveProjectToBundle({
      project,
      store,
      readSource: sourceReader({ "/data/a/scan.pdf": "A", "/data/b/scan.pdf": "B" }),
      now: NOW,
    });

    assert.deepEqual(
      result.files.map((file) => file.bundlePath),
      ["peta/scan.pdf", "peta/scan-2.pdf"],
    );
    assert.equal(layerAt(result.project, 1).sourcePath, "peta/scan-2.pdf");
  });

  it("mencatat region offline di manifes", async () => {
    const store = memoryStore();
    const project = makeProject([{ sourcePath: "/data/scan-desa.pdf" }]);
    await saveProjectToBundle({
      project,
      store,
      readSource: sourceReader(sources),
      now: NOW,
      offlineRegions: [
        {
          id: "reg_01",
          name: "Sukamaju",
          bbox: [106.7, -6.9, 106.9, -6.7],
          minZoom: 10,
          maxZoom: 16,
          tileCount: 4211,
          hosts: ["tile.openstreetmap.org"],
        },
      ],
    });

    const manifest = await readManifest(store);
    assert.equal(manifest.offlineRegions.length, 1);
    assert.equal(manifest.offlineRegions[0].name, "Sukamaju");
  });
});

describe("openProjectFromBundle", () => {
  const sources = { "/data/scan-desa.pdf": "isi peta scan" };

  async function saved(store = memoryStore()) {
    const project = makeProject([
      { id: "l1", name: "Peta scan", sourcePath: "/data/scan-desa.pdf" },
    ]);
    const result = await saveProjectToBundle({
      project,
      store,
      readSource: sourceReader(sources),
      now: NOW,
    });
    return { store, saved: result };
  }

  it("membuka kembali proyek dengan jalur relatif dan status utuh", async () => {
    const { store } = await saved();
    const opened = await openProjectFromBundle(store);

    assert.equal(opened.status, "ok");
    assert.deepEqual(opened.missing, []);
    assert.deepEqual(opened.mismatched, []);
    assert.deepEqual(opened.affectedLayers, []);
    assert.equal(layerAt(opened.project, 0).sourcePath, "peta/scan-desa.pdf");
    assert.equal(opened.manifest.projectId, "survei-desa-sukamaju");
  });

  it("melaporkan berkas hilang beserta lapisan yang memakainya", async () => {
    const { store } = await saved();
    store.disk.delete("peta/scan-desa.pdf");

    const opened = await openProjectFromBundle(store);
    assert.equal(opened.status, "incomplete");
    assert.deepEqual(opened.missing, ["peta/scan-desa.pdf"]);
    assert.deepEqual(opened.affectedLayers, [
      { layerIndex: 0, layerName: "Peta scan", bundlePath: "peta/scan-desa.pdf" },
    ]);
  });

  it("melaporkan salinan yang isinya berubah di luar aplikasi", async () => {
    const { store } = await saved();
    store.disk.set("peta/scan-desa.pdf", encoder.encode("diubah orang lain"));

    const opened = await openProjectFromBundle(store);
    assert.equal(opened.status, "incomplete");
    assert.deepEqual(opened.mismatched, ["peta/scan-desa.pdf"]);
    assert.deepEqual(opened.missing, []);
  });

  it("menolak direktori tanpa manifes", async () => {
    await assert.rejects(() => openProjectFromBundle(memoryStore()), BundleProjectError);
  });

  it("menolak salinan proyek yang bukan JSON", async () => {
    const store = memoryStore();
    const manifest = createManifest({ projectId: "rusak", name: "Rusak", now: NOW });
    await writeManifest(store, manifest);
    await store.write(PROJECT_DATA_FILE, encoder.encode("{ bukan json"));

    await assert.rejects(
      () => openProjectFromBundle(store),
      (error: unknown) =>
        error instanceof BundleProjectError && error.message.includes("not valid JSON"),
    );
  });

  it("menolak manifes yang tidak bisa dibaca sebagai bundel", async () => {
    const store = memoryStore();
    await store.write(PROJECT_MANIFEST_FILE, encoder.encode("{}"));

    await assert.rejects(() => openProjectFromBundle(store), BundleProjectError);
  });
});

describe("missingProjectLayers", () => {
  it("hanya mengembalikan lapisan yang menunjuk jalur hilang", () => {
    const project = makeProject([
      { name: "Ada", sourcePath: "peta/ada.pdf" },
      { name: "Hilang", sourcePath: "peta/hilang.pdf" },
    ]);
    assert.deepEqual(missingProjectLayers(project, ["peta/hilang.pdf"]), [
      { layerIndex: 1, layerName: "Hilang", bundlePath: "peta/hilang.pdf" },
    ]);
    assert.deepEqual(missingProjectLayers(project, []), []);
  });
});
