/**
 * Komposisi jalur lapangan: mengukur, membaca koordinat, menyalinnya.
 *
 * Angka di sini dipakai untuk keputusan lapangan, jadi satuan, ketelitian, dan
 * asal angkanya selalu disebut. Nilai yang belum ada ditulis sebagai tanda
 * hubung, tidak pernah dikarang.
 *
 * Bahasa visualnya mengikuti issue 102 dan rujukan `screens/peta.tsx`: peta
 * membawa skala dan atribusi, hasil ukur dibaca sebagai baris berikon dengan
 * nilai mono di ujung, dan aksi utama menempel di dasar layar. Sebelumnya peta
 * tanpa skala, tombol aksi mengapung di tengah isi, dan keadaan kosong berhenti
 * di tengah layar.
 *
 * Instrumen, baris hasil, dan bagian salinan tinggal di `lapangan-ukur-peta.tsx`,
 * `lapangan-ukur-hasil.tsx`, dan `lapangan-ukur-salinan.tsx`: berkas ini hanya
 * mengurus keadaan.
 */

import { Copy, Crosshair, MapPin, Plus, Ruler, ScanLine } from "lucide-react";
import {
  BilahAtas,
  BilahBawah,
  Daftar,
  LencanaStatus,
  Penuh,
  Tombol,
  usePalet,
} from "../primitives";
import { Galat, IzinDitolak, Kosong, Memuat, Offline, SpandukKeadaan } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { ruangAman, sentuh, spasi } from "../tokens";
import { DaftarKoordinat, HasilLuas, SegmenJarak } from "./lapangan-ukur-hasil";
import { PetaBidang, PetaPosisi, PetaRuas } from "./lapangan-ukur-peta";
import { IsiSalinan } from "./lapangan-ukur-salinan";

export function KomposisiUkurJarak({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  /** Ruas ukur dipakai keadaan utama dan offline: geometrinya tidak berubah. */
  const ruas = <PetaRuas />;
  const segmen = <SegmenJarak />;
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Ukur jarak"
          keterangan="3 segmen · total 248,6 m"
          penanda={<LencanaStatus jenis="info">Bidang datar</LencanaStatus>}
        />
        {ruas}
        <Daftar rapat>
          {segmen}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="info">
              Jarak dihitung di bidang datar pada ketinggian yang sama, bukan jarak lereng.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Plus size={sentuh.ikon} />}>
            Tambah titik ukur
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Ukur jarak" />
        <Penuh>
          <Kosong
            judul="Belum ada titik ukur"
            keterangan="Ketuk peta untuk menaruh titik pertama, lalu titik berikutnya. Jarak dihitung saat titik kedua ada."
            ikon={<Ruler size={28} aria-hidden="true" />}
            aksi={<Tombol>Tambah titik ukur</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Ukur jarak" />
        <Penuh>
          <Memuat
            judul="Menunggu posisi"
            keterangan="Titik pertama diambil dari GPS. Setelah terkunci, titik berikutnya bisa diketuk di peta."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Ukur jarak" />
        <Penuh>
          <Galat
            judul="Titik terlalu berdekatan"
            keterangan="Dua titik berjarak di bawah 0,5 m, jadi segmen ini tidak dihitung agar tidak menambah galat."
            rincian="segmen 4: 0,12 m (minimum 0,5 m)"
            aksi={<Tombol varian="sekunder">Hapus titik terakhir</Tombol>}
          />
        </Penuh>
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Ukur jarak"
          keterangan="3 segmen · total 248,6 m"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        {ruas}
        <Daftar rapat>
          {segmen}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="offline">
              Pengukuran memakai posisi perangkat, bukan layanan peta daring, jadi tetap jalan tanpa jaringan.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Plus size={sentuh.ikon} />}>
            Tambah titik ukur
          </Tombol>
        </BilahBawah>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Ukur jarak" />
        <Penuh>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Titik pertama butuh posisi perangkat. Tanpa izin, pengukuran hanya bisa dari titik yang sudah ada di peta."
            aksi={<Tombol varian="sekunder">Pakai titik yang ada</Tombol>}
          />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Ukur jarak">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiUkurLuas({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  /** Bidang dan hasilnya dipakai keadaan utama dan offline. */
  const bidang = <PetaBidang />;
  const hasil = <HasilLuas />;
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Ukur luas"
          keterangan="Bidang 4 titik"
          penanda={<LencanaStatus jenis="info">Tertutup</LencanaStatus>}
        />
        {bidang}
        <Daftar rapat>
          {hasil}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="info">
              Luas dihitung dengan rumus bidang datar; pada bidang miring hasilnya sedikit lebih kecil.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Plus size={sentuh.ikon} />}>
            Tambah titik batas
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Ukur luas" />
        <Penuh>
          <Kosong
            judul="Belum ada bidang"
            keterangan="Luas baru bisa dihitung setelah tiga titik. Ketuk peta untuk mulai menggambar batas."
            ikon={<ScanLine size={28} aria-hidden="true" />}
            aksi={<Tombol>Mulai menggambar</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Ukur luas" />
        <Penuh>
          <Memuat
            judul="Menghitung luas"
            keterangan="Menyusun titik menurut urutan gambar dan memeriksa bidang yang menyilang."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Ukur luas" />
        <Penuh>
          <Galat
            judul="Bidang menyilang dirinya sendiri"
            keterangan="Batas yang digambar berpotongan, jadi luasnya tidak bisa dihitung. Titik yang bermasalah sudah ditandai di peta."
            rincian="self-intersection di segmen 3–5"
            aksi={<Tombol varian="sekunder">Perbaiki batas</Tombol>}
          />
        </Penuh>
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Ukur luas"
          keterangan="Bidang 4 titik"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        {bidang}
        <Daftar rapat>
          {hasil}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="offline">
              Perhitungan luas berjalan lokal dari koordinat yang sudah ada, jadi tidak menunggu jaringan.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Plus size={sentuh.ikon} />}>
            Tambah titik batas
          </Tombol>
        </BilahBawah>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Ukur luas" />
        <Penuh>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Menggambar bidang dari posisi perangkat butuh izin lokasi. Menggambar manual di peta tetap bisa."
          />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Ukur luas">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiBacaKoordinat({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  /** Peta dan kedua format koordinat dipakai keadaan utama dan offline. */
  const posisi = (
    <>
      <PetaPosisi />
      <DaftarKoordinat />
    </>
  );
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Koordinat"
          keterangan="Posisi perangkat saat ini"
          penanda={<LencanaStatus jenis="sukses">± 3,2 m</LencanaStatus>}
        />
        {posisi}
        <BilahBawah>
          <Tombol lebarPenuh ikon={<MapPin size={sentuh.ikon} />}>
            Tandai titik di sini
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Koordinat" />
        <Penuh>
          <Kosong
            judul="Posisi belum terbaca"
            keterangan="Nilai ditampilkan sebagai tanda hubung sampai GPS memberi satu posisi. Angka kosong tidak diisi tebakan."
            ikon={<Crosshair size={28} aria-hidden="true" />}
            aksi={<Tombol varian="sekunder">Buka peta</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Koordinat" />
        <Penuh>
          <Memuat
            judul="Mencari sinyal"
            keterangan="Akurasi membaik selama beberapa detik pertama. Tunggu sampai di bawah 10 m sebelum mencatat."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Koordinat" />
        <Penuh>
          <Galat
            judul="Posisi tidak stabil"
            keterangan="Perangkat melaporkan lompatan lebih dari 200 m dalam 3 detik, jadi nilai ini tidak dipakai."
            rincian="akurasi 412 m · lompatan 3 detik"
            aksi={<Tombol varian="sekunder">Ulangi pembacaan</Tombol>}
          />
        </Penuh>
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Koordinat"
          keterangan="Posisi perangkat saat ini"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        {posisi}
        <BilahBawah>
          <Tombol lebarPenuh ikon={<MapPin size={sentuh.ikon} />}>
            Tandai titik di sini
          </Tombol>
        </BilahBawah>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Koordinat" />
        <Penuh>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Pembacaan koordinat butuh izin lokasi. Tanpa izin, hanya koordinat titik yang sudah tersimpan yang bisa dibaca."
          />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Baca koordinat">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiSalinKoordinat({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isiSalin = <IsiSalinan />;
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Salin koordinat" keterangan="Sumur bor 04" />
        <Daftar>
          {isiSalin}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="info">
              Format dipilih sebelum menyalin, karena tiap alat lapangan memakai format berbeda.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Copy size={sentuh.ikon} />}>
            Salin
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Salin koordinat" />
        <Penuh>
          <Kosong
            judul="Belum ada koordinat"
            keterangan="Tombol salin baru aktif setelah ada titik yang dipilih. Menyalin teks kosong tidak berguna di alat lain."
            ikon={<Copy size={28} aria-hidden="true" />}
            aksi={<Tombol nonaktif>Salin</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Salin koordinat" />
        <Penuh>
          <Memuat judul="Menyiapkan teks" keterangan="Mengubah koordinat ke format yang dipilih." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Salin koordinat" />
        <Penuh>
          <Galat
            judul="Papan klip menolak akses"
            keterangan="Aplikasi lain sedang memegang papan klip. Teks di layar tetap bisa dipilih dan disalin manual."
            rincian="clipboard: NotAllowedError"
            aksi={<Tombol varian="sekunder">Pilih teks manual</Tombol>}
          />
        </Penuh>
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Salin koordinat"
          keterangan="Sumur bor 04"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        <Daftar>
          {isiSalin}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="offline">
              Menyalin ke papan klip bekerja lokal tanpa jaringan, jadi koordinat tetap bisa dibawa ke alat lain.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Copy size={sentuh.ikon} />}>
            Salin
          </Tombol>
        </BilahBawah>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Salin koordinat" />
        <Penuh>
          <IzinDitolak
            judul="Izin papan klip ditolak"
            keterangan="Menyalin butuh izin papan klip. Teksnya tetap ditampilkan supaya bisa disalin manual."
          />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Salin koordinat">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}
