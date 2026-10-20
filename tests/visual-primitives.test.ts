/**
 * Primitif bahasa visual GeoApps (issue #42).
 *
 * Dua hal yang diuji di sini dan tidak terlihat dari tipe:
 *
 * 1. Target sentuh. `sentuh.minimum` (44 px) adalah batas bawah, bukan saran,
 *    jadi tombol, chip, dan baris daftar harus tetap setinggi itu.
 * 2. Properti logis. Antarmuka ini punya mode kanan-ke-kiri, jadi tidak boleh
 *    ada `left`/`right` di gaya mana pun. Primitif juga tidak boleh memakai
 *    `className`, karena galeri `visual.html` dibuka tanpa Tailwind.
 *
 * `helpers/dom` diimpor lebih dulu karena dialah yang memasang transform JSX
 * otomatis; tanpa itu `.tsx` dikompilasi dengan transform klasik dan melempar
 * `React is not defined`. Karena itu modul di bawah diimpor dinamis, bukan
 * statis: import statis sudah selesai sebelum hook terdaftar.
 *
 * Dirender lewat `react-dom/server`: yang diperiksa markup hasil render, bukan
 * objek React.
 */

import "./helpers/dom";

import assert from "node:assert/strict";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import { palet, sentuh, spasi, tipografi } from "../apps/geolibre-desktop/src/visual/tokens";

const {
  BarisDaftar,
  BilahKemajuan,
  BilahAtas,
  Chip,
  Isi,
  Kartu,
  Kerangka,
  Layar,
  LencanaStatus,
  Pemisah,
  PenyediaTema,
  Peta,
  Tombol,
  TombolIkon,
  gayaLabel,
  gayaTeks,
  usePalet,
  useTemaAktif,
} = await import("../apps/geolibre-desktop/src/visual/primitives");

const render = (elemen: ReactNode): string => renderToStaticMarkup(elemen);

describe("gaya teks", () => {
  it("memakai skala tipografi, bukan ukuran bebas", () => {
    const gaya = gayaTeks();
    assert.equal(gaya.fontSize, tipografi.ukuran.badan);
    assert.equal(gaya.fontWeight, tipografi.bobot.biasa);
    assert.equal(gaya.lineHeight, tipografi.tinggiBaris.normal);
    assert.equal(gaya.textAlign, "start", "rata bawaan harus start supaya mode RTL tidak perlu ditimpa");
  });

  it("menerima ukuran, bobot, warna, mono, dan perataan", () => {
    const gaya = gayaTeks("judul", { bobot: "tebal", warna: "#123456", mono: true, rata: "end" });
    assert.equal(gaya.fontSize, tipografi.ukuran.judul);
    assert.equal(gaya.fontWeight, tipografi.bobot.tebal);
    assert.equal(gaya.color, "#123456");
    assert.equal(gaya.fontFamily, tipografi.keluarga.mono);
    assert.equal(gaya.textAlign, "end");
  });

  it("label adalah huruf besar berskala kecil, bukan teks biasa yang diperbesar", () => {
    const gaya = gayaLabel("#abcdef");
    assert.equal(gaya.textTransform, "uppercase");
    assert.equal(gaya.letterSpacing, tipografi.jarakHuruf.label);
    assert.equal(gaya.fontSize, tipografi.ukuran.mikro);
    assert.equal(gaya.color, "#abcdef");
  });
});

describe("target sentuh dan properti logis", () => {
  it("tombol setinggi batas sentuh minimum", () => {
    const html = render(createElement(Tombol, null, "Simpan"));
    assert.match(html, new RegExp(`min-height:${sentuh.minimum}px`));
    assert.match(html, new RegExp(`min-width:${sentuh.minimum}px`));
    assert.match(html, /<span>Simpan<\/span>/);
  });

  it("tombol nonaktif benar-benar nonaktif, bukan sekadar kelihatan pucat", () => {
    const html = render(createElement(Tombol, { nonaktif: true, children: "Hapus" }));
    assert.match(html, /disabled=""/);
    assert.match(html, /cursor:not-allowed/);
    assert.match(html, /opacity:0\.5/);
  });

  it("tombol lebar penuh mengisi baris", () => {
    assert.match(render(createElement(Tombol, { lebarPenuh: true, children: "Lanjut" })), /width:100%/);
  });

  it("tombol ikon tetap punya nama aksesibel", () => {
    const html = render(createElement(TombolIkon, { label: "Kembali", ikon: null }));
    assert.match(html, /aria-label="Kembali"/);
    assert.match(html, /title="Kembali"/);
    assert.match(html, new RegExp(`width:${sentuh.minimum}px`));
  });

  it("chip melaporkan keadaan terpilih lewat aria-pressed", () => {
    assert.match(render(createElement(Chip, { terpilih: true, children: "Peta" })), /aria-pressed="true"/);
    assert.match(render(createElement(Chip, null, "Peta")), /aria-pressed="false"/);
  });

  it("baris daftar setinggi batas sentuh dan memakai padding logis", () => {
    const html = render(createElement(BarisDaftar, { judul: "Peta Saya", keterangan: "3 lapisan" }));
    assert.match(html, new RegExp(`min-height:${sentuh.minimum}px`));
    assert.match(html, /padding-inline/);
    assert.match(html, /text-align:start/);
  });

  it("tidak ada satu pun primitif yang memakai left/right atau className", () => {
    const contoh = [
      createElement(Tombol, null, "A"),
      createElement(TombolIkon, { label: "B", ikon: null }),
      createElement(Chip, null, "C"),
      createElement(BarisDaftar, { judul: "D" }),
      createElement(LencanaStatus, null, "E"),
      createElement(BilahKemajuan, { nilai: 40, label: "Unggah" }),
      createElement(Kerangka, null),
      createElement(Pemisah, null),
      createElement(Isi, null, "F"),
      createElement(Peta, null),
      createElement(Layar, { lebar: 360, tinggi: 800, children: "G" }),
      createElement(BilahAtas, { judul: "H" }),
      createElement(Kartu, null, "I"),
    ];
    for (const elemen of contoh) {
      // Ikon lucide membawa `class="lucide ..."` bawaannya sendiri; itu bukan
      // gaya primitif, jadi elemen svg dilepas sebelum diperiksa.
      const html = render(elemen).replace(/<svg[\s\S]*?<\/svg>/g, "<svg></svg>");
      assert.doesNotMatch(html, /class=/, `primitif memakai className: ${html.slice(0, 80)}`);
      assert.doesNotMatch(html, /[^-]left:/, `primitif memakai left: ${html.slice(0, 80)}`);
      assert.doesNotMatch(html, /[^-]right:/, `primitif memakai right: ${html.slice(0, 80)}`);
    }
  });
});

describe("bilah kemajuan", () => {
  it("dijepit ke 0..100 dan dibulatkan", () => {
    const kasus: Array<[number, number]> = [
      [-10, 0],
      [0, 0],
      [42.4, 42],
      [42.6, 43],
      [100, 100],
      [999, 100],
    ];
    for (const [masukan, diharapkan] of kasus) {
      const html = render(createElement(BilahKemajuan, { nilai: masukan, label: "Unggah" }));
      assert.match(
        html,
        new RegExp(`aria-valuenow="${diharapkan}"`),
        `nilai ${masukan} seharusnya menjadi ${diharapkan}`,
      );
    }
  });

  it("menyebut apa yang diukur, bukan hanya persentase", () => {
    const html = render(createElement(BilahKemajuan, { nilai: 10, label: "Penyimpanan offline" }));
    assert.match(html, /role="progressbar"/);
    assert.match(html, /aria-label="Penyimpanan offline"/);
    assert.match(html, /aria-valuemin="0"/);
    assert.match(html, /aria-valuemax="100"/);
  });
});

describe("kerangka memuat", () => {
  it("menggambar tiga baris bawaan dan menghormati jumlah yang diminta", () => {
    const bawaan = render(createElement(Kerangka, null));
    assert.equal((bawaan.match(/height:12px/g) ?? []).length, 3);
    const lima = render(createElement(Kerangka, { baris: 5 }));
    assert.equal((lima.match(/height:12px/g) ?? []).length, 5);
  });

  it("disembunyikan dari pembaca layar karena hanya hiasan", () => {
    assert.match(render(createElement(Kerangka, null)), /aria-hidden="true"/);
  });
});

describe("tema", () => {
  function Probe(): ReactNode {
    return createElement("span", null, `${useTemaAktif()}|${usePalet().utama}`);
  }

  it("memakai tema terang bila tidak dibungkus penyedia", () => {
    const html = render(createElement(Probe));
    assert.equal(html, `<span>terang|${palet.terang.utama}</span>`);
  });

  it("menyalurkan tema lewat konteks, bukan variabel global", () => {
    for (const tema of ["gelap", "kontras"] as const) {
      const html = render(createElement(PenyediaTema, { tema, children: createElement(Probe) }));
      assert.equal(html, `<span>${tema}|${palet[tema].utama}</span>`);
    }
  });

  it("tiap tema punya palet sendiri, bukan palet yang sama dengan nama berbeda", () => {
    const utama = new Set([palet.terang.utama, palet.gelap.utama, palet.kontras.utama]);
    assert.equal(utama.size, 3, "tiga tema harus menghasilkan tiga warna utama berbeda");
  });
});

describe("bingkai layar", () => {
  it("memakai lebar dan tinggi yang diminta serta arah tulis yang diminta", () => {
    const html = render(createElement(Layar, { lebar: 412, tinggi: 915, arah: "rtl", nama: "Peta", children: "isi" }));
    assert.match(html, /width:412px/);
    assert.match(html, /height:915px/);
    assert.match(html, /dir="rtl"/);
    assert.match(html, /aria-label="Peta"/);
  });

  it("menutup dasar layar dengan penanda rumah supaya isi pendek tidak terlihat terpotong", () => {
    const html = render(createElement(Layar, { lebar: 360, tinggi: 800, children: "isi" }));
    assert.match(html, /width:108px/);
    assert.match(html, /height:4px/);
  });

  it("isi layar memakai padding sisi dari ruang aman", () => {
    const html = render(createElement(Isi, null, "isi"));
    assert.match(html, /padding-inline/);
    assert.match(html, new RegExp(`gap:${spasi.md}px`));
  });
});
