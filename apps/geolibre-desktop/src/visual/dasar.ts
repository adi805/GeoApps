/**
 * Gaya dasar yang dibutuhkan komposisi.
 *
 * Komposisi ditulis dengan asumsi yang sama seperti aplikasi: `border-box`,
 * tanpa margin bawaan, dan font keluarga dari token. Asumsi itu datang dari
 * preflight Tailwind di `index.css`, yang TIDAK ikut saat galeri dibuka
 * sendiri atau saat tangkapan layar diambil. Akibatnya, tanpa berkas ini, baris
 * daftar yang lebarnya `100%` ditambah padding melebar melewati tepi layar dan
 * terpotong: gambar yang terlihat benar-benar rusak, padahal komposisinya tidak.
 *
 * Jadi berkas ini bukan kosmetik. Ia menutup selisih antara "berjalan di dalam
 * aplikasi" dan "berjalan sendirian", dan selisih itu harus nol.
 */

const GAYA = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
h1, h2, h3, h4, p, figure, blockquote, dl, dd { margin: 0; }
button, input, select, textarea { font: inherit; color: inherit; }
svg { display: block; }
`;

const ID = "gaya-dasar-visual";

/** Pasang sekali per dokumen; pemanggilan kedua tidak menambah tag baru. */
export function pasangGayaDasar(dokumen: Document = document) {
  if (dokumen.getElementById(ID)) return;
  const gaya = dokumen.createElement("style");
  gaya.id = ID;
  gaya.textContent = GAYA;
  dokumen.head.append(gaya);
}
