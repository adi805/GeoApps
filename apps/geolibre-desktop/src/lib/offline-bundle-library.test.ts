import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { BundleDirIo } from "./project-bundle-tauri";
import {
  createBundleLibrary,
  restoreBundleSourcePaths,
  type BundleLibrary,
} from "./offline-bundle-library";

/** An in-memory {@link BundleDirIo}, POSIX paths only, like the real store hands it. */
function fakeIo(): BundleDirIo & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    async mkdir() {
      // Directories are implied by their files, so there is nothing to create.
    },
    async writeFile(path, bytes) {
      files.set(path, bytes);
    },
    async readFile(path) {
      const bytes = files.get(path);
      if (!bytes) throw new Error(`no such file: ${path}`);
      return bytes;
    },
    async readDir(path) {
      const prefix = `${path}/`;
      const seen = new Map<string, { name: string; isDirectory: boolean }>();
      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const slash = rest.indexOf("/");
        const name = slash === -1 ? rest : rest.slice(0, slash);
        seen.set(name, { name, isDirectory: slash !== -1 });
      }
      if (seen.size === 0) throw new Error(`no such directory: ${path}`);
      return [...seen.values()];
    },
    async remove(path) {
      if (!files.delete(path)) throw new Error(`no such file: ${path}`);
    },
  };
}

const WINDOWS_DATA_DIR = "C:\\Users\\petani\\AppData\\Roaming\\app";

/** A project with one file-backed layer, the shape a desktop save produces. */
function projectWithFile(name = "Kebun Utara") {
  return {
    name,
    layers: [
      {
        id: "peta-1",
        name: "Peta Kebun",
        type: "raster",
        sourcePath: "C:\\data\\kebun\\peta.pdf",
      },
    ],
  };
}

function library(io: BundleDirIo, dataDir = WINDOWS_DATA_DIR): BundleLibrary {
  return createBundleLibrary({
    dirIo: io,
    appLocalDataDir: dataDir,
    readSource: async () => new Uint8Array([1, 2, 3, 4]),
    now: () => "2026-11-18T00:00:00.000Z",
  });
}

describe("bundel proyek sebagai pustaka perangkat", () => {
  it("menyimpan proyek ke satu bundel dan mendaftarnya", async () => {
    const io = fakeIo();
    const bundles = library(io);

    const saved = await bundles.save(projectWithFile());
    assert.equal(saved.slug, "kebun-utara");
    assert.equal(saved.result.files.length, 1);
    assert.equal(saved.result.files[0].bundlePath, "peta/peta.pdf");

    const rows = await bundles.list();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, "kebun-utara");
    assert.equal(rows[0].name, "Kebun Utara");
    assert.equal(rows[0].updatedAt, "2026-11-18T00:00:00.000Z");
    // The copied map plus the project data file. `project.json` is not in its
    // own file list: it cannot hash the file that holds the hashes.
    assert.equal(rows[0].files, 2);
    assert.ok(rows[0].bytes > 0);
  });

  it("menyimpan ulang proyek yang sama memperbarui satu bundel, bukan menumpuk", async () => {
    const io = fakeIo();
    const bundles = library(io);
    await bundles.save(projectWithFile());
    const second = await bundles.save(projectWithFile());

    assert.equal(second.result.copied, 0);
    assert.equal((await bundles.list()).length, 1);
  });

  it("membuka bundel mengembalikan jalur absolut yang bisa dibaca lapisan", async () => {
    const io = fakeIo();
    const bundles = library(io);
    await bundles.save(projectWithFile());

    const opened = await bundles.open("kebun-utara");
    assert.equal(opened.status, "ok");
    assert.deepEqual(opened.missing, []);
    assert.deepEqual(opened.restored, ["peta/peta.pdf"]);
    assert.equal(opened.root, "C:\\Users\\petani\\AppData\\Roaming\\app\\projects\\kebun-utara");
    const layer = (opened.project as { layers: Array<{ sourcePath: string }> }).layers[0];
    assert.equal(
      layer.sourcePath,
      "C:\\Users\\petani\\AppData\\Roaming\\app\\projects\\kebun-utara\\peta\\peta.pdf",
    );
  });

  it("berkas yang hilang dilaporkan sebagai incomplete beserta lapisannya", async () => {
    const io = fakeIo();
    const bundles = library(io);
    await bundles.save(projectWithFile());
    io.files.delete(
      "projects/kebun-utara/peta/peta.pdf",
    );

    const opened = await bundles.open("kebun-utara");
    assert.equal(opened.status, "incomplete");
    assert.deepEqual(opened.missing, ["peta/peta.pdf"]);
    assert.equal(opened.affectedLayers.length, 1);
    assert.equal(opened.affectedLayers[0].layerName, "Peta Kebun");
  });

  it("menghapus bundel hanya menyentuh direktorinya sendiri", async () => {
    const io = fakeIo();
    const bundles = library(io);
    await bundles.save(projectWithFile("Kebun Utara"));
    await bundles.save(projectWithFile("Kebun Selatan"));

    const removed = await bundles.delete("kebun-utara");
    assert.ok(removed.includes("peta/peta.pdf"));
    assert.ok(
      [...io.files.keys()].every((key) => !key.startsWith("projects/kebun-utara/")),
    );
    assert.ok([...io.files.keys()].some((key) => key.startsWith("projects/kebun-selatan/")));
    assert.deepEqual(
      (await bundles.list()).map((row) => row.slug),
      ["kebun-selatan"],
    );
  });

  it("manifes rusak tetap terdaftar dengan alasannya, tidak menyembunyikan bundel lain", async () => {
    const io = fakeIo();
    const bundles = library(io);
    await bundles.save(projectWithFile());
    io.files.set("projects/rusak/project.json", new TextEncoder().encode("{bukan json"));

    const rows = await bundles.list();
    const broken = rows.find((row) => row.slug === "rusak");
    assert.ok(broken);
    assert.equal(broken.name, "rusak");
    assert.match(broken.problem ?? "", /project\.json/);
    assert.ok(rows.some((row) => row.slug === "kebun-utara" && !row.problem));
  });
});

describe("restoreBundleSourcePaths", () => {
  const root = "C:\\Users\\petani\\AppData\\Roaming\\app\\projects\\kebun-utara";

  it("hanya menulis ulang jalur relatif yang aman", () => {
    const { project, restored } = restoreBundleSourcePaths(
      {
        layers: [
          { sourcePath: "peta/peta.pdf" },
          { sourcePath: "https://example.test/tiles.json" },
          { sourcePath: "data:image/png;base64,AAA" },
          { sourcePath: "C:\\lain\\berkas.gpkg" },
          { sourcePath: "../keluar.txt" },
          { sourcePath: "/absolut/peta.pdf" },
        ],
      },
      root,
    );
    const layers = (project as { layers: Array<{ sourcePath: string }> }).layers;
    assert.deepEqual(restored, ["peta/peta.pdf"]);
    assert.equal(layers[0].sourcePath, `${root}\\peta\\peta.pdf`);
    assert.equal(layers[1].sourcePath, "https://example.test/tiles.json");
    assert.equal(layers[2].sourcePath, "data:image/png;base64,AAA");
    assert.equal(layers[3].sourcePath, "C:\\lain\\berkas.gpkg");
    // A traversal attempt is left untouched: resolving it would read outside.
    assert.equal(layers[4].sourcePath, "../keluar.txt");
    assert.equal(layers[5].sourcePath, "/absolut/peta.pdf");
  });

  it("tidak mengubah proyek tanpa layers", () => {
    const input = { name: "Kosong" };
    const { project, restored } = restoreBundleSourcePaths(input, root);
    assert.deepEqual(project, input);
    assert.deepEqual(restored, []);
  });
});
