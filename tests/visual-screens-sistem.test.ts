/**
 * Komposisi jalur sistem (issue #119).
 *
 * Sama seperti `visual-screens-peta.test.ts`: `inventaris.ts` mengklaim keadaan
 * mana yang benar-benar digambar, dan uji ini membuktikan klaim itu untuk jalur
 * sistem — bukan mengulanginya. Untuk tiap keadaan yang dideklarasikan `true`,
 * markup yang dihasilkan harus berbeda dari `utama` dan bingkainya harus
 * menyebut nama keadaan itu, karena tangkapan layar dibedakan dari labelnya.
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

const sistem = await import("../apps/geolibre-desktop/src/visual/screens/sistem");

const render = (elemen: ReactNode): string => renderToStaticMarkup(elemen);

/** Akhiran " — <keadaan>" dilepas sebelum isi layar dibandingkan. */
const tanpaLabelKeadaan = (html: string): string =>
  html.replace(/aria-label="([^"]*?) — (kosong|memuat|galat|offline|izinDitolak)"/g, 'aria-label="$1"');

/** Entri inventaris yang komposisinya tinggal di berkas ini. */
const ENTRI = INVENTARIS.filter((entri) => entri.berkas === "screens/sistem.tsx");

/** Kelima keadaan, sesuai urutan kontrak inventaris. */
const KEADAAN = ["kosong", "memuat", "galat", "offline", "izinDitolak"] as const;

type Komponen = (props: { keadaan?: string; lebar?: number; tinggi?: number }) => ReactNode;

function komponen(entri: (typeof ENTRI)[number]): Komponen {
  const nilai = (sistem as unknown as Record<string, Komponen | undefined>)[entri.komponen];
  assert.equal(typeof nilai, "function", `${entri.komponen} tidak diekspor screens/sistem.tsx`);
  return nilai as Komponen;
}

describe("komposisi jalur sistem", () => {
  it("inventaris memang menunjuk ke berkas ini", () => {
    assert.equal(ENTRI.length, 6, "jalur sistem seharusnya berisi enam komposisi");
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
    // Nilai string di inventaris berarti keadaan itu tidak punya layar sendiri.
    // Yang bisa dituntut: render-nya tidak rusak dan tetap menghasilkan bingkai.
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
