/**
 * Komposisi jalur sistem: pengaturan, tema, bahasa, plugin, dan dua kegagalan
 * yang paling sering membingungkan pengguna (izin ditolak, lokasi mati).
 *
 * Dua keadaan terakhir sengaja dipisah: izin ditolak adalah keputusan pengguna,
 * lokasi mati adalah sakelar perangkat. Menyamakan keduanya membuat pengguna
 * mencari di tempat yang salah.
 */

import { Globe, Languages, Palette, Puzzle, Settings, Smartphone, Sun, Moon } from "lucide-react";
import {
  BarisDaftar,
  BilahAtas,
  BilahBawah,
  Bidang,
  Chip,
  Daftar,
  Isi,
  Kartu,
  LencanaStatus,
  Pemisah,
  Tombol,
  gayaTeks,
  usePalet,
} from "../primitives";
import { Galat, IzinDitolak, Kosong, Memuat, Offline, SpandukKeadaan } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { radius, sentuh, spasi } from "../tokens";

export function KomposisiPengaturan({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Pengaturan" keterangan="Berlaku untuk proyek ini" kembali={false} />
        <Daftar>
          <BarisDaftar judul="Tampilan" keterangan="Tema terang · ukuran teks normal" ikon={<Palette size={sentuh.ikon} />} />
          <BarisDaftar judul="Bahasa" keterangan="Indonesia" ikon={<Languages size={sentuh.ikon} />} />
          <BarisDaftar judul="Plugin" keterangan="2 aktif dari 3" ikon={<Puzzle size={sentuh.ikon} />} />
          <BarisDaftar judul="Penyimpanan" keterangan="1,7 GB dari 4,2 GB" ikon={<Settings size={sentuh.ikon} />} />
          <BarisDaftar judul="Izin aplikasi" keterangan="Lokasi aktif · kamera aktif" ikon={<Smartphone size={sentuh.ikon} />} />
        </Daftar>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Pengaturan" kembali={false} />
        <Kosong
          judul="Belum ada pengaturan tersimpan"
          keterangan="Aplikasi memakai nilai bawaan sampai kamu mengubah sesuatu. Perubahan pertama akan muncul di sini."
          ikon={<Settings size={28} aria-hidden="true" />}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Pengaturan" kembali={false} />
        <Memuat judul="Membaca pengaturan" keterangan="Memuat nilai tersimpan dan menandai yang berbeda dari bawaan." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Pengaturan" kembali={false} />
        <Galat
          judul="Pengaturan tidak bisa dibaca"
          keterangan="Berkas pengaturan rusak, jadi aplikasi memakai nilai bawaan sampai diperbaiki."
          rincian="pengaturan.json: unexpected end of input"
          aksi={<Tombol varian="sekunder">Setel ulang ke bawaan</Tombol>}
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Pengaturan">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiTema({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Tema" keterangan="Berlaku di seluruh aplikasi" />
        <Isi>
          <Kartu judul="Pilihan tema" keterangan="Ketiga tema memakai token yang sama, jadi tidak ada layar yang tertinggal.">
            <div style={{ display: "flex", flexDirection: "column", gap: spasi.sm }}>
              {[
                ["Terang", <Sun key="s" size={sentuh.ikon} aria-hidden="true" />, true],
                ["Gelap", <Moon key="m" size={sentuh.ikon} aria-hidden="true" />, false],
                ["Kontras tinggi", <Palette key="p" size={sentuh.ikon} aria-hidden="true" />, false],
              ].map(([label, ikon, aktif]) => (
                <BarisDaftar
                  key={String(label)}
                  ikon={ikon as React.ReactNode}
                  judul={String(label)}
                  keterangan={aktif ? "Sedang dipakai" : undefined}
                  ujung={aktif ? <LencanaStatus jenis="sukses">Aktif</LencanaStatus> : undefined}
                  terpilih={Boolean(aktif)}
                />
              ))}
            </div>
          </Kartu>
          <Kartu judul="Pratinjau">
            <div style={{ display: "flex", gap: spasi.sm }}>
              <span style={{ ...gayaTeks("badan", { warna: p.teks }), background: p.permukaan, padding: spasi.sm, borderRadius: radius.sm, flex: 1 }}>
                Teks utama
              </span>
              <span style={{ ...gayaTeks("badan", { warna: p.utamaTeks }), background: p.utama, padding: spasi.sm, borderRadius: radius.sm, flex: 1 }}>
                Aksi
              </span>
            </div>
          </Kartu>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Tema" />
        <Kosong
          judul="Belum ada tema dipilih"
          keterangan="Aplikasi mengikuti tema sistem sampai kamu memilih sendiri. Pilihan tersimpan di perangkat."
          ikon={<Palette size={28} aria-hidden="true" />}
          aksi={<Tombol>Ikuti tema sistem</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Tema" />
        <Memuat judul="Menerapkan tema" keterangan="Menukar token warna di seluruh layar yang sedang terbuka." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Tema" />
        <Galat
          judul="Tema tidak bisa disimpan"
          keterangan="Pilihan tema berlaku sekarang, tapi akan kembali ke bawaan saat aplikasi dibuka lagi."
          rincian="pengaturan.json: read-only"
          aksi={<Tombol varian="sekunder">Coba lagi</Tombol>}
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Tema">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiBahasa({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Bahasa" keterangan="Tata letak ikut berbalik untuk bahasa kanan-ke-kiri" />
        <Daftar>
          <BarisDaftar judul="Indonesia" keterangan="Bawaan" ujung={<LencanaStatus jenis="sukses">Aktif</LencanaStatus>} terpilih />
          <BarisDaftar judul="English" keterangan="English (US)" />
          <BarisDaftar judul="العربية" keterangan="Arab · kanan ke kiri" />
          <BarisDaftar judul="עברית" keterangan="Ibrani · kanan ke kiri" />
          <BarisDaftar judul="فارسی" keterangan="Persia · kanan ke kiri" />
        </Daftar>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Bahasa" />
        <Kosong
          judul="Belum ada bahasa tambahan"
          keterangan="Aplikasi selalu punya satu bahasa bawaan. Bahasa lain muncul di sini setelah berkas terjemahannya terpasang."
          ikon={<Globe size={28} aria-hidden="true" />}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Bahasa" />
        <Memuat judul="Memuat terjemahan" keterangan="Mengganti katalog teks tanpa memuat ulang aplikasi." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Bahasa" />
        <Galat
          judul="Terjemahan tidak lengkap"
          keterangan="Sebagian teks kembali ke bahasa bawaan. Tidak ada layar yang kosong karena ini."
          rincian="ar: 214 dari 268 kunci"
          aksi={<Tombol varian="sekunder">Laporkan terjemahan</Tombol>}
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Bahasa">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiPlugin({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Plugin" keterangan="2 aktif dari 3" />
        <Daftar>
          <BarisDaftar
            judul="Pembaca GeoPDF"
            keterangan="v2.4.0 · butuh akses berkas"
            ikon={<Puzzle size={sentuh.ikon} />}
            ujung={<LencanaStatus jenis="sukses">Aktif</LencanaStatus>}
          />
          <BarisDaftar
            judul="Pengukur lereng"
            keterangan="v1.1.2 · butuh akses lokasi"
            ikon={<Puzzle size={sentuh.ikon} />}
            ujung={<LencanaStatus jenis="sukses">Aktif</LencanaStatus>}
          />
          <BarisDaftar
            judul="Ekspor CAD"
            keterangan="v0.9.0 · butuh akses penyimpanan"
            ikon={<Puzzle size={sentuh.ikon} />}
            ujung={<LencanaStatus jenis="netral">Mati</LencanaStatus>}
          />
        </Daftar>
        <BilahBawah>
          <Tombol varian="sekunder" lebarPenuh ikon={<Puzzle size={sentuh.ikon} />}>
            Cari plugin
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Plugin" />
        <Kosong
          judul="Belum ada plugin terpasang"
          keterangan="Plugin menambah kemampuan tanpa memperbesar aplikasi utama. Yang terpasang muncul di sini."
          ikon={<Puzzle size={28} aria-hidden="true" />}
          aksi={<Tombol>Cari plugin</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Plugin" />
        <Memuat judul="Memuat plugin" keterangan="Memeriksa versi dan izin yang diminta tiap plugin." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Plugin" />
        <Galat
          judul="Plugin gagal dimuat"
          keterangan="Plugin meminta versi aplikasi yang lebih baru, jadi tidak dijalankan agar tidak merusak data."
          rincian="ekspor-cad 0.9.0 butuh app ≥ 0.6.0, terpasang 0.5.11"
          aksi={<Tombol varian="sekunder">Perbarui aplikasi</Tombol>}
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Plugin">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiIzinLokasiDitolak({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Izin lokasi" keterangan="Diperlukan untuk kerja lapangan" />
        <Isi>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Tanpa izin ini aplikasi tidak bisa mencatat titik, merekam jejak, atau mengawasi geofence. Data yang sudah ada tetap aman."
            aksi={
              <Tombol varian="sekunder" ikon={<Smartphone size={sentuh.ikon} />}>
                Buka pengaturan izin
              </Tombol>
            }
          />
          <Kartu judul="Cara mengaktifkan" keterangan="Jalurnya berbeda per platform, jadi langkahnya disebut langsung.">
            <Bidang label="Android" nilai="Setelan › Aplikasi › GeoApps › Izin › Lokasi" />
            <Pemisah />
            <Bidang label="iOS" nilai="Setelan › GeoApps › Lokasi" />
            <Pemisah />
            <Bidang label="Desktop" nilai="Setelan sistem › Privasi › Lokasi" />
          </Kartu>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Izin lokasi" />
        <Kosong
          judul="Izin belum pernah diminta"
          keterangan="Izin diminta saat pertama kali kamu mencatat titik atau merekam jejak, bukan saat aplikasi dibuka."
          aksi={<Tombol>Minta izin sekarang</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Izin lokasi" />
        <Memuat judul="Menunggu jawaban" keterangan="Aplikasi sedang menunggu keputusanmu di dialog izin sistem." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Izin lokasi" />
        <Galat
          judul="Izin tidak bisa diminta lagi"
          keterangan="Izin sudah ditolak permanen, jadi dialog tidak akan muncul. Hanya pengaturan sistem yang bisa mengubahnya."
          rincian="permission: permanently denied"
          aksi={<Tombol varian="sekunder">Buka pengaturan</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Izin lokasi" />
        <IzinDitolak
          judul="Izin lokasi ditolak"
          keterangan="Kerja lapangan yang butuh posisi tidak akan jalan sampai izin ini diberikan. Pencatatan manual di peta tetap bisa."
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Izin lokasi ditolak">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiLokasiMati({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Lokasi mati" keterangan="Izin diberikan, tapi GPS tidak memberi posisi" />
        <Isi>
          <SpandukKeadaan jenis="peringatan">Lokasi perangkat sedang dimatikan, bukan ditolak.</SpandukKeadaan>
          <Kartu judul="Periksa ini" keterangan="Urutannya dari yang paling sering terjadi.">
            <BarisDaftar judul="Sakelar lokasi perangkat" keterangan="Setelan › Lokasi" ujung={<LencanaStatus jenis="peringatan">Mati</LencanaStatus>} />
            <BarisDaftar judul="Mode hemat daya" keterangan="Mematikan GPS saat layar mati" />
            <BarisDaftar judul="Di dalam ruangan" keterangan="Sinyal GPS butuh langit terbuka" />
          </Kartu>
          <Tombol lebarPenuh varian="sekunder">
            Coba baca ulang
          </Tombol>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Lokasi mati" />
        <Kosong
          judul="Belum ada pembacaan"
          keterangan="Layar ini muncul setelah aplikasi mencoba membaca posisi dan gagal. Belum ada percobaan yang tercatat."
          aksi={<Tombol>Coba baca posisi</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Lokasi mati" />
        <Memuat judul="Mencoba membaca ulang" keterangan="Menunggu sampai 30 detik sebelum menyimpulkan lokasi benar-benar mati." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Lokasi mati" />
        <Galat
          judul="Perangkat tidak punya GPS"
          keterangan="Perangkat ini tidak melaporkan kemampuan lokasi sama sekali, jadi posisi harus diisi manual."
          rincian="geolocation: not supported"
          aksi={<Tombol varian="sekunder">Isi koordinat manual</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Lokasi mati" />
        <IzinDitolak
          judul="Izin lokasi ditolak"
          keterangan="Ini bukan lokasi mati: izinnya yang belum diberikan. Aktifkan izin dulu, lalu periksa sakelar lokasi."
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Lokasi mati">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}
