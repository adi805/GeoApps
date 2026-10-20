/**
 * Mode tangkap layar.
 *
 * Galeri menggambar semua komposisi sekaligus, dan itu bagus untuk dibaca
 * manusia tapi buruk untuk dijadikan berkas: tangkapan layar harus satu layar
 * per berkas, dengan ukuran yang persis. Berkas ini menggambar SATU komposisi
 * saja, dipilih lewat query string:
 *
 *   tembak.html?komposisi=impor-geopdf&lebar=360&tema=terang&keadaan=utama
 *
 * `id` komposisi diambil dari `inventaris.ts`, jadi nama berkas tangkapan layar
 * dan nama fungsi produk selalu sama. Komponen yang tidak ada di inventaris
 * ditolak, bukan digambar kosong: tangkapan layar layar kosong yang terlihat
 * seperti hasil jadi adalah kebohongan yang paling mudah lolos.
 */

import { StrictMode, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { KOMPONEN } from "./entry";
import { INVENTARIS, type Keadaan } from "./inventaris";
import { PenyediaTema } from "./primitives";
import { TEMA, type Tema } from "./tokens";

import { pasangGayaDasar } from "./dasar";

type KomponenKomposisi = (props: {
  keadaan?: "utama" | keyof Keadaan;
  lebar?: number;
}) => ReactElement;

const KEAADAAN = ["utama", "kosong", "memuat", "galat", "offline", "izinDitolak"] as const;
type KeadaanTangkap = (typeof KEAADAAN)[number];

function baca(nama: string): string | null {
  const dariSkrip = (window as { __TEMBAK?: Record<string, string> }).__TEMBAK?.[nama];
  if (dariSkrip !== undefined) return dariSkrip;
  return new URLSearchParams(window.location.search).get(nama);
}

function salah(pesan: string): never {
  const el = document.getElementById("galeri");
  if (el) el.textContent = `TANGKAPAN GAGAL: ${pesan}`;
  throw new Error(pesan);
}

const peta: Record<string, KomponenKomposisi> = KOMPONEN;

const id = baca("komposisi") ?? "";
const entri = INVENTARIS.find((e) => e.id === id);
if (!entri) salah(`komposisi "${id}" tidak ada di inventaris`);

const komponenNama = baca("komponen") ?? entri.komponen;
const Komposisi = peta[komponenNama];
if (!Komposisi) salah(`komponen "${komponenNama}" tidak ada di entry.tsx`);

const lebar = Number(baca("lebar") ?? 360);
if (!Number.isFinite(lebar) || lebar <= 0) salah(`lebar "${baca("lebar")}" bukan angka`);

const temaDiminta = baca("tema") ?? "terang";
if (!TEMA.includes(temaDiminta as Tema)) salah(`tema "${temaDiminta}" tidak dikenal`);
const tema = temaDiminta as Tema;

const keadaanDiminta = baca("keadaan") ?? "utama";
if (!KEAADAAN.includes(keadaanDiminta as KeadaanTangkap)) salah(`keadaan "${keadaanDiminta}" tidak dikenal`);
const keadaan = keadaanDiminta as KeadaanTangkap;

const arah = baca("arah") === "rtl" ? "rtl" : "ltr";

const elemen = document.getElementById("galeri");
if (!elemen) salah("elemen #galeri tidak ditemukan");

pasangGayaDasar(document);

createRoot(elemen).render(
  <StrictMode>
    <PenyediaTema tema={tema}>
      <div id="tangkapan" dir={arah} style={{ display: "inline-flex" }}>
        <Komposisi keadaan={keadaan} lebar={lebar} />
      </div>
    </PenyediaTema>
  </StrictMode>,
);

// Penanda yang dibaca skrip tangkap layar: `document.body.dataset.siap` baru
// terisi sesudah React menempel, jadi skrip tidak menembak sebelum ada layar.
document.body.dataset.siap = "1";
document.body.dataset.komposisi = entri.id;
