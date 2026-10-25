import { expect, test } from "./test";
import { enterViewer, waitForMap } from "./helpers";
import { GEOFENCE_ZONES_STORAGE_KEY } from "../packages/plugins/src/plugins/maplibre-geofence";

/**
 * The geofence door on a phone: the project sheet opens it, a boundary is
 * created at the device's own position, and the zone is still there after the
 * app is reopened.
 *
 * The geofence engine shipped long before any screen did, so nothing pinned the
 * path a field user takes: sheet, entry, form, save. The reopen check is the
 * part that matters most: a boundary that vanishes when the app restarts is a
 * boundary nobody will draw twice, and the storage round-trip is the only way to
 * tell the difference from inside a browser.
 *
 * The phone chrome lives inside the map viewer, so the viewer comes first: the
 * home screen ("Peta Saya") has no tab bar and no project sheet.
 */

/** Phone width, so the sheet, the tab bar and the field chrome are the real ones. */
test.use({ viewport: { width: 390, height: 844 } });

/** A position in the middle of a block of fields; only "somewhere on Earth" matters. */
const DEVICE_POSITION = { latitude: -6.914744, longitude: 107.60981 };

test.use({ geolocation: DEVICE_POSITION, permissions: ["geolocation"] });

test("sheet entry opens the panel and a new zone survives a reopen", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  // A real viewer: the tab bar only exists where the map does.
  await waitForMap(page);

  // A phone gets the tab bar; there is no toolbar to reach the panel from.
  await expect(page.getByTestId("mobile-tab-bar")).toBeVisible();

  // Project tab -> sheet -> geofence entry. Two taps, the whole distance.
  await page.getByTestId("mobile-tab-project").click();
  await expect(page.getByTestId("mobile-project-sheet")).toBeVisible();
  await page.getByTestId("mobile-action-geofence").click();

  const dialog = page.getByTestId("geofence-dialog");
  await expect(dialog).toBeVisible();
  // First run on this browser profile: no boundaries yet, said in words rather
  // than as an empty list a user cannot tell apart from a loading state.
  await expect(page.getByTestId("geofence-empty")).toBeVisible();

  // Create: the form asks for a position and already asked the device for one.
  await page.getByTestId("geofence-create").click();
  const latInput = page.getByTestId("geofence-lat-input");
  const lngInput = page.getByTestId("geofence-lng-input");
  await expect(latInput).not.toHaveValue("");
  // The dialog formats the fix to six decimals, so the expectation carries the
  // same formatting rather than the raw seeded number.
  await expect(latInput).toHaveValue(DEVICE_POSITION.latitude.toFixed(6));
  await expect(lngInput).toHaveValue(DEVICE_POSITION.longitude.toFixed(6));

  // 250 m is the default; making it explicit is what makes this the 250 m zone
  // the plan asks for instead of "whatever the default happens to be today".
  const radiusInput = page.getByTestId("geofence-radius-input");
  await expect(radiusInput).toHaveValue("250");
  await expect(page.getByTestId("geofence-radius-warning")).toHaveCount(0);

  await page.getByTestId("geofence-name-input").fill("Blok C");
  await page.getByTestId("geofence-save").click();

  // Back on the list, with the new zone drawn from the device's own position.
  await expect(page.getByTestId("geofence-empty")).toHaveCount(0);
  await expect(dialog).toContainText("Blok C");
  await expect(dialog).toContainText("radius 250 m");

  await page.screenshot({ path: "test-results/geofence-mobile-list.png", fullPage: false });

  // The claim worth pinning: it is on disk, not in the dialog's state.
  const stored = await page.evaluate((zoneKey) => {
    const raw = window.localStorage.getItem(zoneKey);
    return raw ? (JSON.parse(raw) as { features?: unknown[] }) : null;
  }, GEOFENCE_ZONES_STORAGE_KEY);
  expect(stored?.features?.length, "no zone was written to storage").toBe(1);

  // Reopen the app from scratch, then walk the same two taps. A `reload` would
  // land back on the home screen, where the tab bar does not exist.
  await page.goto("/");
  await enterViewer(page);
  await expect(page.getByTestId("mobile-tab-bar")).toBeVisible();
  await page.getByTestId("mobile-tab-project").click();
  await page.getByTestId("mobile-action-geofence").click();
  await expect(page.getByTestId("geofence-dialog")).toBeVisible();
  await expect(page.getByTestId("geofence-empty")).toHaveCount(0);
  await expect(page.getByTestId("geofence-dialog")).toContainText("Blok C");

  expect(errors).toEqual([]);
});