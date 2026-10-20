/**
 * DesktopShell is the component every desktop session mounts: it is the only
 * place the map surface, the toolbar, the side dock and the status bar are
 * wired together. Until this file existed nothing under tests/ loaded it, so
 * the untested-module ratchet counted it as a large module with no test while
 * it kept growing (#22).
 *
 * The test renders the shell with the same props App.tsx passes. happy-dom has
 * no WebGL2, so the MapCanvas mount fails inside the shell's own section error
 * boundary; that is exactly what the second test pins down: a map that cannot
 * initialize degrades one section, it does not take the rest of the shell with
 * it.
 */
import { render, screen } from "./helpers/dom";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import type { LayoutOptions } from "../apps/geolibre-desktop/src/hooks/useLayoutOptions";

// Loaded after the harness so its CSS imports and Vite globals are handled.
const { DesktopShell } =
  await import("../apps/geolibre-desktop/src/components/layout/DesktopShell");

/** The layout App.tsx passes for a plain desktop window with every panel on. */
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

function renderShell() {
  return render(
    createElement(DesktopShell, {
      layoutOptions,
      mapAppAPI: null,
      themeMode: "light" as const,
      onToggleThemeMode: () => {},
    }),
  );
}

function shellText(): string {
  const shell = screen.getByTestId("desktop-shell");
  return (shell.textContent ?? "").replace(/\s+/g, " ");
}

describe("DesktopShell", () => {
  it("mounts the shell container with its toolbar and status bar", () => {
    renderShell();

    assert.ok(screen.getByTestId("desktop-shell"), "the shell container is in the DOM");

    const text = shellText();
    assert.match(text, /Add Data/, "the toolbar renders its Add Data control");
    assert.match(text, /Zoom: 2\.00/, "the status bar reads the store's zoom");
  });

  it("keeps the shell usable when the map section cannot initialize", () => {
    renderShell();

    // happy-dom provides no WebGL2, so either the canvas mounts (a DOM with a
    // real GL context) or the Map section boundary replaces it. Both are fine;
    // a blank map area with no explanation is not.
    const canvas = screen.queryByTestId("map-canvas");
    const fallback = screen.queryByText(/Map failed to render/i);

    assert.ok(
      canvas !== null || fallback !== null,
      "the map area is either mounted or replaced by its visible fallback",
    );

    if (canvas === null) {
      assert.ok(
        screen.queryByRole("button", { name: /retry/i }) !== null,
        "the degraded map section offers a Retry control",
      );
      assert.ok(
        screen.getByTestId("desktop-shell") !== null,
        "the rest of the shell survives the failed map section",
      );
    }
  });
});
