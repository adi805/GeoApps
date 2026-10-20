/**
 * Tauri bundle store rules (issue #11): path binding, traversal refusal,
 * recursive listing, and a full import → reopen → delete round trip.
 *
 * The fs plugin is replaced by an in-memory fake that behaves like it in the
 * two ways that matter: writing into a directory that was never created fails,
 * and reading a path that is not there fails. So a store that forgets to create
 * parent directories, or that resolves a path outside its project, fails here
 * instead of on a phone.
 */

/* `it()` dari node:test mengembalikan promise yang dilacak runner, bukan promise
 * yang menunggu di-await di sini. Aturan no-floating-promises tidak bisa tahu itu. */
/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { importBundleFile, deleteBundle, openBundle } from "./project-bundle";
import {
  BUNDLE_PROJECTS_DIR,
  bundleProjectRoot,
  createTauriBundleStore,
  listBundleProjectSlugs,
  listFilesRecursively,
  resolveBundlePath,
  type BundleDirEntry,
  type BundleDirIo,
} from "./project-bundle-tauri";
import { createManifest, projectSlug, writeManifest } from "./project-manifest";
import { UnsafeBundlePathError } from "./project-manifest";

/** In-memory stand-in for `@tauri-apps/plugin-fs`'s directory surface. */
function fakeIo(appLocalData = "/appdata") {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>([appLocalData]);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const io: BundleDirIo = {
    appLocalDataDir: async () => appLocalData,
    async mkdir(path, options) {
      if (options?.recursive) {
        const parts = path.split("/").filter(Boolean);
        let current = "";
        for (const part of parts) {
          current += `/${part}`;
          dirs.add(current);
        }
        return;
      }
      if (!dirs.has(path.split("/").slice(0, -1).join("/") || "/")) {
        throw new Error(`forbidden path: ${path}`);
      }
      dirs.add(path);
    },
    async writeFile(path, bytes) {
      const parent = path.split("/").slice(0, -1).join("/") || "/";
      if (!dirs.has(parent)) throw new Error(`forbidden path: ${path}`);
      files.set(path, bytes);
    },
    async readFile(path) {
      const bytes = files.get(path);
      if (!bytes) throw new Error(`not found: ${path}`);
      return bytes;
    },
    async readDir(path) {
      if (!dirs.has(path)) throw new Error(`forbidden path: ${path}`);
      const prefix = path.endsWith("/") ? path : `${path}/`;
      const seen = new Map<string, BundleDirEntry>();
      for (const dir of dirs) {
        if (dir.startsWith(prefix) && dir !== path && !dir.slice(prefix.length).includes("/")) {
          seen.set(dir, { name: dir.slice(prefix.length), isDirectory: true });
        }
      }
      for (const file of files.keys()) {
        if (!file.startsWith(prefix)) continue;
        const rest = file.slice(prefix.length);
        if (rest.includes("/")) continue;
        seen.set(file, { name: rest, isDirectory: false });
      }
      return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    async remove(path) {
      if (!files.delete(path)) throw new Error(`not found: ${path}`);
    },
  };

  return {
    io,
    files,
    dirs,
    text: (path: string) => {
      const bytes = files.get(path);
      return bytes ? decoder.decode(bytes) : undefined;
    },
    put: (path: string, text: string) => files.set(path, encoder.encode(text)),
  };
}

describe("bundleProjectRoot", () => {
  it("puts the project under projects/<slug>", () => {
    assert.equal(bundleProjectRoot("/appdata", "kebun-utara"), "/appdata/projects/kebun-utara");
    assert.equal(bundleProjectRoot("/appdata/", "kebun-utara"), "/appdata/projects/kebun-utara");
    assert.equal(BUNDLE_PROJECTS_DIR, "projects");
  });

  it("keeps a Windows root's separator", () => {
    assert.equal(
      bundleProjectRoot("C:\\Users\\adi\\AppData\\Local\\GeoLibre", "kebun-utara"),
      "C:\\Users\\adi\\AppData\\Local\\GeoLibre\\projects\\kebun-utara",
    );
  });

  it("refuses a slug that is not a plain directory name", () => {
    assert.throws(() => bundleProjectRoot("/appdata", "../other"), UnsafeBundlePathError);
    assert.throws(() => bundleProjectRoot("/appdata", "a/b"), UnsafeBundlePathError);
    assert.throws(() => bundleProjectRoot("/appdata", ""), UnsafeBundlePathError);
    assert.throws(() => bundleProjectRoot("/appdata", "C:evil"), UnsafeBundlePathError);
  });
});

describe("resolveBundlePath", () => {
  it("joins a relative path onto the project root", () => {
    assert.equal(resolveBundlePath("/appdata/projects/k", "data/2026/photo.jpg"), "/appdata/projects/k/data/2026/photo.jpg");
    assert.equal(resolveBundlePath("/appdata/projects/k", "project.json"), "/appdata/projects/k/project.json");
  });

  it("refuses to leave the project directory", () => {
    for (const bad of ["../other/project.json", "/etc/passwd", "data/../../escape", "C:\\x", "a\\b"]) {
      assert.throws(() => resolveBundlePath("/appdata/projects/k", bad), UnsafeBundlePathError, bad);
    }
  });
});

describe("createTauriBundleStore", () => {
  it("creates parent directories, then writes and reads bytes", async () => {
    const { io, dirs, files } = fakeIo();
    const store = await createTauriBundleStore("kebun-utara", io);
    assert.equal(store.root, "/appdata/projects/kebun-utara");
    assert.equal(store.manifestPath, "/appdata/projects/kebun-utara/project.json");

    const bytes = new Uint8Array([1, 2, 3]);
    await store.write("data/foto/kebun.jpg", bytes);

    assert.ok(dirs.has("/appdata/projects/kebun-utara/data/foto"));
    assert.deepEqual([...files.get("/appdata/projects/kebun-utara/data/foto/kebun.jpg")!], [1, 2, 3]);
    assert.deepEqual([...(await store.read("data/foto/kebun.jpg"))], [1, 2, 3]);
  });

  it("lists nested files as sorted POSIX-relative paths", async () => {
    const { io } = fakeIo();
    const store = await createTauriBundleStore("kebun-utara", io);
    await store.write("peta.pdf", new Uint8Array([1]));
    await store.write("data/foto/b.jpg", new Uint8Array([2]));
    await store.write("data/foto/a.jpg", new Uint8Array([3]));

    assert.deepEqual(await store.list(), ["data/foto/a.jpg", "data/foto/b.jpg", "peta.pdf"]);
  });

  it("rejects a traversal path instead of writing outside the project", async () => {
    const { io, files } = fakeIo();
    const store = await createTauriBundleStore("kebun-utara", io);
    await assert.rejects(store.write("../lain/project.json", new Uint8Array([1])), UnsafeBundlePathError);
    assert.equal(files.size, 0);
  });

  it("removes one file and leaves its siblings", async () => {
    const { io } = fakeIo();
    const store = await createTauriBundleStore("kebun-utara", io);
    await store.write("data/a.jpg", new Uint8Array([1]));
    await store.write("data/b.jpg", new Uint8Array([2]));

    await store.remove("data/a.jpg");
    assert.deepEqual(await store.list(), ["data/b.jpg"]);
  });

  it("reads the manifest back from the path it advertises", async () => {
    const { io, text } = fakeIo();
    const store = await createTauriBundleStore("kebun-utara", io);
    const manifest = createManifest({
      projectId: "kebun-utara",
      name: "Kebun Utara",
      now: "2026-10-20T08:00:00.000Z",
    });
    await writeManifest(store, manifest);
    assert.match(text(store.manifestPath) ?? "", /"kebun-utara"/);
  });
});

describe("round trip through the Tauri store", () => {
  it("imports, reopens as ok, then deletes only that project", async () => {
    const { io } = fakeIo();
    const store = await createTauriBundleStore("kebun-utara", io);
    const sibling = await createTauriBundleStore("kebun-selatan", io);

    let manifest = createManifest({
      projectId: "kebun-utara",
      name: "Kebun Utara",
      now: "2026-10-20T08:00:00.000Z",
    });
    manifest = (await importBundleFile(store, manifest, {
      path: "peta.pdf",
      bytes: new TextEncoder().encode("pdf-bytes"),
      now: "2026-10-20T08:01:00.000Z",
      kind: "map",
    })).manifest;
    manifest = (await importBundleFile(store, manifest, {
      path: "data/foto/titik.jpg",
      bytes: new TextEncoder().encode("jpeg-bytes"),
      now: "2026-10-20T08:02:00.000Z",
    })).manifest;
    await writeManifest(store, manifest);
    await sibling.write("peta.pdf", new TextEncoder().encode("other-project"));

    const opened = await openBundle(store);
    assert.equal(opened.status, "ok");
    assert.equal(opened.manifest.files.length, 2);
    assert.equal(opened.verification.ok, 2);
    assert.deepEqual(opened.verification.missing, []);

    const removed = await deleteBundle(store);
    assert.deepEqual(removed, ["data/foto/titik.jpg", "peta.pdf", "project.json"]);
    assert.deepEqual(await store.list(), []);
    assert.deepEqual(await sibling.list(), ["peta.pdf"]);
  });
});

describe("listBundleProjectSlugs", () => {
  it("returns bundle directories, sorted, ignoring files", async () => {
    const { io } = fakeIo();
    await createTauriBundleStore("kebun-utara", io).then((store) =>
      store.write("project.json", new TextEncoder().encode("{}")),
    );
    await createTauriBundleStore("kebun-selatan", io).then((store) =>
      store.write("project.json", new TextEncoder().encode("{}")),
    );
    await io.writeFile("/appdata/projects/notes.txt", new TextEncoder().encode("bukan bundel"));

    assert.deepEqual(await listBundleProjectSlugs(io), ["kebun-selatan", "kebun-utara"]);
  });

  it("returns an empty list when no bundle was ever created", async () => {
    const { io } = fakeIo();
    assert.deepEqual(await listBundleProjectSlugs(io), []);
  });
});

describe("listFilesRecursively", () => {
  it("returns nothing for a directory that is not there", async () => {
    const { io } = fakeIo();
    assert.deepEqual(await listFilesRecursively(io, "/appdata/projects/hilang", ""), []);
  });
});

describe("projectSlug integration", () => {
  it("produces a directory name the store accepts", async () => {
    const slug = projectSlug("Kebun Utara (Blok A)");
    assert.equal(slug, "kebun-utara-blok-a");
    const { io } = fakeIo();
    const store = await createTauriBundleStore(slug, io);
    await store.write("project.json", new TextEncoder().encode("{}"));
    assert.deepEqual(await listBundleProjectSlugs(io), [slug]);
  });
});
