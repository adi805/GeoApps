/**
 * Komposisi jalur lapangan: merekam jejak dan membaca hasilnya.
 *
 * Rekaman adalah fungsi yang paling sering dipakai tanpa jaringan, jadi keadaan
 * offline di sini bukan kegagalan: rekaman tetap jalan dan yang ditahan hanya
 * pengiriman.
 *
 * Bahasa visualnya mengikuti issue 102 dan rujukan `screens/peta.tsx`: bilah
 * atas berpenanda keadaan, label seksi huruf besar, baris berikon dengan nilai
 * di ujung, peta yang membawa skala dan atribusi, dan aksi utama yang menempel
 * di dasar layar. Sebelumnya tombol aksi mengapung di tengah isi lalu hilang
 * saat digulir, peta digambar tanpa skala sehingga tidak bisa dipakai mengukur,
 * dan keadaan kosong berhenti di tengah layar.
 *
 * Tiap komposisi menerima `keadaan`, jadi kelima keadaan layar digambar oleh
 * kode yang sama. Yang tidak dideklarasikan `inventaris.ts` memang tidak
 * digambar, dan alasannya tertulis di sana.
 */

import {
  CircleAlert,
  CirclePause,
  CircleStop,
  FileDown,
  Gauge,
  MapPin,
  Play,
  Route,
  ShieldCheck,
  Timer,
} from "lucide-react";
import {
  BarisDaftar,
  BilahAtas,
  BilahBawah,
  Daftar,
  Kartu,
  LabelSeksi,
  LencanaStatus,
  Penuh,
  PetaLengkap,
  Tombol,
  gayaTeks,
  usePalet,
} from "../primitives";
import { Galat, IzinDitolak, Kosong, Memuat, Offline, SpandukKeadaan } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { ruangAman, sentuh, spasi } from "../tokens";

/**
 * Ruas jejak, digambar di atas `PetaLengkap`.
 *
 * Dua kanvas, bukan satu: peta rekaman mengambil sisa tinggi layar (kanvas
 * 360x400), sedangkan peta ringkasan tingginya tetap (kanvas 360x200). Jejak
 * yang digambar di kanvas pendek lalu direntangkan ke peta tinggi berhenti jadi
 * pita kecil di tengah, dan peta yang isinya pita tidak terbaca sebagai peta.
 */
const JEJAK = "M40 172 L96 138 L150 146 L206 104 L268 92";
const JEJAK_TINGGI = "M40 344 L96 268 L150 288 L206 196 L268 172";
/**
 * Jejak untuk peta ringkasan, yang tingginya tetap 150 px.
 *
 * Kanvas 360x200 di wadah selebar 412 dan setinggi 150 memotong 34 satuan
 * kanvas di atas dan di bawah, jadi titik awal di y=172 hilang dari gambar.
 * Jalur ini sengaja tinggal di pita y 45-155 supaya kedua ujungnya terlihat.
 */
const JEJAK_RINGKAS = "M74 132 L120 116 L168 122 L216 98 L262 86";

/** Nilai angka di ujung baris: mono, karena dibandingkan digit per digit. */
function Angka({ children, warna }: { children: string; warna?: string }) {
  return <span style={gayaTeks("badan", { mono: true, bobot: "tebal", warna })}>{children}</span>;
}

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
        <PetaLengkap skala="200 m">
          <svg
            aria-hidden="true"
            viewBox="0 0 360 400"
            preserveAspectRatio="xMidYMid slice"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            <path d={JEJAK_TINGGI} fill="none" stroke={p.utama} strokeWidth="4" strokeLinecap="round" />
            <circle cx="268" cy="172" r="7" fill={p.aksen} stroke={p.permukaan} strokeWidth="3" />
          </svg>
        </PetaLengkap>
        <Daftar rapat>
          <LabelSeksi>Sesi berjalan</LabelSeksi>
          <BarisDaftar
            ikon={<Route size={sentuh.ikon} />}
            judul="Titik terekam"
            keterangan="Satu titik tiap 2 detik"
            ujung={<LencanaStatus jenis="info">184</LencanaStatus>}
          />
          <BarisDaftar
            ikon={<Gauge size={sentuh.ikon} />}
            judul="Akurasi saat ini"
            keterangan="Ambang lompatan 200 m"
            ujung={<LencanaStatus jenis="sukses">± 3,2 m</LencanaStatus>}
          />
          <BarisDaftar
            ikon={<Timer size={sentuh.ikon} />}
            judul="Durasi"
            keterangan="Mulai 08:12"
            ujung={<Angka warna={p.teks}>12:41</Angka>}
          />
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="info">
              Titik yang jaraknya di bawah 2 m dilewati supaya jejak tidak menumpuk.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh varian="bahaya" ikon={<CircleStop size={sentuh.ikon} />}>
            Hentikan rekaman
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Rekam jejak" />
        <Penuh>
          <Kosong
            judul="Belum ada jejak"
            keterangan="Tekan mulai, lalu berjalan seperti biasa. Titik dicatat tiap 2 detik dan disimpan di perangkat."
            ikon={<Route size={28} aria-hidden="true" />}
            aksi={<Tombol ikon={<Play size={sentuh.ikon} />}>Mulai merekam</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Rekam jejak" />
        <Penuh>
          <Memuat
            judul="Menunggu sinyal GPS"
            keterangan="Butuh satu titik terkunci sebelum rekaman dimulai. Di luar ruangan biasanya 5–20 detik."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Rekam jejak" />
        <Penuh>
          <Galat
            judul="Rekaman berhenti sendiri"
            keterangan="Sistem menghentikan aplikasi saat memori hampir habis. Titik yang sudah tercatat tetap aman."
            rincian="recording stopped: low memory (184 titik tersimpan)"
            aksi={<Tombol varian="sekunder">Lanjutkan rekaman</Tombol>}
          />
        </Penuh>
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Rekam jejak"
          keterangan="Survei blok C · 00:12:41"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        <PetaLengkap skala="200 m">
          <svg
            aria-hidden="true"
            viewBox="0 0 360 400"
            preserveAspectRatio="xMidYMid slice"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            <path d={JEJAK_TINGGI} fill="none" stroke={p.utama} strokeWidth="4" strokeLinecap="round" />
            <circle cx="268" cy="172" r="7" fill={p.aksen} stroke={p.permukaan} strokeWidth="3" />
          </svg>
        </PetaLengkap>
        <Daftar rapat>
          <LabelSeksi>Tersimpan lokal</LabelSeksi>
          <BarisDaftar
            ikon={<Route size={sentuh.ikon} />}
            judul="Titik tersimpan"
            keterangan="12 menit terakhir"
            ujung={<LencanaStatus jenis="info">184</LencanaStatus>}
          />
          <BarisDaftar
            ikon={<CircleStop size={sentuh.ikon} />}
            judul="Menunggu dikirim"
            keterangan="Terkirim otomatis saat jaringan kembali"
            ujung={<LencanaStatus jenis="peringatan">184</LencanaStatus>}
          />
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <Offline
              judul="Rekaman tetap jalan"
              keterangan="Titik disimpan di perangkat dan dikirim saat jaringan kembali. Tidak ada yang hilang."
            />
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh varian="sekunder">
            Lihat antrean
          </Tombol>
          <Tombol lebarPenuh varian="bahaya" ikon={<CircleStop size={sentuh.ikon} />}>
            Hentikan rekaman
          </Tombol>
        </BilahBawah>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Rekam jejak" />
        <Penuh>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Rekaman jejak butuh lokasi saat aplikasi dipakai. Tanpa izin ini tidak ada titik yang bisa dicatat."
            aksi={<Tombol varian="sekunder">Buka pengaturan izin</Tombol>}
          />
        </Penuh>
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
  const p = usePalet();
  /** Isi yang sama dipakai keadaan utama dan offline: kendalinya tidak berubah. */
  const kendali = (
    <>
      {/* Timer adalah instrumen layar ini, jadi ia yang mengambil sisa tinggi.
          Kartu timer yang berhenti di atas daftar yang mengisi sisa layar
          menyisakan pita kosong sepertiga layar di atas bilah aksi. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingInline: ruangAman.sisi,
          paddingBlock: spasi.lg,
        }}
      >
        <Kartu
          aksen={p.utama}
          judul="Sedang merekam"
          keterangan="Jeda menyimpan jejak apa adanya; hentikan menutup rekaman dan menyimpannya."
        >
          <span style={gayaTeks("angka", { bobot: "tebal", mono: true, warna: p.teks })}>00:12:41</span>
        </Kartu>
      </div>
      <Daftar rapat>
        <LabelSeksi>Sesi berjalan</LabelSeksi>
        <BarisDaftar
          ikon={<Route size={sentuh.ikon} />}
          judul="Jarak sementara"
          keterangan="Dihitung dari titik yang sudah tersimpan"
          ujung={<Angka warna={p.teks}>1,24 km</Angka>}
        />
        <BarisDaftar
          ikon={<MapPin size={sentuh.ikon} />}
          judul="Titik"
          keterangan="Satu titik tiap 2 detik"
          ujung={<Angka warna={p.teks}>184</Angka>}
        />
        <BarisDaftar
          ikon={<Gauge size={sentuh.ikon} />}
          judul="Akurasi saat ini"
          keterangan="Diperbarui tiap detik"
          ujung={<LencanaStatus jenis="sukses">± 3,2 m</LencanaStatus>}
        />
        <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
          <SpandukKeadaan jenis="info">
            Hentikan selalu minta konfirmasi, karena jejak yang sudah ditutup tidak bisa disambung lagi.
          </SpandukKeadaan>
        </div>
      </Daftar>
      <BilahBawah>
        <div style={{ display: "flex", gap: spasi.sm }}>
          <div style={{ flex: 1 }}>
            <Tombol lebarPenuh varian="sekunder" ikon={<CirclePause size={sentuh.ikon} />}>
              Jeda
            </Tombol>
          </div>
          <div style={{ flex: 1 }}>
            <Tombol lebarPenuh varian="bahaya" ikon={<CircleStop size={sentuh.ikon} />}>
              Hentikan
            </Tombol>
          </div>
        </div>
      </BilahBawah>
    </>
  );
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Kendali rekaman"
          keterangan="Survei blok C · 184 titik"
          penanda={<LencanaStatus jenis="sukses">Merekam</LencanaStatus>}
        />
        {kendali}
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Kendali rekaman" />
        <Penuh>
          <Kosong
            judul="Belum ada rekaman aktif"
            keterangan="Mulai rekaman baru, atau buka jejak yang sudah tersimpan untuk melanjutkannya."
            ikon={<Timer size={28} aria-hidden="true" />}
            aksi={<Tombol ikon={<Play size={sentuh.ikon} />}>Mulai merekam</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Kendali rekaman" />
        <Penuh>
          <Memuat judul="Menyiapkan rekaman" keterangan="Memeriksa izin lokasi dan menyiapkan berkas jejak baru." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Kendali rekaman" />
        <Penuh>
          <Galat
            judul="Jeda tidak tersimpan"
            keterangan="Status jeda gagal ditulis, jadi rekaman berhenti agar jejak tidak terpotong tanpa catatan."
            rincian="jejak-2026-10-19.json: ENOSPC"
            aksi={<Tombol varian="sekunder">Coba lagi</Tombol>}
          />
        </Penuh>
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Kendali rekaman"
          keterangan="Survei blok C · 184 titik"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        {kendali}
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Kendali rekaman" />
        <Penuh>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Kendali rekaman tidak bisa dimulai tanpa izin lokasi. Izin ini hanya dipakai selama rekaman berjalan."
          />
        </Penuh>
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
        <BilahAtas
          judul="Ringkasan jejak"
          keterangan="Survei blok C · hari ini 08:12"
          penanda={<LencanaStatus jenis="info">Tersimpan</LencanaStatus>}
        />
        <PetaLengkap tinggi={150} skala="200 m">
          <svg
            aria-hidden="true"
            viewBox="0 0 360 200"
            preserveAspectRatio="xMidYMid slice"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            <path d={JEJAK_RINGKAS} fill="none" stroke={p.utama} strokeWidth="4" strokeLinecap="round" />
            <circle cx="74" cy="132" r="6" fill={p.permukaan} stroke={p.utama} strokeWidth="3" />
            <circle cx="262" cy="86" r="7" fill={p.aksen} stroke={p.permukaan} strokeWidth="3" />
          </svg>
        </PetaLengkap>
        <Daftar>
          <LabelSeksi>Angka akhir</LabelSeksi>
          <BarisDaftar
            ikon={<Route size={sentuh.ikon} />}
            judul="Jarak"
            keterangan="Tiga segmen, dihitung antar titik"
            ujung={<Angka warna={p.teks}>1,24 km</Angka>}
          />
          <BarisDaftar
            ikon={<Timer size={sentuh.ikon} />}
            judul="Durasi"
            keterangan="Mulai 08:12 · selesai 08:24"
            ujung={<Angka warna={p.teks}>12:41</Angka>}
          />
          <BarisDaftar
            ikon={<Gauge size={sentuh.ikon} />}
            judul="Kecepatan rata-rata"
            keterangan="Saat bergerak, jeda tidak dihitung"
            ujung={<Angka warna={p.teks}>5,9 km/j</Angka>}
          />
          <BarisDaftar
            ikon={<MapPin size={sentuh.ikon} />}
            judul="Titik"
            keterangan="Tersimpan di perangkat"
            ujung={<Angka warna={p.teks}>184</Angka>}
          />
          <LabelSeksi>Mutu jejak</LabelSeksi>
          <BarisDaftar
            ikon={<ShieldCheck size={sentuh.ikon} />}
            judul="Akurasi rata-rata"
            keterangan="Ambang layak pakai 10 m"
            ujung={<LencanaStatus jenis="sukses">± 3,2 m</LencanaStatus>}
          />
          <BarisDaftar
            ikon={<CircleAlert size={sentuh.ikon} />}
            judul="Titik lemah"
            keterangan="Akurasi di atas 10 m, ditandai bukan dibuang"
            ujung={<LencanaStatus jenis="peringatan">6</LencanaStatus>}
          />
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh varian="sekunder" ikon={<FileDown size={sentuh.ikon} />}>
            Ekspor sebagai GeoJSON
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Ringkasan jejak" />
        <Penuh>
          <Kosong
            judul="Belum ada jejak untuk diringkas"
            keterangan="Ringkasan muncul setelah satu rekaman selesai. Rekaman yang masih berjalan belum punya angka akhir."
            ikon={<Route size={28} aria-hidden="true" />}
            aksi={<Tombol>Rekam jejak baru</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Ringkasan jejak" />
        <Penuh>
          <Memuat
            judul="Menghitung ringkasan"
            keterangan="Menjumlahkan jarak antar titik dan menghitung sebaran akurasi."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Ringkasan jejak" />
        <Penuh>
          <Galat
            judul="Jejak tidak bisa dihitung"
            keterangan="Berkas jejak berisi titik dengan cap waktu yang mundur, jadi durasi tidak bisa dipercaya."
            rincian="titik 57: t=08:04:12 < t-1=08:06:40"
            aksi={<Tombol varian="sekunder">Buka jejak mentah</Tombol>}
          />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Ringkasan jejak">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}
