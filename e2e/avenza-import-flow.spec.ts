import { expect, test } from "./test";
import { bindMapLibreMap } from "./helpers";
import { waitForCachedGeoPdfTiles } from "./geopdf-tiles";

/**
 * The Avenza first-run flow: from "My Maps", one tap opens the OS file picker,
 * the chosen map is what the viewer shows, and the camera lands on the sheet.
 *
 * Avenza's product shape is "pick a map, then work on it". GeoApps used to ask
 * for three taps to reach the same file (viewer, then the project sheet, then
 * the import row) and opened on an empty canvas in between. This spec pins the
 * short version so the extra screen cannot come back.
 *
 * The fixture is the ESRI ArcMap UTM 20N sheet: unlike the QGIS getprint one it
 * covers a real ~50 km extent, so "the camera fits the sheet" is a checkable
 * claim (centre and zoom) instead of a world view that any default satisfies.
 * Its extent, read from the fixture's own `/Measure` dictionary by
 * `parseGeoPdfDocument`, is west -65.10073259794785, south 43.968222638909076,
 * east -64.40549216378747, north 44.6080416044535.
 */

const FIXTURE = "tests/fixtures/geopdf/esri-arcmap-utm20n.pdf";
const SHEET_CENTRE = { lng: -64.75311238086766, lat: 44.28813212168129 };

/** Phone width, so the home screen and the field chrome are the real ones. */
test.use({ viewport: { width: 390, height: 844 } });

test("one tap on My Maps opens the picker, then the sheet is the map", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  const notes: string[] = [];
  page.on("console", (message) => {
    notes.push(`${message.type()}: ${message.text()}`);
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto("/");

  // PDF leads the accept list: a georeferenced PDF is the map a field user
  // brings, and the OS picker orders its filters by this string.
  const input = page.getByTestId("home-add-map-input");
  await expect(input).toHaveAttribute("accept", /^\.pdf,/);

  // One tap, and the picker is open. The click is what carries the user
  // activation; opening the picker later, from an effect, is blocked on mobile
  // Safari and Chrome.
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 30_000 });
  await page.getByTestId("home-add-map").click();
  const chooser = await chooserPromise;
  await chooser.setFiles(FIXTURE);

  // The viewer mounts on the file the user chose, not on an empty canvas.
  await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 90_000 });

  const tiles = await waitForCachedGeoPdfTiles(page, 2, 180_000);
  expect(
    tiles,
    `no GeoPDF tiles were rasterised after the one-tap import.\nconsole:\n${notes.join("\n")}`,
  ).toBeGreaterThanOrEqual(2);

  // The camera fits the sheet: centre on its middle and close enough that the
  // extent fills the viewport, rather than sitting on the default world view.
  await bindMapLibreMap(page);
  const view = await page.evaluate(() => {
    const map = (window as unknown as { __geolibreTestMap: { getCenter(): { lng: number; lat: number }; getZoom(): number } })
      .__geolibreTestMap;
    const centre = map.getCenter();
    return { lng: centre.lng, lat: centre.lat, zoom: map.getZoom() };
  });
  expect(Math.abs(view.lng - SHEET_CENTRE.lng)).toBeLessThan(0.5);
  expect(Math.abs(view.lat - SHEET_CENTRE.lat)).toBeLessThan(0.5);
  expect(view.zoom).toBeGreaterThanOrEqual(6);

  await page.screenshot({ path: "test-results/avenza-import-flow.png", fullPage: false });

  expect(errors.filter((text) => /GlobalWorkerOptions|Invalid PDF|GeoPDF/i.test(text))).toEqual([]);
});
