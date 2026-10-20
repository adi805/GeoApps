/**
 * IndexedDB bundle store rules (issue #11): key composition, slug isolation,
 * prefix listing, and the real adapter exercised against a fake IDBFactory.
 *
 * The fake is minimal on purpose — open, upgrade, transaction, put/get/
 * getAllKeys/delete — so that the adapter cannot pass by using an API a browser
 * would not have. It is not a substitute for a browser run: what it pins is the
 * key layout and the promise plumbing, not IndexedDB's own semantics.
 */

/* `it()` dari node:test mengembalikan promise yang dilacak runner, bukan promise
 * yang menunggu di-await di sini. Aturan no-floating-promises tidak bisa tahu itu. */
/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deleteBundle, importBundleFile, openBundle } from "./project-bundle";
import {
  BUNDLE_DB_NAME,
  BUNDLE_DB_VERSION,
  BUNDLE_FILES_STORE,
  bundleFileKey,
  createWebBundleStore,
  deleteWebBundle,
  indexedDbBundleFiles,
  listWebBundleSlugs,
  type BundleFileTable,
} from "./project-bundle-web";
import { UnsafeBundlePathError, createManifest, writeManifest } from "./project-manifest";

/** Plain Map-backed table: the store's own rules, with no IndexedDB involved. */
function memoryTable(): BundleFileTable & { size: () => number } {
  const data = new Map<string, Uint8Array>();
  return {
    put: async (key, bytes) => {
      data.set(key, bytes);
    },
    get: async (key) => data.get(key),
    keys: async (prefix) => [...data.keys()].filter((key) => key.startsWith(prefix)),
    delete: async (key) => {
      data.delete(key);
    },
    size: () => data.size,
  };
}

describe("bundleFileKey", () => {
  it("composes the slug and the relative path", () => {
    assert.equal(bundleFileKey("kebun-utara", "project.json"), "kebun-utara/project.json");
    assert.equal(bundleFileKey("kebun-utara", "data/foto/a.jpg"), "kebun-utara/data/foto/a.jpg");
  });

  it("refuses a path or slug that is not a bundle-relative name", () => {
    assert.throws(() => bundleFileKey("kebun-utara", "../lain/project.json"), UnsafeBundlePathError);
    assert.throws(() => bundleFileKey("kebun-utara", "/etc/passwd"), UnsafeBundlePathError);
    assert.throws(() => bundleFileKey("a/b", "project.json"), UnsafeBundlePathError);
    assert.throws(() => bundleFileKey("", "project.json"), UnsafeBundlePathError);
  });
});

describe("createWebBundleStore", () => {
  it("writes and reads bytes back", async () => {
    const table = memoryTable();
    const store = createWebBundleStore("kebun-utara", table);
    await store.write("data/foto/a.jpg", new Uint8Array([7, 8, 9]));
    assert.deepEqual([...(await store.read("data/foto/a.jpg"))], [7, 8, 9]);
    assert.equal(store.keyPrefix, "kebun-utara/");
  });

  it("lists only its own files, sorted, with the prefix stripped", async () => {
    const table = memoryTable();
    const north = createWebBundleStore("kebun-utara", table);
    const south = createWebBundleStore("kebun-selatan", table);
    await north.write("peta.pdf", new Uint8Array([1]));
    await north.write("data/b.jpg", new Uint8Array([2]));
    await north.write("data/a.jpg", new Uint8Array([3]));
    await south.write("peta.pdf", new Uint8Array([4]));

    assert.deepEqual(await north.list(), ["data/a.jpg", "data/b.jpg", "peta.pdf"]);
    assert.deepEqual(await south.list(), ["peta.pdf"]);
  });

  it("rejects a read of a file that is not there", async () => {
    const store = createWebBundleStore("kebun-utara", memoryTable());
    await assert.rejects(store.read("hilang.pdf"), /missing/i);
  });

  it("rejects removing a file that is not there, and removes one that is", async () => {
    const table = memoryTable();
    const store = createWebBundleStore("kebun-utara", table);
    await assert.rejects(store.remove("hilang.pdf"), /missing/i);

    await store.write("data/a.jpg", new Uint8Array([1]));
    await store.write("data/b.jpg", new Uint8Array([2]));
    await store.remove("data/a.jpg");
    assert.deepEqual(await store.list(), ["data/b.jpg"]);
  });

  it("refuses to write outside its prefix", async () => {
    const table = memoryTable();
    const store = createWebBundleStore("kebun-utara", table);
    await assert.rejects(store.write("../kebun-selatan/project.json", new Uint8Array([1])), UnsafeBundlePathError);
    assert.equal(table.size(), 0);
  });
});

describe("listWebBundleSlugs", () => {
  it("derives sorted slugs from the keys and skips malformed ones", async () => {
    const table = memoryTable();
    await createWebBundleStore("kebun-utara", table).write("project.json", new Uint8Array([1]));
    await createWebBundleStore("kebun-selatan", table).write("project.json", new Uint8Array([1]));
    await table.put("tanpa-slug", new Uint8Array([1]));

    assert.deepEqual(await listWebBundleSlugs(table), ["kebun-selatan", "kebun-utara"]);
  });

  it("returns an empty list for an empty table", async () => {
    assert.deepEqual(await listWebBundleSlugs(memoryTable()), []);
  });
});

describe("deleteWebBundle", () => {
  it("removes one project's keys and reports them, leaving the other intact", async () => {
    const table = memoryTable();
    const north = createWebBundleStore("kebun-utara", table);
    const south = createWebBundleStore("kebun-selatan", table);
    await north.write("peta.pdf", new Uint8Array([1]));
    await north.write("data/a.jpg", new Uint8Array([2]));
    await south.write("peta.pdf", new Uint8Array([3]));

    assert.deepEqual(await deleteWebBundle("kebun-utara", table), ["data/a.jpg", "peta.pdf"]);
    assert.deepEqual(await north.list(), []);
    assert.deepEqual(await south.list(), ["peta.pdf"]);
  });
});

describe("round trip through the web store", () => {
  it("imports, reopens as ok, then deletes", async () => {
    const table = memoryTable();
    const store = createWebBundleStore("kebun-utara", table);
    const encoder = new TextEncoder();

    let manifest = createManifest({
      projectId: "kebun-utara",
      name: "Kebun Utara",
      now: "2026-10-20T08:00:00.000Z",
    });
    manifest = (await importBundleFile(store, manifest, {
      path: "peta.pdf",
      bytes: encoder.encode("pdf-bytes"),
      now: "2026-10-20T08:01:00.000Z",
      kind: "map",
    })).manifest;
    await writeManifest(store, manifest);

    const opened = await openBundle(store);
    assert.equal(opened.status, "ok");
    assert.equal(opened.verification.ok, 1);

    const removed = await deleteBundle(store);
    assert.deepEqual(removed, ["peta.pdf", "project.json"]);
    assert.deepEqual(await store.list(), []);
  });
});

/** The smallest IDBFactory that can carry `indexedDbBundleFiles`. */
function fakeIndexedDbFactory() {
  interface FakeStore {
    data: Map<string, unknown>;
  }
  interface FakeDb {
    stores: Map<string, FakeStore>;
    objectStoreNames: { contains: (name: string) => boolean };
    createObjectStore: (name: string) => void;
    transaction: (storeName: string) => unknown;
  }
  const databases = new Map<string, FakeDb>();
  const created: string[] = [];

  function fireRequest<T>(result: T) {
    const request = {
      result,
      error: null as unknown,
      onsuccess: null as ((event: unknown) => void) | null,
      onerror: null as ((event: unknown) => void) | null,
    };
    queueMicrotask(() => request.onsuccess?.(request));
    return request;
  }

  function transactionFor(db: FakeDb, storeName: string) {
    const store = db.stores.get(storeName);
    if (!store) throw new Error(`No object store named ${storeName}`);
    const objectStore = {
      put: (value: unknown, key: string) => {
        store.data.set(key, value);
        return fireRequest(key);
      },
      get: (key: string) => fireRequest(store.data.get(key)),
      getAllKeys: () => fireRequest([...store.data.keys()]),
      delete: (key: string) => {
        store.data.delete(key);
        return fireRequest(undefined);
      },
    };
    const transaction = {
      objectStore: () => objectStore,
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,
    };
    queueMicrotask(() => queueMicrotask(() => transaction.oncomplete?.()));
    return transaction;
  }

  const factory = {
    open(name: string, version?: number) {
      const request = {
        result: undefined as unknown,
        error: null as unknown,
        onsuccess: null as ((event: unknown) => void) | null,
        onerror: null as ((event: unknown) => void) | null,
        onupgradeneeded: null as ((event: unknown) => void) | null,
      };
      queueMicrotask(() => {
        let db = databases.get(name);
        if (!db) {
          const stores = new Map<string, FakeStore>();
          const made: FakeDb = {
            stores,
            objectStoreNames: { contains: (storeName: string) => stores.has(storeName) },
            createObjectStore: (storeName: string) => {
              stores.set(storeName, { data: new Map() });
            },
            transaction: (storeName: string) => transactionFor(made, storeName),
          };
          db = made;
          databases.set(name, db);
          created.push(`${name}@${version ?? 1}`);
          request.result = db;
          request.onupgradeneeded?.(request);
        }
        request.result = db;
        request.onsuccess?.(request);
      });
      return request;
    },
    // Only `open` is used by the adapter; the rest of IDBFactory is not needed.
    __db: (name: string) => databases.get(name),
    __created: created,
  };

  return factory;
}

describe("indexedDbBundleFiles", () => {
  it("round trips bytes through a fake IDBFactory and creates the store on upgrade", async () => {
    const factory = fakeIndexedDbFactory();
    const table = indexedDbBundleFiles({ factory: factory as unknown as IDBFactory });

    await table.put("kebun-utara/peta.pdf", new Uint8Array([1, 2]));
    assert.deepEqual([...(await table.get("kebun-utara/peta.pdf"))!], [1, 2]);
    assert.equal(await table.get("kebun-utara/hilang.pdf"), undefined);

    await table.put("kebun-selatan/peta.pdf", new Uint8Array([3]));
    assert.deepEqual((await table.keys("kebun-utara/")).sort(), ["kebun-utara/peta.pdf"]);
    assert.deepEqual((await table.keys("")).sort(), [
      "kebun-selatan/peta.pdf",
      "kebun-utara/peta.pdf",
    ]);

    await table.delete("kebun-utara/peta.pdf");
    assert.deepEqual(await table.keys("kebun-utara/"), []);

    assert.deepEqual(factory.__created, [`${BUNDLE_DB_NAME}@${BUNDLE_DB_VERSION}`]);
    assert.ok(factory.__db(BUNDLE_DB_NAME)?.stores.has(BUNDLE_FILES_STORE));
  });

  it("returns undefined when the stored value is not bytes", async () => {
    const factory = fakeIndexedDbFactory();
    const table = indexedDbBundleFiles({ factory: factory as unknown as IDBFactory });
    await table.put("kebun-utara/peta.pdf", new Uint8Array([1]));
    factory.__db(BUNDLE_DB_NAME)?.stores.get(BUNDLE_FILES_STORE)?.data.set("kebun-utara/peta.pdf", "bukan bytes");
    assert.equal(await table.get("kebun-utara/peta.pdf"), undefined);
  });

  it("rejects clearly when the environment has no IndexedDB", async () => {
    const table = indexedDbBundleFiles();
    await assert.rejects(table.keys(""), /IndexedDB is not available/);
  });
});
