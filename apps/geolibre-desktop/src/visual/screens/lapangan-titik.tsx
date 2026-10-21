/**
 * Komposisi jalur lapangan: titik baru dan foto lampirannya.
 *
 * Pencatatan titik adalah inti kerja lapangan, jadi koordinat, akurasi, dan
 * sumbernya selalu terlihat. Titik yang tidak yakin asalnya lebih berbahaya
 * daripada tidak ada titik.
 *
 * Bahasa visualnya mengikuti issue 102 dan rujukan `screens/peta.tsx`: peta
 * membawa skala dan atribusi, posisi dibaca sebagai baris berikon dengan nilai
 * mono di ujung, dan aksi simpan menempel di dasar layar. Sebelumnya peta tidak
 * punya skala, tombol simpan mengapung di tengah isi, dan keadaan kosong
 * berhenti di tengah layar.
 */

import type { ReactNode } from "react";
import { Camera, Check, Clock, Compass, Crosshair, MapPin, Satellite } from "lucide-react";
import {
  BarisDaftar,
  BilahAtas,
  BilahBawah,
  Chip,
  Daftar,
  LabelSeksi,
  LencanaStatus,
  Penuh,
  PetaLengkap,
  Tombol,
  gayaTeks,
  usePalet,
} from "../primitives";
import { Galat, IzinDitolak, Kosong, Memuat, SpandukKeadaan } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { radius, ruangAman, sentuh, spasi } from "../tokens";

/** Penanda posisi titik baru di atas kanvas: cincin aksen berlubang permukaan. */
function PenandaTitik({ aksen, permukaan }: { aksen: string; permukaan: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        insetInlineStart: "48%",
        insetBlockStart: "44%",
        width: 20,
        height: 20,
        borderRadius: radius.penuh,
        background: aksen,
        border: `3px solid ${permukaan}`,
      }}
    />
  );
}

/** Lencana kecil di sudut kanvas, mis. sumber posisi. */
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

/** Nilai koordinat di ujung baris: mono, karena dibaca digit per digit. */
function Koordinat({ children, warna }: { children: string; warna: string }) {
  return <span style={gayaTeks("badan", { mono: true, bobot: "tebal", warna })}>{children}</span>;
}

/** Kisi chip jenis titik; satu terpilih, sisanya pilihan lain. */
function PilihJenis({ terpilih }: { terpilih: string }) {
  const jenis = ["Sumur", "Jembatan", "Bangunan", "Lainnya"];
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: spasi.sm,
        paddingInline: ruangAman.sisi,
        paddingBlock: spasi.md,
      }}
    >
      {jenis.map((j) => (
        <Chip key={j} terpilih={j === terpilih}>
          {j}
        </Chip>
      ))}
    </div>
  );
}

export function KomposisiTitikBaru({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  /** Baris posisi dipakai keadaan utama dan offline: koordinatnya sama. */
  const posisi = (
    <>
      <LabelSeksi>Posisi</LabelSeksi>
      <BarisDaftar
        ikon={<Crosshair size={sentuh.ikon} />}
        judul="Lintang"
        keterangan="Derajat desimal, enam angka di belakang koma"
        ujung={<Koordinat warna={p.teks}>-6,914352</Koordinat>}
      />
      <BarisDaftar
        ikon={<Crosshair size={sentuh.ikon} />}
        judul="Bujur"
        keterangan="Derajat desimal, enam angka di belakang koma"
        ujung={<Koordinat warna={p.teks}>107,609118</Koordinat>}
      />
      <BarisDaftar
        ikon={<Satellite size={sentuh.ikon} />}
        judul="Sumber"
        keterangan="GPS perangkat, bukan layanan daring"
        ujung={<LencanaStatus jenis="sukses">± 3,2 m</LencanaStatus>}
      />
    </>
  );
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Titik baru"
          keterangan="Sumur bor · blok C"
          penanda={<LencanaStatus jenis="sukses">± 3,2 m</LencanaStatus>}
        />
        <PetaLengkap skala="50 m">
          <LencanaPeta>GPS perangkat</LencanaPeta>
          <PenandaTitik aksen={p.aksen} permukaan={p.permukaan} />
        </PetaLengkap>
        <Daftar rapat>
          {posisi}
          <LabelSeksi>Keterangan</LabelSeksi>
          <BarisDaftar
            ikon={<MapPin size={sentuh.ikon} />}
            judul="Nama titik"
            keterangan="Tampil di peta dan ikut terekspor"
            ujung={<LencanaStatus jenis="info">Sumur bor 04</LencanaStatus>}
          />
          <PilihJenis terpilih="Sumur" />
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Check size={sentuh.ikon} />}>
            Simpan titik
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Titik baru" />
        <Penuh>
          <Kosong
            judul="Belum ada titik di proyek ini"
            keterangan="Titik pertama jadi acuan peta. Posisi diambil dari GPS, atau diketik kalau kamu sudah punya koordinatnya."
            ikon={<MapPin size={28} aria-hidden="true" />}
            aksi={<Tombol>Isi manual</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Titik baru" />
        <Penuh>
          <Memuat
            judul="Menunggu posisi terkunci"
            keterangan="Koordinat akan terisi sendiri setelah GPS mengunci. Akurasi terlihat selama menunggu."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Titik baru" />
        <Penuh>
          <Galat
            judul="Titik gagal disimpan"
            keterangan="Penyimpanan perangkat penuh, jadi titik ini belum tercatat. Jangan tutup layar sebelum tersimpan."
            rincian="titik: ENOSPC (butuh 48 KB)"
            aksi={<Tombol varian="sekunder">Kosongkan ruang</Tombol>}
          />
        </Penuh>
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Titik baru"
          keterangan="Sumur bor · blok C"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        <PetaLengkap skala="50 m">
          <LencanaPeta>Tersimpan lokal</LencanaPeta>
          <PenandaTitik aksen={p.aksen} permukaan={p.permukaan} />
        </PetaLengkap>
        <Daftar rapat>
          {posisi}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="offline">
              Titik masuk antrean kirim dan tetap tercatat. Mencatat titik tidak butuh jaringan.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Check size={sentuh.ikon} />}>
            Simpan titik
          </Tombol>
        </BilahBawah>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Titik baru" />
        <Penuh>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Koordinat tidak bisa diambil otomatis. Kamu masih bisa mengetik koordinat manual di layar ini."
            aksi={<Tombol varian="sekunder">Isi manual</Tombol>}
          />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Titik baru">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

/**
 * Kotak foto contoh: langit dari `petaAir`, tanah dari `petaLahan`, cap waktu di
 * sudut. Foto asli tidak ada di galeri ini, dan kotak abu-abu kosong membuat
 * layar terbaca seperti belum jadi.
 */
function FotoContoh({ waktu }: { waktu: string }) {
  const p = usePalet();
  return (
    <div
      style={{
        flex: 1,
        position: "relative",
        aspectRatio: "4 / 3",
        borderRadius: radius.md,
        overflow: "hidden",
        border: `1px solid ${p.garis}`,
        background: p.petaAir,
      }}
    >
      <span
        aria-hidden="true"
        style={{ position: "absolute", insetInline: 0, insetBlockEnd: 0, height: "42%", background: p.petaLahan }}
      />
      <span
        style={{
          position: "absolute",
          insetBlockEnd: spasi.xs,
          insetInlineStart: spasi.xs,
          paddingInline: spasi.xs,
          borderRadius: radius.xs,
          background: p.permukaan,
          ...gayaTeks("mikro", { mono: true, bobot: "tebal", warna: p.teks }),
        }}
      >
        {waktu}
      </span>
    </div>
  );
}

export function KomposisiLampirkanFoto({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  /** Dua foto contoh yang sama dipakai keadaan utama dan offline. */
  const lampiran = (
    <>
      <LabelSeksi>Lampiran</LabelSeksi>
      <div style={{ display: "flex", gap: spasi.sm, paddingInline: ruangAman.sisi, paddingBlock: spasi.md }}>
        <FotoContoh waktu="08:14:12" />
        <FotoContoh waktu="08:14:21" />
      </div>
      <BarisDaftar
        ikon={<Camera size={sentuh.ikon} />}
        judul="Foto 1"
        keterangan="Arah timur laut · 08:14:12"
        ujung={<LencanaStatus jenis="info">1,8 MB</LencanaStatus>}
      />
      <BarisDaftar
        ikon={<Camera size={sentuh.ikon} />}
        judul="Foto 2"
        keterangan="Arah timur laut · 08:14:21"
        ujung={<LencanaStatus jenis="info">2,1 MB</LencanaStatus>}
      />
    </>
  );
  const metadata = (
    <>
      <LabelSeksi>Metadata tersimpan</LabelSeksi>
      <BarisDaftar
        ikon={<Compass size={sentuh.ikon} />}
        judul="Arah kamera"
        keterangan="Dari sensor perangkat, bukan diketik"
        ujung={<span style={gayaTeks("badan", { mono: true, bobot: "tebal", warna: p.teks })}>62° TL</span>}
      />
      <BarisDaftar
        ikon={<Clock size={sentuh.ikon} />}
        judul="Waktu ambil"
        keterangan="Zona waktu perangkat"
        ujung={<span style={gayaTeks("badan", { mono: true, bobot: "tebal", warna: p.teks })}>08:14:12</span>}
      />
      <BarisDaftar
        ikon={<Crosshair size={sentuh.ikon} />}
        judul="Titik acuan"
        keterangan="Foto diikat ke titik ini, bukan ke posisi sekarang"
        ujung={<LencanaStatus jenis="sukses">± 3,2 m</LencanaStatus>}
      />
    </>
  );
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Foto titik" keterangan="Sumur bor 04 · 2 foto" />
        <Daftar>
          {lampiran}
          {metadata}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="info">
              Foto disimpan pada resolusi asli. Yang dikirim ke server versi kecilnya, dan berkas asli tetap
              di perangkat sampai titik ini diekspor.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Camera size={sentuh.ikon} />}>
            Ambil foto
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Foto titik" keterangan="Sumur bor 04" />
        <Penuh>
          <Kosong
            judul="Belum ada foto"
            keterangan="Foto membantu orang lain mengenali titik ini tanpa harus datang. Ambil dari kamera atau pilih dari galeri."
            ikon={<Camera size={28} aria-hidden="true" />}
            aksi={<Tombol>Ambil foto</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Foto titik" />
        <Penuh>
          <Memuat
            judul="Menyimpan foto"
            keterangan="Mengecilkan gambar dan menulis arah kamera ke berkas lampiran."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Foto titik" />
        <Penuh>
          <Galat
            judul="Kamera gagal dibuka"
            keterangan="Kamera sedang dipakai aplikasi lain. Kamu masih bisa memilih foto dari galeri."
            rincian="camera: device busy"
            aksi={<Tombol varian="sekunder">Pilih dari galeri</Tombol>}
          />
        </Penuh>
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Foto titik"
          keterangan="Sumur bor 04 · 2 foto"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        <Daftar>
          {lampiran}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="offline">
              Foto disimpan di perangkat lebih dulu dan ikut terkirim bersama titiknya saat jaringan kembali.
            </SpandukKeadaan>
          </div>
          {metadata}
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Camera size={sentuh.ikon} />}>
            Ambil foto
          </Tombol>
        </BilahBawah>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Foto titik" />
        <Penuh>
          <IzinDitolak
            judul="Izin kamera ditolak"
            keterangan="Kamera tidak bisa dipakai untuk melampirkan foto. Pilih dari galeri masih bisa."
            aksi={<Tombol varian="sekunder">Pilih dari galeri</Tombol>}
          />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Lampirkan foto">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}
