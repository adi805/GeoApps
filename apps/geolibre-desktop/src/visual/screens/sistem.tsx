/**
 * Komposisi jalur sistem: pengaturan, tema, bahasa, plugin, dan dua kegagalan
 * yang paling sering membingungkan pengguna (izin ditolak, lokasi mati).
 *
 * Dua keadaan terakhir sengaja dipisah: izin ditolak adalah keputusan pengguna,
 * lokasi mati adalah sakelar perangkat. Menyamakan keduanya membuat pengguna
 * mencari di tempat yang salah.
 *
 * Bahasa visualnya mengikuti issue 102 dan rujukan `screens/peta.tsx`: bilah atas
 * berpenanda keadaan, baris berikon dengan nilai di ujung, label seksi di atas
 * kelompok baris, dan aksi yang menempel di dasar layar. Sebelumnya daftar
 * pengaturan hanya lima baris tanpa pengelompokan, pilihan tema disusun sebagai
 * array tuple yang menyembunyikan mana yang aktif, dan tombol "Coba baca ulang"
 * mengambang di ujung isi yang bisa digulir.
 */

import { Contrast, Globe, Languages, Moon, Palette, Puzzle, Settings, Smartphone, Sun, Wrench } from "lucide-react";
import {
  BarisDaftar,
  Bidang,
  BilahAtas,
  BilahBawah,
  Daftar,
  Isi,
  Kartu,
  LabelSeksi,
  LencanaStatus,
  Pemisah,
  Penuh,
  Tombol,
  gayaTeks,
  usePalet,
} from "../primitives";
import { Galat, IzinDitolak, Kosong, Memuat, SpandukKeadaan } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { radius, sentuh, spasi } from "../tokens";

/** Nilai di ujung baris: mono, supaya kolom angka lurus ke bawah. */
function Nilai({ children }: { children: string }) {
  const p = usePalet();
  return <span style={gayaTeks("badan", { mono: true, warna: p.teks })}>{children}</span>;
}

export function KomposisiPengaturan({ keadaan = "utama", ...varian }: Varian) {
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Pengaturan"
          keterangan="Berlaku untuk proyek ini"
          kembali={false}
          penanda={<LencanaStatus jenis="netral">1 nilai diubah</LencanaStatus>}
        />
        <Daftar>
          <LabelSeksi>Tampilan</LabelSeksi>
          <BarisDaftar
            ikon={<Palette size={sentuh.ikon} />}
            judul="Tema"
            keterangan="Diikuti dari sistem"
            ujung={<LencanaStatus jenis="netral">Terang</LencanaStatus>}
          />
          <BarisDaftar
            ikon={<Languages size={sentuh.ikon} />}
            judul="Bahasa"
            keterangan="Katalog teks yang dipakai di semua layar"
            ujung={<LencanaStatus jenis="netral">Indonesia</LencanaStatus>}
          />
          <LabelSeksi>Perangkat</LabelSeksi>
          <BarisDaftar
            ikon={<Puzzle size={sentuh.ikon} />}
            judul="Plugin"
            keterangan="2 aktif dari 3 terpasang"
            ujung={<Nilai>2/3</Nilai>}
          />
          <BarisDaftar
            ikon={<Smartphone size={sentuh.ikon} />}
            judul="Izin aplikasi"
            keterangan="Lokasi aktif · kamera aktif"
            ujung={<LencanaStatus jenis="sukses">Cukup</LencanaStatus>}
          />
          <div style={{ paddingInline: spasi.lg, paddingBlock: spasi.lg }}>
            <Kartu
              judul="Penyimpanan"
              keterangan="Angka dihitung dari berkas lokal; rinciannya ada di layar penyimpanan."
            >
              <BarisDaftar
                ikon={<Settings size={sentuh.ikon} />}
                judul="Terpakai"
                keterangan="1,7 GB dari 4,2 GB"
                ujung={<Nilai>41%</Nilai>}
              />
            </Kartu>
          </div>
        </Daftar>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Pengaturan" kembali={false} />
        <Penuh>
          <Kosong
            judul="Belum ada pengaturan tersimpan"
            keterangan="Aplikasi memakai nilai bawaan sampai kamu mengubah sesuatu. Perubahan pertama akan muncul di sini."
            ikon={<Settings size={28} aria-hidden="true" />}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Pengaturan" kembali={false} />
        <Penuh>
          <Memuat
            judul="Membaca pengaturan"
            keterangan="Memuat nilai tersimpan dan menandai yang berbeda dari bawaan."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Pengaturan" kembali={false} />
        <Penuh>
          <Galat
            judul="Pengaturan tidak bisa dibaca"
            keterangan="Berkas pengaturan rusak, jadi aplikasi memakai nilai bawaan sampai diperbaiki."
            rincian="pengaturan.json: unexpected end of input"
            aksi={<Tombol varian="sekunder">Setel ulang ke bawaan</Tombol>}
          />
        </Penuh>
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
        <BilahAtas
          judul="Tema"
          keterangan="Berlaku di seluruh aplikasi"
          penanda={<LencanaStatus jenis="sukses">Tersimpan</LencanaStatus>}
        />
        <Isi>
          <Kartu
            judul="Pilihan tema"
            keterangan="Ketiga tema memakai token yang sama, jadi tidak ada layar yang tertinggal."
          >
            <BarisDaftar
              ikon={<Sun size={sentuh.ikon} />}
              judul="Terang"
              keterangan="Sedang dipakai"
              ujung={<LencanaStatus jenis="sukses">Aktif</LencanaStatus>}
              terpilih
            />
            <BarisDaftar
              ikon={<Moon size={sentuh.ikon} />}
              judul="Gelap"
              keterangan="Untuk kerja malam"
            />
            <BarisDaftar
              ikon={<Contrast size={sentuh.ikon} />}
              judul="Kontras tinggi"
              keterangan="Teks dan garis lebih tegas"
            />
          </Kartu>
          <Kartu judul="Pratinjau" keterangan="Warna yang kamu lihat di sini sama dengan yang dipakai layar lain.">
            <div style={{ display: "flex", gap: spasi.sm }}>
              <span
                style={{
                  ...gayaTeks("badan", { warna: p.teks }),
                  background: p.permukaan,
                  border: `1px solid ${p.garis}`,
                  padding: spasi.sm,
                  borderRadius: radius.sm,
                  flex: 1,
                }}
              >
                Teks utama
              </span>
              <span
                style={{
                  ...gayaTeks("badan", { warna: p.utamaTeks }),
                  background: p.utama,
                  padding: spasi.sm,
                  borderRadius: radius.sm,
                  flex: 1,
                }}
              >
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
        <Penuh>
          <Kosong
            judul="Belum ada tema dipilih"
            keterangan="Aplikasi mengikuti tema sistem sampai kamu memilih sendiri. Pilihan tersimpan di perangkat."
            ikon={<Palette size={28} aria-hidden="true" />}
            aksi={<Tombol>Ikuti tema sistem</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Tema" />
        <Penuh>
          <Memuat judul="Menerapkan tema" keterangan="Menukar token warna di seluruh layar yang sedang terbuka." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Tema" />
        <Penuh>
          <Galat
            judul="Tema tidak bisa disimpan"
            keterangan="Pilihan tema berlaku sekarang, tapi akan kembali ke bawaan saat aplikasi dibuka lagi."
            rincian="pengaturan.json: read-only"
            aksi={<Tombol varian="sekunder">Coba lagi</Tombol>}
          />
        </Penuh>
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
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Bahasa"
          keterangan="Tata letak ikut berbalik untuk bahasa kanan-ke-kiri"
          penanda={<LencanaStatus jenis="netral">5 katalog</LencanaStatus>}
        />
        <Daftar>
          <LabelSeksi>Kiri ke kanan</LabelSeksi>
          <BarisDaftar judul="Indonesia" keterangan="Bawaan" ujung={<LencanaStatus jenis="sukses">Aktif</LencanaStatus>} terpilih />
          <BarisDaftar judul="English" keterangan="English (US)" />
          <LabelSeksi>Kanan ke kiri</LabelSeksi>
          <BarisDaftar judul="العربية" keterangan="Arab · tata letak berbalik" />
          <BarisDaftar judul="עברית" keterangan="Ibrani · tata letak berbalik" />
          <BarisDaftar judul="فارسی" keterangan="Persia · tata letak berbalik" />
          <div style={{ paddingInline: spasi.lg, paddingBlock: spasi.lg }}>
            <Kartu
              judul="Arah tata letak"
              keterangan="Bukan hanya teks yang diganti: bilah atas, ikon, dan bilah bawah ikut berbalik."
            >
              <BarisDaftar
                ikon={<Globe size={sentuh.ikon} />}
                judul="Katalog terpasang"
                keterangan="Ikut aplikasi, jadi tetap ada tanpa jaringan"
                ujung={<Nilai>5</Nilai>}
              />
            </Kartu>
          </div>
        </Daftar>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Bahasa" />
        <Penuh>
          <Kosong
            judul="Belum ada bahasa tambahan"
            keterangan="Aplikasi selalu punya satu bahasa bawaan. Bahasa lain muncul di sini setelah berkas terjemahannya terpasang."
            ikon={<Globe size={28} aria-hidden="true" />}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Bahasa" />
        <Penuh>
          <Memuat judul="Memuat terjemahan" keterangan="Mengganti katalog teks tanpa memuat ulang aplikasi." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Bahasa" />
        <Penuh>
          <Galat
            judul="Terjemahan tidak lengkap"
            keterangan="Sebagian teks kembali ke bahasa bawaan. Tidak ada layar yang kosong karena ini."
            rincian="ar: 214 dari 268 kunci"
            aksi={<Tombol varian="sekunder">Laporkan terjemahan</Tombol>}
          />
        </Penuh>
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
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Plugin"
          keterangan="2 aktif dari 3 terpasang"
          penanda={<LencanaStatus jenis="sukses">2 aktif</LencanaStatus>}
        />
        <Daftar>
          <LabelSeksi>Aktif</LabelSeksi>
          <BarisDaftar
            ikon={<Puzzle size={sentuh.ikon} />}
            judul="Pembaca GeoPDF"
            keterangan="v2.4.0 · butuh akses berkas"
            ujung={<LencanaStatus jenis="sukses">Aktif</LencanaStatus>}
          />
          <BarisDaftar
            ikon={<Puzzle size={sentuh.ikon} />}
            judul="Pengukur lereng"
            keterangan="v1.1.2 · butuh akses lokasi"
            ujung={<LencanaStatus jenis="sukses">Aktif</LencanaStatus>}
          />
          <LabelSeksi>Mati</LabelSeksi>
          <BarisDaftar
            ikon={<Puzzle size={sentuh.ikon} />}
            judul="Ekspor CAD"
            keterangan="v0.9.0 · butuh akses penyimpanan"
            ujung={<LencanaStatus jenis="netral">Mati</LencanaStatus>}
          />
          <div style={{ paddingInline: spasi.lg, paddingBlock: spasi.lg }}>
            <Kartu
              judul="Izin yang diminta"
              keterangan="Plugin menyebut kebutuhannya sebelum dinyalakan, bukan setelah gagal."
            >
              <BarisDaftar
                ikon={<Wrench size={sentuh.ikon} />}
                judul="Berjalan di dalam aplikasi"
                keterangan="Tidak ada proses terpisah yang perlu dipasang"
                ujung={<LencanaStatus jenis="netral">Aman</LencanaStatus>}
              />
            </Kartu>
          </div>
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
        <Penuh>
          <Kosong
            judul="Belum ada plugin terpasang"
            keterangan="Plugin menambah kemampuan tanpa memperbesar aplikasi utama. Yang terpasang muncul di sini."
            ikon={<Puzzle size={28} aria-hidden="true" />}
            aksi={<Tombol>Cari plugin</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Plugin" />
        <Penuh>
          <Memuat judul="Memuat plugin" keterangan="Memeriksa versi dan izin yang diminta tiap plugin." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Plugin" />
        <Penuh>
          <Galat
            judul="Plugin gagal dimuat"
            keterangan="Plugin meminta versi aplikasi yang lebih baru, jadi tidak dijalankan agar tidak merusak data."
            rincian="ekspor-cad 0.9.0 butuh app ≥ 0.6.0, terpasang 0.5.11"
            aksi={<Tombol varian="sekunder">Perbarui aplikasi</Tombol>}
          />
        </Penuh>
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
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Izin lokasi"
          keterangan="Diperlukan untuk kerja lapangan"
          penanda={<LencanaStatus jenis="peringatan">Ditolak</LencanaStatus>}
        />
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
          <Kartu
            judul="Cara mengaktifkan"
            keterangan="Jalurnya berbeda per platform, jadi langkahnya disebut langsung."
          >
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
        <Penuh>
          <Kosong
            judul="Izin belum pernah diminta"
            keterangan="Izin diminta saat pertama kali kamu mencatat titik atau merekam jejak, bukan saat aplikasi dibuka."
            ikon={<Smartphone size={28} aria-hidden="true" />}
            aksi={<Tombol>Minta izin sekarang</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Izin lokasi" />
        <Penuh>
          <Memuat judul="Menunggu jawaban" keterangan="Aplikasi sedang menunggu keputusanmu di dialog izin sistem." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Izin lokasi" />
        <Penuh>
          <Galat
            judul="Izin tidak bisa diminta lagi"
            keterangan="Izin sudah ditolak permanen, jadi dialog tidak akan muncul. Hanya pengaturan sistem yang bisa mengubahnya."
            rincian="permission: permanently denied"
            aksi={<Tombol varian="sekunder">Buka pengaturan</Tombol>}
          />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Izin lokasi" />
        <Penuh>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Kerja lapangan yang butuh posisi tidak akan jalan sampai izin ini diberikan. Pencatatan manual di peta tetap bisa."
          />
        </Penuh>
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
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Lokasi mati"
          keterangan="Izin diberikan, tapi GPS tidak memberi posisi"
          penanda={<LencanaStatus jenis="peringatan">Tanpa posisi</LencanaStatus>}
        />
        <Isi>
          <SpandukKeadaan jenis="peringatan">Lokasi perangkat sedang dimatikan, bukan ditolak.</SpandukKeadaan>
          <Kartu judul="Periksa ini" keterangan="Urutannya dari yang paling sering terjadi.">
            <BarisDaftar
              ikon={<Smartphone size={sentuh.ikon} />}
              judul="Sakelar lokasi perangkat"
              keterangan="Setelan › Lokasi"
              ujung={<LencanaStatus jenis="peringatan">Mati</LencanaStatus>}
            />
            <BarisDaftar
              ikon={<Settings size={sentuh.ikon} />}
              judul="Mode hemat daya"
              keterangan="Mematikan GPS saat layar mati"
              ujung={<LencanaStatus jenis="netral">Periksa</LencanaStatus>}
            />
            <BarisDaftar
              ikon={<Globe size={sentuh.ikon} />}
              judul="Di dalam ruangan"
              keterangan="Sinyal GPS butuh langit terbuka"
              ujung={<LencanaStatus jenis="netral">Periksa</LencanaStatus>}
            />
          </Kartu>
        </Isi>
        <BilahBawah>
          <Tombol varian="sekunder" lebarPenuh ikon={<Smartphone size={sentuh.ikon} />}>
            Buka setelan lokasi
          </Tombol>
          <Tombol lebarPenuh>Baca ulang</Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Lokasi mati" />
        <Penuh>
          <Kosong
            judul="Belum ada pembacaan"
            keterangan="Layar ini muncul setelah aplikasi mencoba membaca posisi dan gagal. Belum ada percobaan yang tercatat."
            ikon={<Globe size={28} aria-hidden="true" />}
            aksi={<Tombol>Coba baca posisi</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Lokasi mati" />
        <Penuh>
          <Memuat
            judul="Mencoba membaca ulang"
            keterangan="Menunggu sampai 30 detik sebelum menyimpulkan lokasi benar-benar mati."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Lokasi mati" />
        <Penuh>
          <Galat
            judul="Perangkat tidak punya GPS"
            keterangan="Perangkat ini tidak melaporkan kemampuan lokasi sama sekali, jadi posisi harus diisi manual."
            rincian="geolocation: not supported"
            aksi={<Tombol varian="sekunder">Isi koordinat manual</Tombol>}
          />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Lokasi mati" />
        <Penuh>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Ini bukan lokasi mati: izinnya yang belum diberikan. Aktifkan izin dulu, lalu periksa sakelar lokasi."
          />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Lokasi mati">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

