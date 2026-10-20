/**
 * Kontrak keadaan untuk komposisi.
 *
 * Tiap komposisi menerima `keadaan`, jadi kelima keadaan layar itu digambar
 * oleh kode yang sama, bukan oleh tangkapan layar yang ditempel. Galeri memanggil
 * komposisi sekali per keadaan yang dideklarasikan `inventaris.ts`, dan itu yang
 * membuat keadaan "ada di kode" bisa diperiksa, bukan diklaim.
 */

import type { ReactNode } from "react";
import { Layar } from "./primitives";
import type { Keadaan } from "./inventaris";
import { kanvas } from "./tokens";

export type KeadaanTampil = "utama" | keyof Keadaan;

export interface Varian {
  keadaan?: KeadaanTampil;
  lebar?: number;
  tinggi?: number;
}

/** Kanvas yang dipakai: tinggi selalu ikut lebar, bukan tinggi bawaan ponsel kecil. */
function kanvasUntuk(lebar?: number) {
  if (lebar === kanvas.lebar.lebar) return kanvas.lebar;
  return kanvas.sempit;
}

/** Bingkai layar dengan ukuran bawaan ponsel kecil. */
export function Bingkai({
  varian,
  nama,
  children,
  arah,
}: {
  varian: Varian;
  nama: string;
  children: ReactNode;
  arah?: "ltr" | "rtl";
}) {
  const ukuran = kanvasUntuk(varian.lebar);
  return (
    <Layar
      lebar={varian.lebar ?? ukuran.lebar}
      tinggi={varian.tinggi ?? ukuran.tinggi}
      nama={`${nama}${varian.keadaan && varian.keadaan !== "utama" ? ` — ${varian.keadaan}` : ""}`}
      arah={arah}
    >
      {children}
    </Layar>
  );
}

/** Pilih isi menurut keadaan, dengan `utama` sebagai cadangan. */
export function pilih<T>(keadaan: KeadaanTampil, isi: Partial<Record<KeadaanTampil, T>>, utama: T): T {
  return isi[keadaan] ?? utama;
}
