import { expect, test } from "./test";
import { waitForMap } from "./helpers";

/**
 * The phone-width shell (Brief #12): five bottom destinations, every target at
 * least 48x48 CSS px with an 8 px gutter, nothing spilling out of a 390x844
 * viewport, and the chrome over the map capped at a quarter of the screen.
 *
 * The shell is driven at the real device metrics rather than a resized desktop,
 * because the breakpoint is a `matchMedia` query: a 390 px context is the only
 * way to make the mobile branch exist at all.
 */

const PHONE = { width: 390, height: 844 };
const TABS = ["map", "layers", "measure", "track", "project"] as const;
const MIN_TARGET = 48;
const MIN_GUTTER = 8;
const CHROME_BUDGET = 0.25;

test.use({ viewport: PHONE });

test("phone shell: five thumb-sized tabs, no overflow, chrome under a quarter", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await waitForMap(page);

  // The mobile branch exists only below the 768 px breakpoint.
  await expect(page.getByTestId("mobile-shell")).toBeVisible();
  await expect(page.getByTestId("mobile-tab-bar")).toBeVisible();

  // 1. Every destination is present.
  for (const tab of TABS) {
    await expect(page.getByTestId(`mobile-tab-${tab}`)).toBeVisible();
  }

  // 2. Each target clears 48x48, and neighbours keep an 8 px gutter.
  const boxes: { x: number; y: number; width: number; height: number }[] = [];
  for (const tab of TABS) {
    const box = await page.getByTestId(`mobile-tab-${tab}`).boundingBox();
    expect(box, `no bounding box for the ${tab} tab`).not.toBeNull();
    const target = box as { x: number; y: number; width: number; height: number };
    expect(target.width, `${tab} tab width`).toBeGreaterThanOrEqual(MIN_TARGET);
    expect(target.height, `${tab} tab height`).toBeGreaterThanOrEqual(MIN_TARGET);
    boxes.push(target);
  }
  for (let index = 1; index < boxes.length; index += 1) {
    const previous = boxes[index - 1];
    const current = boxes[index];
    const gutter = current.x - (previous.x + previous.width);
    expect(gutter, `gutter before tab ${TABS[index]}`).toBeGreaterThanOrEqual(MIN_GUTTER);
  }

  // 3. Nothing overflows the viewport in either axis.
  const overflow = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
    vertical: document.documentElement.scrollHeight - window.innerHeight,
  }));
  expect(overflow.horizontal, "horizontal overflow").toBeLessThanOrEqual(0);
  expect(overflow.vertical, "vertical overflow").toBeLessThanOrEqual(0);

  // 4. The chrome over the map (status strip + tab bar) stays under a quarter
  //    of the screen, so the map is still the surface a field worker reads.
  const chromeHeight = await page.evaluate(() => {
    const height = (selector: string) => {
      const element = document.querySelector(selector);
      return element ? element.getBoundingClientRect().height : 0;
    };
    return height('[data-testid="mobile-tab-bar"]') + height('[data-testid="field-status-strip"]');
  });
  expect(chromeHeight, "chrome over the map").toBeLessThanOrEqual(
    PHONE.height * CHROME_BUDGET,
  );

  // 5. The project sheet opens from its tab and closes back to the map.
  await page.getByTestId("mobile-tab-project").click();
  await expect(page.getByTestId("mobile-project-sheet")).toBeVisible();
  await expect(page.getByTestId("mobile-action-import-file")).toBeVisible();
  await page.getByTestId("mobile-tab-map").click();
  await expect(page.getByTestId("mobile-project-sheet")).toBeHidden();
});

test("phone shell: the field status strip can be hidden and brought back", async ({ page }) => {
  test.setTimeout(120_000);
  await waitForMap(page);

  const strip = page.getByTestId("field-status-strip");
  await expect(strip).toBeVisible();
  // The strip reports the three facts a field worker checks before moving:
  // GPS accuracy, connectivity and free storage.
  await expect(page.getByTestId("field-status-accuracy")).toBeVisible();
  await expect(page.getByTestId("field-status-network")).toBeVisible();
  await expect(page.getByTestId("field-status-storage")).toBeVisible();

  await page.getByTestId("field-status-hide").click();
  await expect(strip).toBeHidden();
  await expect(page.getByTestId("field-status-show")).toBeVisible();

  await page.getByTestId("field-status-show").click();
  await expect(strip).toBeVisible();
});
