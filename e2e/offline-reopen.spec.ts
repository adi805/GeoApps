import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEmptyProject, DEFAULT_LAYER_STYLE, type GeoLibreProject } from "@geolibre/core";
import { expect, test, type Page } from "./test";
import { bindMapLibreMap, layerRow, waitForMap } from "./helpers";

/**
 * Reopening a saved project with the network switched off (issue #11).
 *
 * The portable bundle keeps a project's data inside the project itself, so
 * opening one must not need the internet for anything: the map still mounts
 * (a blank basemap is a local style, not a fetched one), the 20 survey points
 * are drawn from the project's own GeoJSON, and the 3 attached photos render
 * from the inline data URLs they were saved with.
 *
 * Every request that is not served by the local preview is aborted, so a
 * regression that reaches for a tile, a sprite or a font fails here instead of
 * silently passing on a machine that happens to have a connection.
 */

/**
 * Three distinct 1x1 PNGs, one per photo point. They must differ: the test
 * collects the popup `<img>` sources into a Set to prove each point renders
 * *its own* photo, and identical bytes would collapse that Set to one entry no
 * matter how many popups opened.
 */
const PHOTO_PNGS = [
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mO4o6EBAAMQAS0Qc/Z2AAAAAElFTkSuQmCC",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mPQ2BIAAAI0AS1by1fNAAAAAElFTkSuQmCC",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mPQCLgDAAH4AVXsR+abAAAAAElFTkSuQmCC",
];

const POINT_COUNT = 20;
/** Which of the 20 points carry a photo. Three of them do, as #11 requires. */
const PHOTO_INDICES = [0, 7, 14];

const LAYER_NAME = "Titik Survei";

/** The project a field worker saves before leaving the network behind. */
function offlineProject(): GeoLibreProject {
  const project = createEmptyProject("Survei Offline");
  // A blank basemap is resolved locally (`createBlankMapStyle`), so the map
  // mounts with nothing fetched. A remote style would abort and leave the
  // canvas without a style at all, which would fail for the wrong reason.
  project.basemapStyleUrl = "";
  project.mapView = { center: [110.36, -7.755], zoom: 11, bearing: 0, pitch: 0 };
  project.layers = [
    {
      id: "titik-survei",
      name: LAYER_NAME,
      type: "geojson",
      source: { type: "geojson" },
      visible: true,
      opacity: 1,
      style: DEFAULT_LAYER_STYLE,
      // The photo popup only binds to layers that declare this kind.
      metadata: { sourceKind: "geotagged-photos" },
      geojson: {
        type: "FeatureCollection",
        features: Array.from({ length: POINT_COUNT }, (_, index) => {
          const properties: Record<string, unknown> = { id: index + 1, nama: `Titik ${index + 1}` };
          const photoIndex = PHOTO_INDICES.indexOf(index);
          if (photoIndex !== -1) properties.photo = PHOTO_PNGS[photoIndex];
          return {
            type: "Feature" as const,
            id: index + 1,
            properties,
            geometry: {
              type: "Point" as const,
              coordinates: [110.3 + (index % 5) * 0.03, -7.8 + Math.floor(index / 5) * 0.03],
            },
          };
        }),
      },
    },
  ];
  return project;
}

/** Aborts every request the local preview cannot answer, and returns the list. */
async function blockNetwork(page: Page): Promise<string[]> {
  const aborted: string[] = [];
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
    if (local || url.startsWith("data:") || url.startsWith("blob:")) {
      await route.continue();
      return;
    }
    aborted.push(url);
    await route.abort();
  });
  return aborted;
}

/** Clicks a geographic position, projecting it through the live camera. */
async function clickLngLat(page: Page, lngLat: [number, number]): Promise<void> {
  const point = await page.evaluate((target) => {
    const map = window.__geolibreTestMap!;
    const projected = map.project(target);
    const rect = map.getCanvas().getBoundingClientRect();
    return { x: rect.left + projected.x, y: rect.top + projected.y };
  }, lngLat);
  await page.mouse.click(point.x, point.y);
}

test("reopens a project with every non-local request aborted", async ({ page }) => {
  // Opening a project prefers the File System Access picker
  // (`window.showOpenFilePicker`, project-files.ts), which Playwright cannot
  // intercept: it opens a native OS dialog, so no `filechooser` event ever
  // fires and the test waits out its timeout. Removing it forces the
  // `<input type=file>` fallback, which is drivable. Same reason, same shape as
  // layer-groups.spec.ts:38-41.
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
    delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
  });

  const aborted = await blockNetwork(page);
  const dir = await mkdtemp(join(tmpdir(), "geolibre-offline-"));
  const projectPath = join(dir, "survei-offline.geolibre.json");
  await writeFile(projectPath, JSON.stringify(offlineProject(), null, 2));

  try {
    // English, because the assertions below read the attribute table's status
    // line, which is translated per locale.
    await waitForMap(page, "/?lang=en");

    // Prove the block is live before trusting anything that follows: a probe
    // that reached the network would mean the assertions below prove nothing.
    const probe = await page.evaluate(() =>
      fetch("https://example.invalid/offline-probe")
        .then(() => "reached")
        .catch(() => "blocked"),
    );
    expect(probe).toBe("blocked");
    // The fetch failing could also be a DNS failure; the recorded abort proves
    // the route handler is the reason, so the rest of the test is offline.
    expect(aborted.some((url) => url.includes("offline-probe"))).toBe(true);

    // Open the saved project the way a user does, from a file on disk.
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Project" }).click();
    await page.getByRole("menuitem", { name: "Open From" }).click();
    await page.getByRole("menuitem", { name: "File..." }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(projectPath);

    // Opening a project over an untouched one offers to save the old one first.
    const discard = page.getByRole("button", { name: "Do not save", exact: true });
    if (await discard.isVisible({ timeout: 2_000 }).catch(() => false)) await discard.click();

    await expect(page.getByTestId("map-canvas")).toBeVisible();
    await expect(layerRow(page, LAYER_NAME)).toBeVisible();
    await expect(page.getByTestId("desktop-shell")).toContainText(LAYER_NAME);

    await bindMapLibreMap(page);
    await expect
      .poll(async () => page.evaluate(() => window.__geolibreTestMap!.loaded()), { timeout: 30_000 })
      .toBe(true);

    // The Layers panel overlays the left of the map, and a click that lands on
    // it never reaches the canvas. Collapse it so the photo points are hittable.
    const collapse = page.getByRole("button", { name: "Collapse layers", exact: true });
    if (await collapse.isVisible({ timeout: 2_000 }).catch(() => false)) await collapse.click();

    // 3 photos: every photo point opens the popup with its own inline
    // thumbnail. The Set proves the three are distinct, not one photo shown
    // three times.
    const sources = new Set<string>();
    for (const index of PHOTO_INDICES) {
      const lngLat: [number, number] = [110.3 + (index % 5) * 0.03, -7.8 + Math.floor(index / 5) * 0.03];
      await clickLngLat(page, lngLat);
      const image = page.locator(".geolibre-photo-popup-img");
      await expect(image).toBeVisible({ timeout: 15_000 });
      const src = await image.getAttribute("src");
      expect(src?.startsWith("data:image/png")).toBe(true);
      sources.add(src ?? "");
      await page.locator(".geolibre-photo-popup-root .maplibregl-popup-close-button").click();
      await expect(image).toHaveCount(0);
    }
    expect(sources.size).toBe(PHOTO_INDICES.length);

    // Collapsing above left only the panel's thin rail, and the rail renders no
    // layer rows (LayerPanel.tsx:488-500), so the row the menu hangs off is gone
    // from the DOM. Expand it back before reaching for that row; mirror of the
    // collapse, and conditional for the same reason. The assertion is what turns
    // a missing row into a named failure instead of a 60s click timeout.
    const expand = page.getByRole("button", { name: "Expand layers", exact: true });
    if (await expand.isVisible({ timeout: 2_000 }).catch(() => false)) await expand.click();
    await expect(layerRow(page, LAYER_NAME)).toBeVisible();

    // 20 points: the attribute table reports the project's own feature count.
    // The rows themselves are virtualized (only what fits the viewport is in
    // the DOM), so the status line is what carries the total.
    await layerRow(page, LAYER_NAME).locator('button[aria-label="Layer actions"]').click();
    await page.getByRole("menuitem", { name: "Open attribute table" }).click();
    await expect(page.getByTestId("attribute-table")).toBeVisible();
    await expect(page.getByTestId("attribute-table-status")).toContainText(`${POINT_COUNT} features`);
    await expect(page.locator('[data-testid="attribute-table"] tbody tr').first()).toBeVisible();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
