#!/usr/bin/env node
/**
 * Pemeriksa inventaris bahasa visual.
 *
 * Menegakkan lima kontrak yang tidak bisa dijaga oleh TypeScript sendiri:
 *
 * 1. Tiap komposisi yang diekspor `screens/*.tsx` terdaftar di `inventaris.ts`,
 *    dan tiap entri inventaris benar-benar ada komponennya. Hitungannya harus
 *    sama persis, jadi menambah layar tanpa mendaftarkannya akan gagal.
 * 2. Tiap entri menyebut kelima keadaan. Alasan `string` wajib cukup panjang
 *    untuk berarti, bukan sekadar "tidak ada".
 * 3. Tidak ada nilai warna mentah di luar `tokens.ts`.
 * 4. Tidak ada properti fisik `left`/`right`; aplikasi ini punya mode kanan-ke-kiri.
 * 5. Semua pasangan kontras di `KONTRAS_WAJIB` lulus ambangnya di ketiga tema.
 *
 * Inventaris dibaca dengan membundelnya lewat esbuild, bukan dengan regex atas
 * teks sumber: regex atas kode akan pecah begitu bentuk datanya berubah, dan
 * pemeriksa yang diam-diam berhenti memeriksa lebih buruk daripada tidak ada.
 *
 * Jalankan: node apps/geolibre-desktop/src/visual/cek-inventaris.mjs
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const DIREKTORI = dirname(fileURLToPath(import.meta.url));
const galat = [];
let lulus = 0;

function periksa(nama, syarat, pesan) {
  if (syarat) lulus += 1;
  else galat.push(`${nama}: ${pesan}`);
}

const KUNCI_KEADAAN = ["kosong", "memuat", "galat", "offline", "izinDitolak"];
const MIN_ALASAN = 20;

/** Bundel sebuah modul TS tanpa menulis ke disk, lalu impor sebagai ESM. */
async function imporModul(berkas) {
  const hasil = await build({
    entryPoints: [join(DIREKTORI, berkas)],
    bundle: true,
    format: "esm",
    write: false,
    platform: "node",
    loader: { ".ts": "ts", ".tsx": "tsx" },
    jsx: "automatic",
  });
  const kode = hasil.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(kode).toString("base64")}`);
}

/** Komponen yang diekspor berkas layar. */
async function komponenLayar() {
  const berkas = (await readdir(join(DIREKTORI, "screens"))).filter((f) => f.endsWith(".tsx"));
  const hasil = new Map();
  for (const f of berkas) {
    const isi = await readFile(join(DIREKTORI, "screens", f), "utf8");
    const nama = [...isi.matchAll(/export function (Komposisi[A-Za-z0-9]+)\s*\(/g)].map((m) => m[1]);
    hasil.set(`screens/${f}`, nama);
  }
  return hasil;
}

/** Rasio kontras WCAG dari dua warna heksadesimal. */
function rasio(warna1, warna2) {
  const kanal = (hex) => {
    const nilai = hex.replace("#", "");
    const penuh = nilai.length === 3 ? [...nilai].map((c) => c + c).join("") : nilai;
    return [0, 2, 4].map((i) => parseInt(penuh.slice(i, i + 2), 16) / 255);
  };
  const linier = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminansi = (hex) => {
    const [r, g, b] = kanal(hex).map(linier);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = luminansi(warna1);
  const b = luminansi(warna2);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const { INVENTARIS } = await imporModul("inventaris.ts");
const token = await imporModul("tokens.ts");
const layar = await komponenLayar();
const semuaKomponen = [...layar.values()].flat();

periksa("inventaris terbaca", Array.isArray(INVENTARIS) && INVENTARIS.length > 0, "INVENTARIS kosong");
periksa(
  "jumlah komposisi sama",
  INVENTARIS.length === semuaKomponen.length,
  `inventaris ${INVENTARIS.length} entri, layar mengekspor ${semuaKomponen.length} komposisi`,
);

const idTerpakai = new Set();
for (const e of INVENTARIS) {
  periksa(`id unik ${e.id}`, !idTerpakai.has(e.id), "id dipakai lebih dari satu entri");
  idTerpakai.add(e.id);

  periksa(
    `komponen ${e.id}`,
    semuaKomponen.includes(e.komponen),
    `"${e.komponen}" tidak diekspor berkas layar mana pun`,
  );
  const rumah = [...layar.entries()].find(([, nama]) => nama.includes(e.komponen));
  periksa(
    `berkas ${e.id}`,
    Boolean(rumah) && rumah[0] === e.berkas,
    `berkas tertulis "${e.berkas}", komponennya ada di "${rumah?.[0] ?? "tidak ada"}"`,
  );

  for (const k of KUNCI_KEADAAN) {
    const nilai = e.keadaan?.[k];
    periksa(
      `keadaan ${e.id}.${k}`,
      nilai === true || (typeof nilai === "string" && nilai.trim().length >= MIN_ALASAN),
      "harus true atau alasan yang menjelaskan, bukan kosong",
    );
  }
}

for (const nama of semuaKomponen) {
  periksa(`terdaftar ${nama}`, INVENTARIS.some((e) => e.komponen === nama), "komposisi tanpa entri inventaris");
}

// 3 & 4: larangan warna mentah dan properti fisik, di semua berkas tampilan.
const berkasTampilan = [
  ...(await readdir(join(DIREKTORI, "screens"))).map((f) => `screens/${f}`),
  "primitives.tsx",
  "states.tsx",
  "keadaan.tsx",
  "Gallery.tsx",
];
const PROPS_FISIK = /\b(?:margin|padding|border)(?:Left|Right)\b|\b(?:left|right)\s*:/;
for (const berkas of berkasTampilan) {
  const isi = await readFile(join(DIREKTORI, berkas), "utf8");
  const heks = isi.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  periksa(`warna ${berkas}`, heks.length === 0, `nilai warna mentah: ${heks.join(", ")}`);
  const fisik = isi.match(new RegExp(PROPS_FISIK.source, "g")) ?? [];
  periksa(`logis ${berkas}`, fisik.length === 0, `properti fisik terpakai: ${fisik.join(", ")}`);
}

// Layar tidak boleh merakit tombol sendiri; target sentuh 44 px milik primitif.
for (const [berkas] of layar) {
  const isi = await readFile(join(DIREKTORI, berkas), "utf8");
  periksa(`primitif ${berkas}`, !/<button/.test(isi), "komposisi memakai <button> mentah");
}

// 5: kontras.
let pasanganDiperiksa = 0;
for (const [namaTema, paletTema] of Object.entries(token.palet)) {
  for (const pasangan of token.KONTRAS_WAJIB) {
    const nilai = rasio(paletTema[pasangan.depan], paletTema[pasangan.belakang]);
    pasanganDiperiksa += 1;
    periksa(
      `kontras ${namaTema} ${pasangan.depan}/${pasangan.belakang}`,
      nilai >= pasangan.minimum,
      `${nilai.toFixed(2)}:1 di bawah ${pasangan.minimum}:1`,
    );
  }
}

// Kanvas: dua lebar yang digambar harus terdaftar di token, bukan angka bebas.
periksa("kanvas dua lebar", token.LEBAR_KANVAS.length === 2, `LEBAR_KANVAS berisi ${token.LEBAR_KANVAS.length} nilai`);

console.log(`komposisi: ${INVENTARIS.length}`);
console.log(`keadaan diperiksa: ${INVENTARIS.length * KUNCI_KEADAAN.length}`);
console.log(`pasangan kontras diperiksa: ${pasanganDiperiksa}`);
console.log(`pemeriksaan lulus: ${lulus}`);
if (galat.length > 0) {
  console.error(`\nGAGAL (${galat.length}):`);
  for (const g of galat) console.error(`  - ${g}`);
  process.exit(1);
}
console.log("OK");
