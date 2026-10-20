/**
 * Tangkap layar galeri visual, satu berkas per fungsi produk per lebar.
 *
 * Kenapa skrip, bukan tangan: 62 berkas yang diambil manual akan berbeda
 * ukuran, berbeda tema, dan tidak bisa diulang. Skrip ini membundel
 * `tembak.tsx` dengan esbuild, membuka tiap komposisi di Chromium headless,
 * dan menulis `factory/bahan/visual/<id>-<lebar>.png`.
 *
 *   node apps/geolibre-desktop/src/visual/tangkap-layar.mjs
 *
 * Daftar komposisi dibaca dari `inventaris.ts` (dibundel dulu jadi .mjs), jadi
 * menambah komposisi otomatis menambah tangkapan layar tanpa menyentuh skrip
 * ini. Halaman diisi lewat `setContent` + `addScriptTag`, bukan `file://`:
 * Chromium headless di mesin ini mematikan renderer-nya sendiri saat membuka
 * berkas lokal sebesar 900 KB, dan galat "target crashed" itu tidak memberi
 * petunjuk apa pun tentang komposisi mana yang bermasalah.
 */

import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sini = path.dirname(fileURLToPath(import.meta.url));
const akar = path.resolve(sini, "../../../..");
const keluaran = path.join(akar, "factory/bahan/visual");
const LEBAR = [360, 412];
const TEMA_BAWAAN = "terang";
/** Keadaan yang dibuktikan dengan gambar, satu contoh per keadaan. */
const KEADAAN_CONTOH = ["kosong", "memuat", "galat", "offline", "izinDitolak"];
const TINGGI = { 360: 800, 412: 915 };
const HALAMAN = '<!doctype html><html lang="id"><body><div id="galeri"></div></body></html>';
/**
 * Saring tugas lewat `TEMBAK_HANYA=peringatan-masuk-keluar` saat satu berkas
 * gagal karena mesin kehabisan memori. Tanpa saringan, mengulang satu gambar
 * berarti merender ulang 66 gambar yang sudah benar.
 */
const HANYA = process.env.TEMBAK_HANYA ?? "";

const kerja = await mkdtemp(path.join(tmpdir(), "tembak-visual-"));

async function bundel(entri, keluar, format) {
  await build({
    entryPoints: [path.join(sini, entri)],
    bundle: true,
    format,
    outfile: path.join(kerja, keluar),
    jsx: "automatic",
    loader: { ".tsx": "tsx" },
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "warning",
  });
}

/**
 * Luncurkan Chromium headless.
 *
 * Versi peramban yang dipasang di mesin tidak selalu sama dengan yang diminta
 * `@playwright/test`: 1.64.0 meminta build 1248, sedangkan mesin ini punya
 * 1243 dari pemasangan sebelumnya. Mengunduh 261 MB untuk lima revisi
 * perbedaan bukan trade yang bagus di mesin yang disknya 94% penuh, jadi
 * skrip memakai build yang ADA dan baru menyerah kalau tidak ada sama sekali.
 */
async function luncurkan() {
  try {
    return await chromium.launch();
  } catch (e) {
    const kandidat = [];
    for (const dir of [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(process.env.HOME || "", ".cache/ms-playwright")]) {
      if (!dir) continue;
      try {
        for (const nama of await readdir(dir)) {
          if (!nama.startsWith("chromium_headless_shell-")) continue;
          const bin = path.join(dir, nama, "chrome-headless-shell-linux64", "chrome-headless-shell");
          try {
            await stat(bin);
            kandidat.push({ nama, bin });
          } catch {
            /* build tanpa binari, lewati */
          }
        }
      } catch {
        /* direktori cache tidak ada */
      }
    }
    kandidat.sort((a, b) => b.nama.localeCompare(a.nama, undefined, { numeric: true }));
    if (!kandidat.length) throw e;
    console.warn(`peramban bawaan tidak ada, memakai ${kandidat[0].nama}`);
    return chromium.launch({ executablePath: kandidat[0].bin });
  }
}

try {
  await bundel("tembak.tsx", "tembak.js", "iife");
  await bundel("inventaris.ts", "inventaris.mjs", "esm");
  const { INVENTARIS } = await import(pathToFileURL(path.join(kerja, "inventaris.mjs")).href);

  await mkdir(keluaran, { recursive: true });
  await mkdir(path.join(keluaran, "keadaan"), { recursive: true });

  const tugas = [];
  for (const entri of INVENTARIS) {
    if (HANYA && entri.id !== HANYA) continue;
    for (const lebar of LEBAR) {
      tugas.push({
        id: entri.id,
        keadaan: "utama",
        lebar,
        berkas: path.join(keluaran, `${entri.id}-${lebar}.png`),
      });
    }
  }
  for (const keadaan of KEADAAN_CONTOH) {
    if (HANYA) break;
    const entri = INVENTARIS.find((e) => e.keadaan[keadaan] === true);
    if (!entri) {
      console.warn(`tidak ada komposisi yang menggambar keadaan ${keadaan}`);
      continue;
    }
    tugas.push({
      id: entri.id,
      keadaan,
      lebar: 360,
      berkas: path.join(keluaran, "keadaan", `${entri.id}-${keadaan}.png`),
    });
  }

  const peramban = await luncurkan();
  await peramban.close();

  /**
   * Satu peramban per tugas. Satu peramban yang dipakai ulang mematikan
   * dirinya sendiri setelah belasan render: tiap halaman yang ditutup tetap
   * menyisakan memori di proses induk, dan di mesin 3,9 GB ini kernel yang
   * memutuskan, bukan skrip. Meluncurkan ulang per tugas menambah ~0,5 detik
   * per berkas, dan itu harga yang pantas dibanding run yang mati di tengah.
   */
  const gagal = [];
  let n = 0;
  for (const t of tugas) {
    for (let percobaan = 1; percobaan <= 2; percobaan += 1) {
      let perambanTugas;
      try {
        perambanTugas = await luncurkan();
        const konteks = await perambanTugas.newContext({
          viewport: { width: t.lebar, height: TINGGI[t.lebar] },
          deviceScaleFactor: 2,
          reducedMotion: "reduce",
        });
        const halaman = await konteks.newPage();
        await halaman.setContent(HALAMAN);
        await halaman.evaluate((p) => {
          window.__TEMBAK = p;
        }, { komposisi: t.id, lebar: String(t.lebar), tema: TEMA_BAWAAN, keadaan: t.keadaan });
        await halaman.addScriptTag({ path: path.join(kerja, "tembak.js") });
        await halaman.waitForFunction(() => document.body.dataset.siap === "1", null, { timeout: 20000 });
        const pesan = await halaman.evaluate(() => document.getElementById("galeri")?.textContent ?? "");
        if (pesan.startsWith("TANGKAPAN GAGAL")) throw new Error(pesan);
        await halaman.addStyleTag({
          content: "*,*::before,*::after{animation:none !important;transition:none !important}",
        });
        await halaman.evaluate(() => document.fonts.ready);
        const layar = halaman.locator("#tangkapan > div");
        const kotak = await layar.boundingBox();
        const lebar = kotak ? Math.round(kotak.width) : 0;
        const tinggi = kotak ? Math.round(kotak.height) : 0;
        if (lebar !== t.lebar || tinggi !== TINGGI[t.lebar]) {
          throw new Error(`layar ${lebar}x${tinggi}, seharusnya ${t.lebar}x${TINGGI[t.lebar]}`);
        }
        await layar.screenshot({ path: t.berkas });
        const { size } = await stat(t.berkas);
        if (size < 2000) throw new Error(`berkas terlalu kecil: ${size} bita`);
        n += 1;
        process.stdout.write(`${t.id} ${t.lebar} ${t.keadaan} ${size}B\n`);
        percobaan = 99;
      } catch (e) {
        const akhir = percobaan >= 2;
        if (akhir) gagal.push(`${t.id} ${t.lebar} ${t.keadaan}: ${e.message.split("\n")[0]}`);
        else process.stdout.write(`ulang ${t.id} ${t.lebar}: ${e.message.split("\n")[0]}\n`);
      } finally {
        await perambanTugas?.close().catch(() => {});
      }
    }
  }

  await writeFile(
    path.join(keluaran, "README.md"),
    [
      "# Tangkapan layar bahasa visual",
      "",
      `Dihasilkan \`node apps/geolibre-desktop/src/visual/tangkap-layar.mjs\`, tema ${TEMA_BAWAAN}, skala 2x.`,
      "",
      "- `<id>-<lebar>.png`: satu komposisi pada keadaan utama, lebar 360 dan 412.",
      "- `keadaan/<id>-<keadaan>.png`: bukti satu layar per keadaan (kosong, memuat, galat, offline, izin ditolak).",
      "",
      `${n} berkas ditulis.`,
      "",
    ].join("\n"),
  );

  console.log(`\ntangkapan layar: ${n}/${tugas.length} berkas di ${path.relative(akar, keluaran)}`);
  if (gagal.length) {
    for (const g of gagal) console.error(`GAGAL ${g}`);
    process.exitCode = 1;
  }
} finally {
  await rm(kerja, { recursive: true, force: true });
}
