/**
 * Komposisi jalur offline: mengunduh wilayah, mengelolanya, dan menandai
 * keadaan tanpa jaringan.
 *
 * Offline bukan mode darurat di aplikasi ini: pekerjaan lapangan justru sering
 * terjadi tanpa sinyal. Karena itu keadaan offline di sini tenang dan menyebut
 * apa yang masih jalan, bukan sekadar memberi tahu bahwa jaringan hilang.
 */

import { CloudOff, Download, HardDrive, Trash2 } from "lucide-react";
import {
  BarisDaftar,
  BilahAtas,
  BilahBawah,
  Bidang,
  Daftar,
  BilahKemajuan,
  Isi,
  Kartu,
  LencanaStatus,
  Pemisah,
  Peta,
  Tombol,
  gayaLabel,
  gayaTeks,
  usePalet,
} from "../primitives";
import { Galat, IzinDitolak, Kosong, Memuat, Offline, SpandukKeadaan } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { radius, sentuh, spasi } from "../tokens";

export function KomposisiUnduhRegion({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Unduh region" keterangan="Kotak 12,4 × 8,6 km" />
        <Peta tinggi={170}>
          <div
            style={{
              position: "absolute",
              insetBlockStart: "24%",
              insetInlineStart: "18%",
              insetBlockEnd: "22%",
              insetInlineEnd: "22%",
              border: `2px dashed ${p.aksen}`,
              background: `${p.aksen}1F`,
              borderRadius: radius.sm,
            }}
          />
        </Peta>
        <Isi>
          <Kartu judul="Perkiraan unduhan">
            <Bidang label="Ubin" nilai="1.284" satuan="z 12–16" mono />
            <Pemisah />
            <Bidang label="Ukuran" nilai="386" satuan="MB" mono />
            <Pemisah />
            <Bidang label="Ruang tersedia" nilai="2,1" satuan="GB" mono />
          </Kartu>
          <Tombol lebarPenuh ikon={<Download size={sentuh.ikon} />}>
            Mulai unduh
          </Tombol>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Unduh region" />
        <Kosong
          judul="Belum ada wilayah dipilih"
          keterangan="Geser dan perbesar peta, lalu gambar kotak wilayah yang mau dipakai tanpa jaringan."
          ikon={<Download size={28} aria-hidden="true" />}
          aksi={<Tombol>Gambar wilayah</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Unduh region" keterangan="612 dari 1.284 ubin" />
        <Isi>
          <Kartu judul="Mengunduh" keterangan="Unduhan berhenti sendiri kalau aplikasi ditutup, dan bisa dilanjutkan.">
            <BilahKemajuan nilai={48} />
            <span style={gayaTeks("kecil", { warna: p.teksLembut, mono: true })}>48% · sisa ± 3 menit</span>
          </Kartu>
          <SpandukKeadaan jenis="info">Kamu boleh menutup layar ini; unduhan lanjut di latar belakang.</SpandukKeadaan>
        </Isi>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Unduh region" />
        <Galat
          judul="Unduhan berhenti"
          keterangan="Penyedia ubin menolak sebagian permintaan. Wilayah yang sudah terunduh tetap bisa dipakai."
          rincian="HTTP 429 pada 74 ubin (z 16)"
          aksi={<Tombol varian="sekunder">Lanjutkan unduhan</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Unduh region" />
        <IzinDitolak
          judul="Akses penyimpanan ditolak"
          keterangan="Ubin peta disimpan di perangkat, jadi izin penyimpanan dibutuhkan sebelum mengunduh."
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Unduh region">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiDaftarRegion({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Region tersimpan" keterangan="3 region · 1,02 GB" />
        <Daftar>
          <BarisDaftar
            judul="Blok C — survei"
            keterangan="12,4 × 8,6 km · diunduh hari ini"
            ujung={<LencanaStatus jenis="sukses">386 MB</LencanaStatus>}
          />
          <BarisDaftar
            judul="Desa Sukamaju"
            keterangan="8,2 × 6,1 km · diunduh 3 hari lalu"
            ujung={<LencanaStatus jenis="info">402 MB</LencanaStatus>}
          />
          <BarisDaftar
            judul="Koridor jalan"
            keterangan="24,6 × 1,2 km · diunduh 2 minggu lalu"
            ujung={<LencanaStatus jenis="info">232 MB</LencanaStatus>}
          />
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Download size={sentuh.ikon} />}>
            Unduh region
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Region tersimpan" />
        <Kosong
          judul="Belum ada region"
          keterangan="Region yang diunduh muncul di sini dan bisa dipakai saat tidak ada sinyal."
          ikon={<HardDrive size={28} aria-hidden="true" />}
          aksi={<Tombol>Unduh region</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Region tersimpan" />
        <Memuat judul="Membaca daftar region" keterangan="Menghitung ukuran tiap region dari berkas ubin di perangkat." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Region tersimpan" />
        <Galat
          judul="Satu region tidak lengkap"
          keterangan="Sebagian ubin hilang, jadi region ini akan berlubang saat dibuka offline."
          rincian="sukamaju: 38 dari 1.024 ubin hilang"
          aksi={<Tombol varian="sekunder">Unduh ulang</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Region tersimpan" />
        <IzinDitolak judul="Akses penyimpanan ditolak" keterangan="Daftar region dibaca dari penyimpanan aplikasi di perangkat." />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Daftar region">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiHapusRegion({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Hapus region" keterangan="Blok C — survei" />
        <Isi>
          <Kartu judul="Yang akan dihapus" keterangan="Ubin peta saja. Titik dan jejak yang kamu rekam tidak ikut terhapus.">
            <Bidang label="Ukuran" nilai="386" satuan="MB" mono />
            <Pemisah />
            <Bidang label="Ubin" nilai="1.284" mono />
            <Pemisah />
            <Bidang label="Diunduh" nilai="Hari ini 07:42" />
          </Kartu>
          <SpandukKeadaan jenis="bahaya">Penghapusan tidak bisa dibatalkan. Region bisa diunduh lagi kalau ada jaringan.</SpandukKeadaan>
          <Tombol lebarPenuh varian="bahaya" ikon={<Trash2 size={sentuh.ikon} />}>
            Hapus region
          </Tombol>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Hapus region" />
        <Kosong
          judul="Belum ada region"
          keterangan="Tidak ada yang bisa dihapus karena belum ada region terunduh."
          ikon={<Trash2 size={28} aria-hidden="true" />}
          aksi={<Tombol varian="sekunder">Unduh region</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Hapus region" />
        <Memuat judul="Menghapus ubin" keterangan="Membebaskan ruang penyimpanan; jangan tutup aplikasi sampai selesai." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Hapus region" />
        <Galat
          judul="Sebagian ubin tidak terhapus"
          keterangan="Berkas sedang dipakai proses lain, jadi ruang baru sebagian yang dibebaskan."
          rincian="712 ubin terhapus · 572 gagal (EBUSY)"
          aksi={<Tombol varian="sekunder">Coba lagi</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Hapus region" />
        <IzinDitolak judul="Akses penyimpanan ditolak" keterangan="Menghapus ubin butuh izin tulis ke penyimpanan aplikasi." />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Hapus region">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiStatusPenyimpanan({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Penyimpanan" keterangan="1,7 GB dari 4,2 GB terpakai" />
        <Isi>
          <Kartu>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={gayaLabel(p.teksLembut)}>Terpakai</span>
              <span style={gayaTeks("badanBesar", { bobot: "tebal", warna: p.teks, mono: true })}>41%</span>
            </div>
            <BilahKemajuan nilai={41} />
          </Kartu>
          <Kartu judul="Rincian">
            <BarisDaftar judul="Ubin peta" keterangan="3 region" ujung={<span style={gayaTeks("badan", { mono: true, warna: p.teks })}>1,02 GB</span>} />
            <BarisDaftar judul="Foto lapangan" keterangan="214 foto" ujung={<span style={gayaTeks("badan", { mono: true, warna: p.teks })}>612 MB</span>} />
            <BarisDaftar judul="Jejak dan titik" keterangan="48 rekaman" ujung={<span style={gayaTeks("badan", { mono: true, warna: p.teks })}>74 MB</span>} />
            <BarisDaftar judul="Cadangan lokal" keterangan="2 berkas" ujung={<span style={gayaTeks("badan", { mono: true, warna: p.teks })}>38 MB</span>} />
          </Kartu>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Penyimpanan" />
        <Kosong
          judul="Belum ada data tersimpan"
          keterangan="Angka pemakaian muncul setelah ada region, foto, atau rekaman yang disimpan."
          ikon={<HardDrive size={28} aria-hidden="true" />}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Penyimpanan" />
        <Memuat judul="Menghitung pemakaian" keterangan="Menjumlahkan ukuran berkas per jenis isi." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Penyimpanan" />
        <Galat
          judul="Sebagian ukuran tidak terbaca"
          keterangan="Direktori foto tidak bisa dibaca, jadi totalnya lebih kecil dari sebenarnya."
          rincian="foto/: EACCES"
          aksi={<Tombol varian="sekunder">Coba lagi</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Penyimpanan" />
        <IzinDitolak judul="Akses penyimpanan ditolak" keterangan="Status penyimpanan dihitung dari berkas aplikasi di perangkat." />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Status penyimpanan">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiIndikatorOffline({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Indikator offline" keterangan="Contoh penempatan di bilah atas" />
        <Isi>
          <SpandukKeadaan
            jenis="offline"
            aksi={<Tombol varian="halus">Antrean</Tombol>}
          >
            Offline · 12 perubahan menunggu dikirim
          </SpandukKeadaan>
          <Kartu judul="Apa yang tetap jalan" keterangan="Indikator ini menyebut jumlah, bukan hanya ikon, supaya kamu tahu ada pekerjaan tertunda.">
            <BarisDaftar judul="Rekam jejak" ujung={<LencanaStatus jenis="sukses">Jalan</LencanaStatus>} />
            <BarisDaftar judul="Catat titik" ujung={<LencanaStatus jenis="sukses">Jalan</LencanaStatus>} />
            <BarisDaftar judul="Unduh region baru" ujung={<LencanaStatus jenis="peringatan">Tertunda</LencanaStatus>} />
            <BarisDaftar judul="Sinkron ke server" ujung={<LencanaStatus jenis="peringatan">Tertunda</LencanaStatus>} />
          </Kartu>
          <Kartu judul="Antrean kirim">
            <Bidang label="Titik baru" nilai="8" mono />
            <Pemisah />
            <Bidang label="Foto" nilai="4" satuan="1,2 MB" mono />
          </Kartu>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Indikator offline" keterangan="Contoh penempatan di bilah atas" />
        <Kosong
          judul="Tidak ada perubahan tertunda"
          keterangan="Indikator tidak ditampilkan saat semua sudah terkirim, supaya bilah atas tidak penuh tanpa alasan."
          ikon={<CloudOff size={28} aria-hidden="true" />}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Indikator offline" />
        <Memuat judul="Memeriksa antrean" keterangan="Menghitung perubahan yang belum terkirim." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Indikator offline" />
        <Galat
          judul="Antrean tidak terbaca"
          keterangan="Berkas antrean rusak, jadi jumlah perubahan tertunda tidak bisa dipastikan."
          rincian="antrean.json: unexpected token"
          aksi={<Tombol varian="sekunder">Bangun ulang antrean</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Indikator offline" />
        <IzinDitolak judul="Akses penyimpanan ditolak" keterangan="Antrean kirim disimpan di perangkat dan butuh izin baca." />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Indikator offline">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}
