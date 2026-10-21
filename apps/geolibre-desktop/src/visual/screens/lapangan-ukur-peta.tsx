/**
 * Instrumen jalur lapangan: peta yang membawa jejak ukur, bidang, dan posisi.
 *
 * Dipisah dari `lapangan-ukur.tsx` karena berkas komposisi di atas 500 baris
 * tanpa uji akan ditolak ratchet `check-untested-modules`. Geometrinya tinggal
 * di sini supaya komposisi hanya mengurus keadaan, bukan angka kanvas.
 *
 * Kanvas 360x400 dengan `slice`, bukan `meet`: peta latar sudah menutup penuh
 * bingkai, dan `meet` menyisakan jalur ukur mengambang di tengah peta.
 */

import { Crosshair } from "lucide-react";
import { PetaLengkap, gayaTeks, usePalet } from "../primitives";
import { radius, spasi, sentuh } from "../tokens";

/** Nilai ukur di ujung baris: mono, karena dibandingkan digit per digit. */
export function Ukuran({ children, warna }: { children: string; warna: string }) {
  return <span style={gayaTeks("badan", { mono: true, bobot: "tebal", warna })}>{children}</span>;
}

/** Titik sudut pengukuran di atas kanvas. */
function Sudut({ x, y, warna, permukaan }: { x: number; y: number; warna: string; permukaan: string }) {
  return <circle cx={x} cy={y} r="6" fill={permukaan} stroke={warna} strokeWidth="3" />;
}

/** Ruas ukur: empat titik, tiga segmen, garis putus-putus. */
export function PetaRuas() {
  const p = usePalet();
  return (
    <PetaLengkap skala="100 m">
      <svg
        aria-hidden="true"
        viewBox="0 0 360 400"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <path
          d="M48 304 L142 220 L236 256 L302 148"
          fill="none"
          stroke={p.aksen}
          strokeWidth="3"
          strokeDasharray="8 6"
        />
        <Sudut x={48} y={304} warna={p.aksen} permukaan={p.permukaan} />
        <Sudut x={142} y={220} warna={p.aksen} permukaan={p.permukaan} />
        <Sudut x={236} y={256} warna={p.aksen} permukaan={p.permukaan} />
        <Sudut x={302} y={148} warna={p.aksen} permukaan={p.permukaan} />
      </svg>
    </PetaLengkap>
  );
}

/** Bidang ukur: poligon di kanvas yang sama dengan titik sudutnya. */
export function PetaBidang() {
  const p = usePalet();
  return (
    <PetaLengkap skala="100 m">
      <svg
        aria-hidden="true"
        viewBox="0 0 360 400"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {/* Poligon digambar di kanvas yang sama dengan titik sudutnya. Memakai
            `bidang` dari primitives akan menaruh poligon di kanvas 360x260,
            sehingga sisinya tidak lagi melewati titik yang jadi alasannya. */}
        <polygon
          points="60,280 150,124 262,176 300,304"
          fill={p.aksen}
          fillOpacity="0.16"
          stroke={p.aksen}
          strokeWidth="2"
          strokeDasharray="7 5"
          strokeLinejoin="round"
        />
        <Sudut x={60} y={280} warna={p.aksen} permukaan={p.permukaan} />
        <Sudut x={150} y={124} warna={p.aksen} permukaan={p.permukaan} />
        <Sudut x={262} y={176} warna={p.aksen} permukaan={p.permukaan} />
        <Sudut x={300} y={304} warna={p.aksen} permukaan={p.permukaan} />
      </svg>
    </PetaLengkap>
  );
}

/** Peta posisi: penanda silang di tengah dan label sumber di sudut. */
export function PetaPosisi() {
  const p = usePalet();
  return (
      <PetaLengkap tinggi={180} skala="50 m">
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            insetBlockStart: "50%",
            insetInlineStart: "50%",
            transform: "translate(-50%, -50%)",
            color: p.aksen,
          }}
        >
          <Crosshair size={sentuh.ikon + 8} />
        </span>
        <span
          style={{
            position: "absolute",
            insetInlineStart: spasi.md,
            insetBlockStart: spasi.md,
            paddingInline: spasi.sm,
            paddingBlock: 2,
            borderRadius: radius.xs,
            background: p.permukaan,
            border: `1px solid ${p.garis}`,
            ...gayaTeks("mikro", { bobot: "tebal", warna: p.teks }),
          }}
        >
          GPS perangkat
        </span>
      </PetaLengkap>
  );
}
