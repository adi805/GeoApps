import { expect, test } from "./test";

/**
 * The first Avenza-parity feature: a georeferenced PDF opened from the phone
 * import sheet becomes a map.
 *
 * The regression this guards is not cosmetic. `pdfjs-dist` keeps its parser in
 * a worker and reads the script URL from `GlobalWorkerOptions.workerSrc`; with
 * that value empty, `PDFWorker` throws, falls back to a fake worker that throws
 * again, and every `getDocument` rejects with
 * `No "GlobalWorkerOptions.workerSrc" specified.` The unit tests never saw it
 * because Node's `isNodeJS` branch defaults the value. Only a real browser
 * runtime shows it, which is why this spec drives the app instead of the
 * parser.
 *
 * The assertion is the tile cache, not the canvas: `geopdf://` tiles are
 * rasterised per request and written to IndexedDB, so a populated
 * `geolibre-geopdf-tiles` store proves the PDF was parsed, georeferenced and
 * drawn. A blank map with no cache rows is exactly the failure this catches.
 */

const FIXTURE = "tests/fixtures/geopdf/qgis-3.35-getprint.pdf";
const TILE_DB = "geolibre-geopdf-tiles";
const TILE_STORE = "tiles";

/** Phone width, so `useIsMobileViewport` mounts the field chrome. */
test.use({ viewport: { width: 390, height: 844 } });

test("opens a georeferenced PDF from the phone import sheet and rasterises it", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  const notes: string[] = [];
  page.on("console", (message) => {
    const text = `${message.type()}: ${message.text()}`;
    notes.push(text);
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto("/?loading=1");
  // The app opens on "Peta Saya" (Avenza's My Maps). "+ Tambah Peta" is the
  // phone's way into the viewer, and it also opens the raster panel, so the
  // map canvas is what a user sees next.
  await page.getByRole("button", { name: "Tambah Peta" }).click();
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 60_000 });

  await page.getByTestId("mobile-tab-project").click();
  await expect(page.getByTestId("mobile-project-sheet")).toBeVisible();
  await page.getByTestId("mobile-import-input").setInputFiles(FIXTURE);

  /**
   * Count the cached tiles without ever creating the database.
   *
   * A probe that opens `geolibre-geopdf-tiles` before the app does creates it
   * at version 1 with no object store; the app's own `open(name, 1)` then
   * matches that version, its `onupgradeneeded` never fires, and every tile put
   * fails. Polling with a bare `open()` poisons the very cache it measures, so
   * the existence check comes first and only an existing database is opened.
   */
  const cachedTiles = async (): Promise<number> =>
    page.evaluate(
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

  // Poll by hand rather than with `expect.poll`: when nothing is cached, the
  // useful output is what the page said, not the bare 0.
  const deadline = Date.now() + 180_000;
  let count = 0;
  while (Date.now() < deadline) {
    count = await cachedTiles();
    if (count > 0) break;
    await page.waitForTimeout(2_000);
  }
  expect(
    count,
    `no GeoPDF tiles were rasterised.\nconsole:\n${notes.join("\n")}`,
  ).toBeGreaterThan(0);

  // A manifest key plus at least one rasterised tile, so the count cannot be
  // one bookkeeping row standing in for a rendered sheet.
  expect(await cachedTiles()).toBeGreaterThan(1);

  // The screenshot is the human-readable half of the evidence: the sheet is
  // visible in the map, not just cached.
  await page.screenshot({ path: "test-results/geopdf-import-mobile.png", fullPage: false });

  expect(errors.filter((text) => /GlobalWorkerOptions|Invalid PDF|GeoPDF/i.test(text))).toEqual(
    [],
  );
});
