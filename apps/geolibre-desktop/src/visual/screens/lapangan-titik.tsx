/**
 * Komposisi jalur lapangan: titik baru dan foto lampirannya.
 *
 * Pencatatan titik adalah inti kerja lapangan, jadi koordinat, akurasi, dan
 * sumbernya selalu terlihat. Titik yang tidak yakin asalnya lebih berbahaya
 * daripada tidak ada titik.
 */

import { Camera, Check, MapPin } from "lucide-react";
import {
  BarisDaftar,
  BilahAtas,
  Bidang,
  Chip,
  Isi,
  Kartu,
  LencanaStatus,
  Pemisah,
  Peta,
  Tombol,
  gayaTeks,
  usePalet,
} from "../primitives";
import { Galat, IzinDitolak, Kosong, Memuat, Offline } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { radius, sentuh, spasi } from "../tokens";

export function KomposisiTitikBaru({ keadaan = "utama", ...varian }: Varian) {
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Titik baru" keterangan="Sumur bor · blok C" />
        <Peta tinggi={150}>
          <div
            style={{
              position: "absolute",
              insetBlockStart: spasi.md,
              insetInlineEnd: spasi.md,
            }}
          >
            <LencanaStatus jenis="sukses">± 3,2 m</LencanaStatus>
          </div>
        </Peta>
        <Isi>
          <Kartu judul="Posisi">
            <Bidang label="Lintang" nilai="-6,914352" mono />
            <Pemisah />
            <Bidang label="Bujur" nilai="107,609118" mono />
            <Pemisah />
            <Bidang label="Sumber" nilai="GPS perangkat" satuan="akurasi ± 3,2 m" />
          </Kartu>
          <Kartu judul="Keterangan">
            <Bidang label="Nama titik" nilai="Sumur bor 04" />
            <Pemisah />
            <div style={{ display: "flex", gap: spasi.xs, flexWrap: "wrap" }}>
              <Chip terpilih>Sumur</Chip>
              <Chip>Jembatan</Chip>
              <Chip>Lainnya</Chip>
            </div>
          </Kartu>
          <Tombol lebarPenuh ikon={<Check size={sentuh.ikon} />}>
            Simpan titik
          </Tombol>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Titik baru" />
        <Kosong
          judul="Belum ada titik di proyek ini"
          keterangan="Titik pertama jadi acuan peta. Posisi diambil dari GPS, atau diketik kalau kamu sudah punya koordinatnya."
          ikon={<MapPin size={28} aria-hidden="true" />}
          aksi={<Tombol>Isi manual</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Titik baru" />
        <Memuat judul="Menunggu posisi terkunci" keterangan="Koordinat akan terisi sendiri setelah GPS mengunci. Akurasi terlihat selama menunggu." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Titik baru" />
        <Galat
          judul="Titik gagal disimpan"
          keterangan="Penyimpanan perangkat penuh, jadi titik ini belum tercatat. Jangan tutup layar sebelum tersimpan."
          rincian="titik: ENOSPC (butuh 48 KB)"
          aksi={<Tombol varian="sekunder">Kosongkan ruang</Tombol>}
        />
      </>
    ),
    offline: (
      <>
        <BilahAtas judul="Titik baru" keterangan="Sumur bor · blok C" penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>} />
        <Isi>
          <Offline
            judul="Titik disimpan lokal"
            keterangan="Titik masuk antrean kirim dan tetap tercatat. Jaringan tidak dibutuhkan untuk mencatat."
          />
          <Kartu judul="Posisi">
            <Bidang label="Lintang" nilai="-6,914352" mono />
            <Pemisah />
            <Bidang label="Bujur" nilai="107,609118" mono />
          </Kartu>
          <Tombol lebarPenuh ikon={<Check size={sentuh.ikon} />}>
            Simpan titik
          </Tombol>
        </Isi>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Titik baru" />
        <IzinDitolak
          judul="Izin lokasi ditolak"
          keterangan="Koordinat tidak bisa diambil otomatis. Kamu masih bisa mengetik koordinat manual di layar ini."
          aksi={<Tombol varian="sekunder">Isi manual</Tombol>}
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Titik baru">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiLampirkanFoto({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Foto titik" keterangan="Sumur bor 04 · 2 foto" />
        <Isi>
          <Kartu judul="Foto terlampir" keterangan="Tiap foto menyimpan arah kamera dan waktu pengambilan.">
            <div style={{ display: "flex", gap: spasi.sm }}>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    aspectRatio: "4 / 3",
                    borderRadius: radius.md,
                    background: p.petaLahan,
                    border: `1px solid ${p.garis}`,
                    display: "flex",
                    alignItems: "flex-end",
                    padding: spasi.xs,
                  }}
                >
                  <span style={gayaTeks("mikro", { warna: p.teks, mono: true })}>08:14:{12 + i * 9}</span>
                </div>
              ))}
            </div>
          </Kartu>
          <BarisDaftar
            judul="Foto 1"
            keterangan="Arah timur laut · 08:14:12"
            ujung={<LencanaStatus jenis="info">1,8 MB</LencanaStatus>}
          />
          <Tombol lebarPenuh varian="sekunder" ikon={<Camera size={sentuh.ikon} />}>
            Ambil foto lain
          </Tombol>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Foto titik" keterangan="Sumur bor 04" />
        <Kosong
          judul="Belum ada foto"
          keterangan="Foto membantu orang lain mengenali titik ini tanpa harus datang. Ambil dari kamera atau pilih dari galeri."
          ikon={<Camera size={28} aria-hidden="true" />}
          aksi={<Tombol>Ambil foto</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Foto titik" />
        <Memuat judul="Menyimpan foto" keterangan="Mengecilkan gambar dan menulis arah kamera ke berkas lampiran." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Foto titik" />
        <Galat
          judul="Kamera gagal dibuka"
          keterangan="Kamera sedang dipakai aplikasi lain. Kamu masih bisa memilih foto dari galeri."
          rincian="camera: device busy"
          aksi={<Tombol varian="sekunder">Pilih dari galeri</Tombol>}
        />
      </>
    ),
    offline: (
      <>
        <BilahAtas judul="Foto titik" keterangan="Sumur bor 04 · 2 foto" penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>} />
        <Isi>
          <Offline
            judul="Foto tersimpan di perangkat"
            keterangan="Foto tidak dikirim sekarang, tapi tercatat sebagai lampiran titik dan ikut terkirim nanti."
            aksi={<Tombol varian="sekunder">Lihat antrean</Tombol>}
          />
        </Isi>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Foto titik" />
        <IzinDitolak
          judul="Izin kamera ditolak"
          keterangan="Kamera tidak bisa dipakai untuk melampirkan foto. Pilih dari galeri masih bisa."
          aksi={<Tombol varian="sekunder">Pilih dari galeri</Tombol>}
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Lampirkan foto">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}
