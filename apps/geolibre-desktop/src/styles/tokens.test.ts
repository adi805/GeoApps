/**
 * The generated palette must never drift from its source (issue #68).
 *
 * `src/styles/tokens.css` is written by `scripts/gen-tokens-css.mjs` from
 * `TEMA` in `src/visual/tokens.ts`. The moment someone edits one and not the
 * other, the app silently keeps painting the old colours, which is exactly the
 * failure #68 exists to end. So the generator's own `--check` mode is the
 * assertion here: it regenerates into memory and compares, exiting non-zero on
 * any difference.
 *
 * This lives under `src/` because `tests/` belongs to another lane; run it with
 *
 *   node --import tsx --test apps/geolibre-desktop/src/styles/tokens.test.ts
 */

/* `it()` dari node:test mengembalikan promise yang dilacak runner, bukan promise
 * yang menunggu di-await di sini. Aturan no-floating-promises tidak bisa tahu itu. */
/* eslint-disable @typescript-eslint/no-floating-promises */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../..");
const GENERATOR = "apps/geolibre-desktop/scripts/gen-tokens-css.mjs";
const CSS = path.join(HERE, "tokens.css");

/** Roles the brief names, which every theme has to end up defining. */
const REQUIRED = [
  "--background",
  "--foreground",
  "--primary",
  "--primary-foreground",
  "--accent",
  "--muted",
  "--border",
  "--ring",
  "--radius",
];

/** Selectors whose declarations together form one theme. */
const THEMES: Record<string, string[]> = {
  terang: [":root", "html:not([data-theme]):not(.dark)"],
  gelap: [".dark", ".dark:not([data-theme])"],
  kontras: [':root[data-contrast="high-dark"]'],
};

/** Every custom property declared by the blocks whose selector starts with `head`. */
function declaredBy(css: string, head: string): Set<string> {
  const declared = new Set<string>();
  const block = new RegExp(`(?:^|\\n)\\s*${head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g");
  for (const match of css.matchAll(block)) {
    for (const name of match[1].matchAll(/(--[a-z-]+)\s*:/g)) declared.add(name[1]);
  }
  return declared;
}

describe("tokens.css", () => {
  const css = readFileSync(CSS, "utf8");

  it("matches tokens.ts (generator --check)", async () => {
    // A mismatch throws: the generator prints the differing path and exits 1.
    await run(process.execPath, ["--import", "tsx", GENERATOR, "--check"], { cwd: REPO_ROOT });
  });

  for (const [theme, selectors] of Object.entries(THEMES)) {
    it(`defines every required role for the ${theme} theme`, () => {
      const declared = new Set<string>();
      for (const selector of selectors) {
        for (const name of declaredBy(css, selector)) declared.add(name);
      }
      // `--radius` is theme-independent, declared once on `:root`.
      if (!declared.has("--radius")) {
        for (const name of declaredBy(css, ":root")) declared.add(name);
      }
      const missing = REQUIRED.filter((role) => !declared.has(role));
      assert.deepEqual(missing, [], `${theme} is missing ${missing.join(", ")}`);
    });
  }

  it("carries no literal colour, only hsl() triples", () => {
    // A hex or rgb() value here would bypass the theme system entirely.
    assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(css), false, "hex colour found in tokens.css");
    assert.equal(/\brgba?\(/.test(css), false, "rgb() colour found in tokens.css");
  });
});
