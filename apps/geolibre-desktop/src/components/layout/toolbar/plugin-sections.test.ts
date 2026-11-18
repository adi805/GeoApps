/* `it()` returns a promise the runner tracks; nothing here awaits it. The rule
 * cannot know that, so it is silenced for this file only, the same way
 * `src/styles/tokens.test.ts` handles it. */
/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { partitionPlugins } from "./plugin-sections";

/**
 * The repository root, six levels above this file
 * (`toolbar/` → `layout/` → `components/` → `src/` → `geolibre-desktop/` →
 * `apps/`).
 */
const REPO_ROOT = new URL("../../../../../../", import.meta.url);

/**
 * The real KEBUN preset, loaded at run time.
 *
 * The app is a composite TypeScript project, so a source file may not import
 * `packages/plugins/src` by path (TS6307), and the preset's own entry point
 * pulls in every plugin and stylesheet, which needs a browser. Importing a URL
 * computed at run time sidesteps both: `tsc` has no specifier to resolve, and
 * `tsx` resolves it. The preset itself is unchanged and stays the only list of
 * what counts as a kebun plugin.
 */
function loadPreset(): Promise<KebunPreset> {
  const specifier = new URL("packages/plugins/src/kebun-preset.ts", REPO_ROOT).href;
  return import(specifier) as Promise<KebunPreset>;
}

interface KebunPreset {
  isKebunPlugin: (pluginId: string) => boolean;
  KEBUN_PLUGINS: readonly string[];
}

/**
 * The registered plugin ids, in registration order.
 *
 * `scripts/plugin-reference.json` is generated from `BUILT_IN_PLUGINS` in
 * `usePlugins.ts` by `scripts/gen-plugin-reference.mjs`, and CI runs that
 * generator with `--check`, so its keys are the registered plugins and cannot
 * drift from them unnoticed. Reading it avoids importing the registry (which
 * needs a browser) and avoids a hand-typed copy of the list.
 */
function registeredPluginIds(): string[] {
  const path = new URL("scripts/plugin-reference.json", REPO_ROOT);
  return Object.keys(JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>);
}

describe("partitionPlugins", () => {
  const isEven = (n: number) => n % 2 === 0;

  it("keeps both sides in the order they were given", () => {
    const { primary, rest } = partitionPlugins([4, 1, 2, 7, 6], isEven);
    assert.deepEqual(primary, [4, 2, 6]);
    assert.deepEqual(rest, [1, 7]);
  });

  it("loses nothing: the union is the input, with no duplicates", () => {
    const input = Array.from({ length: 70 }, (_, index) => `plugin-${index}`);
    const { primary, rest } = partitionPlugins(input, (id) => Number(id.slice(7)) % 7 === 0);
    const union = [...primary, ...rest];
    assert.equal(union.length, input.length);
    assert.deepEqual([...union].sort(), [...input].sort());
    assert.equal(new Set(union).size, union.length);
  });

  it("puts everything on one side when the predicate never matches", () => {
    const { primary, rest } = partitionPlugins(["a", "b"], () => false);
    assert.deepEqual(primary, []);
    assert.deepEqual(rest, ["a", "b"]);
  });

  it("handles an empty list", () => {
    assert.deepEqual(partitionPlugins([], isEven), { primary: [], rest: [] });
  });
});

describe("KEBUN section over the registered plugins", () => {
  it("splits the registry into curated and remaining with no id lost", async () => {
    const preset = await loadPreset();
    const ids = registeredPluginIds();
    assert.equal(ids.length, 70, "the registry has 70 plugins; regenerate the reference if not");

    const { primary, rest } = partitionPlugins(ids, preset.isKebunPlugin);

    // No id may go missing from either side, and none may appear twice.
    const union = [...primary, ...rest];
    assert.deepEqual([...union].sort(), [...ids].sort());
    assert.equal(new Set(union).size, ids.length);

    // The two sides are exactly the preset's answer, not a second opinion.
    assert.deepEqual(primary, ids.filter((id) => preset.isKebunPlugin(id)));
    assert.deepEqual(rest, ids.filter((id) => !preset.isKebunPlugin(id)));

    // Measured 2026-10-21: 4 curated + 66 remaining, not the 6 + 64 the issue
    // predicted. Of the preset's 5 ids, maplibre-gl-geofence is registered by
    // `registerGeofencePlugin` rather than as a plugin object in
    // BUILT_IN_PLUGINS, and the preset counts measure and geolocation as core
    // features rather than plugins. The test pins the invariant, and the
    // numbers below record what the registry actually holds.
    assert.equal(primary.length, 4);
    assert.equal(rest.length, 66);
  });

  it("curates only ids the registry actually registers", async () => {
    const preset = await loadPreset();
    const ids = registeredPluginIds();
    const registered = new Set(ids);

    const unregistered = preset.KEBUN_PLUGINS.filter((id) => !registered.has(id));
    assert.deepEqual(unregistered, ["maplibre-gl-geofence"]);

    // Every curated id that *is* registered must reach the primary section.
    for (const id of preset.KEBUN_PLUGINS.filter((candidate) => registered.has(candidate))) {
      assert.equal(preset.isKebunPlugin(id), true);
      assert.ok(ids.includes(id));
    }
  });
});
