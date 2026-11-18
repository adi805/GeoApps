/**
 * The phone's "Daftar" tab, and why it is a sheet.
 *
 * The tab used to flip `layerPanelVisible` and call it done. On a phone that
 * toggles a panel which is not what is mounted there: the left dock is the
 * shared rail (Browser expanded, Layers a collapsed entry), so the built-in
 * panel renders `collapsed` + `hideOwnRail` and returns null. Measured in a
 * 390x844 viewport after importing a GeoPDF: `[data-testid=layer-panel]` null
 * and zero `[data-testid=layer-row]` both before AND after tapping the tab.
 *
 * Two things are guarded here: the shell renders the panel inside its own sheet
 * when the tab is the active one (and not otherwise), and the tab handler no
 * longer goes back to flipping the desktop setting.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { createElement } from "react";
import { render, screen } from "./helpers/dom";

const { MobileShell } =
  await import("../apps/geolibre-desktop/src/components/layout/mobile/MobileShell");

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (relative: string) => readFileSync(`${repoRoot}${relative}`, "utf8");

/** Stand-in for the layer panel: this suite is about the sheet, not the rows. */
const fakePanel = createElement("div", { "data-testid": "fake-layer-panel" }, "tiga layer");

/** Every non-optional prop of the shell, so a new required one fails loudly. */
function renderShell(activeTab: "map" | "layers") {
  return render(
    createElement(MobileShell, {
      mobile: true,
      activeTab,
      onSelectTab: () => {},
      statusStripVisible: false,
      onStatusStripVisibleChange: () => {},
      highContrast: false,
      onHighContrastChange: () => {},
      onDropPoint: () => {},
      onTakePhoto: () => {},
      onStartTrack: () => {},
      onOpenGeofence: () => {},
      onSaveProject: () => {},
      onOpenProject: () => {},
      onNewProject: () => {},
      onImportFile: () => {},
      layersPanel: fakePanel,
      children: createElement("div", { "data-testid": "map-area" }, "peta"),
    }),
  );
}

describe("sheet daftar layer di HP", () => {
  it("tidak merender daftar layer saat tab peta yang aktif", () => {
    renderShell("map");
    assert.equal(screen.queryByTestId("mobile-layers-sheet"), null);
    // The sheet returns null while closed, so the panel is not merely hidden:
    // it is never mounted, which is what keeps it off the desktop cost path.
    assert.equal(screen.queryByTestId("fake-layer-panel"), null);
    assert.ok(screen.getByTestId("map-area"));
  });

  it("merender daftar layer di dalam sheet saat tab daftar aktif", () => {
    renderShell("layers");
    assert.ok(screen.getByTestId("mobile-layers-sheet"));
    assert.ok(screen.getByTestId("fake-layer-panel"));
    // The map stays mounted underneath: the sheet overlays it, it does not
    // replace it, so closing the sheet returns to a live map.
    assert.ok(screen.getByTestId("map-area"));
  });

  it("tab daftar membuka sheet, bukan membalik setelan panel desktop", () => {
    const shell = read("apps/geolibre-desktop/src/components/layout/DesktopShell.tsx");
    const branch = shell.slice(
      shell.indexOf('if (tab === "layers")'),
      shell.indexOf('if (tab === "measure")'),
    );
    assert.ok(branch.includes('setMobileTab("layers")'), "cabang layers harus membuka sheet");
    // Comments may name the old setting (the reason is worth keeping next to the
    // code); the assertion is about what the branch executes.
    const branchCode = branch
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    assert.ok(
      !branchCode.includes("layerPanelVisible"),
      "cabang layers tidak boleh menyentuh layerPanelVisible lagi",
    );
    const mobileShell = read("apps/geolibre-desktop/src/components/layout/mobile/MobileShell.tsx");
    assert.ok(mobileShell.includes('testId="mobile-layers-sheet"'));
    assert.ok(mobileShell.includes("layersPanel"));
  });

  it("panel layer punya mode sheet yang melepas posisi absolute", () => {
    const panel = read("apps/geolibre-desktop/src/components/panels/LayerPanel.tsx");
    assert.ok(panel.includes("embeddedInSheet"), "prop embeddedInSheet harus ada");
    // The absolute placement is what put the panel over the map at phone width;
    // inside a sheet it would escape the sheet box, so sheet mode must not use it.
    const sheetBranch = panel.slice(
      panel.indexOf("embeddedInSheet\n"),
      panel.indexOf('"relative grid h-full'),
    );
    assert.ok(!sheetBranch.includes("max-md:absolute"));
  });

  it("panel di dalam sheet tidak mulai dalam keadaan terlipat", () => {
    const panel = read("apps/geolibre-desktop/src/components/panels/LayerPanel.tsx");
    // `useState(getIsMobileViewport)` made the panel start as a rail on a phone,
    // so the sheet opened showing "LAYER" and zero rows even though the panel was
    // mounted. Measured before the fix: rows 0 with the sheet 390x211 on screen.
    assert.ok(
      panel.includes("embeddedInSheet ? false : getIsMobileViewport()"),
      "seed collapse harus menghormati embeddedInSheet",
    );
  });

  it("sheet daftar terbuka di snap tinggi, bukan setinggi intip 25 vh", () => {
    const shell = read("apps/geolibre-desktop/src/components/layout/mobile/MobileShell.tsx");
    const sheetBlock = shell.slice(
      shell.indexOf('testId="mobile-layers-sheet"'),
      shell.indexOf("</MobileSheet>", shell.indexOf('testId="mobile-layers-sheet"')),
    );
    // At 25 vh (211 px on a 844 px phone) the panel's header, toolbar and search
    // fill the sheet and the first row was clipped by its overflow.
    assert.ok(
      sheetBlock.includes("defaultExpanded"),
      "sheet daftar harus minta tinggi penuh sejak dibuka",
    );
    const sheet = read("apps/geolibre-desktop/src/components/layout/mobile/MobileSheet.tsx");
    assert.ok(sheet.includes("defaultExpanded = false"));
    assert.ok(sheet.includes("useState(defaultExpanded)"));
    assert.ok(sheet.includes("setExpanded(defaultExpanded)"));
  });
});