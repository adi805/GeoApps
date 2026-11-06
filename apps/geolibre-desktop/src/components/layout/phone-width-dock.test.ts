/**
 * Regression test for QC 3.3 (umbrella #14): the desktop side dock still
 * renders at phone width.
 *
 * `SharedSidebar` lays itself out as `w-full ... md:w-11 md:flex-col`, so below
 * the `md` breakpoint the vertical rail becomes a full-width horizontal strip
 * 28 px tall. At 390 px that strip carried BROWSER + LAYER on the left and
 * COMMENTS + STYLE on the right - two 87x28 and 67x28 targets, half the 48 px
 * thumb minimum, stacked directly under the map on a device where the mobile
 * shell already offers the same four panels through the tab bar. The QC
 * walkthrough measured those rectangles; they are the defect.
 *
 * The fix drops the dock from the tree below `md` (`showSideDocks`) instead of
 * hiding it with CSS: a 28 px-tall strip of buttons must not exist in the
 * accessibility tree, in the tab order or in the DOM at all on a phone. This
 * test pins both halves of that: absent at 390 px, still there at 1280 px, so a
 * future "always render, hide with a media query" shortcut fails here.
 */
import { render, screen } from "../../../../../tests/helpers/dom";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import type { LayoutOptions } from "../../hooks/useLayoutOptions";

const { DesktopShell } = await import("./DesktopShell");

/** The layout App.tsx passes for a plain window with every panel on. */
const layoutOptions: LayoutOptions = {
  attributePanelVisible: true,
  compact: false,
  layerPanelVisible: true,
  panelsHidden: false,
  panelsCollapsed: false,
  showProjectInfo: true,
  statusBarVisible: true,
  stylePanelVisible: true,
  toolbarLabels: true,
  toolbarVisible: true,
  viewer: false,
};

function setViewport(width: number, height: number): void {
  const happyDom = (window as unknown as { happyDOM?: { setViewport?: (v: unknown) => void } })
    .happyDOM;
  happyDom?.setViewport?.({ width, height });
}

function renderShell(): void {
  render(
    createElement(DesktopShell, {
      layoutOptions,
      mapAppAPI: null,
      themeMode: "light" as const,
      onToggleThemeMode: () => {},
    }),
  );
}

/**
 * The shared dock rails: `<aside aria-label="Sidebar">`, one per side, each
 * holding the toggles for the two panels docked on that side (SharedSidebar.tsx).
 * Queried structurally - by element, name and the button count inside - so the
 * assertions do not depend on whether a panel currently reads "Expand" or
 * "Collapse".
 */
function dockRails(): { aside: Element; buttons: number }[] {
  return Array.from(document.querySelectorAll('aside[aria-label="Sidebar"]')).map((aside) => ({
    aside,
    buttons: aside.querySelectorAll("button[aria-pressed]").length,
  }));
}

describe("phone-width side dock", () => {
  it("renders no desktop dock rails at 390 px", () => {
    setViewport(390, 844);
    assert.equal(
      window.matchMedia("(max-width: 767px)").matches,
      true,
      "the harness viewport is phone width, otherwise this test would exercise the desktop branch",
    );

    renderShell();

    // The mobile chrome is what replaces the dock, so it must be there.
    assert.ok(screen.getByTestId("mobile-shell"), "the phone shell is mounted");
    assert.ok(screen.getByTestId("mobile-tab-bar"), "the tab bar offers the panels the dock would");

    // SharedSidebar is the only `<aside>` in the workspace row; the panels are
    // portals into the docks, so an aside here means the 28 px strip is back.
    assert.deepEqual(
      dockRails().length,
      0,
      "no dock rail may render on a phone, otherwise the 28 px strip of sub-48 px targets is back",
    );
    assert.equal(
      document.querySelectorAll("aside").length,
      0,
      "the workspace row holds no aside at all at phone width",
    );

    const row = document.querySelector("[data-workspace-row]");
    assert.ok(row, "the workspace row is still the layout container");
    assert.equal(
      row?.children.length,
      1,
      "nothing but the map section may sit in the workspace row at phone width",
    );
  });

  it("still renders the dock rails at 1280 px", () => {
    setViewport(1280, 800);
    assert.equal(
      window.matchMedia("(max-width: 767px)").matches,
      false,
      "the harness viewport is desktop width",
    );

    renderShell();

    assert.equal(
      screen.queryByTestId("mobile-tab-bar"),
      null,
      "the phone tab bar stays out of the desktop layout",
    );
    const rails = dockRails();
    assert.equal(rails.length, 2, "both dock rails render again on a desktop window");
    for (const rail of rails) {
      assert.equal(
        rail.buttons,
        2,
        "each rail keeps the two panel toggles it is responsible for",
      );
    }
  });
});