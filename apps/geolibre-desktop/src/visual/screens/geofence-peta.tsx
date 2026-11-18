/**
 * Peta batas geofence, dipakai dua komposisi di `geofence.tsx`.
 *
 * Satu kanvas ber-skala: cincin batas, titik pusat, dan label radius di sudut
 * peta. Dipisah ke berkas daun supaya `geofence.tsx` tetap di bawah ambang
 * ratchet modul tanpa uji (500 baris); pemecahan ini tidak mengubah tampilan.
 */

import { PetaLengkap, gayaTeks, usePalet } from "../primitives";
import { radius, spasi } from "../tokens";

/** Label kecil di sudut kanvas, mis. "Radius 250 m". */
function LabelKanvas({ children }: { children: string }) {
  const p = usePalet();
  return (
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
      {children}
    </span>
  );
}

/**
 * Kanvas peta dengan cincin batas dan titik pusat.
 *
 * Cincin, bukan poligon: geofence adalah radius dari satu pusat, dan bentuk
 * lain akan menjanjikan batas yang tidak bisa dijanjikan aplikasi ini.
 */
export function PetaBatas({
  tinggi,
  skala,
  label,
  warna,
  aksen,
}: {
  tinggi: number;
  skala: string;
  label: string;
  warna: string;
  aksen: string;
}) {
  return (
    <PetaLengkap tinggi={tinggi} skala={skala}>
      <LabelKanvas>{label}</LabelKanvas>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          insetBlockStart: "19%",
          insetInlineStart: "18%",
          insetBlockEnd: "17%",
          insetInlineEnd: "20%",
          border: `2px solid ${warna}`,
          background: `${warna}1A`,
          borderRadius: radius.penuh,
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          insetBlockStart: "46%",
          insetInlineStart: "47%",
          width: 14,
          height: 14,
          borderRadius: radius.penuh,
          background: aksen,
          border: `3px solid ${warna}`,
        }}
      />
    </PetaLengkap>
  );
}
