/**
 * Persistent tile cache for the GeoPDF renderer (issue #66).
 *
 * The renderer keeps at most two encoded tiles in memory (`MAX_LIVE_TILES`),
 * which is the memory bound an Android WebView can survive. That bound is also
 * why a closed project used to come back with nothing: every tile was rendered
 * again from the PDF on the next open. This module puts the encoded tiles in a
 * store that outlives the renderer, keyed `{fileHash}/{z}/{x}/{y}` so one PDF's
 * tiles can be found, bounded and deleted without touching another PDF's.
 *
 * Three layers, each testable without a browser:
 *
 * 1. {@link TileCacheTable} — a key/value table. `indexedDbTileCacheTable` is
 *    the production binding; `MemoryTileCacheTable` is the test double.
 * 2. {@link TableTileCache} — the policy: key layout, per-project byte budget,
 *    eviction, and prefix deletion. Every rule lives here, not in the adapter.
 * 3. {@link GeoPdfTileCacheStore} — what the renderer and the host use: a
 *    scope bound to one `fileHash`, plus project-level deletion.
 *
 * Nothing here holds tile bytes beyond the single value being written or read,
 * so the cache cannot become the allocation this issue exists to remove.
 */

/** IndexedDB database holding the tiles. */
export const TILE_CACHE_DB_NAME = "geolibre-geopdf-tiles";

/** Bumped when the object store layout changes; there is one store, no index. */
export const TILE_CACHE_DB_VERSION = 1;

/** Object store inside {@link TILE_CACHE_DB_NAME}. */
export const TILE_CACHE_STORE = "tiles";

/**
 * Byte budget per project. An A1 sheet is roughly a thousand 512 px PNG tiles,
 * so 32 MiB holds a few sheets' worth of the zooms a user actually visits while
 * still leaving the device's storage alone. Oldest tiles go first.
 */
export const DEFAULT_PROJECT_BUDGET_BYTES = 32 * 1024 * 1024;

/** Manifest keys start here, so a tile prefix can never collide with one. */
const MANIFEST_PREFIX = "!";

/** One tile the manifest knows about. Sizes only: the bytes stay in the table. */
export interface TileCacheEntry {
  z: number;
  x: number;
  y: number;
  bytes: number;
  savedAt: number;
}

/** Per-project index of what is stored, small enough to rewrite on each tile. */
interface TileCacheManifest {
  entries: TileCacheEntry[];
}

/** A key/value table. Values are structured-cloneable, as IndexedDB requires. */
export interface TileCacheTable {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

/** Lowercase hex, so a hash from a saved project matches the one just computed. */
export function normalizeTileHash(fileHash: string): string {
  return fileHash.trim().toLowerCase();
}

/** The key the issue asks for: `{fileHash}/{z}/{x}/{y}`. */
export function tileCacheKey(fileHash: string, z: number, x: number, y: number): string {
  return `${normalizeTileHash(fileHash)}/${z}/${x}/${y}`;
}

/** Everything stored for one PDF starts with this. */
export function tileCachePrefix(fileHash: string): string {
  return `${normalizeTileHash(fileHash)}/`;
}

function manifestKey(fileHash: string): string {
  return `${MANIFEST_PREFIX}${normalizeTileHash(fileHash)}`;
}

/** A table held in a `Map`: the test double, and the no-IndexedDB fallback. */
export class MemoryTileCacheTable implements TileCacheTable {
  private readonly values = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.values.get(key);
  }

  async put(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async keys(): Promise<string[]> {
    return [...this.values.keys()];
  }

  async clear(): Promise<void> {
    this.values.clear();
  }
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Tile cache request failed."));
  });
}

function whenComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Tile cache write failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Tile cache write was aborted."));
  });
}

/**
 * The real IndexedDB table.
 *
 * Same shape as the project bundle's table: the connection is opened once and
 * reused, a failed open is not cached, and bytes are stored as-is rather than
 * base64. A missing `indexedDB` (a Node test, a worker without DOM) rejects on
 * first use instead of throwing at import time, so the module stays importable
 * everywhere.
 */
export function indexedDbTileCacheTable(
  options: { factory?: IDBFactory; dbName?: string } = {},
): TileCacheTable {
  const dbName = options.dbName ?? TILE_CACHE_DB_NAME;
  let connection: Promise<IDBDatabase> | undefined;

  function open(): Promise<IDBDatabase> {
    const factory = options.factory ?? (typeof indexedDB === "undefined" ? undefined : indexedDB);
    if (!factory) return Promise.reject(new Error("IndexedDB is not available here."));
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(dbName, TILE_CACHE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(TILE_CACHE_STORE)) {
          db.createObjectStore(TILE_CACHE_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not open the GeoPDF tile cache."));
    });
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
    const transaction = db.transaction(TILE_CACHE_STORE, mode);
    // Handlers before any request: a small transaction can commit first.
    const completion = mode === "readwrite" ? whenComplete(transaction) : undefined;
    completion?.catch(() => undefined);
    const result = await work(transaction.objectStore(TILE_CACHE_STORE));
    if (completion) await completion;
    return result;
  }

  return {
    get: (key) => run("readonly", (store) => promisifyRequest<unknown>(store.get(key))),
    put: async (key, value) => {
      await run("readwrite", (store) => promisifyRequest(store.put(value, key)));
    },
    delete: async (key) => {
      await run("readwrite", (store) => promisifyRequest(store.delete(key)));
    },
    keys: () =>
      run("readonly", (store) =>
        promisifyRequest(store.getAllKeys()).then((keys) =>
          keys.filter((key): key is string => typeof key === "string"),
        ),
      ),
    clear: async () => {
      await run("readwrite", (store) => promisifyRequest(store.clear()));
    },
  };
}

/** What the renderer needs: one PDF's tiles, by zoom and index. */
export interface GeoPdfTileScope {
  get(z: number, x: number, y: number): Promise<ArrayBuffer | null>;
  set(z: number, x: number, y: number, bytes: ArrayBuffer): Promise<void>;
}

/** What the host needs: scopes, and deleting a project's tiles. */
export interface GeoPdfTileCacheStore {
  scope(fileHash: string): GeoPdfTileScope;
  /** Delete every tile of one PDF. Returns how many were removed. */
  deleteProject(fileHash: string): Promise<number>;
  deleteAll(): Promise<void>;
  /** Stored tile keys, for diagnostics; manifests are excluded. */
  keys(fileHash?: string): Promise<string[]>;
}

/**
 * The cache policy over any {@link TileCacheTable}.
 *
 * The manifest is what makes the budget cheap: sizes are kept in one small
 * record per project, so eviction never has to read a tile's bytes back into
 * memory. It is rewritten after each write, which is one small `put` next to
 * the tile's own, and it is always validated against the table on delete, so a
 * lost manifest cannot leave orphan tiles behind.
 */
export class TableTileCache implements TileCacheBackend {
  constructor(
    private readonly table: TileCacheTable,
    private readonly budgetBytes: number = DEFAULT_PROJECT_BUDGET_BYTES,
  ) {}

  async get(key: string): Promise<ArrayBuffer | null> {
    const value = await this.table.get(key);
    return value instanceof ArrayBuffer ? value : null;
  }

  async set(key: string, bytes: ArrayBuffer): Promise<void> {
    const parsed = parseTileKey(key);
    if (!parsed) throw new Error(`Not a GeoPDF tile key: ${key}`);
    await this.table.put(key, bytes);
    const manifest = await this.readManifest(parsed.fileHash);
    const entries = manifest.entries.filter(
      (entry) => !(entry.z === parsed.z && entry.x === parsed.x && entry.y === parsed.y),
    );
    entries.push({
      z: parsed.z,
      x: parsed.x,
      y: parsed.y,
      bytes: bytes.byteLength,
      savedAt: Date.now(),
    });
    entries.sort((a, b) => a.savedAt - b.savedAt);
    let total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
    while (total > this.budgetBytes && entries.length > 1) {
      const oldest = entries.shift();
      if (!oldest) break;
      total -= oldest.bytes;
      await this.table.delete(tileCacheKey(parsed.fileHash, oldest.z, oldest.x, oldest.y));
    }
    await this.writeManifest(parsed.fileHash, { entries });
  }

  /** Delete one project: its manifest first, then whatever the table still has. */
  async deletePrefix(prefix: string): Promise<number> {
    const fileHash = normalizeTileHash(prefix.replace(/\/+$/, ""));
    const normalized = tileCachePrefix(fileHash);
    const keys = (await this.table.keys()).filter(
      (key) => key.startsWith(normalized) && !key.startsWith(MANIFEST_PREFIX),
    );
    for (const key of keys) await this.table.delete(key);
    await this.table.delete(manifestKey(fileHash));
    return keys.length;
  }

  async keys(prefix = ""): Promise<string[]> {
    const keys = await this.table.keys();
    return keys.filter((key) => !key.startsWith(MANIFEST_PREFIX) && key.startsWith(prefix));
  }

  async clear(): Promise<void> {
    await this.table.clear();
  }

  /** Total bytes the manifest claims for one project, without reading tiles. */
  async size(fileHash: string): Promise<number> {
    const manifest = await this.readManifest(fileHash);
    return manifest.entries.reduce((sum, entry) => sum + entry.bytes, 0);
  }

  private async readManifest(fileHash: string): Promise<TileCacheManifest> {
    const value = await this.table.get(manifestKey(fileHash));
    if (!value || typeof value !== "object") return { entries: [] };
    const entries = (value as TileCacheManifest).entries;
    return { entries: Array.isArray(entries) ? entries : [] };
  }

  private async writeManifest(fileHash: string, manifest: TileCacheManifest): Promise<void> {
    await this.table.put(manifestKey(fileHash), manifest);
  }
}

/** The storage backend a {@link GeoPdfTileCacheStore} writes through. */
export interface TileCacheBackend {
  get(key: string): Promise<ArrayBuffer | null>;
  set(key: string, bytes: ArrayBuffer): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
  keys(prefix?: string): Promise<string[]>;
  clear(): Promise<void>;
}

/** Split `{fileHash}/{z}/{x}/{y}` back into its parts. */
export function parseTileKey(
  key: string,
): { fileHash: string; z: number; x: number; y: number } | null {
  const match = /^([0-9a-z]+)\/(\d+)\/(\d+)\/(\d+)$/i.exec(key);
  if (!match) return null;
  return {
    fileHash: match[1].toLowerCase(),
    z: Number(match[2]),
    x: Number(match[3]),
    y: Number(match[4]),
  };
}

/**
 * Bind the backend to one `fileHash`.
 *
 * The scope is the only thing the renderer sees, so it cannot address another
 * project's tiles even by accident: every key is built from its own hash.
 */
export function createGeoPdfTileCacheStore(backend: TileCacheBackend): GeoPdfTileCacheStore {
  return {
    scope(fileHash: string): GeoPdfTileScope {
      const hash = normalizeTileHash(fileHash);
      return {
        get: (z, x, y) => backend.get(tileCacheKey(hash, z, x, y)),
        set: (z, x, y, bytes) => backend.set(tileCacheKey(hash, z, x, y), bytes),
      };
    },
    deleteProject: (fileHash) => backend.deletePrefix(tileCachePrefix(fileHash)),
    deleteAll: () => backend.clear(),
    keys: (fileHash) =>
      fileHash === undefined ? backend.keys() : backend.keys(tileCachePrefix(fileHash)),
  };
}

/**
 * The store the app uses: IndexedDB when the host has it, memory otherwise.
 *
 * Tauri's WebView has IndexedDB too, so this is the same code path on web,
 * desktop and Android. A disk-backed table can be dropped in later without
 * touching the policy: it only has to implement {@link TileCacheTable}.
 */
export function createDefaultGeoPdfTileCacheStore(): GeoPdfTileCacheStore {
  const table: TileCacheTable =
    typeof indexedDB === "undefined"
      ? new MemoryTileCacheTable()
      : indexedDbTileCacheTable();
  return createGeoPdfTileCacheStore(new TableTileCache(table));
}
