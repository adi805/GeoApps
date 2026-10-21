/* Apakah partisi menu tetap menjangkau SETIAP id yang sebelumnya tampil.
 *
 * Menu Plugins sekarang punya seksi kebun di atas, submenu "All plugins (N)"
 * yang terlipat, lalu DGGS / Web Services / Installed. Probe ini membuktikan
 * gabungan keempatnya sama dengan daftar yang dulu tampil, tanpa id yang
 * hilang atau muncul dua kali. Dijalankan dari akar repo:
 *
 *   node --import tsx factory/receipts/122/menu-probe.mjs
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const { isKebunPlugin } = await import(ROOT + "packages/plugins/src/kebun-preset.ts");
const { WEB_SERVICE_PLUGIN_IDS } = await import(
  ROOT + "packages/plugins/src/plugins/web-service-sync.ts"
);
const { DGGS_PLUGIN_IDS } = await import(ROOT + "packages/plugins/src/plugins/dggs-group.ts");

// Id terdaftar, dari berkas yang dihasilkan registry dan dijaga `plugins:docs:check`.
const allIds = Object.keys(
  JSON.parse(fs.readFileSync(ROOT + "scripts/plugin-reference.json", "utf8")),
);

// Daftar yang dikecualikan dari menu dibaca dari sumbernya, bukan disalin,
// supaya probe tidak bisa menyimpang dari komponen.
const src = fs.readFileSync(
  ROOT + "apps/geolibre-desktop/src/components/layout/toolbar/PluginsMenu.tsx",
  "utf8",
);
const block = src.slice(src.indexOf("function isLeftOutOfPluginsMenu"));
const consts = [...block.slice(0, block.indexOf("\n}\n")).matchAll(/p\.id === ([A-Z_0-9]+)/g)].map(
  (m) => m[1],
);
const declared = {};
for (const f of fs.readdirSync(ROOT + "packages/plugins/src/plugins")) {
  if (!f.endsWith(".ts")) continue;
  const text = fs.readFileSync(ROOT + "packages/plugins/src/plugins/" + f, "utf8");
  for (const m of text.matchAll(/export const ([A-Z_0-9]+_PLUGIN_ID[A-Z_0-9]*) = "([^"]+)"/g)) {
    declared[m[1]] = m[2];
  }
}
const unresolved = consts.filter((c) => !declared[c]);
const leftOut = new Set(consts.map((c) => declared[c]));
const web = new Set(WEB_SERVICE_PLUGIN_IDS);
const dggs = new Set(DGGS_PLUGIN_IDS);

const listed = allIds.filter((id) => !leftOut.has(id));
const ungrouped = listed.filter((id) => !web.has(id) && !dggs.has(id));
const kebun = ungrouped.filter((id) => isKebunPlugin(id));
const other = ungrouped.filter((id) => !isKebunPlugin(id));
const grouped = listed.filter((id) => web.has(id) || dggs.has(id));
const reachable = new Set([...kebun, ...other, ...grouped]);

const problems = [];
for (const c of unresolved) problems.push("konstanta tidak resolve: " + c);
if (reachable.size !== listed.length) {
  problems.push(`terjangkau ${reachable.size} != tampil-sebelumnya ${listed.length}`);
}
for (const id of listed) if (!reachable.has(id)) problems.push("id hilang: " + id);
for (const id of kebun) if (other.includes(id)) problems.push("id di dua seksi: " + id);
for (const id of kebun) if (!isKebunPlugin(id)) problems.push("seksi kebun memuat non-kebun: " + id);
for (const id of other) if (isKebunPlugin(id)) problems.push("kebun tersisa di submenu: " + id);

console.log(
  JSON.stringify(
    {
      terdaftar: allIds.length,
      dikecualikanMenu: leftOut.size,
      tampilSebelumnya: listed.length,
      seksiKebun: kebun.length,
      kebunIds: kebun,
      submenuAllPlugins: other.length,
      submenuWebServices: listed.filter((id) => web.has(id)).length,
      submenuDggs: listed.filter((id) => dggs.has(id)).length,
      terjangkau: reachable.size,
      verdict: problems.length === 0 ? "SEMUA ID TETAP TERJANGKAU" : "GAGAL",
      problems,
    },
    null,
    1,
  ),
);
process.exit(problems.length === 0 ? 0 : 1);
