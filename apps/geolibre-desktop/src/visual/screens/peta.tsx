/**
 * Komposisi jalur peta: memasukkan data, mengelola lapisan, membaca legenda.
 *
 * Tiap komposisi menerima `keadaan`, jadi kelima keadaan layar digambar oleh
 * kode yang sama. Yang tidak dideklarasikan `inventaris.ts` memang tidak
 * digambar, dan alasannya tertulis di sana.
 */

import {
  Eye,
  FileDown,
  FileText,
  Images,
  Layers,
  Map as IkonMap,
  Satellite,
  SlidersHorizontal,
} from "lucide-react";
import {
  BarisDaftar,
  BilahAtas,
  Bidang,
  BilahKemajuan,
  Chip,
  Daftar,
  Isi,
  Kartu,
  LencanaStatus,
  Pemisah,
  Peta,
  Tombol,
  TombolIkon,
  gayaLabel,
  gayaTeks,
  usePalet,
} from "../primitives";
import { Galat, IzinDitolak, Kosong, Memuat, Offline } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { radius, sentuh, spasi } from "../tokens";

export function KomposisiImporGeopdf({ keadaan = "utama", ...varian }: Varian) {
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Impor GeoPDF" keterangan="Peta_Desa_2024.pdf · 18,4 MB" />
        <Isi>
          <Kartu judul="Halaman 1 dari 4" keterangan="Pilih halaman yang memuat peta, bukan halaman sampul.">
            <Peta tinggi={148} />
          </Kartu>
          <Kartu judul="Georeferensi">
            <Bidang label="Sistem acuan" nilai="EPSG:32748" satuan="UTM 48S" mono />
            <Pemisah />
            <Bidang label="Titik kontrol" nilai="4 titik" satuan="sisa galat 1,8 m" />
            <BilahKemajuan nilai={92} />
          </Kartu>
          <Tombol lebarPenuh ikon={<FileDown size={sentuh.ikon} />}>
            Tambahkan sebagai lapisan
          </Tombol>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Impor GeoPDF" />
        <Kosong
          judul="Belum ada berkas dipilih"
          keterangan="GeoPDF menyimpan koordinat di dalam berkasnya, jadi peta langsung terpasang di posisi yang benar."
          ikon={<FileText size={28} aria-hidden="true" />}
          aksi={<Tombol>Pilih berkas PDF</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Impor GeoPDF" />
        <Memuat judul="Membaca berkas" keterangan="Menyusun ubin halaman 1 dan memeriksa titik kontrol." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Impor GeoPDF" />
        <Galat
          judul="Berkas tidak bisa dibaca"
          keterangan="Halaman ini tidak memuat informasi georeferensi, jadi posisinya tidak bisa ditentukan."
          rincian="geopdf: no /VP entry on page 1"
          aksi={<Tombol varian="sekunder">Pilih berkas lain</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Impor GeoPDF" />
        <IzinDitolak
          judul="Akses penyimpanan ditolak"
          keterangan="Aplikasi butuh membaca berkas yang kamu pilih. Izin ini hanya dipakai saat impor."
          aksi={<Tombol varian="sekunder">Buka pengaturan</Tombol>}
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Impor GeoPDF">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiImporGeotiff({ keadaan = "utama", ...varian }: Varian) {
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Impor GeoTIFF" keterangan="kelerengan_48s.tif · 240 MB" />
        <Isi>
          <Kartu judul="Raster" keterangan="Resolusi 30 m, 1 pita, tipe Float32.">
            <Peta tinggi={140} />
          </Kartu>
          <Kartu judul="Tampilan">
            <Bidang label="Pita" nilai="Pita 1 — kelerengan" mono />
            <Pemisah />
            <div style={{ display: "flex", gap: spasi.xs, flexWrap: "wrap" }}>
              <Chip terpilih>Rampa warna</Chip>
              <Chip>Kontras</Chip>
              <Chip>Nilai tunggal</Chip>
            </div>
          </Kartu>
          <Tombol lebarPenuh varian="sekunder">
            Periksa sebelum dipasang
          </Tombol>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Impor GeoTIFF" />
        <Kosong
          judul="Belum ada raster"
          keterangan="Berkas GeoTIFF membawa posisi sendiri, jadi tidak perlu digeser manual."
          ikon={<Satellite size={28} aria-hidden="true" />}
          aksi={<Tombol>Pilih berkas GeoTIFF</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Impor GeoTIFF" />
        <Memuat judul="Menyiapkan ubin" keterangan="240 MB sedang dipecah jadi ubin 256 px." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Impor GeoTIFF" />
        <Galat
          judul="Ruang penyimpanan tidak cukup"
          keterangan="Ubin raster ini butuh 610 MB, sisa ruang 180 MB."
          rincian="butuh 610 MB · tersedia 180 MB"
          aksi={<Tombol varian="sekunder">Kosongkan ruang</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Impor GeoTIFF" />
        <IzinDitolak
          judul="Akses berkas ditolak"
          keterangan="Raster dibaca langsung dari berkas yang kamu pilih, tidak disalin ke server."
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Impor GeoTIFF">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiImporGeojson({ keadaan = "utama", ...varian }: Varian) {
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Impor GeoJSON" keterangan="batas_desa.geojson · 214 fitur" />
        <Isi>
          <Kartu judul="Isi berkas">
            <BarisDaftar judul="Poligon" keterangan="Batas bidang" ujung={<LencanaStatus jenis="info">188</LencanaStatus>} />
            <BarisDaftar judul="Garis" keterangan="Jalan dan sungai" ujung={<LencanaStatus jenis="info">21</LencanaStatus>} />
            <BarisDaftar judul="Titik" keterangan="Fasilitas" ujung={<LencanaStatus jenis="info">5</LencanaStatus>} />
          </Kartu>
          <Kartu judul="Sistem acuan" keterangan="Tidak ada CRS di berkas, jadi dianggap WGS 84.">
            <Bidang label="CRS terdeteksi" nilai="EPSG:4326" mono />
          </Kartu>
          <Tombol lebarPenuh>Tambahkan 214 fitur</Tombol>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Impor GeoJSON" />
        <Kosong
          judul="Belum ada data"
          keterangan="Bisa dari berkas, tempelan teks, atau tautan. Tempelan teks berguna saat berkas tidak bisa dikirim."
          aksi={<Tombol>Pilih berkas</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Impor GeoJSON" />
        <Memuat judul="Memeriksa fitur" keterangan="Menghitung geometri dan mencocokkan sistem acuan." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Impor GeoJSON" />
        <Galat
          judul="GeoJSON tidak valid"
          keterangan="Fitur ke-12 tidak punya koordinat, jadi berkasnya belum bisa dipakai."
          rincian="features[11].geometry = null"
          aksi={<Tombol varian="sekunder">Perbaiki berkas</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Impor GeoJSON" />
        <IzinDitolak judul="Akses berkas ditolak" keterangan="Impor butuh membaca satu berkas yang kamu pilih." />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Impor GeoJSON">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiGaleriPeta({ keadaan = "utama", ...varian }: Varian) {
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Galeri peta" keterangan="4 peta tersimpan · 612 MB" />
        <Isi>
          <Kartu
            judul="Peta Desa Sukamaju"
            keterangan="12 lapisan · dibuka 2 jam lalu"
            kaki={
              <>
                <Tombol varian="sekunder" ikon={<IkonMap size={sentuh.ikon} />}>
                  Buka
                </Tombol>
                <Tombol varian="halus">Rincian</Tombol>
              </>
            }
          >
            <Peta tinggi={96} />
          </Kartu>
          <Kartu
            judul="DAS Citarum Hulu"
            keterangan="6 lapisan · dibuka kemarin"
            kaki={<Tombol varian="sekunder">Buka</Tombol>}
          >
            <Peta tinggi={96} />
          </Kartu>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Galeri peta" />
        <Kosong
          judul="Belum ada peta"
          keterangan="Peta yang kamu buat akan muncul di sini dan tetap bisa dibuka tanpa jaringan."
          ikon={<Images size={28} aria-hidden="true" />}
          aksi={<Tombol>Buat peta baru</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Galeri peta" />
        <Memuat judul="Memuat galeri" keterangan="Membaca daftar peta dan ukuran penyimpanannya." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Galeri peta" />
        <Galat
          judul="Sebagian peta tidak terbaca"
          keterangan="Dua berkas proyek rusak dan tidak bisa dibuka. Sisanya masih aman."
          rincian="peta-2024-03.glb: checksum mismatch"
          aksi={<Tombol varian="sekunder">Coba muat ulang</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Galeri peta" />
        <IzinDitolak
          judul="Akses penyimpanan ditolak"
          keterangan="Galeri membaca berkas proyek di perangkat. Tanpa izin ini peta tersimpan tidak bisa dibuka."
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Galeri peta">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiBukaTutupLapisan({ keadaan = "utama", ...varian }: Varian) {
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Lapisan"
          keterangan="3 dari 5 terlihat"
          aksi={<TombolIkon label="Urutkan lapisan" ikon={<Layers size={sentuh.ikon} />} />}
        />
        <Peta tinggi={168}>
          <div
            style={{
              position: "absolute",
              insetInlineStart: spasi.md,
              insetBlockEnd: spasi.md,
              display: "flex",
              gap: spasi.xs,
            }}
          >
            <LencanaStatus jenis="info">3 terlihat</LencanaStatus>
          </div>
        </Peta>
        <Daftar>
          <BarisDaftar judul="Batas desa" keterangan="Poligon · vektor" terpilih ujung={<TombolIkon label="Sembunyikan batas desa" ikon={<Eye size={sentuh.ikon} />} terpilih />} />
          <BarisDaftar judul="Jalan" keterangan="Garis · vektor" ujung={<TombolIkon label="Sembunyikan jalan" ikon={<Eye size={sentuh.ikon} />} terpilih />} />
          <BarisDaftar judul="Kelerengan" keterangan="Raster · 30 m" ujung={<TombolIkon label="Tampilkan kelerengan" ikon={<Eye size={sentuh.ikon} />} />} />
          <BarisDaftar judul="Foto lapangan" keterangan="Titik · 34 foto" ujung={<TombolIkon label="Sembunyikan foto lapangan" ikon={<Eye size={sentuh.ikon} />} terpilih />} />
          <BarisDaftar judul="Batas kecamatan" keterangan="Poligon · vektor" ujung={<TombolIkon label="Tampilkan batas kecamatan" ikon={<Eye size={sentuh.ikon} />} />} />
        </Daftar>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Lapisan" />
        <Kosong
          judul="Belum ada lapisan"
          keterangan="Tambahkan data lewat impor, atau rekam titik di lapangan. Lapisan pertama jadi dasar peta."
          ikon={<Layers size={28} aria-hidden="true" />}
          aksi={<Tombol>Tambah lapisan</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Lapisan" />
        <Memuat judul="Menyiapkan lapisan" keterangan="Memuat geometri dan gaya yang tersimpan." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Lapisan" />
        <Galat
          judul="Lapisan gagal digambar"
          keterangan="Berkas vektor tidak bisa dibaca, jadi lapisan ini dilewati sementara."
          rincian="batas_desa.geojson: unexpected end of JSON"
          aksi={<Tombol varian="sekunder">Muat ulang lapisan</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Lapisan" />
        <IzinDitolak
          judul="Akses penyimpanan ditolak"
          keterangan="Lapisan dibaca dari proyek di perangkat; tanpa izin ini tidak ada yang bisa digambar."
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Buka tutup lapisan">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiAturGayaLapisan({ keadaan = "utama", ...varian }: Varian) {
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Gaya lapisan"
          keterangan="Batas desa"
          aksi={<TombolIkon label="Setel ulang gaya" ikon={<SlidersHorizontal size={sentuh.ikon} />} />}
        />
        <Peta tinggi={150} />
        <Isi>
          <Kartu judul="Garis">
            <Bidang label="Warna" nilai="Utama" children={<span style={{ display: "flex", gap: spasi.xs }}><Chip terpilih>Utama</Chip><Chip>Aksen</Chip><Chip>Bahaya</Chip></span>} />
            <Pemisah />
            <Bidang label="Ketebalan" nilai="2" satuan="px" mono />
            <Pemisah />
            <Bidang label="Opasitas" nilai="80" satuan="%" mono />
          </Kartu>
          <Tombol lebarPenuh>Simpan gaya</Tombol>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Gaya lapisan" />
        <Kosong
          judul="Belum ada lapisan dipilih"
          keterangan="Pilih lapisan dulu, lalu atur warna dan ketebalannya. Gaya tersimpan per lapisan."
          aksi={<Tombol>Pilih lapisan</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Gaya lapisan" />
        <Memuat judul="Membaca gaya" keterangan="Mengambil gaya tersimpan untuk lapisan ini." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Gaya lapisan" />
        <Galat
          judul="Gaya tersimpan rusak"
          keterangan="Nilai opasitas di luar rentang, jadi gaya ini tidak bisa dipakai apa adanya."
          rincian="opacity: 140 (harus 0–100)"
          aksi={<Tombol varian="sekunder">Setel ulang gaya</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Gaya lapisan" />
        <IzinDitolak judul="Akses penyimpanan ditolak" keterangan="Gaya disimpan di berkas proyek di perangkat." />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Atur gaya lapisan">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiLegenda({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Legenda" keterangan="Mengikuti lapisan yang terlihat" />
        <Isi>
          <Kartu judul="Kelerengan">
            <div style={{ display: "flex", flexDirection: "column", gap: spasi.sm }}>
              {[
                ["0 – 8 %", p.petaLahan],
                ["8 – 15 %", p.petaJalan],
                ["15 – 25 %", p.peringatan],
                ["25 – 40 %", p.bahaya],
                ["> 40 %", p.teks],
              ].map(([label, warna]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: spasi.sm }}>
                  <span
                    style={{
                      width: 28,
                      height: 14,
                      borderRadius: radius.xs,
                      background: warna,
                      border: `1px solid ${p.garis}`,
                    }}
                  />
                  <span style={gayaTeks("kecil", { warna: p.teks })}>{label}</span>
                </div>
              ))}
            </div>
          </Kartu>
          <Kartu judul="Batas desa" keterangan="Garis tebal, warna utama.">
            <span style={{ ...gayaLabel(p.teksLembut) }}>1 lapisan vektor</span>
          </Kartu>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Legenda" />
        <Kosong
          judul="Belum ada yang terlihat"
          keterangan="Legenda hanya menampilkan simbol lapisan yang sedang terlihat, jadi tidak ada yang bisa diringkas."
          aksi={<Tombol>Tampilkan lapisan</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Legenda" />
        <Memuat judul="Menyusun legenda" keterangan="Membaca simbol dari gaya lapisan yang aktif." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Legenda" />
        <Galat
          judul="Simbol tidak bisa dibaca"
          keterangan="Lapisan memakai gaya dari versi lama yang tidak dikenali."
          rincian="styleVersion: 0 (diharapkan 2)"
          aksi={<Tombol varian="sekunder">Atur ulang gaya</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Legenda" />
        <IzinDitolak judul="Akses penyimpanan ditolak" keterangan="Legenda dibaca dari gaya lapisan di proyek perangkat." />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Legenda">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}
