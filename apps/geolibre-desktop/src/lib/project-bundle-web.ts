/**
 * The browser side of a portable project bundle: a {@link BundleStore} backed
 * by IndexedDB, for the web build and for a browser tab where there is no
 * filesystem to write into.
 *
 * The shape of the data is deliberately boring: one record per file, keyed
 * `<slug>/<relative path>`. One record per *file* rather than one per project,
 * because a bundle holds a PDF map, a GeoTIFF and field photos — rewriting the
 * whole project record on every photo import would copy hundreds of megabytes
 * per save. Keys carry the slug, so `list()` for one project is a prefix scan
 * over keys only (no bytes read) and two projects can never see each other's
 * files even though they share a store.
 *
 * The table is injected ({@link BundleFileTable}) so the key rules are testable
 * in Node without a browser; {@link indexedDbBundleFiles} is the real binding.
 * Nothing here imports Tauri or React.
 */

import type { BundleStore } from "./project-manifest";
import {
  UnsafeBundlePathError,
  assertSafeBundlePath,
  isSafeBundlePath,
} from "./project-manifest";

/** Database that holds web-side project bundles. */
export const BUNDLE_DB_NAME = "geolibre-project-bundles";
export const BUNDLE_DB_VERSION = 1;
/** Single object store; keys are `<slug>/<relative path>`. */
export const BUNDLE_FILES_STORE = "bundle-files";

/**
 * The four operations the store needs from a key→bytes table.
 *
 * Narrow on purpose: no transactions, no cursors, no indexes. That keeps the
 * fake in the tests honest (it can implement all of it) and keeps the store's
 * logic — key composition, prefix scanning, slug isolation — independent of how
 * the bytes are actually kept.
 */
export interface BundleFileTable {
  put: (key: string, bytes: Uint8Array) => Promise<void>;
  /** `undefined` when the key is not there. */
  get: (key: string) => Promise<Uint8Array | undefined>;
  /** Every key starting with `prefix`; `""` means all of them. */
  keys: (prefix: string) => Promise<string[]>;
  delete: (key: string) => Promise<void>;
}

/** Store that also exposes the key prefix it owns, for logging and debugging. */
export interface WebBundleStore extends BundleStore {
  readonly slug: string;
  /** Prefix every key of this project starts with, `<slug>/`. */
  readonly keyPrefix: string;
}

/** Compose the record key for one file of one project. */
export function bundleFileKey(slug: string, relativePath: string): string {
  if (!isSafeBundlePath(slug) || slug.includes("/")) throw new UnsafeBundlePathError(slug);
  return `${slug}/${assertSafeBundlePath(relativePath)}`;
}

/**
 * A store over one project's slice of the table.
 *
 * Every path goes through the same `assertSafeBundlePath` the manifest uses, so
 * a hand-built manifest cannot address another project's keys or a key that
 * climbs out of the prefix.
 */
export function createWebBundleStore(
  slug: string,
  table: BundleFileTable = indexedDbBundleFiles(),
): WebBundleStore {
  // Validates the slug; every other path is validated per call below.
  bundleFileKey(slug, "project.json");
  const keyPrefix = `${slug}/`;

  return {
    slug,
    keyPrefix,
    async write(relativePath, bytes) {
      await table.put(bundleFileKey(slug, relativePath), bytes);
    },
    async read(relativePath) {
      const bytes = await table.get(bundleFileKey(slug, relativePath));
      if (!bytes) throw new Error(`Bundle file is missing: ${relativePath}`);
      return bytes;
    },
    async list() {
      const keys = await table.keys(keyPrefix);
      return keys
        .map((key) => key.slice(keyPrefix.length))
        .filter((path) => isSafeBundlePath(path))
        .sort();
    },
    async remove(relativePath) {
      const key = bundleFileKey(slug, relativePath);
      // IndexedDB deletes a missing key without complaint, but `BundleStore`
      // promises a rejection, and `deleteBundle` relies on that to report what
      // survived. Check first rather than reporting a removal that never was.
      const existing = await table.get(key);
      if (!existing) throw new Error(`Bundle file is missing: ${relativePath}`);
      await table.delete(key);
    },
  };
}

/**
 * Slugs of every project bundle stored in this browser.
 *
 * Derived from the keys, so it costs one key scan and reads no bytes.
 */
export async function listWebBundleSlugs(table: BundleFileTable): Promise<string[]> {
  const keys = await table.keys("");
  const slugs = new Set<string>();
  for (const key of keys) {
    const slash = key.indexOf("/");
    if (slash > 0) slugs.add(key.slice(0, slash));
  }
  return [...slugs].sort();
}

/**
 * Drop every file of one project. The `BundleStore` equivalent is
 * `deleteBundle`, which needs a store; this is the "delete this bundle" call for
 * a UI that has a slug but has not opened the project.
 */
export async function deleteWebBundle(slug: string, table: BundleFileTable): Promise<string[]> {
  const store = createWebBundleStore(slug, table);
  const listed = await store.list();
  for (const path of listed) {
    await table.delete(bundleFileKey(slug, path));
  }
  return listed;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Bundle request failed."));
  });
}

/** Resolve when the transaction commits, reject when it errors or aborts. */
function whenComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Bundle write failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Bundle write was aborted."));
  });
}

/**
 * The real IndexedDB table.
 *
 * The connection is opened once and reused; a failed open is not cached, so a
 * later attempt (after the user clears storage, say) can still succeed. Bytes
 * are stored as-is — a `Uint8Array` is structured-cloneable — rather than
 * base64, which would inflate every photo by a third.
 */
export function indexedDbBundleFiles(
  options: { factory?: IDBFactory; dbName?: string } = {},
): BundleFileTable {
  const dbName = options.dbName ?? BUNDLE_DB_NAME;
  let connection: Promise<IDBDatabase> | undefined;

  function open(): Promise<IDBDatabase> {
    const factory = options.factory ?? (typeof indexedDB === "undefined" ? undefined : indexedDB);
    if (!factory) {
      return Promise.reject(new Error("IndexedDB is not available in this environment."));
    }
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(dbName, BUNDLE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(BUNDLE_FILES_STORE)) {
          db.createObjectStore(BUNDLE_FILES_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not open the project bundle database."));
    });
    // A rejected connection must not be reused; retry on the next call instead.
    pending.catch(() => {
      if (connection === pending) connection = undefined;
    });
    return pending;
  }

  function database(): Promise<IDBDatabase> {
    connection ??= open();
    return connection;
  }

  async function run<T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore) => Promise<T> | T,
  ): Promise<T> {
    const db = await database();
    const transaction = db.transaction(BUNDLE_FILES_STORE, mode);
    // Handlers go on before any request runs: a small transaction can commit
    // before we get back here, and a listener added afterwards never fires.
    const completion = mode === "readwrite" ? whenComplete(transaction) : undefined;
    completion?.catch(() => {});
    const result = await work(transaction.objectStore(BUNDLE_FILES_STORE));
    if (completion) await completion;
    return result;
  }

  return {
    put: async (key, bytes) => {
      await run("readwrite", (store) => promisifyRequest(store.put(bytes, key)));
    },
    get: (key) =>
      run("readonly", async (store) => {
        const value = await promisifyRequest<unknown>(store.get(key));
        return value instanceof Uint8Array ? value : undefined;
      }),
    keys: async (prefix) =>
      (await run("readonly", (store) => promisifyRequest(store.getAllKeys()))).filter(
        (key): key is string => typeof key === "string" && key.startsWith(prefix),
      ),
    delete: async (key) => {
      await run("readwrite", (store) => promisifyRequest(store.delete(key)));
    },
  };
}
