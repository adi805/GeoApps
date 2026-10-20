/**
 * Galeri komposisi.
 *
 * Galeri ini alat kerja, bukan halaman pemasaran: ia menggambar setiap
 * komposisi di setiap keadaan yang dideklarasikan `inventaris.ts`, di dua lebar
 * kanvas, di ketiga tema. Kalau sebuah keadaan tidak muncul di sini, berarti
 * keadaan itu memang tidak digambar kodenya, dan alasannya ada di inventaris.
 */

import { useMemo, useState, type ReactElement } from "react";
import { Chip, PenyediaTema, Tombol, gayaLabel, gayaTeks, usePalet } from "./primitives";
import { INVENTARIS, type Komposisi, type Keadaan } from "./inventaris";
import { LEBAR_KANVAS, TEMA, palet, spasi, tipografi, type Tema } from "./tokens";

type KomponenKomposisi = (props: { keadaan?: "utama" | keyof Keadaan; lebar?: number }) => ReactElement;

const JALUR: readonly Komposisi["jalur"][] = ["peta", "lapangan", "offline", "geofence", "sistem"];

const NAMA_KEADAAN: Record<"utama" | keyof Keadaan, string> = {
  utama: "utama",
  kosong: "kosong",
  memuat: "memuat",
  galat: "galat",
  offline: "offline",
  izinDitolak: "izin ditolak",
};

/** Keadaan yang benar-benar digambar untuk satu entri, `utama` selalu ikut. */
function keadaanTampil(e: Komposisi): ("utama" | keyof Keadaan)[] {
  const hasil: ("utama" | keyof Keadaan)[] = ["utama"];
  for (const k of Object.keys(NAMA_KEADAAN) as (keyof Keadaan)[]) {
    if (e.keadaan[k] === true) hasil.push(k);
  }
  return hasil;
}

function KartuKomposisi({
  entri,
  komponen,
  tema,
  arah,
}: {
  entri: Komposisi;
  komponen: KomponenKomposisi;
  tema: Tema;
  arah: "ltr" | "rtl";
}) {
  const p = palet[tema];
  const keadaan = keadaanTampil(entri);
  return (
    <section
      id={entri.id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spasi.lg,
        padding: spasi.xl,
        borderRadius: 14,
        background: p.permukaan,
        border: `1px solid ${p.garis}`,
      }}
    >
      <header style={{ display: "flex", flexDirection: "column", gap: spasi.xs }}>
        <h2 style={{ ...gayaTeks("judul", { bobot: "tebal", warna: p.teks }), margin: 0 }}>{entri.judul}</h2>
        <p style={{ ...gayaTeks("kecil", { warna: p.teksLembut }), margin: 0 }}>
          {entri.komponen} · {entri.berkas} · {keadaan.length} keadaan
        </p>
        <p style={{ ...gayaTeks("kecil", { warna: p.teksLembut }), margin: 0 }}>{entri.catatan}</p>
      </header>
      <div style={{ display: "flex", gap: spasi.xl, flexWrap: "wrap", alignItems: "flex-start" }}>
        {keadaan.map((k) =>
          LEBAR_KANVAS.map((lebar) => (
            <figure
              key={`${k}-${lebar}`}
              style={{ margin: 0, display: "flex", flexDirection: "column", gap: spasi.xs }}
            >
              <figcaption style={gayaLabel(p.teksLembut)}>
                {NAMA_KEADAAN[k]} · {lebar}
              </figcaption>
              <div
                dir={arah}
                style={{
                  borderRadius: 20,
                  overflow: "hidden",
                  border: `1px solid ${p.garis}`,
                  background: p.latar,
                }}
              >
                <PenyediaTema tema={tema}>
                  {komponen({ keadaan: k, lebar })}
                </PenyediaTema>
              </div>
            </figure>
          )),
        )}
      </div>
    </section>
  );
}

export function Galeri({ komponen }: { komponen: Record<string, KomponenKomposisi> }) {
  const [tema, setTema] = useState<Tema>("terang");
  const [jalur, setJalur] = useState<Komposisi["jalur"] | "semua">("semua");
  const [arah, setArah] = useState<"ltr" | "rtl">("ltr");
  const p = palet[tema];

  const daftar = useMemo(
    () => INVENTARIS.filter((e) => jalur === "semua" || e.jalur === jalur),
    [jalur],
  );

  const total = useMemo(
    () => INVENTARIS.reduce((n, e) => n + keadaanTampil(e).length * LEBAR_KANVAS.length, 0),
    [],
  );

  return (
    <div style={{ minHeight: "100vh", background: p.latar, color: p.teks, fontFamily: tipografi.keluarga.sans }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: spasi.sm,
          padding: spasi.lg,
          background: p.permukaan,
          borderBlockEnd: `1px solid ${p.garis}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: spasi.md, flexWrap: "wrap" }}>
          <h1 style={{ ...gayaTeks("judulBesar", { bobot: "tebal", warna: p.teks }), margin: 0 }}>
            Bahasa visual GeoApps
          </h1>
          <span style={{ ...gayaTeks("kecil", { warna: p.teksLembut }) }}>
            {INVENTARIS.length} komposisi · {total} gambar · 2 lebar
          </span>
        </div>
        <div style={{ display: "flex", gap: spasi.sm, flexWrap: "wrap", alignItems: "center" }}>
          <span style={gayaLabel(p.teksLembut)}>tema</span>
          {TEMA.map((t) => (
            <Chip key={t} terpilih={tema === t} onClick={() => setTema(t)}>
              {t}
            </Chip>
          ))}
          <span style={{ ...gayaLabel(p.teksLembut), marginInlineStart: spasi.md }}>jalur</span>
          <Chip terpilih={jalur === "semua"} onClick={() => setJalur("semua")}>
            semua
          </Chip>
          {JALUR.map((j) => (
            <Chip key={j} terpilih={jalur === j} onClick={() => setJalur(j)}>
              {j}
            </Chip>
          ))}
          <span style={{ ...gayaLabel(p.teksLembut), marginInlineStart: spasi.md }}>arah</span>
          <Tombol varian="halus" onClick={() => setArah(arah === "ltr" ? "rtl" : "ltr")}>
            {arah === "ltr" ? "kiri ke kanan" : "kanan ke kiri"}
          </Tombol>
        </div>
      </header>

      <main style={{ display: "flex", flexDirection: "column", gap: spasi.xl, padding: spasi.lg }}>
        {daftar.map((e) => {
          const K = komponen[e.komponen];
          if (!K) {
            return (
              <section key={e.id} style={{ padding: spasi.lg, background: p.permukaan, borderRadius: 14, border: `1px solid ${p.bahaya}` }}>
                <p style={{ ...gayaTeks("badan", { warna: p.bahaya }), margin: 0 }}>
                  Komponen {e.komponen} tidak ditemukan. Galeri dan inventaris tidak sinkron.
                </p>
              </section>
            );
          }
          return <KartuKomposisi key={e.id} entri={e} komponen={K} tema={tema} arah={arah} />;
        })}
      </main>
    </div>
  );
}
