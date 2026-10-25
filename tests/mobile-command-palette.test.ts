/**
 * The phone's door to the command palette, and the catalog keys behind it.
 *
 * The palette was desktop-only by accident: its entry points are Cmd/Ctrl-K and
 * a toolbar menu, neither of which exists on a phone. Three pieces fix that, and
 * each has a test here: the event the mobile sheet fires, the sheet row that
 * fires it, and the row height the palette uses under a phone viewport. The last
 * suite then checks that every `mobile.*` string those surfaces render is
 * actually in the catalogs rather than living on as an Indonesian fallback in
 * the source.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { createElement } from "react";
import { fireEvent, render, screen, stubLayout } from "./helpers/dom";

const events = await import("../apps/geolibre-desktop/src/components/layout/field-tool-events");
const { MobileShell } =
  await import("../apps/geolibre-desktop/src/components/layout/mobile/MobileShell");
const { CommandPalette } =
  await import("../apps/geolibre-desktop/src/components/command/CommandPalette");

/** The props of a component, so test doubles stay typed. */
type ComponentProps<T> = T extends (props: infer P) => unknown ? P : never;

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const localesDir = `${repoRoot}apps/geolibre-desktop/src/i18n/locales/`;
const srcDir = `${repoRoot}apps/geolibre-desktop/src/`;

/**
 * Force {@link useIsMobileViewport} one way or the other. The hook reads
 * `window.matchMedia`, and the harness maps `window` onto `globalThis`, so
 * replacing the global is enough.
 *
 * Args:
 *   isMobile: What every media query should report as `matches`.
 * Returns:
 *   A function restoring the original `matchMedia`.
 */
function stubMobileViewport(isMobile: boolean): () => void {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = ((query: string) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof globalThis.matchMedia;
  return () => {
    globalThis.matchMedia = original;
  };
}

/** Commands to open the palette with: two rows, one group each. */
const paletteCommands: ComponentProps<typeof CommandPalette>["commands"] = [
  { id: "layer.add", title: "Add layer", group: "Layers", run: () => {} },
  { id: "map.export", title: "Export map", group: "Project", run: () => {} },
];

/**
 * Render the mobile shell on its project sheet with every handler recording
 * into a shared list, so a tap can be traced to the exact handler it reached.
 *
 * Returns:
 *   The recorded calls, in order.
 */
function renderMobileShell(): string[] {
  const calls: string[] = [];
  const props: Omit<ComponentProps<typeof MobileShell>, "children"> = {
    mobile: true,
    activeTab: "project",
    onSelectTab: (tab) => calls.push(`tab:${tab}`),
    statusStripVisible: true,
    onStatusStripVisibleChange: () => {},
    highContrast: false,
    onHighContrastChange: () => {},
    onDropPoint: () => calls.push("dropPoint"),
    onTakePhoto: () => calls.push("takePhoto"),
    onStartTrack: () => calls.push("startTrack"),
    onSaveProject: () => calls.push("saveProject"),
    onOpenProject: () => calls.push("openProject"),
    onNewProject: () => calls.push("newProject"),
    onOpenCommandPalette: () => calls.push("commandPalette"),
    onImportFile: () => calls.push("importFile"),
  };
  render(createElement(MobileShell, { ...props, children: createElement("div", null, "map") }));
  return calls;
}

/** Render the palette open, with a layout box so the virtualizer mounts rows. */
function renderPalette(): void {
  stubLayout(390, 844);
  render(
    createElement(CommandPalette, {
      open: true,
      commands: paletteCommands,
      onOpenChange: () => {},
    }),
  );
}

describe("command palette request event", () => {
  it("reaches every current subscriber and stops at unsubscribe", () => {
    const seen: string[] = [];
    const offFirst = events.onCommandPaletteRequest(() => seen.push("first"));
    const offSecond = events.onCommandPaletteRequest(() => seen.push("second"));

    events.openCommandPalette();
    assert.deepEqual(seen, ["first", "second"], "both subscribers hear the request");

    offFirst();
    events.openCommandPalette();
    assert.deepEqual(seen, ["first", "second", "second"], "the first one is gone");

    offSecond();
    events.openCommandPalette();
    assert.deepEqual(seen, ["first", "second", "second"], "no subscribers left, no error");
  });
});

describe("mobile project sheet", () => {
  it("leads with the palette row, labelled from the English catalog", () => {
    renderMobileShell();
    const rows = screen.getAllByTestId(/^mobile-action-/);

    assert.equal(
      rows[0].getAttribute("data-testid"),
      "mobile-action-command-palette",
      "the palette row is the sheet's first action",
    );
    // "Search commands" is en.json's string. The source fallback is the
    // Indonesian "Cari perintah", so seeing English here proves the key is
    // resolved from the catalog and not from the fallback.
    assert.equal(rows[0].textContent, "Search commands");
    assert.match(rows[0].className, /min-h-12/, "a 48 px tap target");
  });

  it("closes the sheet and opens the palette when tapped", () => {
    const calls = renderMobileShell();
    fireEvent.click(screen.getByTestId("mobile-action-command-palette"));
    assert.deepEqual(calls, ["tab:map", "commandPalette"]);
  });
});

describe("command palette row heights", () => {
  it("uses a 48 px target on a phone viewport", () => {
    const restore = stubMobileViewport(true);
    try {
      renderPalette();
      assert.match(screen.getByRole("combobox").className, /h-12/, "the search field is 48 px");
      const options = screen.getAllByRole("option");
      assert.ok(options.length > 0, "the virtualizer mounted rows before measuring");
      for (const option of options) {
        assert.match(option.className, /min-h-12/, "every option is a 48 px target");
      }
    } finally {
      restore();
    }
  });

  it("keeps the compact rows on a desktop viewport", () => {
    const restore = stubMobileViewport(false);
    try {
      renderPalette();
      assert.match(screen.getByRole("combobox").className, /h-11/);
      const option = screen.getAllByRole("option")[0];
      assert.doesNotMatch(option.className, /min-h-12/, "no touch sizing on desktop");
      assert.match(option.className, /px-2 py-1\.5/);
    } finally {
      restore();
    }
  });
});

/** Every `.ts`/`.tsx` file under `dir`, recursively. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(`${path}/`);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Dotted key -> string value, for a parsed catalog. */
function flatStrings(value: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof value === "string") {
    out.set(prefix, value);
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      for (const [k, v] of flatStrings(child, prefix ? `${prefix}.${key}` : key)) out.set(k, v);
    }
  }
  return out;
}

function catalog(code: string): Map<string, string> {
  return flatStrings(JSON.parse(readFileSync(`${localesDir}${code}.json`, "utf8")));
}

/** i18next `{{vars}}` in a string, sorted, for comparing a translation to its source. */
function placeholders(value: string): string[] {
  return (value.match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort();
}

describe("mobile catalog keys", () => {
  const en = catalog("en");
  const id = catalog("id");
  /** key -> the fallback the source passes, for every `t("mobile.*", "…")`. */
  const used = new Map<string, string>();
  for (const file of sourceFiles(srcDir)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\bt\(\s*"(mobile\.[A-Za-z0-9._]+)"\s*,\s*"([^"]*)"/g)) {
      used.set(match[1], match[2]);
    }
  }

  it("finds the mobile strings in the source", () => {
    // A scan that matches nothing would let the next two tests pass vacuously.
    // The floor is deliberately below the current count (18 on main): the point
    // is to catch a broken scan, not to freeze how many mobile strings exist.
    assert.ok(used.size >= 15, `found only ${used.size} mobile fallbacks`);
    assert.ok(used.has("mobile.action.commandPalette"), "the new row's key is one of them");
    assert.ok(used.has("mobile.sheet.project"), "and so is a pre-existing one");
  });

  it("defines every one of them in en.json and id.json", () => {
    const missing: string[] = [];
    for (const key of used.keys()) {
      if (typeof en.get(key) !== "string") missing.push(`en: ${key}`);
      if (typeof id.get(key) !== "string") missing.push(`id: ${key}`);
    }
    assert.deepEqual(missing, [], missing.join(", "));
  });

  it("carries the same interpolation placeholders as the source", () => {
    const mismatches: string[] = [];
    for (const [key, fallback] of used) {
      for (const [code, strings] of [
        ["en", en],
        ["id", id],
      ] as const) {
        const translated = strings.get(key);
        if (translated === undefined) continue;
        const want = placeholders(fallback);
        const got = placeholders(translated);
        if (want.join() !== got.join()) {
          mismatches.push(`${code} ${key}: source [${want}] translation [${got}]`);
        }
      }
    }
    assert.deepEqual(mismatches, [], mismatches.join("\n"));
  });

  it("keeps the two catalogs level on the mobile section", () => {
    const keysOf = (strings: Map<string, string>) =>
      [...strings.keys()].filter((key) => key.startsWith("mobile.")).sort();
    assert.deepEqual(keysOf(id), keysOf(en));
    assert.ok(keysOf(en).length >= 20);
  });
});