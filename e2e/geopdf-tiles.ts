import type { Page } from "@playwright/test";

const TILE_DB = "geolibre-geopdf-tiles";
const TILE_STORE = "tiles";

/**
 * Counts the rasterised tiles in the page's GeoPDF tile cache.
 *
 * `geopdf://` tiles are rendered on demand and written to IndexedDB, so a
 * populated store is the mechanical proof that a PDF was parsed, georeferenced
 * and drawn — a blank map with no rows is exactly the failure this measures.
 *
 * A probe that opens `geolibre-geopdf-tiles` before the app does creates it at
 * version 1 with no object store; the app's own `open(name, 1)` then matches
 * that version, its `onupgradeneeded` never fires, and every tile put fails.
 * Polling with a bare `open()` poisons the very cache it measures, so the
 * existence check comes first and only an existing database is opened.
 *
 * @param page - The page whose cache to read.
 * @returns The number of cached tiles, or -1 while the database does not exist.
 */
export async function countCachedGeoPdfTiles(page: Page): Promise<number> {
  return page.evaluate(
    async ({ dbName, storeName }) => {
      const existing = (await indexedDB.databases?.()) ?? [];
      if (!existing.some((db) => db.name === dbName)) return -1;
      return new Promise<number>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            resolve(0);
            return;
          }
          const keys = db.transaction(storeName, "readonly").objectStore(storeName).getAllKeys();
          keys.onsuccess = () => {
            resolve(keys.result.length);
            db.close();
          };
          keys.onerror = () => reject(keys.error);
        };
      });
    },
    { dbName: TILE_DB, storeName: TILE_STORE },
  );
}

/**
 * Polls the tile cache until it holds at least `minimum` tiles.
 *
 * Polled by hand rather than with `expect.poll`: when nothing is cached the
 * useful output is what the page said, not a bare `0`.
 *
 * @param page - The page whose cache to poll.
 * @param minimum - The count that counts as "the sheet is drawn".
 * @param timeoutMs - How long to wait before giving up.
 * @returns The last count observed.
 */
export async function waitForCachedGeoPdfTiles(
  page: Page,
  minimum = 2,
  timeoutMs = 180_000,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  let count = 0;
  while (Date.now() < deadline) {
    count = await countCachedGeoPdfTiles(page);
    if (count >= minimum) return count;
    await page.waitForTimeout(2_000);
  }
  return count;
}
