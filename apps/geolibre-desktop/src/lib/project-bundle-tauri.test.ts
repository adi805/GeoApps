/**
 * Tauri bundle store rules (issue #11): path binding, traversal refusal,
 * recursive listing, and a full import → reopen → delete round trip.
 *
 * The store is bound to `projects/<slug>/` RELATIVE to app-local data, and the
 * fake below refuses an absolute path, so a store that starts building one
 * fails here instead of on a phone. `tauriBundleDirIo` is exercised separately
 * with a fake plugin module, which is where `baseDir` is asserted.
 */

/* `it()` dari node:test mengembalikan promise yang dilacak runner, bukan promise
 * yang menunggu di-await di sini. Aturan no-floating-promises tidak bisa tahu itu. */
/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BaseDirectory } from "@tauri-apps/plugin-fs";

import { importBundleFile, deleteBundle, openBundle } from "./project-bundle";
import {
  BUNDLE_PROJECTS_DIR,
  bundleProjectRoot,
  createTauriBundleStore,
  listBundleProjectSlugs,
  listFilesRecursively,
  resolveBundlePath,
  tauriBundleDirIo,
  type BundleDirEntry,
  type BundleDirIo,
  type TauriFsModules,
} from "./project-bundle-tauri";
import { createManifest, projectSlug, writeManifest } from "./project-manifest";
import { UnsafeBundlePathError } from "./project-manifest";

/**
 * In-memory stand-in for the fs plugin's directory surface, bound to a virtual
 * app-local root. An absolute path is refused exactly as the plugin refuses it,
 * because the store must only ever name a path relative to its base directory.
 */
function fakeIo() {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>([""]);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const guard = (path: string): string => {
    if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) {
      throw new Error(`absolute path refused: ${path}`);
    }
    return path;
  };

  const io: BundleDirIo = {
    async mkdir(path, options) {
      const target = guard(path);
      if (options?.recursive) {
        let current = "";
        for (const part of target.split("/").filter(Boolean)) {
          current = current === "" ? part : `${current}/${part}`;
          dirs.add(current);
        }
        return;
      }
      const parent = target.split("/").slice(0, -1).join("/");
      if (!dirs.has(parent)) throw new Error(`forbidden path: ${target}`);
      dirs.add(target);
    },
    async writeFile(path, bytes) {
      const target = guard(path);
      const parent = target.split("/").slice(0, -1).join("/");
      if (!dirs.has(parent)) throw new Error(`forbidden path: ${target}`);
      files.set(target, bytes);
    },
    async readFile(path) {
      const bytes = files.get(guard(path));
      if (!bytes) throw new Error(`not found: ${path}`);
      return bytes;
    },
    async readDir(path) {
      const target = guard(path);
      if (!dirs.has(target)) throw new Error(`forbidden path: ${target}`);
      const prefix = target === "" ? "" : `${target}/`;
      const seen = new Map<string, BundleDirEntry>();
      for (const dir of dirs) {
        if (dir === target || !dir.startsWith(prefix)) continue;
        const rest = dir.slice(prefix.length);
        if (rest.includes("/")) continue;
        seen.set(dir, { name: rest, isDirectory: true });
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
      if (!files.delete(guard(path))) throw new Error(`not found: ${path}`);
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
  it("puts the project under projects/<slug>, relative to app-local data", () => {
    assert.equal(bundleProjectRoot("kebun-utara"), "projects/kebun-utara");
    assert.equal(BUNDLE_PROJECTS_DIR, "projects");
  });

  it("never returns an absolute path", () => {
    const root = bundleProjectRoot("kebun-utara");
    assert.ok(!root.startsWith("/"));
    assert.ok(!/^[A-Za-z]:/.test(root));
  });

  it("refuses a slug that is not a plain directory name", () => {
    assert.throws(() => bundleProjectRoot("../other"), UnsafeBundlePathError);
    assert.throws(() => bundleProjectRoot("a/b"), UnsafeBundlePathError);
    assert.throws(() => bundleProjectRoot(""), UnsafeBundlePathError);
    assert.throws(() => bundleProjectRoot("C:evil"), UnsafeBundlePathError);
  });
});

describe("resolveBundlePath", () => {
  it("joins a relative path onto the project root", () => {
    assert.equal(
      resolveBundlePath("projects/k", "data/2026/photo.jpg"),
      "projects/k/data/2026/photo.jpg",
    );
    assert.equal(resolveBundlePath("projects/k", "project.json"), "projects/k/project.json");
  });

  it("refuses to leave the project directory", () => {
    for (const bad of ["../other/project.json", "/etc/passwd", "data/../../escape", "C:\\x", "a\\b"]) {
      assert.throws(() => resolveBundlePath("projects/k", bad), UnsafeBundlePathError, bad);
    }
  });
});

describe("createTauriBundleStore", () => {
  it("binds to a relative root and manifest path", async () => {
    const { io } = fakeIo();
    const store = await createTauriBundleStore("kebun-utara", io);
    assert.equal(store.root, "projects/kebun-utara");
    assert.equal(store.manifestPath, "projects/kebun-utara/project.json");
  });

  it("creates parent directories, then writes and reads bytes", async () => {
    const { io, dirs, files } = fakeIo();
    const store = await createTauriBundleStore("kebun-utara", io);

    const bytes = new Uint8Array([1, 2, 3]);
    await store.write("data/foto/kebun.jpg", bytes);

    assert.ok(dirs.has("projects/kebun-utara/data/foto"));
    assert.deepEqual([...files.get("projects/kebun-utara/data/foto/kebun.jpg")!], [1, 2, 3]);
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

describe("tauriBundleDirIo", () => {
  /** Fake plugin module that records every call the real binding makes. */
  function fakePlugin() {
    const calls: { op: string; path: string; baseDir?: unknown }[] = [];
    const modules: TauriFsModules = {
      BaseDirectory: { AppLocalData: BaseDirectory.AppLocalData },
      fs: {
        async mkdir(path, options) {
          calls.push({ op: "mkdir", path, baseDir: options?.baseDir });
        },
        async writeFile(path, _bytes, options) {
          calls.push({ op: "writeFile", path, baseDir: options?.baseDir });
        },
        async readFile(path, options) {
          calls.push({ op: "readFile", path, baseDir: options?.baseDir });
          return new Uint8Array();
        },
        async readDir(path, options) {
          calls.push({ op: "readDir", path, baseDir: options?.baseDir });
          return [];
        },
        async remove(path, options) {
          calls.push({ op: "remove", path, baseDir: options?.baseDir });
        },
      },
    };
    return { modules, calls };
  }

  it("passes a relative path and AppLocalData baseDir on every call", async () => {
    const { modules, calls } = fakePlugin();
    const io = await tauriBundleDirIo(async () => modules);
    const store = await createTauriBundleStore("kebun-utara", io);

    await store.write("data/foto/a.jpg", new Uint8Array([1]));
    await store.read("data/foto/a.jpg");
    await store.list();
    await store.remove("data/foto/a.jpg");
    await listBundleProjectSlugs(io);

    assert.deepEqual(
      calls.map((call) => `${call.op}:${call.path}`),
      [
        "mkdir:projects/kebun-utara/data/foto",
        "writeFile:projects/kebun-utara/data/foto/a.jpg",
        "readFile:projects/kebun-utara/data/foto/a.jpg",
        "readDir:projects/kebun-utara",
        "remove:projects/kebun-utara/data/foto/a.jpg",
        "readDir:projects",
      ],
    );
    for (const call of calls) {
      assert.equal(call.baseDir, BaseDirectory.AppLocalData, `${call.op} baseDir`);
      assert.ok(!call.path.startsWith("/"), `${call.op} path absolute: ${call.path}`);
      assert.ok(!/^[A-Za-z]:/.test(call.path), `${call.op} path absolute: ${call.path}`);
    }
  });

  it("does not create the projects root before listing it", async () => {
    const { modules, calls } = fakePlugin();
    const io = await tauriBundleDirIo(async () => modules);
    assert.deepEqual(await listBundleProjectSlugs(io), []);
    assert.deepEqual(calls.map((call) => `${call.op}:${call.path}`), ["readDir:projects"]);
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
    await io.writeFile("projects/notes.txt", new TextEncoder().encode("bukan bundel"));

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
    assert.deepEqual(await listFilesRecursively(io, "projects/hilang", ""), []);
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
