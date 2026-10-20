/**
 * Komposisi jalur peta (issue #42).
 *
 * `inventaris.ts` mengklaim keadaan mana yang benar-benar digambar. Uji ini
 * membuktikan klaim itu, bukan mengulanginya: untuk tiap keadaan yang
 * dideklarasikan `true`, markup yang dihasilkan harus berbeda dari `utama`.
 * Keadaan yang dideklarasikan sebagai alasan teks (artinya tidak punya layar
 * sendiri) harus jatuh ke `utama` tanpa melempar.
 *
 * `helpers/dom` diimpor lebih dulu untuk memasang transform JSX otomatis, dan
 * komposisi diimpor dinamis karena import statis selesai sebelum hook terdaftar.
 */

import "./helpers/dom";

import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { INVENTARIS } from "../apps/geolibre-desktop/src/visual/inventaris";

const peta = await import("../apps/geolibre-desktop/src/visual/screens/peta");

const render = (elemen: ReactNode): string => renderToStaticMarkup(elemen);

/**
 * `Bingkai` menambahkan " — <keadaan>" ke `aria-label` supaya tangkapan layar
 * bisa dibedakan. Saat yang dibandingkan adalah ISI layar, akhiran itu dilepas
 * dulu: keadaan yang cuma mengubah label berarti tidak menggambar apa pun.
 */
const tanpaLabelKeadaan = (html: string): string =>
  html.replace(/aria-label="([^"]*?) — (kosong|memuat|galat|offline|izinDitolak)"/g, 'aria-label="$1"');

/** Entri inventaris yang komposisinya tinggal di berkas ini. */
const ENTRI = INVENTARIS.filter((entri) => entri.berkas === "screens/peta.tsx");

/** Kelima keadaan, sesuai urutan kontrak inventaris. */
const KEADAAN = ["kosong", "memuat", "galat", "offline", "izinDitolak"] as const;

type Komponen = (props: { keadaan?: string; lebar?: number; tinggi?: number }) => ReactNode;

function komponen(entri: (typeof ENTRI)[number]): Komponen {
  const nilai = (peta as unknown as Record<string, Komponen | undefined>)[entri.komponen];
  assert.equal(typeof nilai, "function", `${entri.komponen} tidak diekspor screens/peta.tsx`);
  return nilai as Komponen;
}

describe("komposisi jalur peta", () => {
  it("inventaris memang menunjuk ke berkas ini", () => {
    assert.ok(ENTRI.length > 0, "tidak ada entri inventaris untuk screens/peta.tsx");
    for (const entri of ENTRI) {
      assert.equal(typeof komponen(entri), "function", `${entri.id}: komponen tidak bisa dirender`);
    }
  });

  it("setiap komposisi tergambar tanpa prop, bukan layar kosong", () => {
    for (const entri of ENTRI) {
      const html = render(createElement(komponen(entri)));
      assert.ok(html.length > 200, `${entri.id}: markup terlalu pendek, kemungkinan kosong`);
      assert.match(html, /dir="ltr"/, `${entri.id}: bingkai layar tidak tergambar`);
    }
  });

  it("setiap keadaan yang dideklarasikan benar-benar mengubah layar", () => {
    for (const entri of ENTRI) {
      const Komposisi = komponen(entri);
      const utama = tanpaLabelKeadaan(render(createElement(Komposisi)));
      for (const keadaan of KEADAAN) {
        if (entri.keadaan[keadaan] !== true) continue;
        const html = render(createElement(Komposisi, { keadaan }));
        assert.notEqual(
          tanpaLabelKeadaan(html),
          utama,
          `${entri.id}: keadaan "${keadaan}" dideklarasikan true tapi isinya sama dengan utama`,
        );
        assert.match(
          html,
          new RegExp(`aria-label="[^"]*— ${keadaan}"`),
          `${entri.id}: bingkai tidak menyebut keadaan "${keadaan}", tangkapan layar akan sulit dibedakan`,
        );
      }
    }
  });

  it("keadaan beralasan teks tetap tergambar penuh, bukan kosong", () => {
    // Nilai string di inventaris berarti "fungsi ini tidak punya keadaan itu".
    // Yang bisa dituntut dari uji di lane ini cuma render-nya tidak rusak:
    // apakah ia jatuh ke utama atau menggambar layar sendiri adalah keputusan
    // `apps/**`, dan uji kasus di bawah memantau penyimpangannya.
    for (const entri of ENTRI) {
      const Komposisi = komponen(entri);
      for (const keadaan of KEADAAN) {
        if (entri.keadaan[keadaan] === true) continue;
        const html = render(createElement(Komposisi, { keadaan }));
        assert.ok(html.length > 200, `${entri.id}: keadaan "${keadaan}" menghasilkan markup kosong`);
        assert.match(html, /dir="ltr"/, `${entri.id}: keadaan "${keadaan}" tidak menghasilkan bingkai layar`);
      }
    }
  });

  it("kontradiksi izinDitolak terdaftar terbuka, bukan disembunyikan", () => {
    // `inventaris.ts` menyatakan izinDitolak TIDAK berlaku untuk ketujuh
    // komposisi peta (nilainya string alasan), tapi `screens/peta.tsx` justru
    // punya cabang `izinDitolak` dan menggambar layar "Akses penyimpanan
    // ditolak". Kontradiksi itu hidup di `apps/**`, di luar cakupan lane uji,
    // jadi uji ini mematoknya sebagai temuan terbuka: gagal kalau bertambah
    // (kontradiksi baru) dan gagal juga kalau hilang (sudah diperbaiki, hapus
    // uji ini). Repo-wide polanya 26 entri; yang diperiksa di sini hanya peta.
    const KONTRADIKSI_IZIN_DITOLAK = [
      "impor-geopdf",
      "impor-geotiff",
      "impor-geojson",
      "galeri-peta",
      "buka-tutup-lapisan",
      "atur-gaya-lapisan",
      "legenda",
    ];

    const menyimpang: string[] = [];
    for (const entri of ENTRI) {
      if (entri.keadaan.izinDitolak === true) continue;
      const Komposisi = komponen(entri);
      const utama = tanpaLabelKeadaan(render(createElement(Komposisi)));
      const html = tanpaLabelKeadaan(render(createElement(Komposisi, { keadaan: "izinDitolak" })));
      if (html !== utama) menyimpang.push(entri.id);
    }

    assert.deepEqual(
      menyimpang,
      KONTRADIKSI_IZIN_DITOLAK,
      "daftar komposisi yang menggambar izinDitolak padahal inventaris menyatakannya tidak berlaku " +
        "berubah: perbaiki inventaris/komponen di lane visual, lalu perbarui uji ini",
    );
  });

  it("menghormati lebar kanvas yang diminta", () => {
    for (const entri of ENTRI) {
      const html = render(createElement(komponen(entri), { lebar: 412 }));
      assert.match(html, /width:412px/, `${entri.id}: lebar kanvas tidak dipakai`);
    }
  });

  it("tidak memakai properti fisik kiri/kanan", () => {
    for (const entri of ENTRI) {
      const html = render(createElement(komponen(entri))).replace(/<svg[\s\S]*?<\/svg>/g, "<svg></svg>");
      assert.doesNotMatch(html, /[^-]left:/, `${entri.id}: memakai left`);
      assert.doesNotMatch(html, /[^-]right:/, `${entri.id}: memakai right`);
    }
  });
});
