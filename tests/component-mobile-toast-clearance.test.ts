/**
 * Regression test for QC 3.4 (umbrella #14): the toast region covers the mobile
 * tab bar.
 *
 * `NotificationRegion` is mounted by `App.tsx`, outside `DesktopShell`, so it
 * cannot know the tab bar exists unless the two agree on a number. The bar is
 * 56 px tall (pt-1 + min-h-12 + pb 4, plus whatever `env(safe-area-inset-bottom)`
 * the phone reports), and the region used to sit at a flat `bottom-10` (40 px) on
 * every width. On a phone that put the toast's bottom edge 16 px *inside* the
 * bar: the five tabs were painted over and could not be tapped while a toast was
 * up, which is exactly what the QC walkthrough recorded.
 *
 * The fix keeps `bottom-10` for desktop (where a 40 px status bar is what the
 * offset is for) and adds a `max-md:` override that clears
 * `env(safe-area-inset-bottom) + tab bar + 16 px`. This test pins that override
 * to `MOBILE_TAB_BAR_HEIGHT_PX` so the two numbers cannot drift apart: raise the
 * bar and this fails until the toast moves with it.
 *
 * Nothing here measures pixels - happy-dom runs no Tailwind and has no layout
 * engine, so the class and the inline height are read as strings and the
 * arithmetic is done here.
 */
import { render, screen } from "./helpers/dom";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement, Fragment } from "react";

const { NotificationRegion } = await import("../apps/geolibre-desktop/src/components/layout/NotificationRegion");
const { MobileTabBar, MOBILE_TAB_BAR_HEIGHT_PX } = await import("../apps/geolibre-desktop/src/components/layout/mobile/MobileTabBar");

/** Space kept between the toast's bottom edge and the top of the tab bar. */
const GAP_PX = 16;

function setViewport(width: number, height: number): void {
  const happyDom = (window as unknown as { happyDOM?: { setViewport?: (v: unknown) => void } })
    .happyDOM;
  happyDom?.setViewport?.({ width, height });
}

/**
 * Reads the phone-width bottom offset out of the region's class list, in px.
 * Returns null when no `max-md:bottom-[...]` override is present, which is the
 * pre-fix state: the region then keeps the desktop `bottom-10` (40 px) and
 * overlaps the bar.
 */
function mobileBottomOffsetPx(className: string): number | null {
  const match = /(?:^|\s)max-md:bottom-\[calc\(env\(safe-area-inset-bottom,0px\)\+([\d.]+)rem\)\]/.exec(
    className,
  );
  return match ? Number.parseFloat(match[1]) * 16 : null;
}

describe("mobile toast clearance", () => {
  it("lifts the toast above the tab bar on phone width", () => {
    setViewport(390, 844);
    assert.equal(
      window.matchMedia("(max-width: 767px)").matches,
      true,
      "the harness viewport is phone width, otherwise this test would pass on the desktop branch",
    );

    render(
      createElement(
        Fragment,
        null,
        createElement(MobileTabBar, { activeTab: "map", onSelect: () => {} }),
        createElement(NotificationRegion),
      ),
    );

    const region = screen.getByTestId("notification-region");
    const className = region.getAttribute("class") ?? "";

    // Desktop offset must survive: on a wide window there is no tab bar to clear
    // and the toast still sits just above the status bar.
    assert.match(
      className,
      /(?:^|\s)bottom-10(?:\s|$)/,
      "the desktop bottom-10 offset must not be replaced, only overridden below md",
    );

    const offsetPx = mobileBottomOffsetPx(className);
    assert.notEqual(
      offsetPx,
      null,
      "the toast region needs a max-md bottom offset; without one it sits at 40 px and covers the 56 px tab bar",
    );

    const tabBarHeightPx = Number.parseInt(
      (screen.getByTestId("mobile-tab-bar") as HTMLElement).style.minHeight,
      10,
    );
    assert.equal(
      tabBarHeightPx,
      MOBILE_TAB_BAR_HEIGHT_PX,
      "the tab bar reserves its exported height in the DOM, so the shared constant is load-bearing",
    );

    assert.ok(
      (offsetPx ?? 0) >= tabBarHeightPx + GAP_PX,
      `toast bottom offset ${offsetPx}px must clear the ${tabBarHeightPx}px tab bar plus a ${GAP_PX}px gap, otherwise the tabs are covered`,
    );

    // The offset is stacked on top of the safe-area inset rather than replacing
    // it, so a phone with a home indicator still gets the gap above the bar.
    assert.match(
      className,
      /max-md:bottom-\[calc\(env\(safe-area-inset-bottom,0px\)\+/,
      "the clearance must add to env(safe-area-inset-bottom), not hardcode a fixed bottom",
    );
  });
});