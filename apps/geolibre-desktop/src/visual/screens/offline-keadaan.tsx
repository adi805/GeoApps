/**
 * Keadaan bukan-utama untuk layar jalur offline.
 *
 * Semuanya berbentuk sama: bilah atas yang sama, isi terpusat, dan satu
 * komponen keadaan dari `states.tsx`. Dirakit di satu tempat supaya
 * `offline.tsx` cukup menyebut judul dan alasannya — dan supaya keadaan yang
 * jarang dibuka tidak berbeda diam-diam antar layar.
 */

import type { ReactNode } from "react";
import { BilahAtas, Penuh } from "../primitives";
import { Galat, IzinDitolak, Kosong, Memuat, Offline } from "../states";

export interface KeadaanKosong {
  judul: string;
  keterangan: string;
  ikon: ReactNode;
  aksi?: ReactNode;
  /** Keterangan di bilah atas, kalau keadaan itu perlu menyebut konteks. */
  atas?: string;
}

export interface KeadaanMemuat {
  judul: string;
  keterangan: string;
  atas?: string;
}

export interface KeadaanGalat {
  judul: string;
  keterangan: string;
  rincian: string;
  aksi?: ReactNode;
}

export interface KeadaanIzin {
  judul: string;
  keterangan: string;
  aksi?: ReactNode;
}

export interface KeadaanTanpaJaringan {
  judul?: string;
  keterangan: string;
  aksi?: ReactNode;
}

export interface KeadaanLain {
  kosong: KeadaanKosong;
  memuat: KeadaanMemuat;
  galat: KeadaanGalat;
  izin: KeadaanIzin;
  /**
   * Hanya untuk layar yang masih berguna tanpa jaringan. Layar yang tidak
   * menyebutkannya tidak mendapat cabang `offline`, dan keadaannya jatuh ke
   * `utama` — sesuai alasan yang tertulis di `inventaris.ts`.
   */
  offline?: KeadaanTanpaJaringan;
}

/** Merakit keadaan bukan-utama untuk satu layar. */
export function keadaanLain(judul: string, k: KeadaanLain) {
  const { atas: atasKosong, ...kosong } = k.kosong;
  const { atas: atasMemuat, ...memuat } = k.memuat;
  return {
    kosong: (
      <>
        <BilahAtas judul={judul} keterangan={atasKosong} />
        <Penuh>
          <Kosong {...kosong} />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul={judul} keterangan={atasMemuat} />
        <Penuh>
          <Memuat {...memuat} />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul={judul} />
        <Penuh>
          <Galat {...k.galat} />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul={judul} />
        <Penuh>
          <IzinDitolak {...k.izin} />
        </Penuh>
      </>
    ),
    ...(k.offline
      ? {
          offline: (
            <>
              <BilahAtas judul={judul} />
              <Penuh>
                <Offline {...k.offline} />
              </Penuh>
            </>
          ),
        }
      : {}),
  };
}
