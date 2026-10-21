/**
 * Baris hasil jalur ukur: segmen, luas, dan koordinat perangkat.
 *
 * Angka di sini dibaca di lapangan, jadi tiap baris menyebut satuan dan asalnya.
 * Dipisah dari `lapangan-ukur.tsx` supaya berkas komposisi tinggal mengurus
 * keadaan dan tidak melewati batas ratchet `check-untested-modules`.
 */

import { Crosshair, MapPin, Route, Ruler, ScanLine } from "lucide-react";
import { BarisDaftar, Daftar, LabelSeksi, LencanaStatus, usePalet } from "../primitives";
import { sentuh } from "../tokens";
import { Ukuran } from "./lapangan-ukur-peta";

/** Tiga segmen dan panjang totalnya. */
export function SegmenJarak() {
  const p = usePalet();
  return (
    <>
      <LabelSeksi>Segmen</LabelSeksi>
      <BarisDaftar
        ikon={<Ruler size={sentuh.ikon} />}
        judul="Segmen 1"
        keterangan="Titik 1 ke titik 2"
        ujung={<Ukuran warna={p.teks}>94,2 m</Ukuran>}
      />
      <BarisDaftar
        ikon={<Ruler size={sentuh.ikon} />}
        judul="Segmen 2"
        keterangan="Titik 2 ke titik 3"
        ujung={<Ukuran warna={p.teks}>96,1 m</Ukuran>}
      />
      <BarisDaftar
        ikon={<Ruler size={sentuh.ikon} />}
        judul="Segmen 3"
        keterangan="Titik 3 ke titik 4"
        ujung={<Ukuran warna={p.teks}>58,3 m</Ukuran>}
      />
      <LabelSeksi>Total</LabelSeksi>
      <BarisDaftar
        ikon={<Route size={sentuh.ikon} />}
        judul="Panjang total"
        keterangan="Jumlah tiga segmen"
        ujung={<LencanaStatus jenis="sukses">248,6 m</LencanaStatus>}
      />
    </>
  );
}

/** Luas bidang empat titik beserta rumus dan asal angkanya. */
export function HasilLuas() {
  const p = usePalet();
  return (
    <>
      <LabelSeksi>Hasil</LabelSeksi>
      <BarisDaftar
        ikon={<ScanLine size={sentuh.ikon} />}
        judul="Luas"
        keterangan="Rumus bidang datar dari empat titik"
        ujung={<LencanaStatus jenis="sukses">0,42 ha</LencanaStatus>}
      />
      <BarisDaftar
        ikon={<Ruler size={sentuh.ikon} />}
        judul="Keliling"
        keterangan="Jumlah sisi terluar bidang"
        ujung={<Ukuran warna={p.teks}>268,4 m</Ukuran>}
      />
      <BarisDaftar
        ikon={<MapPin size={sentuh.ikon} />}
        judul="Titik batas"
        keterangan="Minimal tiga titik untuk menghitung luas"
        ujung={<Ukuran warna={p.teks}>4</Ukuran>}
      />
    </>
  );
}

/** Koordinat perangkat dalam dua format, plus ketelitiannya. */
export function DaftarKoordinat() {
  const p = usePalet();
  return (
      <Daftar>
        <LabelSeksi>Derajat desimal</LabelSeksi>
        <BarisDaftar
          ikon={<Crosshair size={sentuh.ikon} />}
          judul="Lintang"
          keterangan="Enam angka di belakang koma"
          ujung={<Ukuran warna={p.teks}>-6,914352</Ukuran>}
        />
        <BarisDaftar
          ikon={<Crosshair size={sentuh.ikon} />}
          judul="Bujur"
          keterangan="Enam angka di belakang koma"
          ujung={<Ukuran warna={p.teks}>107,609118</Ukuran>}
        />
        <LabelSeksi>Derajat menit detik</LabelSeksi>
        <BarisDaftar
          ikon={<Crosshair size={sentuh.ikon} />}
          judul="Lintang"
          keterangan="Format yang dipakai alat survei"
          ujung={<Ukuran warna={p.teks}>6° 54′ 51,7″ S</Ukuran>}
        />
        <BarisDaftar
          ikon={<Crosshair size={sentuh.ikon} />}
          judul="Bujur"
          keterangan="Format yang dipakai alat survei"
          ujung={<Ukuran warna={p.teks}>107° 36′ 32,8″ E</Ukuran>}
        />
        <LabelSeksi>Ketelitian</LabelSeksi>
        <BarisDaftar
          ikon={<MapPin size={sentuh.ikon} />}
          judul="Akurasi"
          keterangan="Ambang catat 10 m"
          ujung={<LencanaStatus jenis="sukses">± 3,2 m</LencanaStatus>}
        />
        <BarisDaftar
          ikon={<Route size={sentuh.ikon} />}
          judul="Diperbarui"
          keterangan="Posisi bergerak, angka ikut berubah"
          ujung={<Ukuran warna={p.teks}>2 dtk lalu</Ukuran>}
        />
      </Daftar>
  );
}
