/**
 * Komposisi jalur lapangan: merekam jejak dan membaca hasilnya.
 *
 * Rekaman adalah fungsi yang paling sering dipakai tanpa jaringan, jadi keadaan
 * offline di sini bukan kegagalan: rekaman tetap jalan dan yang ditahan hanya
 * pengiriman.
 */

import { CirclePause, CircleStop, Play, Route, Timer } from "lucide-react";
import {
  BarisDaftar,
  BilahAtas,
  Bidang,
  Isi,
  Kartu,
  LencanaStatus,
  Pemisah,
  Peta,
  Tombol,
  gayaTeks,
  usePalet,
} from "../primitives";
import { Galat, IzinDitolak, Kosong, Memuat, Offline, SpandukKeadaan } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { sentuh, spasi } from "../tokens";

export function KomposisiRekamJejak({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Rekam jejak"
          keterangan="Survei blok C · 00:12:41"
          penanda={<LencanaStatus jenis="sukses">Merekam</LencanaStatus>}
        />
        <Peta tinggi={200}>
          <svg width="100%" height="100%" viewBox="0 0 360 200" aria-hidden="true">
            <path
              d="M40 160 L96 128 L150 136 L206 96 L268 84"
              fill="none"
              stroke={p.utama}
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="268" cy="84" r="7" fill={p.aksen} stroke={p.permukaan} strokeWidth="3" />
          </svg>
        </Peta>
        <Isi>
          <Kartu>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={gayaTeks("badan", { warna: p.teksLembut })}>Titik terekam</span>
              <span style={gayaTeks("judulBesar", { bobot: "tebal", warna: p.teks, mono: true })}>184</span>
            </div>
            <Pemisah />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={gayaTeks("badan", { warna: p.teksLembut })}>Akurasi saat ini</span>
              <span style={gayaTeks("badanBesar", { bobot: "tebal", warna: p.sukses, mono: true })}>± 3,2 m</span>
            </div>
          </Kartu>
          <SpandukKeadaan jenis="info" aksi={<Tombol varian="halus">Rincian</Tombol>}>
            Titik yang jaraknya di bawah 2 m dilewati supaya jejak tidak menumpuk.
          </SpandukKeadaan>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Rekam jejak" />
        <Kosong
          judul="Belum ada jejak"
          keterangan="Tekan mulai, lalu berjalan seperti biasa. Titik dicatat tiap 2 detik dan disimpan di perangkat."
          ikon={<Route size={28} aria-hidden="true" />}
          aksi={
            <Tombol ikon={<Play size={sentuh.ikon} />}>Mulai merekam</Tombol>
          }
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Rekam jejak" />
        <Memuat judul="Menunggu sinyal GPS" keterangan="Butuh satu titik terkunci sebelum rekaman dimulai. Di luar ruangan biasanya 5–20 detik." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Rekam jejak" />
        <Galat
          judul="Rekaman berhenti sendiri"
          keterangan="Sistem menghentikan aplikasi saat memori hampir habis. Titik yang sudah tercatat tetap aman."
          rincian="recording stopped: low memory (184 titik tersimpan)"
          aksi={<Tombol varian="sekunder">Lanjutkan rekaman</Tombol>}
        />
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Rekam jejak"
          keterangan="Survei blok C · 00:12:41"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        <Isi>
          <Offline
            judul="Rekaman tetap jalan"
            keterangan="Titik disimpan di perangkat dan dikirim saat jaringan kembali. Tidak ada yang hilang."
            aksi={<Tombol varian="sekunder">Lihat antrean</Tombol>}
          />
          <Kartu judul="Tersimpan lokal" keterangan="184 titik · 12 menit terakhir">
            <Bidang label="Menunggu dikirim" nilai="184" satuan="titik" mono />
          </Kartu>
        </Isi>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Rekam jejak" />
        <IzinDitolak
          judul="Izin lokasi ditolak"
          keterangan="Rekaman jejak butuh lokasi saat aplikasi dipakai. Tanpa izin ini tidak ada titik yang bisa dicatat."
          aksi={<Tombol varian="sekunder">Buka pengaturan izin</Tombol>}
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Rekam jejak">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiMulaiJedaHentikan({ keadaan = "utama", ...varian }: Varian) {
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Kendali rekaman" keterangan="00:12:41 · 184 titik" />
        <Isi>
          <Kartu judul="Sedang merekam" keterangan="Jeda menyimpan jejak apa adanya; hentikan menutup rekaman dan menyimpannya.">
            <div style={{ display: "flex", gap: spasi.sm, marginBlockStart: spasi.sm }}>
              <Tombol varian="sekunder" ikon={<CirclePause size={sentuh.ikon} />}>
                Jeda
              </Tombol>
              <Tombol varian="bahaya" ikon={<CircleStop size={sentuh.ikon} />}>
                Hentikan
              </Tombol>
            </div>
          </Kartu>
          <Kartu judul="Ringkasan sementara">
            <Bidang label="Jarak" nilai="1,24" satuan="km" mono />
            <Pemisah />
            <Bidang label="Durasi" nilai="00:12:41" mono />
          </Kartu>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Kendali rekaman" />
        <Kosong
          judul="Belum ada rekaman aktif"
          keterangan="Mulai rekaman baru, atau buka jejak yang sudah tersimpan untuk melanjutkannya."
          ikon={<Timer size={28} aria-hidden="true" />}
          aksi={
            <Tombol ikon={<Play size={sentuh.ikon} />}>Mulai merekam</Tombol>
          }
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Kendali rekaman" />
        <Memuat judul="Menyiapkan rekaman" keterangan="Memeriksa izin lokasi dan menyiapkan berkas jejak baru." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Kendali rekaman" />
        <Galat
          judul="Jeda tidak tersimpan"
          keterangan="Status jeda gagal ditulis, jadi rekaman berhenti agar jejak tidak terpotong tanpa catatan."
          rincian="jejak-2026-10-19.json: ENOSPC"
          aksi={<Tombol varian="sekunder">Coba lagi</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Kendali rekaman" />
        <IzinDitolak
          judul="Izin lokasi ditolak"
          keterangan="Kendali rekaman tidak bisa dimulai tanpa izin lokasi. Izin ini hanya dipakai selama rekaman berjalan."
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Mulai jeda hentikan">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiRingkasanJejak({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Ringkasan jejak" keterangan="Survei blok C · hari ini 08:12" />
        <Isi>
          <Kartu>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={gayaTeks("badan", { warna: p.teksLembut })}>Jarak</span>
              <span style={gayaTeks("angka", { bobot: "tebal", warna: p.teks, mono: true })}>1,24 km</span>
            </div>
            <Pemisah />
            <BarisDaftar judul="Durasi" ujung={<span style={gayaTeks("badan", { mono: true, warna: p.teks })}>12:41</span>} />
            <BarisDaftar judul="Kecepatan rata-rata" ujung={<span style={gayaTeks("badan", { mono: true, warna: p.teks })}>5,9 km/j</span>} />
            <BarisDaftar judul="Titik" ujung={<span style={gayaTeks("badan", { mono: true, warna: p.teks })}>184</span>} />
            <BarisDaftar
              judul="Akurasi rata-rata"
              ujung={<LencanaStatus jenis="sukses">± 3,2 m</LencanaStatus>}
            />
          </Kartu>
          <Kartu judul="Mutu jejak" keterangan="Titik dengan akurasi di atas 10 m ditandai, bukan dibuang.">
            <Bidang label="Titik lemah" nilai="6" satuan="dari 184" mono />
          </Kartu>
          <Tombol lebarPenuh varian="sekunder">
            Ekspor sebagai GeoJSON
          </Tombol>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Ringkasan jejak" />
        <Kosong
          judul="Belum ada jejak untuk diringkas"
          keterangan="Ringkasan muncul setelah satu rekaman selesai. Rekaman yang masih berjalan belum punya angka akhir."
          ikon={<Route size={28} aria-hidden="true" />}
          aksi={<Tombol>Rekam jejak baru</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Ringkasan jejak" />
        <Memuat judul="Menghitung ringkasan" keterangan="Menjumlahkan jarak antar titik dan menghitung sebaran akurasi." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Ringkasan jejak" />
        <Galat
          judul="Jejak tidak bisa dihitung"
          keterangan="Berkas jejak berisi titik dengan cap waktu yang mundur, jadi durasi tidak bisa dipercaya."
          rincian="titik 57: t=08:04:12 < t-1=08:06:40"
          aksi={<Tombol varian="sekunder">Buka jejak mentah</Tombol>}
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Ringkasan jejak">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}
