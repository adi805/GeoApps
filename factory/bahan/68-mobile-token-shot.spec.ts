import { expect, test } from "./test";
import { waitForMap } from "./helpers";

/**
 * Issue #68: proves the palette in `src/visual/tokens.ts` reaches the running
 * app, and that the phone chrome it reaches is the real `MobileShell`.
 *
 * This file lives in `factory/bahan/` because `e2e/**` is lane `uji`'s scope.
 * To run it, copy it into `e2e/` first (the Playwright config's `testDir`):
 *
 *   cp factory/bahan/68-mobile-token-shot.spec.ts e2e/ && \
 *   npx playwright test e2e/68-mobile-token-shot.spec.ts --project=features
 *
 * The screenshots it writes are the receipt for issue #68: real app, real
 * viewport, no Storybook and no static render.
 */

/** The generated values from `styles/tokens.css`. */
const LIGHT = {
  background: "90 18.2% 95.7%",
  foreground: "111.4 14.3% 9.6%",
  primary: "149.1 53.3% 23.5%",
  radius: "0.625rem",
};
const DARK = { background: "135 11.8% 6.7%", primary: "145 48.8% 66.3%" };
/** The `kontras` palette, painted by `:root[data-contrast="high-dark"]`. */
const KONTRAS = { background: "0 0% 0%", primary: "49.9 100% 50%" };

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 412, height: 915 },
];

/** Reads a custom property off `<html>`, where every theme declares them. */
function token(page: import("@playwright/test").Page, name: string): Promise<string> {
  return page.evaluate(
    (property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim(),
    name,
  );
}

test.describe("tokens reach the phone shell", () => {
  for (const viewport of VIEWPORTS) {
    test(`light palette and mobile chrome at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await waitForMap(page, "/");

      // The generated palette, not the stock @geolibre/ui one.
      expect(await token(page, "--background")).toBe(LIGHT.background);
      expect(await token(page, "--foreground")).toBe(LIGHT.foreground);
      expect(await token(page, "--primary")).toBe(LIGHT.primary);
      expect(await token(page, "--radius")).toBe(LIGHT.radius);

      // And the chrome on top of it is the real shell, not a stand-in.
      await expect(page.getByTestId("mobile-shell")).toBeVisible();
      await expect(page.getByTestId("mobile-tab-bar")).toBeVisible();
      await expect(page.getByTestId("field-status-strip")).toBeVisible();

      // Field use: every tab has to be hittable with a thumb.
      const tabs = page.locator('[data-testid^="mobile-tab-"]');
      const count = await tabs.count();
      expect(count).toBeGreaterThanOrEqual(5);
      for (let i = 0; i < count; i += 1) {
        const box = await tabs.nth(i).boundingBox();
        expect(box, `tab ${i} has no layout box`).not.toBeNull();
        expect(box!.height, `tab ${i} height`).toBeGreaterThanOrEqual(48);
        expect(box!.width, `tab ${i} width`).toBeGreaterThanOrEqual(48);
      }

      await page.screenshot({
        path: `factory/receipts/mobile/68-mobile-${viewport.width}-light.png`,
      });
    });

    test(`dark palette at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await waitForMap(page, "/?theme=dark");

      await expect(page.locator("html")).toHaveClass(/(^|\s)dark(\s|$)/);
      expect(await token(page, "--background")).toBe(DARK.background);
      expect(await token(page, "--primary")).toBe(DARK.primary);

      await page.screenshot({
        path: `factory/receipts/mobile/68-mobile-${viewport.width}-dark.png`,
      });
    });
  }

  test("high contrast in dark mode defers to the generated kontras palette", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    // `useHighContrast` reads this key on mount; seeding it here exercises the
    // persisted path a field device takes after the toggle was switched on.
    await page.addInitScript(() => {
      window.localStorage.setItem("geolibre.highContrast", "1");
    });
    await waitForMap(page, "/?theme=dark");

    // The attribute is the whole switch now: the hook sets it and the
    // stylesheet paints the palette, so no inline token may survive and shadow
    // it.
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high-dark");
    expect(await token(page, "--background")).toBe(KONTRAS.background);
    expect(await token(page, "--primary")).toBe(KONTRAS.primary);
    const inline = await page.evaluate(
      () => document.documentElement.getAttribute("style") ?? "",
    );
    expect(inline).not.toContain("--background");

    await page.screenshot({
      path: "factory/receipts/mobile/68-mobile-360-high-contrast.png",
    });
  });
});
