import { expect, test } from "./test";
import { waitForMap } from "./helpers";
import type { Locator, Page } from "@playwright/test";

/**
 * Issue #69: the seven field compositions were ported onto the real screens.
 * This spec proves the part only a running app can prove: at a 360 px and a
 * 412 px phone viewport the primary action of each real screen clears 48 px,
 * and each screen is captured for the receipt.
 *
 * It lives in `factory/bahan/` because `e2e/**` is lane `uji`'s scope. To run
 * it, copy it into the Playwright config's `testDir` first:
 *
 *   cp factory/bahan/69-mobile-layar.spec.ts e2e/ && \
 *   npx playwright test e2e/69-mobile-layar.spec.ts --project=features
 *
 * Screenshots land in `factory/receipts/mobile/69-<layar>-<lebar>.png`, which
 * is what criterion 5 of the issue asks for.
 */

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 412, height: 915 },
];

/**
 * Asserts one target is at least 48 px in both axes, with a usable label.
 * `sentuh` in the composition is 44; the issue asks for 48, so 48 wins and the
 * number is spelled out here rather than imported, so the criterion is
 * greppable in this file.
 */
async function expectTarget(locator: Locator, label: string): Promise<void> {
  await expect(locator, `${label} is not attached`).toHaveCount(1);
  const box = await locator.boundingBox();
  expect(box, `${label} has no layout box`).not.toBeNull();
  expect(box!.height, `${label} height`).toBeGreaterThanOrEqual(48);
  expect(box!.width, `${label} width`).toBeGreaterThanOrEqual(48);
}

/** Every button inside `scope`, measured one by one so a failure names the row. */
async function expectAllTargets(scope: Locator, label: string): Promise<void> {
  const buttons = scope.getByRole("button");
  const count = await buttons.count();
  expect(count, `${label} has no buttons`).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    await expectTarget(buttons.nth(i), `${label} button ${i}`);
  }
}

async function shot(page: Page, screen: string, width: number): Promise<void> {
  await page.screenshot({ path: `factory/receipts/mobile/69-${screen}-${width}.png` });
}

test.describe("layar peta: konteks proyek dan aksi impor", () => {
  for (const viewport of VIEWPORTS) {
    test(`panel lapisan pada ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await waitForMap(page, "/");

      // The phone reaches the layer panel through the bottom tab bar; the tab
      // flips the same persisted setting the desktop toggle uses.
      await page.getByTestId("mobile-tab-layers").click();
      const panel = page.getByTestId("layer-panel");
      await expect(panel).toBeVisible();

      // BilahAtas: the title carries the project context underneath it, from
      // the store rather than from a placeholder.
      await expect(panel).toContainText(/lapisan/);

      await expectAllTargets(panel.getByTestId("layer-panel-toolbar"), "layer toolbar");
      await shot(page, "peta", viewport.width);
    });
  }
});

test.describe("layar titik: FieldCollectionDialog", () => {
  for (const viewport of VIEWPORTS) {
    test(`dialog koleksi lapangan pada ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await waitForMap(page, "/");

      // Field actions live in the project sheet on a phone.
      await page.getByTestId("mobile-tab-project").click();
      await page.getByTestId("mobile-action-drop-point").click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      // An empty project starts on the collection-layer state, whose primary
      // action is the full-width create button.
      await expectTarget(dialog.getByRole("button", { name: /create layer/i }), "create layer");
      await shot(page, "titik", viewport.width);
    });
  }
});

test.describe("layar rekam: GpsTrackingDialog", () => {
  for (const viewport of VIEWPORTS) {
    test(`dialog jejak GPS pada ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await waitForMap(page, "/");

      // The track tab asks the toolbar-owned dialog to open over the same
      // window event the project sheet uses.
      await page.getByTestId("mobile-tab-track").click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      // Without a fix the record button is disabled, which is still the
      // primary action and still has to be a thumb-sized target.
      await expectTarget(
        dialog.getByRole("button", { name: /record track|start gps/i }).first(),
        "record track",
      );
      await shot(page, "rekam", viewport.width);
    });
  }
});

/**
 * Settings and the offline region extract are owned by the desktop toolbar,
 * which a phone hides (its dialogs stay mounted). So they are opened at a desk
 * viewport and then measured and captured at the two phone widths: the port
 * makes them usable at 360 px, it does not move where they open from.
 */
test.describe("layar sistem dan unduh region", () => {
  test("SettingsDialog pada 360 dan 412 px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await waitForMap(page, "/");
    await page.getByRole("button", { name: "Settings", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expectTarget(dialog.getByRole("button", { name: /save settings/i }), "save settings");
      await shot(page, "sistem", viewport.width);
    }
  });

  test("BasemapExtractPanel pada 360 dan 412 px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await waitForMap(page, "/");
    await page.getByRole("button", { name: "Project", exact: true }).first().click();
    await page.getByRole("menuitem", { name: /offline basemap/i }).click();

    const panel = page.getByTestId("basemap-extract-panel");
    await expect(panel).toBeVisible();

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      await expectTarget(panel.getByRole("button", { name: /^extract$/i }).first(), "extract");
      await shot(page, "offline", viewport.width);
    }
  });
});
