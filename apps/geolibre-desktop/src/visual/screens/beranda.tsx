/**
 * Komposisi beranda dan chrome shell.
 *
 * Sampai issue 102 bahasa visual ini punya 31 komposisi untuk fungsi lapangan
 * dan nol untuk layar yang pertama dilihat pengguna. Akibatnya #68 dan #69 bisa
 * "selesai" tanpa satu pun perubahan bentuk yang kelihatan: yang dinilai hanya
 * layar yang memang sudah digambar.
 *
 * `KomposisiBeranda` menggambar tempat pengguna mendarat: daftar peta terakhir,
 * keadaan kosong yang menawarkan langkah pertama, dan tab bawah Peta Saya/Layer.
 * `KomposisiChrome` menggambar bagian yang menetap di semua layar peta: bilah
 * atas, tab bawah, dan bilah sesi lapangan yang aktif.
 *
 * Keduanya komposisi, bukan implementasi. Pemasangan ke shell aplikasi milik
 * lane `ui` (issue 103); berkas ini tidak menyentuh `App.tsx` atau `components/**`.
 */

import {
  Check,
  Layers,
  Map as IkonMap,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Timer,
} from "lucide-react";
import {
  BarisDaftar,
  BilahAtas,
  BilahBawah,
  BilahKemajuan,
  BilahTab,
  Daftar,
  Kartu,
  LencanaStatus,
  PetaLengkap,
  Tombol,
  TombolIkon,
  gayaLabel,
  gayaTeks,
  usePalet,
} from "../primitives";
import { Galat, Kosong, Memuat, SpandukKeadaan } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { elevasi, radius, ruangAman, sentuh, spasi } from "../tokens";

/** Dua tujuan utama. Beranda tidak punya tab ketiga: menu bukan tempat berpindah. */
const TAB = [
  { id: "peta" as const, label: "Peta Saya", ikon: <IkonMap size={sentuh.ikon} aria-hidden="true" /> },
  { id: "layer" as const, label: "Layer", ikon: <Layers size={sentuh.ikon} aria-hidden="true" /> },
];

/** Peta yang terakhir dibuka, urut dari yang paling baru. */
const PETA_TERAKHIR = [
  { nama: "Kebun Blok C", meta: "12 lapisan · 2 jam lalu", status: "Lokal", jenis: "info" as const },
  { nama: "Survei 12 Oktober", meta: "6 lapisan · kemarin", status: "Lokal", jenis: "info" as const },
  { nama: "DAS Ciliwung Hulu", meta: "9 lapisan · 3 hari lalu", status: "Ubin tertunda", jenis: "peringatan" as const },
];

/**
 * Bilah sesi lapangan: satu-satunya bagian chrome yang berubah karena ada
 * pekerjaan yang sedang berjalan. Ia duduk tepat di atas tab bawah supaya
 * tombol jeda dan selesai tetap terjangkau ibu jari.
 */
function BilahSesi({
  nada,
  judul,
  keterangan,
  aksi,
}: {
  nada: "aktif" | "tertahan";
  judul: string;
  keterangan: string;
  aksi: React.ReactNode;
}) {
  const p = usePalet();
  const warna = nada === "aktif" ? p.bahaya : p.peringatan;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spasi.sm,
        paddingInline: ruangAman.sisi,
        paddingBlock: spasi.sm,
        background: p.permukaan,
        borderBlockStart: `1px solid ${p.garis}`,
        boxShadow: elevasi.sedang,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spasi.sm }}>
        <span
          aria-hidden="true"
          style={{ width: 10, height: 10, borderRadius: radius.penuh, background: warna, flexShrink: 0 }}
        />
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ ...gayaTeks("badan", { bobot: "tebal", warna: p.teks }) }}>{judul}</span>
          <span style={{ ...gayaTeks("kecil", { warna: p.teksLembut, mono: nada === "aktif" }) }}>{keterangan}</span>
        </span>
      </div>
      {/* Aksi di baris sendiri: di 360 px, teks durasi dan dua tombol dalam satu
          baris saling menghimpit sampai durasinya pecah tiga baris. */}
      <div style={{ display: "flex", gap: spasi.sm }}>{aksi}</div>
    </div>
  );
}

/**
 * Ringkasan penyimpanan di bawah daftar peta.
 *
 * Tiga baris peta menyisakan setengah layar kosong, dan layar yang separuh
 * kosong terbaca seperti daftar yang belum selesai dimuat. Blok ini mengisi
 * ruang itu dengan angka yang memang dipakai pengguna untuk memutuskan peta
 * mana yang perlu dihapus.
 */
function KartuPenyimpanan() {
  const p = usePalet();
  return (
    <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
      <Kartu judul="Ruang penyimpanan" keterangan="1,7 GB terpakai dari 4,2 GB">
        <BilahKemajuan nilai={40} label="Ruang penyimpanan terpakai" />
        <span style={{ ...gayaTeks("kecil", { warna: p.teksLembut }) }}>
          Ubin offline 1,2 GB · proyek 0,5 GB
        </span>
      </Kartu>
    </div>
  );
}

/**
 * Pembungkus keadaan yang mengisi sisa layar.
 *
 * `Kosong`, `Memuat`, dan `Galat` tingginya mengikuti isinya, jadi tanpa
 * pembungkus ini bilah tab berhenti di tengah layar dan sisa bawahnya kosong.
 * Tab bawah harus menempel di dasar layar di keadaan apa pun.
 */
function Penuh({ children }: { children: React.ReactNode }) {
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

/** Jejak yang sudah direkam, digambar di atas kanvas peta. */
function Jejak({ warna }: { warna: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 360 260"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <polyline
        points="70,214 96,188 128,196 150,164 186,158 208,126 238,132 262,102"
        fill="none"
        stroke={warna}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="70" cy="214" r="5" fill={warna} />
    </svg>
  );
}

/** Penanda posisi sekarang: titik aksen dengan cincin permukaan. */
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
        boxShadow: elevasi.sedang,
      }}
    />
  );
}

export function KomposisiBeranda({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Peta Saya"
          keterangan="3 peta · 1,7 GB dari 4,2 GB"
          kembali={false}
          aksi={<TombolIkon label="Cari peta" ikon={<Search size={sentuh.ikon} />} />}
        />
        <Daftar
          kepala={
            <div style={{ paddingInline: spasi.lg, paddingBlockStart: spasi.md }}>
              <span style={gayaLabel(p.teksLembut)}>Peta terakhir</span>
            </div>
          }
        >
          {PETA_TERAKHIR.map((peta) => (
            <BarisDaftar
              key={peta.nama}
              ikon={<IkonMap size={sentuh.ikon} />}
              judul={peta.nama}
              keterangan={peta.meta}
              ujung={<LencanaStatus jenis={peta.jenis}>{peta.status}</LencanaStatus>}
            />
          ))}
          <KartuPenyimpanan />
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Plus size={sentuh.ikon} />}>
            Tambah Peta
          </Tombol>
        </BilahBawah>
        <BilahTab tab={TAB} aktif="peta" label="Navigasi utama" />
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Peta Saya" kembali={false} />
        <Penuh>
          <Kosong
            judul="Belum ada peta"
            keterangan="Peta yang kamu tambahkan akan muncul di sini dan tetap terbuka tanpa jaringan."
            ikon={<IkonMap size={28} aria-hidden="true" />}
            aksi={
              <Tombol ikon={<Plus size={sentuh.ikon} />} onClick={() => undefined}>
                Tambah Peta
              </Tombol>
            }
          />
        </Penuh>
        <BilahTab tab={TAB} aktif="peta" label="Navigasi utama" />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Peta Saya" kembali={false} />
        <Penuh>
          <Memuat
            judul="Membaca peta tersimpan"
            keterangan="Menghitung luas dan ukuran penyimpanan tiap peta sebelum daftarnya ditampilkan."
          />
        </Penuh>
        <BilahTab tab={TAB} aktif="peta" label="Navigasi utama" />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Peta Saya" kembali={false} />
        <Penuh>
          <Galat
            judul="Daftar peta tidak terbaca"
            keterangan="Indeks peta rusak, jadi peta tersimpan belum bisa ditampilkan. Berkas petanya sendiri tidak hilang."
            rincian="indeks-peta.json: unexpected token < at position 0"
            aksi={
              <Tombol varian="sekunder" ikon={<RefreshCw size={sentuh.ikon} />}>
                Coba lagi
              </Tombol>
            }
          />
        </Penuh>
        <BilahTab tab={TAB} aktif="peta" label="Navigasi utama" />
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Peta Saya"
          keterangan="3 peta · 1,7 GB dari 4,2 GB"
          kembali={false}
          aksi={<TombolIkon label="Cari peta" ikon={<Search size={sentuh.ikon} />} />}
        />
        <Daftar
          kepala={
            <div style={{ paddingInline: spasi.lg, paddingBlock: spasi.md }}>
              <SpandukKeadaan jenis="offline">
                Jaringan mati. Tiga peta tersimpan tetap bisa dibuka dan diedit.
              </SpandukKeadaan>
            </div>
          }
        >
          {PETA_TERAKHIR.map((peta) => (
            <BarisDaftar
              key={peta.nama}
              ikon={<IkonMap size={sentuh.ikon} />}
              judul={peta.nama}
              keterangan={peta.meta}
              ujung={<LencanaStatus jenis="info">Siap offline</LencanaStatus>}
            />
          ))}
          <KartuPenyimpanan />
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Plus size={sentuh.ikon} />}>
            Tambah Peta
          </Tombol>
        </BilahBawah>
        <BilahTab tab={TAB} aktif="peta" label="Navigasi utama" />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Beranda Peta Saya">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiChrome({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Kebun Blok C"
          keterangan="Batas blok · Ortofoto 2024"
          kembali={false}
          penanda={<LencanaStatus jenis="sukses">Lokal</LencanaStatus>}
          aksi={<TombolIkon label="Cari di peta" ikon={<Search size={sentuh.ikon} />} />}
        />
        <PetaLengkap bidang={p.utama}>
          <Jejak warna={p.bahaya} />
          <Penanda aksen={p.aksen} permukaan={p.permukaan} />
        </PetaLengkap>
        <BilahSesi
          nada="aktif"
          judul="Merekam jejak"
          keterangan="00:12:41 · 1,24 km · 14 titik"
          aksi={
            <>
              <Tombol varian="sekunder" lebarPenuh ikon={<Timer size={sentuh.ikon} />}>
                Jeda
              </Tombol>
              <Tombol varian="bahaya" lebarPenuh ikon={<Check size={sentuh.ikon} />}>
                Selesai
              </Tombol>
            </>
          }
        />
        <BilahTab tab={TAB} aktif="peta" label="Navigasi utama" />
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Kebun Blok C"
          keterangan="Batas blok · Ortofoto 2024"
          kembali={false}
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
          aksi={<TombolIkon label="Cari di peta" ikon={<Search size={sentuh.ikon} />} />}
        />
        <PetaLengkap bidang={p.utama}>
          <Jejak warna={p.bahaya} />
          <Penanda aksen={p.aksen} permukaan={p.permukaan} />
        </PetaLengkap>
        <BilahSesi
          nada="aktif"
          judul="Merekam jejak"
          keterangan="00:12:41 · 1,24 km · tersimpan di perangkat"
          aksi={
            <Tombol varian="sekunder" lebarPenuh ikon={<Timer size={sentuh.ikon} />}>
              Jeda
            </Tombol>
          }
        />
        <BilahTab tab={TAB} aktif="peta" label="Navigasi utama" />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas
          judul="Kebun Blok C"
          keterangan="Batas blok · Ortofoto 2024"
          kembali={false}
          penanda={<LencanaStatus jenis="bahaya">Lokasi nonaktif</LencanaStatus>}
        />
        <PetaLengkap bidang={p.utama} />
        <BilahSesi
          nada="tertahan"
          judul="Perekaman tertahan"
          keterangan="Izin lokasi ditolak · tidak ada titik baru"
          aksi={
            <Tombol varian="sekunder" lebarPenuh ikon={<MapPin size={sentuh.ikon} />}>
              Buka izin
            </Tombol>
          }
        />
        <BilahTab tab={TAB} aktif="peta" label="Navigasi utama" />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Chrome peta dan sesi lapangan">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}
