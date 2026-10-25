import { expect, test } from "./test";
import { openViewer } from "./helpers";
import { countCachedGeoPdfTiles, waitForCachedGeoPdfTiles } from "./geopdf-tiles";

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
 *
 * This spec enters the viewer through a seeded recent project rather than the
 * "Tambah Peta" button: that button now opens the OS file picker directly (see
 * `avenza-import-flow.spec.ts`), so the sheet path needs an already-open map.
 */

const FIXTURE = "tests/fixtures/geopdf/qgis-3.35-getprint.pdf";

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

  await openViewer(page);
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 60_000 });

  await page.getByTestId("mobile-tab-project").click();
  await expect(page.getByTestId("mobile-project-sheet")).toBeVisible();
  // The import row leads the sheet: importing a map is what a new map needs.
  await expect(page.getByTestId("mobile-action-import-file")).toBeVisible();
  await page.getByTestId("mobile-import-input").setInputFiles(FIXTURE);

  const count = await waitForCachedGeoPdfTiles(page, 2, 180_000);
  expect(
    count,
    `no GeoPDF tiles were rasterised.\nconsole:\n${notes.join("\n")}`,
  ).toBeGreaterThanOrEqual(2);

  // A manifest key plus at least one rasterised tile, so the count cannot be
  // one bookkeeping row standing in for a rendered sheet.
  expect(await countCachedGeoPdfTiles(page)).toBeGreaterThan(1);

  // Choosing a file closes the sheet, so the map is what the user sees next.
  await expect(page.getByTestId("mobile-project-sheet")).toBeHidden();

  // The screenshot is the human-readable half of the evidence: the sheet is
  // visible in the map, not just cached.
  await page.screenshot({ path: "test-results/geopdf-import-mobile.png", fullPage: false });

  expect(errors.filter((text) => /GlobalWorkerOptions|Invalid PDF|GeoPDF/i.test(text))).toEqual(
    [],
  );
});
