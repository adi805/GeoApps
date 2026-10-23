/* Angka preset kebun terhadap registry, diukur bukan dikarang.
 *
 *   node --import tsx factory/receipts/122/angka.mjs
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const { isKebunPlugin, KEBUN_PLUGINS, HIDDEN_PLUGINS } = await import(
  ROOT + "packages/plugins/src/kebun-preset.ts"
);
const allIds = Object.keys(
  JSON.parse(fs.readFileSync(ROOT + "scripts/plugin-reference.json", "utf8")),
);
const kebun = allIds.filter((id) => isKebunPlugin(id));

console.log(
  JSON.stringify(
    {
      terdaftar: allIds.length,
      KEBUN_PLUGINS: KEBUN_PLUGINS.length,
      KEBUN_PLUGINS_isi: KEBUN_PLUGINS,
      kebunTerdaftar: kebun.length,
      kebunTerdaftarIds: kebun,
      kebunTidakTerdaftar: KEBUN_PLUGINS.filter((id) => !allIds.includes(id)),
      HIDDEN_PLUGINS: HIDDEN_PLUGINS.length,
      sisanya: allIds.length - kebun.length,
    },
    null,
    1,
  ),
);
