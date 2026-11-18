/**
 * Komposisi jalur offline: mengunduh wilayah, mengelolanya, dan menandai
 * keadaan tanpa jaringan.
 *
 * Offline bukan mode darurat di aplikasi ini: pekerjaan lapangan justru sering
 * terjadi tanpa sinyal. Karena itu keadaan offline di sini tenang dan menyebut
 * apa yang masih jalan, bukan sekadar memberi tahu bahwa jaringan hilang.
 *
 * Bahasa visualnya mengikuti issue 102 dan rujukan `screens/peta.tsx`: bilah atas
 * berpenanda keadaan, peta berskala dan berlabel, label seksi di atas kelompok
 * baris, baris berikon dengan nilai di ujung, dan aksi utama yang menempel di
 * dasar layar. Sebelumnya kotak unduhan digambar di `<Peta>` tanpa skala, daftar
 * region hanya tiga baris tanpa judul kelompok, dan tombol hapus mengambang di
 * ujung isi yang bisa digulir.
 */

import {
  CloudOff,
  CloudUpload,
  Download,
  HardDrive,
  Images,
  Layers,
  MapPin,
  MapPinned,
  Route,
  Satellite,
  Trash2,
} from "lucide-react";
import {
  BarisDaftar,
  Bidang,
  BilahAtas,
  BilahBawah,
  BilahKemajuan,
  Daftar,
  Isi,
  Kartu,
  LabelSeksi,
  LencanaStatus,
  Pemisah,
  PetaLengkap,
  Tombol,
  gayaTeks,
  usePalet,
} from "../primitives";
import { SpandukKeadaan } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { keadaanLain } from "./offline-keadaan";
import { radius, sentuh } from "../tokens";

/** Nilai di ujung baris: mono, supaya kolom angka lurus ke bawah. */
function Nilai({ children }: { children: string }) {
  const p = usePalet();
  return <span style={gayaTeks("badan", { mono: true, warna: p.teks })}>{children}</span>;
}

export function KomposisiUnduhRegion({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Unduh region"
          keterangan="Kotak 12,4 × 8,6 km"
          penanda={<LencanaStatus jenis="peringatan">Belum diunduh</LencanaStatus>}
        />
        <PetaLengkap tinggi={170} skala="2 km">
          <div
            aria-hidden="true"
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
        </PetaLengkap>
        <Isi>
          <Kartu
            judul="Perkiraan unduhan"
            keterangan="Dihitung dari jumlah ubin tiap tingkat zoom, sebelum unduhan dimulai."
          >
            <Bidang label="Ubin" nilai="1.284" satuan="z 12–16" mono />
            <Pemisah />
            <Bidang label="Ukuran" nilai="386" satuan="MB" mono />
            <Pemisah />
            <Bidang label="Ruang tersedia" nilai="2,1" satuan="GB" mono />
            <BilahKemajuan nilai={18} label="Bagian ruang penyimpanan yang akan terpakai" />
          </Kartu>
          <Kartu judul="Isi region" keterangan="Hanya yang wajib ikut terunduh; sisanya pilihan.">
            <BarisDaftar
              ikon={<Layers size={sentuh.ikon} />}
              judul="Ubin peta"
              keterangan="z 12–16 · 1.284 ubin"
              ujung={<LencanaStatus jenis="netral">Wajib</LencanaStatus>}
            />
            <BarisDaftar
              ikon={<MapPinned size={sentuh.ikon} />}
              judul="Label tempat"
              keterangan="Nama jalan dan tempat"
              ujung={<LencanaStatus jenis="netral">Wajib</LencanaStatus>}
            />
            <BarisDaftar
              ikon={<Satellite size={sentuh.ikon} />}
              judul="Citra satelit"
              keterangan="Menambah 240 MB"
              ujung={<LencanaStatus jenis="info">Pilihan</LencanaStatus>}
            />
          </Kartu>
        </Isi>
        <BilahBawah>
          <Tombol varian="sekunder" lebarPenuh>
            Ubah kotak
          </Tombol>
          <Tombol lebarPenuh ikon={<Download size={sentuh.ikon} />}>
            Mulai unduh
          </Tombol>
        </BilahBawah>
      </>
    ),
    ...keadaanLain("Unduh region", {
      kosong: {
        judul: "Belum ada wilayah dipilih",
        keterangan:
          "Geser dan perbesar peta, lalu gambar kotak wilayah yang mau dipakai tanpa jaringan.",
        ikon: <Download size={28} aria-hidden="true" />,
        aksi: <Tombol>Gambar wilayah</Tombol>,
      },
      memuat: {
        judul: "Mengunduh ubin",
        keterangan:
          "Unduhan lanjut di latar belakang kalau layar ini ditutup; sisa waktunya kira-kira 3 menit.",
        atas: "612 dari 1.284 ubin",
      },
      offline: {
        judul: "Unduhan butuh jaringan",
        keterangan:
          "Ubin peta diambil dari penyedia ubin, jadi unduhan baru menunggu sampai sinyal kembali. Region yang sudah terunduh tetap bisa dibuka.",
        aksi: <Tombol varian="sekunder">Lihat region tersimpan</Tombol>,
      },
      galat: {
        judul: "Unduhan berhenti",
        keterangan:
          "Penyedia ubin menolak sebagian permintaan. Wilayah yang sudah terunduh tetap bisa dipakai.",
        rincian: "HTTP 429 pada 74 ubin (z 16)",
        aksi: <Tombol varian="sekunder">Lanjutkan unduhan</Tombol>,
      },
      izin: {
        judul: "Akses penyimpanan ditolak",
        keterangan:
          "Ubin peta disimpan di perangkat, jadi izin penyimpanan dibutuhkan sebelum mengunduh.",
      },
    }),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Unduh region">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiDaftarRegion({ keadaan = "utama", ...varian }: Varian) {
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Region tersimpan"
          keterangan="3 region · 1,02 GB"
          penanda={<LencanaStatus jenis="sukses">Siap offline</LencanaStatus>}
        />
        <Daftar>
          <LabelSeksi>Siap dipakai</LabelSeksi>
          <BarisDaftar
            ikon={<Layers size={sentuh.ikon} />}
            judul="Blok C — survei"
            keterangan="12,4 × 8,6 km · diunduh hari ini 07:42"
            ujung={<Nilai>386 MB</Nilai>}
          />
          <BarisDaftar
            ikon={<Layers size={sentuh.ikon} />}
            judul="Desa Sukamaju"
            keterangan="8,2 × 6,1 km · diunduh 3 hari lalu"
            ujung={<Nilai>402 MB</Nilai>}
          />
          <LabelSeksi>Perlu diunduh ulang</LabelSeksi>
          <BarisDaftar
            ikon={<Layers size={sentuh.ikon} />}
            judul="Koridor jalan"
            keterangan="38 ubin hilang · diunduh 2 minggu lalu"
            ujung={<LencanaStatus jenis="peringatan">Berlubang</LencanaStatus>}
          />
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Download size={sentuh.ikon} />}>
            Unduh region
          </Tombol>
        </BilahBawah>
      </>
    ),
    ...keadaanLain("Region tersimpan", {
      kosong: {
        judul: "Belum ada region",
        keterangan: "Region yang diunduh muncul di sini dan bisa dipakai saat tidak ada sinyal.",
        ikon: <HardDrive size={28} aria-hidden="true" />,
        aksi: <Tombol>Unduh region</Tombol>,
      },
      memuat: {
        judul: "Membaca daftar region",
        keterangan: "Menghitung ukuran tiap region dari berkas ubin di perangkat.",
      },
      galat: {
        judul: "Satu region tidak lengkap",
        keterangan: "Sebagian ubin hilang, jadi region ini akan berlubang saat dibuka offline.",
        rincian: "sukamaju: 38 dari 1.024 ubin hilang",
        aksi: <Tombol varian="sekunder">Unduh ulang</Tombol>,
      },
      izin: {
        judul: "Akses penyimpanan ditolak",
        keterangan: "Daftar region dibaca dari penyimpanan aplikasi di perangkat.",
      },
    }),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Daftar region">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiHapusRegion({ keadaan = "utama", ...varian }: Varian) {
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Hapus region"
          keterangan="Blok C — survei"
          penanda={<LencanaStatus jenis="bahaya">Tidak bisa dibatalkan</LencanaStatus>}
        />
        <Isi>
          <Kartu
            judul="Yang akan dihapus"
            keterangan="Ubin peta saja. Titik dan jejak yang kamu rekam tidak ikut terhapus."
          >
            <Bidang label="Ukuran" nilai="386" satuan="MB" mono />
            <Pemisah />
            <Bidang label="Ubin" nilai="1.284" mono />
            <Pemisah />
            <Bidang label="Diunduh" nilai="Hari ini 07:42" />
          </Kartu>
          <Kartu judul="Yang tetap ada" keterangan="Penghapusan hanya menyentuh salinan ubin di perangkat.">
            <BarisDaftar
              ikon={<Route size={sentuh.ikon} />}
              judul="Jejak dan titik"
              keterangan="48 rekaman di proyek ini"
              ujung={<LencanaStatus jenis="sukses">Tetap</LencanaStatus>}
            />
            <BarisDaftar
              ikon={<Images size={sentuh.ikon} />}
              judul="Foto lapangan"
              keterangan="214 foto"
              ujung={<LencanaStatus jenis="sukses">Tetap</LencanaStatus>}
            />
          </Kartu>
          <SpandukKeadaan jenis="bahaya">
            Ruang 386 MB dibebaskan. Region bisa diunduh lagi kapan saja kalau ada jaringan.
          </SpandukKeadaan>
        </Isi>
        <BilahBawah>
          <Tombol varian="sekunder" lebarPenuh>
            Batal
          </Tombol>
          <Tombol varian="bahaya" lebarPenuh ikon={<Trash2 size={sentuh.ikon} />}>
            Hapus region
          </Tombol>
        </BilahBawah>
      </>
    ),
    ...keadaanLain("Hapus region", {
      kosong: {
        judul: "Belum ada region",
        keterangan: "Tidak ada yang bisa dihapus karena belum ada region terunduh.",
        ikon: <Trash2 size={28} aria-hidden="true" />,
        aksi: <Tombol varian="sekunder">Unduh region</Tombol>,
      },
      memuat: {
        judul: "Menghapus ubin",
        keterangan: "Membebaskan ruang penyimpanan; jangan tutup aplikasi sampai selesai.",
      },
      galat: {
        judul: "Sebagian ubin tidak terhapus",
        keterangan: "Berkas sedang dipakai proses lain, jadi ruang baru sebagian yang dibebaskan.",
        rincian: "712 ubin terhapus · 572 gagal (EBUSY)",
        aksi: <Tombol varian="sekunder">Coba lagi</Tombol>,
      },
      izin: {
        judul: "Akses penyimpanan ditolak",
        keterangan: "Menghapus ubin butuh izin tulis ke penyimpanan aplikasi.",
      },
    }),
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
        <BilahAtas
          judul="Penyimpanan"
          keterangan="1,7 GB dari 4,2 GB terpakai"
          penanda={<LencanaStatus jenis="netral">41%</LencanaStatus>}
        />
        <Isi>
          <Kartu
            judul="Pemakaian"
            keterangan="Dihitung dari berkas lokal, jadi angkanya tetap sama tanpa jaringan."
          >
            <BilahKemajuan nilai={41} label="Ruang penyimpanan terpakai" />
            <span style={gayaTeks("kecil", { warna: p.teksLembut })}>
              2,5 GB masih kosong · unduhan region berikutnya muat
            </span>
          </Kartu>
          <Kartu judul="Rincian" keterangan="Per jenis isi, supaya jelas apa yang layak dihapus.">
            <BarisDaftar
              ikon={<Layers size={sentuh.ikon} />}
              judul="Ubin peta"
              keterangan="3 region"
              ujung={<Nilai>1,02 GB</Nilai>}
            />
            <BarisDaftar
              ikon={<Images size={sentuh.ikon} />}
              judul="Foto lapangan"
              keterangan="214 foto"
              ujung={<Nilai>612 MB</Nilai>}
            />
            <BarisDaftar
              ikon={<Route size={sentuh.ikon} />}
              judul="Jejak dan titik"
              keterangan="48 rekaman"
              ujung={<Nilai>74 MB</Nilai>}
            />
            <BarisDaftar
              ikon={<HardDrive size={sentuh.ikon} />}
              judul="Cadangan lokal"
              keterangan="2 berkas"
              ujung={<Nilai>38 MB</Nilai>}
            />
          </Kartu>
        </Isi>
        <BilahBawah>
          <Tombol varian="sekunder" lebarPenuh ikon={<HardDrive size={sentuh.ikon} />}>
            Kelola region
          </Tombol>
        </BilahBawah>
      </>
    ),
    ...keadaanLain("Penyimpanan", {
      kosong: {
        judul: "Belum ada data tersimpan",
        keterangan: "Angka pemakaian muncul setelah ada region, foto, atau rekaman yang disimpan.",
        ikon: <HardDrive size={28} aria-hidden="true" />,
      },
      memuat: {
        judul: "Menghitung pemakaian",
        keterangan: "Menjumlahkan ukuran berkas per jenis isi.",
      },
      galat: {
        judul: "Sebagian ukuran tidak terbaca",
        keterangan: "Direktori foto tidak bisa dibaca, jadi totalnya lebih kecil dari sebenarnya.",
        rincian: "foto/: EACCES",
        aksi: <Tombol varian="sekunder">Coba lagi</Tombol>,
      },
      izin: {
        judul: "Akses penyimpanan ditolak",
        keterangan: "Status penyimpanan dihitung dari berkas aplikasi di perangkat.",
      },
    }),
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
        <BilahAtas
          judul="Indikator offline"
          keterangan="Contoh penempatan di bilah atas"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        <Isi>
          <SpandukKeadaan jenis="offline" aksi={<Tombol varian="halus">Antrean</Tombol>}>
            Offline · 12 perubahan menunggu dikirim
          </SpandukKeadaan>
          <Kartu
            judul="Apa yang tetap jalan"
            keterangan="Indikator menyebut jumlah, bukan hanya ikon, supaya kamu tahu ada pekerjaan tertunda."
          >
            <BarisDaftar
              ikon={<Route size={sentuh.ikon} />}
              judul="Rekam jejak"
              keterangan="Tersimpan di perangkat"
              ujung={<LencanaStatus jenis="sukses">Jalan</LencanaStatus>}
            />
            <BarisDaftar
              ikon={<MapPin size={sentuh.ikon} />}
              judul="Catat titik"
              keterangan="Tersimpan di perangkat"
              ujung={<LencanaStatus jenis="sukses">Jalan</LencanaStatus>}
            />
            <BarisDaftar
              ikon={<Download size={sentuh.ikon} />}
              judul="Unduh region baru"
              keterangan="Butuh jaringan"
              ujung={<LencanaStatus jenis="peringatan">Tertunda</LencanaStatus>}
            />
            <BarisDaftar
              ikon={<CloudUpload size={sentuh.ikon} />}
              judul="Sinkron ke server"
              keterangan="Dikirim saat sinyal kembali"
              ujung={<LencanaStatus jenis="peringatan">Tertunda</LencanaStatus>}
            />
          </Kartu>
          <Kartu judul="Antrean kirim" keterangan="Antrean bertahan walau aplikasi ditutup.">
            <Bidang label="Titik baru" nilai="8" mono />
            <Pemisah />
            <Bidang label="Foto" nilai="4" satuan="1,2 MB" mono />
            <span style={gayaTeks("mikro", { warna: p.teksLembut })}>
              dikirim berurutan · tidak ada yang hilang kalau baterai habis
            </span>
          </Kartu>
        </Isi>
        <BilahBawah>
          <Tombol varian="sekunder" lebarPenuh ikon={<CloudOff size={sentuh.ikon} />}>
            Lihat antrean
          </Tombol>
        </BilahBawah>
      </>
    ),
    ...keadaanLain("Indikator offline", {
      kosong: {
        judul: "Tidak ada perubahan tertunda",
        keterangan:
          "Indikator tidak ditampilkan saat semua sudah terkirim, supaya bilah atas tidak penuh tanpa alasan.",
        ikon: <CloudOff size={28} aria-hidden="true" />,
        atas: "Contoh penempatan di bilah atas",
      },
      memuat: {
        judul: "Memeriksa antrean",
        keterangan: "Menghitung perubahan yang belum terkirim.",
      },
      offline: {
        judul: "Sedang offline",
        keterangan:
          "Indikator ini hidup justru saat tidak ada jaringan: 12 perubahan tertunda tetap tercatat di perangkat dan dikirim saat sinyal kembali.",
        aksi: <Tombol varian="sekunder">Lihat antrean</Tombol>,
      },
      galat: {
        judul: "Antrean tidak terbaca",
        keterangan: "Berkas antrean rusak, jadi jumlah perubahan tertunda tidak bisa dipastikan.",
        rincian: "antrean.json: unexpected token",
        aksi: <Tombol varian="sekunder">Bangun ulang antrean</Tombol>,
      },
      izin: {
        judul: "Akses penyimpanan ditolak",
        keterangan: "Antrean kirim disimpan di perangkat dan butuh izin baca.",
      },
    }),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Indikator offline">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

