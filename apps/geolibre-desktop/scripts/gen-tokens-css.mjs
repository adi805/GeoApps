#!/usr/bin/env node
/**
 * Generates `src/styles/tokens.css` from the visual language in
 * `src/visual/tokens.ts`, so the app's shell and the visual gallery share one
 * palette instead of two.
 *
 * Why this exists (#68): `src/visual/tokens.ts` was only ever read by the
 * gallery (`visual.html`). Nothing under `src/App.tsx`, `src/components/**` or
 * `src/hooks/**` imported it, so the shipped app kept the stock shadcn palette
 * from `packages/ui/src/theme.css` and looked nothing like the language the
 * visual lane designed. This script is the missing wire: `index.css` imports its
 * output, and every existing `bg-background` / `text-foreground` / `bg-primary`
 * class picks up the new values without a single component being edited.
 *
 * Read-only on the source: `src/visual/tokens.ts` belongs to the visual lane.
 * Nothing here writes it, and nothing here invents a colour — every value in the
 * output is a straight HSL conversion of a `palet` entry.
 *
 * Usage:
 *   node --import tsx apps/geolibre-desktop/scripts/gen-tokens-css.mjs
 *   node --import tsx apps/geolibre-desktop/scripts/gen-tokens-css.mjs --check
 *
 * `--check` regenerates in memory and exits 1 if the file on disk differs, which
 * is the sync test: a `tokens.ts` edit that is not regenerated turns red instead
 * of shipping a stale palette.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKENS_TS = path.join(APP_DIR, "src", "visual", "tokens.ts");
const OUT_CSS = path.join(APP_DIR, "src", "styles", "tokens.css");

const { TEMA, palet, radius } = await import(pathToFileURL(TOKENS_TS).href);

/**
 * Which shadcn token each palette role becomes.
 *
 * The right-hand names are the ones `packages/ui/src/theme.css` defines and that
 * Tailwind's utilities read through `hsl(var(--...))`. Roles with no counterpart
 * (`aksen`, `aksenTeks`, `sukses`, `peringatan`, `info`, `peta*`) are deliberately
 * left out rather than parked in variables nothing consumes: a variable with no
 * reader is a promise the app does not keep.
 *
 * `--accent` maps to `permukaanTinggi`, not to `aksen`. In shadcn `--accent` is a
 * *fill* (menu hover, selected row), while `aksen` is a saturated *foreground*
 * highlight; mapping them would paint every hover state dark brown and put the
 * inherited `--accent-foreground` on top of it at about 1.4:1.
 */
const ROLE_MAP = [
  ["--background", "latar"],
  ["--foreground", "teks"],
  ["--card", "permukaan"],
  ["--card-foreground", "teks"],
  ["--popover", "permukaan"],
  ["--popover-foreground", "teks"],
  ["--secondary", "permukaanTinggi"],
  ["--secondary-foreground", "teks"],
  ["--muted", "permukaanTinggi"],
  ["--muted-foreground", "teksLembut"],
  ["--accent", "permukaanTinggi"],
  ["--accent-foreground", "teks"],
  ["--destructive", "bahaya"],
  ["--destructive-foreground", "bahayaTeks"],
  ["--border", "garis"],
  ["--input", "garis"],
];

/**
 * Tokens the preset accent schemes re-tint (`[data-theme="violet"]` and friends in
 * `packages/ui/src/theme.css`). They are emitted under selectors that stop
 * matching once a scheme is chosen, so the scheme keeps winning; see the
 * selector comments in the output.
 */
const SCHEME_MAP = [
  ["--primary", "utama"],
  ["--primary-foreground", "utamaTeks"],
  ["--ring", "fokus"],
];

/** shadcn's `--radius` is the `lg` step; `radius.md` is the scale's default. */
const RADIUS_ROLE = "md";

/**
 * Converts a `#rrggbb` colour to the space-separated HSL channels the stylesheet
 * expects (`hsl(var(--x))` supplies the wrapper).
 *
 * @param {string} hex A six-digit hex colour, as used by `palet`.
 * @returns {string} `H S% L%`, one decimal place at most.
 */
function hexToHslChannels(hex) {
  const value = hex.replace("#", "");
  const channel = (offset) => parseInt(value.slice(offset, offset + 2), 16) / 255;
  const r = channel(0);
  const g = channel(2);
  const b = channel(4);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  let saturation = 0;
  if (delta !== 0) {
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  // One decimal is the precision the source hex carries; more would suggest
  // accuracy the round-trip does not have, and it keeps the diff stable.
  const round = (n) => {
    const fixed = Math.round(n * 10) / 10;
    return Number.isInteger(fixed) ? String(fixed) : fixed.toFixed(1);
  };
  return `${round(hue)} ${round(saturation * 100)}% ${round(lightness * 100)}%`;
}

/**
 * Renders one declaration block.
 *
 * @param {string} selector CSS selector.
 * @param {Array<[string, string]>} pairs `[custom property, palette role]` pairs.
 * @param {object} theme The `palet` entry for the theme being rendered.
 * @param {string} note Comment placed above the block.
 * @returns {string} The block, ready to concatenate.
 */
function block(selector, pairs, theme, note) {
  const lines = [`  /* ${note} */`, `  ${selector} {`];
  for (const [property, role] of pairs) {
    lines.push(`    ${property}: ${hexToHslChannels(theme[role])};`);
  }
  lines.push("  }");
  return lines.join("\n");
}

/**
 * Builds the whole stylesheet.
 *
 * @returns {string} File contents.
 */
function render() {
  const source = TEMA.map((name) => `\`${name}\``).join(", ");
  const base = radius[RADIUS_ROLE];
  const header = `/*
 * GENERATED FILE - do not edit.
 *
 * Produced by \`apps/geolibre-desktop/scripts/gen-tokens-css.mjs\` from the
 * palette in \`src/visual/tokens.ts\` (themes: ${source}). Change the palette
 * there and regenerate; editing this file only makes the sync check fail.
 *
 *   node --import tsx apps/geolibre-desktop/scripts/gen-tokens-css.mjs
 *   node --import tsx apps/geolibre-desktop/scripts/gen-tokens-css.mjs --check
 *
 * The declarations sit in \`@layer base\` and \`index.css\` imports this file
 * *after* \`@geolibre/ui/globals.css\`, so at equal specificity they win on source
 * order and replace the stock palette instead of fighting it. Unlayered rules
 * were not an option: unlayered beats every layer, which would also beat the
 * \`[data-theme]\` accent schemes.
 *
 * Three surfaces are all \`tokens.ts\` offers (\`latar\`, \`permukaan\`,
 * \`permukaanTinggi\`), while shadcn splits the sunken fill three ways
 * (\`--secondary\`, \`--muted\`, \`--accent\`). Those three therefore resolve to the
 * same value. Hover still reads: it always sits on \`--popover\` or
 * \`--background\`, one step away from \`permukaanTinggi\`.
 *
 * \`--radius\` comes from \`radius.${RADIUS_ROLE}\` (${base}px). Tailwind derives
 * \`md\`/\`sm\` from it by subtracting 2px/4px, so the scale is
 * ${base}/${base - 2}/${base - 4}px and every step stays positive.
 */

@layer base {`;

  const parts = [
    header,
    block(":root", ROLE_MAP, palet.terang, "Light theme: `latar` behind `permukaan` cards."),
    block(
      "html:not([data-theme]):not(.dark)",
      SCHEME_MAP,
      palet.terang,
      "Scheme-bearing light tokens: skipped once `[data-theme]` selects a preset,\n   * because a plain `:root` here would win on source order over the preset's\n   * block and turn the scheme picker into a no-op. `.dark` is excluded because\n   * the dark block below owns those values.",
    ),
    block(".dark", ROLE_MAP, palet.gelap, "Dark theme: same roles, `latar` lifted off pure black."),
    block(
      ".dark:not([data-theme])",
      SCHEME_MAP,
      palet.gelap,
      "Scheme-bearing dark tokens: a preset's `[data-theme].dark` block outranks this.",
    ),
    block(
      ':root[data-contrast="high-dark"]',
      [...ROLE_MAP, ...SCHEME_MAP],
      palet.kontras,
      "High contrast, dark: the `kontras` palette, selected by `useHighContrast`.\n   * The light variant stays in that hook because `tokens.ts` defines one kontras\n   * palette (black and yellow) and the sunlight case needs a white background.",
    ),
  ];

  parts.push(`}

/* Radius is theme-independent, so it is declared once rather than repeated in
   every block above. */
@layer base {
  :root {
    --radius: ${base / 16}rem;
  }
}
`);

  return parts.join("\n\n");
}

const css = render();
const check = process.argv.includes("--check");

if (check) {
  let current = "";
  try {
    current = await readFile(OUT_CSS, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (current === css) {
    console.log(`OK      ${path.relative(APP_DIR, OUT_CSS)} matches tokens.ts`);
    process.exit(0);
  }
  console.error(`GAGAL   ${path.relative(APP_DIR, OUT_CSS)} is stale: run the generator without --check`);
  process.exit(1);
}

await writeFile(OUT_CSS, css, "utf8");
console.log(`tulis   ${path.relative(APP_DIR, OUT_CSS)} (${css.length} bytes, ${TEMA.length} themes)`);
