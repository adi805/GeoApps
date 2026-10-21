/**
 * Komposisi jalur peta: memasukkan data, mengelola lapisan, membaca legenda.
 *
 * Bahasa visualnya mengikuti issue 102: bilah atas dengan penanda keadaan, label
 * seksi huruf besar, baris berikon dengan lencana di ujung, peta yang membawa
 * skala dan atribusi, dan satu aksi utama yang menempel di dasar layar.
 *
 * Tujuh komposisi di berkas ini sebelumnya memakai bahasa lama, dan selisihnya
 * kelihatan di tangkapan layar: tombol aksi mengapung di tengah isi lalu
 * menghilang saat digulir, peta digambar tanpa skala sehingga tidak bisa dipakai
 * mengukur, dan sepertiga sampai dua perlima bagian bawah layar dibiarkan
 * kosong. Ketiganya diperbaiki di sini tanpa mengubah ekspor atau kunci keadaan.
 *
 * Tiap komposisi menerima `keadaan`, jadi kelima keadaan layar digambar oleh
 * kode yang sama. Yang tidak dideklarasikan `inventaris.ts` memang tidak
 * digambar, dan alasannya tertulis di sana.
 */

import type { ReactNode } from "react";
import {
  Camera,
  Eye,
  FileDown,
  FileText,
  Hexagon,
  Images,
  Layers,
  Map as IkonMap,
  MapPin,
  Mountain,
  Plus,
  Route,
  Satellite,
  Search,
  Share2,
  SlidersHorizontal,
} from "lucide-react";
import {
  BarisDaftar,
  Bidang,
  BilahAtas,
  BilahBawah,
  BilahKemajuan,
  Chip,
  Daftar,
  Isi,
  Kartu,
  LencanaStatus,
  Pemisah,
  PetaLengkap,
  Tombol,
  TombolIkon,
  gayaLabel,
  gayaTeks,
  usePalet,
} from "../primitives";
import { Galat, IzinDitolak, Kosong, Memuat } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { radius, ruangAman, sentuh, spasi } from "../tokens";

/** Label seksi di atas kelompok baris, seperti "PETA TERAKHIR" di beranda. */
function LabelSeksi({ children }: { children: ReactNode }) {
  const p = usePalet();
  return (
    <div style={{ paddingInline: spasi.lg, paddingBlockStart: spasi.lg, paddingBlockEnd: spasi.sm }}>
      <span style={gayaLabel(p.teksLembut)}>{children}</span>
    </div>
  );
}

/**
 * Penanda posisi di atas kanvas peta: titik aksen dengan cincin permukaan.
 *
 * Peta tanpa titik "kamu di sini" tidak menjawab pertanyaan pertama yang
 * dibawa pengguna ke layar peta.
 */
function Penanda({ aksen, permukaan }: { aksen: string; permukaan: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        insetInlineStart: "46%",
        insetBlockStart: "40%",
        width: 18,
        height: 18,
        borderRadius: radius.penuh,
        background: aksen,
        border: `3px solid ${permukaan}`,
      }}
    />
  );
}

/** Lencana kecil yang menempel di sudut kanvas, mis. "Halaman 1 dari 4". */
function LencanaPeta({ children }: { children: ReactNode }) {
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
 * Pembungkus keadaan yang mengisi sisa layar.
 *
 * `Kosong`, `Memuat`, dan `Galat` tingginya mengikuti isinya, jadi tanpa
 * pembungkus ini keadaan galat berhenti di tengah layar dan sisanya kosong.
 */
function Penuh({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

/** Titik kontrol georeferensi GeoPDF, urut searah jarum jam dari barat laut. */
const TITIK_KONTROL = [
  { judul: "Titik 1", keterangan: "Sudut barat laut · sisa 1,2 m", lencana: "Cocok", jenis: "sukses" as const },
  { judul: "Titik 2", keterangan: "Sudut timur laut · sisa 2,1 m", lencana: "Cocok", jenis: "sukses" as const },
  { judul: "Titik 3", keterangan: "Sudut tenggara · sisa 1,9 m", lencana: "Cocok", jenis: "sukses" as const },
  { judul: "Titik 4", keterangan: "Sudut barat daya · sisa 2,0 m", lencana: "Periksa", jenis: "peringatan" as const },
];

export function KomposisiImporGeopdf({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Impor GeoPDF"
          keterangan="Peta_Desa_2024.pdf · 18,4 MB"
          penanda={<LencanaStatus jenis="info">4 halaman</LencanaStatus>}
        />
        <PetaLengkap tinggi={176}>
          <LencanaPeta>Halaman 1 dari 4</LencanaPeta>
          <Penanda aksen={p.aksen} permukaan={p.permukaan} />
        </PetaLengkap>
        <Isi>
          <div style={{ display: "flex", flexDirection: "column", gap: spasi.xs }}>
            <span style={gayaLabel(p.teksLembut)}>Halaman</span>
            <div style={{ display: "flex", gap: spasi.xs }}>
              {["1", "2", "3", "4"].map((nomor) => (
                <Chip key={nomor} terpilih={nomor === "1"}>
                  {nomor}
                </Chip>
              ))}
            </div>
          </div>
          <Kartu judul="Georeferensi" keterangan="Empat titik kontrol dicocokkan ke peta dasar.">
            <Bidang label="Sistem acuan" nilai="EPSG:32748" satuan="UTM 48S" mono />
            <Pemisah />
            <Bidang label="Titik kontrol" nilai="4 titik" satuan="sisa galat 1,8 m" />
            <BilahKemajuan nilai={92} label="Mutu georeferensi" />
          </Kartu>
          <Kartu judul="Titik kontrol">
            {TITIK_KONTROL.map((titik) => (
              <BarisDaftar
                key={titik.judul}
                judul={titik.judul}
                keterangan={titik.keterangan}
                ujung={<LencanaStatus jenis={titik.jenis}>{titik.lencana}</LencanaStatus>}
              />
            ))}
          </Kartu>
        </Isi>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<FileDown size={sentuh.ikon} />}>
            Tambahkan sebagai lapisan
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Impor GeoPDF" />
        <Penuh>
          <Kosong
            judul="Belum ada berkas dipilih"
            keterangan="GeoPDF menyimpan koordinat di dalam berkasnya, jadi peta langsung terpasang di posisi yang benar."
            ikon={<FileText size={28} aria-hidden="true" />}
            aksi={<Tombol>Pilih berkas PDF</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Impor GeoPDF" />
        <Penuh>
          <Memuat judul="Membaca berkas" keterangan="Menyusun ubin halaman 1 dan memeriksa titik kontrol." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Impor GeoPDF" />
        <Penuh>
          <Galat
            judul="Berkas tidak bisa dibaca"
            keterangan="Halaman ini tidak memuat informasi georeferensi, jadi posisinya tidak bisa ditentukan."
            rincian="geopdf: no /VP entry on page 1"
            aksi={<Tombol varian="sekunder">Pilih berkas lain</Tombol>}
          />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Impor GeoPDF" />
        <Penuh>
          <IzinDitolak
            judul="Akses penyimpanan ditolak"
            keterangan="Aplikasi butuh membaca berkas yang kamu pilih. Izin ini hanya dipakai saat impor."
            aksi={<Tombol varian="sekunder">Buka pengaturan</Tombol>}
          />
        </Penuh>
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
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Impor GeoTIFF"
          keterangan="kelerengan_48s.tif · 240 MB"
          penanda={<LencanaStatus jenis="info">Float32</LencanaStatus>}
        />
        <PetaLengkap tinggi={176} skala="1 km">
          <LencanaPeta>Resolusi 30 m</LencanaPeta>
        </PetaLengkap>
        <Isi>
          <Kartu judul="Pita dan tampilan" keterangan="Satu pita, tipe Float32, tanpa nilai alpha.">
            <Bidang label="Pita" nilai="Pita 1 — kelerengan" mono />
            <Pemisah />
            <div style={{ display: "flex", gap: spasi.xs, flexWrap: "wrap" }}>
              <Chip terpilih>Rampa warna</Chip>
              <Chip>Kontras</Chip>
              <Chip>Nilai tunggal</Chip>
            </div>
          </Kartu>
          <Kartu judul="Rentang nilai" keterangan="Rampa dipetakan dari nilai terendah ke tertinggi.">
            <div
              aria-hidden="true"
              style={{
                height: 12,
                borderRadius: radius.penuh,
                border: `1px solid ${p.garis}`,
                background: `linear-gradient(90deg, ${p.petaLahan}, ${p.petaJalan}, ${p.peringatan}, ${p.bahaya})`,
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={gayaTeks("mikro", { warna: p.teksLembut, mono: true })}>0 m</span>
              <span style={gayaTeks("mikro", { warna: p.teksLembut, mono: true })}>45 m</span>
            </div>
            <Pemisah />
            <Bidang label="Nilai kosong" nilai="-9999" satuan="dilewati" mono />
          </Kartu>
          <Kartu judul="Penyimpanan" keterangan="Ubin 256 px dibuat saat raster dipasang, bukan saat dibuka.">
            <BilahKemajuan nilai={30} label="Ruang penyimpanan terpakai" />
            <span style={gayaTeks("kecil", { warna: p.teksLembut })}>610 MB dari 2 GB</span>
          </Kartu>
        </Isi>
        <BilahBawah>
          <Tombol varian="sekunder" lebarPenuh>
            Periksa dulu
          </Tombol>
          <Tombol lebarPenuh ikon={<FileDown size={sentuh.ikon} />}>
            Tambahkan
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Impor GeoTIFF" />
        <Penuh>
          <Kosong
            judul="Belum ada raster"
            keterangan="Berkas GeoTIFF membawa posisi sendiri, jadi tidak perlu digeser manual."
            ikon={<Satellite size={28} aria-hidden="true" />}
            aksi={<Tombol>Pilih berkas GeoTIFF</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Impor GeoTIFF" />
        <Penuh>
          <Memuat judul="Menyiapkan ubin" keterangan="240 MB sedang dipecah jadi ubin 256 px." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Impor GeoTIFF" />
        <Penuh>
          <Galat
            judul="Ruang penyimpanan tidak cukup"
            keterangan="Ubin raster ini butuh 610 MB, sisa ruang 180 MB."
            rincian="butuh 610 MB · tersedia 180 MB"
            aksi={<Tombol varian="sekunder">Kosongkan ruang</Tombol>}
          />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Impor GeoTIFF" />
        <Penuh>
          <IzinDitolak
            judul="Akses berkas ditolak"
            keterangan="Raster dibaca langsung dari berkas yang kamu pilih, tidak disalin ke server."
          />
        </Penuh>
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
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Impor GeoJSON"
          keterangan="batas_desa.geojson · 214 fitur"
          penanda={<LencanaStatus jenis="info">WGS 84</LencanaStatus>}
        />
        <PetaLengkap tinggi={168} bidang={p.utama}>
          <LencanaPeta>214 fitur</LencanaPeta>
        </PetaLengkap>
        <Daftar>
          <LabelSeksi>Isi berkas</LabelSeksi>
          <BarisDaftar
            ikon={<Hexagon size={sentuh.ikon} />}
            judul="Poligon"
            keterangan="Batas bidang dan blok"
            ujung={<LencanaStatus jenis="info">188</LencanaStatus>}
          />
          <BarisDaftar
            ikon={<Route size={sentuh.ikon} />}
            judul="Garis"
            keterangan="Jalan dan sungai"
            ujung={<LencanaStatus jenis="info">21</LencanaStatus>}
          />
          <BarisDaftar
            ikon={<MapPin size={sentuh.ikon} />}
            judul="Titik"
            keterangan="Fasilitas dan patok"
            ujung={<LencanaStatus jenis="info">5</LencanaStatus>}
          />
          <LabelSeksi>Sistem acuan</LabelSeksi>
          <BarisDaftar
            ikon={<IkonMap size={sentuh.ikon} />}
            judul="EPSG:4326"
            keterangan="Tidak ada CRS di berkas, jadi dianggap WGS 84"
            ujung={<LencanaStatus jenis="peringatan">Diasumsikan</LencanaStatus>}
          />
          <LabelSeksi>Atribut terdeteksi</LabelSeksi>
          <BarisDaftar
            ikon={<FileText size={sentuh.ikon} />}
            judul="nama"
            keterangan="Teks · terisi di 214 fitur"
          />
          <BarisDaftar
            ikon={<FileText size={sentuh.ikon} />}
            judul="luas_ha"
            keterangan="Angka · kosong di 24 fitur"
            ujung={<LencanaStatus jenis="peringatan">24 kosong</LencanaStatus>}
          />
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh>Tambahkan 214 fitur</Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Impor GeoJSON" />
        <Penuh>
          <Kosong
            judul="Belum ada data"
            keterangan="Bisa dari berkas, tempelan teks, atau tautan. Tempelan teks berguna saat berkas tidak bisa dikirim."
            aksi={<Tombol>Pilih berkas</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Impor GeoJSON" />
        <Penuh>
          <Memuat judul="Memeriksa fitur" keterangan="Menghitung geometri dan mencocokkan sistem acuan." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Impor GeoJSON" />
        <Penuh>
          <Galat
            judul="GeoJSON tidak valid"
            keterangan="Fitur ke-12 tidak punya koordinat, jadi berkasnya belum bisa dipakai."
            rincian="features[11].geometry = null"
            aksi={<Tombol varian="sekunder">Perbaiki berkas</Tombol>}
          />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Impor GeoJSON" />
        <Penuh>
          <IzinDitolak judul="Akses berkas ditolak" keterangan="Impor butuh membaca satu berkas yang kamu pilih." />
        </Penuh>
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
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Galeri peta"
          keterangan="4 peta tersimpan · 612 MB"
          aksi={<TombolIkon label="Cari peta" ikon={<Search size={sentuh.ikon} />} />}
        />
        <Daftar>
          <LabelSeksi>Terakhir dibuka</LabelSeksi>
          <div
            style={{
              paddingInline: ruangAman.sisi,
              display: "flex",
              flexDirection: "column",
              gap: spasi.md,
            }}
          >
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
              <PetaLengkap tinggi={160} bidang={p.utama} />
            </Kartu>
            <Kartu
              judul="DAS Citarum Hulu"
              keterangan="6 lapisan · dibuka kemarin"
              kaki={
                <>
                  <Tombol varian="sekunder">Buka</Tombol>
                  <Tombol varian="halus">Rincian</Tombol>
                </>
              }
            >
              <PetaLengkap tinggi={160} />
            </Kartu>
          </div>
          <LabelSeksi>Peta lain</LabelSeksi>
          <BarisDaftar
            ikon={<IkonMap size={sentuh.ikon} />}
            judul="Blok C 2023"
            keterangan="4 lapisan · 3 minggu lalu"
            ujung={<LencanaStatus jenis="info">Lokal</LencanaStatus>}
          />
          <BarisDaftar
            ikon={<IkonMap size={sentuh.ikon} />}
            judul="Survei Agustus"
            keterangan="2 lapisan · 2 bulan lalu"
            ujung={<LencanaStatus jenis="peringatan">Ubin tertunda</LencanaStatus>}
          />
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Plus size={sentuh.ikon} />}>
            Buat peta baru
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Galeri peta" />
        <Penuh>
          <Kosong
            judul="Belum ada peta"
            keterangan="Peta yang kamu buat akan muncul di sini dan tetap bisa dibuka tanpa jaringan."
            ikon={<Images size={28} aria-hidden="true" />}
            aksi={<Tombol>Buat peta baru</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Galeri peta" />
        <Penuh>
          <Memuat judul="Memuat galeri" keterangan="Membaca daftar peta dan ukuran penyimpanannya." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Galeri peta" />
        <Penuh>
          <Galat
            judul="Sebagian peta tidak terbaca"
            keterangan="Dua berkas proyek rusak dan tidak bisa dibuka. Sisanya masih aman."
            rincian="peta-2024-03.glb: checksum mismatch"
            aksi={<Tombol varian="sekunder">Coba muat ulang</Tombol>}
          />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Galeri peta" />
        <Penuh>
          <IzinDitolak
            judul="Akses penyimpanan ditolak"
            keterangan="Galeri membaca berkas proyek di perangkat. Tanpa izin ini peta tersimpan tidak bisa dibuka."
          />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Galeri peta">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

/** Tumpukan lapisan, urut dari yang paling atas. Keterlihatan mengikuti data. */
const LAPISAN = [
  { judul: "Batas desa", keterangan: "Poligon · vektor", ikon: <Hexagon size={sentuh.ikon} />, terlihat: true, terpilih: true },
  { judul: "Jalan", keterangan: "Garis · vektor", ikon: <Route size={sentuh.ikon} />, terlihat: true, terpilih: false },
  { judul: "Kelerengan", keterangan: "Raster · 30 m", ikon: <Mountain size={sentuh.ikon} />, terlihat: false, terpilih: false },
  { judul: "Foto lapangan", keterangan: "Titik · 34 foto", ikon: <Camera size={sentuh.ikon} />, terlihat: true, terpilih: false },
  { judul: "Batas kecamatan", keterangan: "Poligon · vektor", ikon: <Layers size={sentuh.ikon} />, terlihat: false, terpilih: false },
];

export function KomposisiBukaTutupLapisan({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Lapisan"
          keterangan="3 dari 5 terlihat"
          aksi={<TombolIkon label="Urutkan lapisan" ikon={<Layers size={sentuh.ikon} />} />}
        />
        <PetaLengkap tinggi={180} bidang={p.utama}>
          <LencanaPeta>3 terlihat</LencanaPeta>
          <Penanda aksen={p.aksen} permukaan={p.permukaan} />
        </PetaLengkap>
        <Daftar>
          <LabelSeksi>Tumpukan · atas ke bawah</LabelSeksi>
          {LAPISAN.map((lapisan) => (
            <BarisDaftar
              key={lapisan.judul}
              ikon={lapisan.ikon}
              judul={lapisan.judul}
              keterangan={lapisan.keterangan}
              terpilih={lapisan.terpilih}
              ujung={
                <TombolIkon
                  label={`${lapisan.terlihat ? "Sembunyikan" : "Tampilkan"} ${lapisan.judul.toLowerCase()}`}
                  ikon={<Eye size={sentuh.ikon} />}
                  terpilih={lapisan.terlihat}
                />
              }
            />
          ))}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <Kartu
              judul="Urutan tumpukan"
              keterangan="Lapisan paling atas digambar paling akhir, jadi ia yang menutupi lapisan di bawahnya."
            />
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Plus size={sentuh.ikon} />}>
            Tambah lapisan
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Lapisan" />
        <Penuh>
          <Kosong
            judul="Belum ada lapisan"
            keterangan="Tambahkan data lewat impor, atau rekam titik di lapangan. Lapisan pertama jadi dasar peta."
            ikon={<Layers size={28} aria-hidden="true" />}
            aksi={<Tombol>Tambah lapisan</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Lapisan" />
        <Penuh>
          <Memuat judul="Menyiapkan lapisan" keterangan="Memuat geometri dan gaya yang tersimpan." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Lapisan" />
        <Penuh>
          <Galat
            judul="Lapisan gagal digambar"
            keterangan="Berkas vektor tidak bisa dibaca, jadi lapisan ini dilewati sementara."
            rincian="batas_desa.geojson: unexpected end of JSON"
            aksi={<Tombol varian="sekunder">Muat ulang lapisan</Tombol>}
          />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Lapisan" />
        <Penuh>
          <IzinDitolak
            judul="Akses penyimpanan ditolak"
            keterangan="Lapisan dibaca dari proyek di perangkat; tanpa izin ini tidak ada yang bisa digambar."
          />
        </Penuh>
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
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Gaya lapisan"
          keterangan="Batas desa · vektor"
          aksi={<TombolIkon label="Setel ulang gaya" ikon={<SlidersHorizontal size={sentuh.ikon} />} />}
        />
        <PetaLengkap tinggi={200} bidang={p.utama}>
          <LencanaPeta>Pratinjau langsung</LencanaPeta>
        </PetaLengkap>
        <Isi>
          <Kartu judul="Garis" keterangan="Berlaku untuk semua ruas batas lapisan ini.">
            <Bidang label="Warna">
              <span style={{ display: "flex", gap: spasi.xs, flexWrap: "wrap" }}>
                <Chip terpilih>Utama</Chip>
                <Chip>Aksen</Chip>
                <Chip>Bahaya</Chip>
              </span>
            </Bidang>
            <Pemisah />
            <Bidang label="Ketebalan" nilai="2" satuan="px" mono />
            <Pemisah />
            <Bidang label="Opasitas" nilai="80" satuan="%" mono />
            <BilahKemajuan nilai={80} label="Opasitas garis" />
          </Kartu>
          <Kartu judul="Label" keterangan="Nama bidang muncul di atas garis saat diperbesar.">
            <Bidang label="Ukuran huruf" nilai="12" satuan="px" mono />
            <Pemisah />
            <Bidang label="Posisi" nilai="Di tengah garis" />
          </Kartu>
        </Isi>
        <BilahBawah>
          <Tombol varian="sekunder" lebarPenuh>
            Batal
          </Tombol>
          <Tombol lebarPenuh>Simpan gaya</Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Gaya lapisan" />
        <Penuh>
          <Kosong
            judul="Belum ada lapisan dipilih"
            keterangan="Pilih lapisan dulu, lalu atur warna dan ketebalannya. Gaya tersimpan per lapisan."
            aksi={<Tombol>Pilih lapisan</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Gaya lapisan" />
        <Penuh>
          <Memuat judul="Membaca gaya" keterangan="Mengambil gaya tersimpan untuk lapisan ini." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Gaya lapisan" />
        <Penuh>
          <Galat
            judul="Gaya tersimpan rusak"
            keterangan="Nilai opasitas di luar rentang, jadi gaya ini tidak bisa dipakai apa adanya."
            rincian="opacity: 140 (harus 0–100)"
            aksi={<Tombol varian="sekunder">Setel ulang gaya</Tombol>}
          />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Gaya lapisan" />
        <Penuh>
          <IzinDitolak judul="Akses penyimpanan ditolak" keterangan="Gaya disimpan di berkas proyek di perangkat." />
        </Penuh>
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
  /** Kelas kelerengan beserta warna rampanya, urut dari datar ke curam. */
  const kelas = [
    { label: "0 – 8 %", keterangan: "Datar · jalan dan permukiman", bagian: "38%", warna: p.petaLahan },
    { label: "8 – 15 %", keterangan: "Landai · sawah dan kebun", bagian: "27%", warna: p.petaJalan },
    { label: "15 – 25 %", keterangan: "Miring · kebun campur", bagian: "19%", warna: p.peringatan },
    { label: "25 – 40 %", keterangan: "Curam · perlu teras", bagian: "11%", warna: p.bahaya },
    { label: "> 40 %", keterangan: "Sangat curam · rawan longsor", bagian: "5%", warna: p.teks },
  ];
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Legenda"
          keterangan="Mengikuti lapisan yang terlihat"
          penanda={<LencanaStatus jenis="info">2 lapisan</LencanaStatus>}
        />
        <Daftar>
          <LabelSeksi>Kelerengan · raster</LabelSeksi>
          {kelas.map((k) => (
            <BarisDaftar
              key={k.label}
              ikon={
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: radius.xs,
                    background: k.warna,
                    border: `1px solid ${p.garis}`,
                  }}
                />
              }
              judul={k.label}
              keterangan={k.keterangan}
              ujung={<LencanaStatus jenis="netral">{k.bagian}</LencanaStatus>}
            />
          ))}
          <LabelSeksi>Batas desa · vektor</LabelSeksi>
          <BarisDaftar
            ikon={<span style={{ width: 20, height: 3, borderRadius: radius.penuh, background: p.utama }} />}
            judul="Batas desa"
            keterangan="Garis 2 px, warna utama"
            ujung={<LencanaStatus jenis="info">Terlihat</LencanaStatus>}
          />
          <LabelSeksi>Foto lapangan · titik</LabelSeksi>
          <BarisDaftar
            ikon={<Camera size={sentuh.ikon} />}
            judul="Terverifikasi"
            keterangan="Sudah dicek di lapangan"
            ujung={<LencanaStatus jenis="sukses">34</LencanaStatus>}
          />
          <BarisDaftar
            ikon={<MapPin size={sentuh.ikon} />}
            judul="Perlu tinjau"
            keterangan="Ditandai saat survei"
            ujung={<LencanaStatus jenis="peringatan">6</LencanaStatus>}
          />
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh varian="sekunder" ikon={<Share2 size={sentuh.ikon} />}>
            Bagikan legenda
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Legenda" />
        <Penuh>
          <Kosong
            judul="Belum ada yang terlihat"
            keterangan="Legenda hanya menampilkan simbol lapisan yang sedang terlihat, jadi tidak ada yang bisa diringkas."
            aksi={<Tombol>Tampilkan lapisan</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Legenda" />
        <Penuh>
          <Memuat judul="Menyusun legenda" keterangan="Membaca simbol dari gaya lapisan yang aktif." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Legenda" />
        <Penuh>
          <Galat
            judul="Simbol tidak bisa dibaca"
            keterangan="Lapisan memakai gaya dari versi lama yang tidak dikenali."
            rincian="styleVersion: 0 (diharapkan 2)"
            aksi={<Tombol varian="sekunder">Atur ulang gaya</Tombol>}
          />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Legenda" />
        <Penuh>
          <IzinDitolak judul="Akses penyimpanan ditolak" keterangan="Legenda dibaca dari gaya lapisan di proyek perangkat." />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Legenda">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}
