/**
 * Salinan byte PDF yang membuat layer GeoPDF bisa dibuka lagi sesudah app ditutup.
 *
 * KENAPA modul ini ada. Ubin GeoPDF sudah punya cache persisten
 * (`geopdf-tile-cache.ts`), tetapi renderer-nya hanya bisa membuat ubin baru
 * kalau byte PDF-nya masih terbaca: `registerGeoPdfTileSet` butuh berkasnya
 * (`geopdf-render.ts:147`). Di Android, berkas yang dipilih dari storage
 * perangkat adalah URI `content://` yang grant bacanya mati bersama proses
 * (lihat `apps/geolibre-desktop/src/lib/startup-project-snapshot.ts:1-20`),
 * dan impor lewat pemilih berkas HP tidak pernah mencatat path sama sekali.
 * Akibatnya proyek yang dibuka ulang menunjuk `geopdf://<hash>/...` tanpa
 * renderer di belakangnya: peta PDF hilang, tepat fitur nomor satu yang
 * diminta di riset paritas Avenza.
 *
 * Yang disimpan di sini adalah BYTE PDF-nya, di IndexedDB, berkunci hash
 * SHA-256 yang sama dengan kunci ubin. Pola dan alasannya sama dengan arsip
 * basemap offline (`apps/geolibre-desktop/src/lib/offline-basemap-archive.ts`):
 * IndexedDB adalah satu-satunya tempat yang bisa ditulis tanpa izin tambahan,
 * sama di web, desktop, dan APK.
 *
 * Berkas ini sengaja bebas impor Tauri, DOM, dan React, supaya aturannya bisa
 * diuji di Node dengan {@link MemoryPdfArchiveTable}.
 */

/** Database IndexedDB khusus byte PDF GeoPDF, terpisah dari cache ubin. */
export const PDF_ARCHIVE_DB_NAME = "geolibre-geopdf-pdfs";

/** Naikkan kalau bentuk record berubah. Satu store, tanpa index. */
export const PDF_ARCHIVE_DB_VERSION = 1;

/** Object store di dalam {@link PDF_ARCHIVE_DB_NAME}. */
export const PDF_ARCHIVE_STORE = "pdfs";

/**
 * Batas atas ukuran satu PDF yang diarsipkan.
 *
 * Peta lapangan yang realistis berada jauh di bawah ini (lembar A1 vektor
 * biasanya 5 sampai 30 MB). Batas ini ada supaya satu PDF hasil pindai 500 MB
 * tidak menghabiskan kuota IndexedDB dan membuat impor lain ikut gagal, bukan
 * karena ukuran itu dilarang.
 */
export const MAX_ARCHIVED_PDF_BYTES = 96 * 1024 * 1024;

/** Hash dinormalkan ke huruf kecil, sama seperti kunci ubin. */
function archiveKey(fileHash: string): string {
  return fileHash.trim().toLowerCase();
}

/** Tabel kunci-nilai. Nilainya harus bisa di-structured-clone, seperti IndexedDB. */
export interface PdfArchiveTable {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

/** Tabel di dalam `Map`: pengganti uji, dan cadangan saat IndexedDB tidak ada. */
export class MemoryPdfArchiveTable implements PdfArchiveTable {
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
    request.onerror = () => reject(request.error ?? new Error("PDF archive request failed."));
  });
}

function whenComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("PDF archive write failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("PDF archive write was aborted."));
  });
}

/**
 * Tabel IndexedDB yang sebenarnya.
 *
 * Bentuknya sama dengan cache ubin: koneksi dibuka sekali dan dipakai ulang,
 * buka yang gagal tidak disimpan, dan byte disimpan apa adanya, bukan base64.
 * `indexedDB` yang tidak ada (uji Node, worker tanpa DOM) ditolak saat dipakai,
 * bukan saat impor, supaya modul ini tetap bisa diimpor di mana saja.
 */
export function indexedDbPdfArchiveTable(
  options: { factory?: IDBFactory; dbName?: string } = {},
): PdfArchiveTable {
  const dbName = options.dbName ?? PDF_ARCHIVE_DB_NAME;
  let connection: Promise<IDBDatabase> | undefined;

  function open(): Promise<IDBDatabase> {
    const factory = options.factory ?? (typeof indexedDB === "undefined" ? undefined : indexedDB);
    if (!factory) return Promise.reject(new Error("IndexedDB is not available here."));
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(dbName, PDF_ARCHIVE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PDF_ARCHIVE_STORE)) {
          db.createObjectStore(PDF_ARCHIVE_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not open the GeoPDF PDF archive."));
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
    const transaction = db.transaction(PDF_ARCHIVE_STORE, mode);
    const completion = mode === "readwrite" ? whenComplete(transaction) : undefined;
    completion?.catch(() => undefined);
    const result = await work(transaction.objectStore(PDF_ARCHIVE_STORE));
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
        promisifyRequest<IDBValidKey[]>(store.getAllKeys()).then((keys) =>
          keys.filter((key): key is string => typeof key === "string"),
        ),
      ),
    clear: async () => {
      await run("readwrite", (store) => promisifyRequest(store.clear()));
    },
  };
}

/** Yang dipakai host: simpan, ambil, dan buang byte satu PDF. */
export interface GeoPdfPdfArchive {
  /**
   * Simpan byte satu PDF.
   *
   * @returns `true` saat byte-nya benar-benar tersimpan, `false` saat berkasnya
   *   melewati {@link MAX_ARCHIVED_PDF_BYTES} dan sengaja dilewati. Kegagalan
   *   penyimpanan dilempar sebagai error supaya pemanggil bisa memberi tahu
   *   pengguna, bukan diam-diam kehilangan kemampuan buka-ulang.
   */
  save(fileHash: string, bytes: ArrayBuffer): Promise<boolean>;
  /** Byte PDF, atau null kalau tidak pernah diarsipkan. */
  load(fileHash: string): Promise<ArrayBuffer | null>;
  remove(fileHash: string): Promise<void>;
  /** Hash yang punya arsip, untuk diagnostik. */
  keys(): Promise<string[]>;
}

/** Bungkus byte apa pun yang tersimpan (ArrayBuffer atau Blob) jadi ArrayBuffer. */
async function toArrayBuffer(value: unknown): Promise<ArrayBuffer | null> {
  if (value instanceof ArrayBuffer) return value;
  if (typeof Blob !== "undefined" && value instanceof Blob) return value.arrayBuffer();
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    const copy = new Uint8Array(view.byteLength);
    copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    return copy.buffer;
  }
  return null;
}

/**
 * Kebijakan arsip di atas tabel apa pun.
 *
 * @param table - Penyimpanan nyata: IndexedDB di produksi, `Map` di uji.
 */
export function createGeoPdfPdfArchive(table: PdfArchiveTable): GeoPdfPdfArchive {
  return {
    async save(fileHash: string, bytes: ArrayBuffer): Promise<boolean> {
      if (bytes.byteLength === 0) return false;
      if (bytes.byteLength > MAX_ARCHIVED_PDF_BYTES) return false;
      await table.put(archiveKey(fileHash), bytes);
      return true;
    },
    async load(fileHash: string): Promise<ArrayBuffer | null> {
      const stored = await table.get(archiveKey(fileHash));
      return stored === undefined ? null : await toArrayBuffer(stored);
    },
    async remove(fileHash: string): Promise<void> {
      await table.delete(archiveKey(fileHash));
    },
    async keys(): Promise<string[]> {
      return table.keys();
    },
  };
}

let shared: GeoPdfPdfArchive | undefined;

/**
 * Arsip yang dipakai renderer dan host: IndexedDB kalau ada, memori kalau tidak.
 *
 * Satu instance per proses, karena IndexedDB juga satu per origin: dua instance
 * hanya akan membuka koneksi yang sama dua kali.
 */
export function sharedGeoPdfPdfArchive(): GeoPdfPdfArchive {
  if (!shared) {
    const table: PdfArchiveTable =
      typeof indexedDB === "undefined" ? new MemoryPdfArchiveTable() : indexedDbPdfArchiveTable();
    shared = createGeoPdfPdfArchive(table);
  }
  return shared;
}

/** Ganti arsip bersama; dipakai uji dan host yang ingin tabel sendiri. */
export function setSharedGeoPdfPdfArchive(archive: GeoPdfPdfArchive | undefined): void {
  shared = archive;
}
