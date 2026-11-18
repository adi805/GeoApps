/**
 * Komposisi jalur geofence: membuat batas, mengawasinya, dan mempercayai
 * peringatannya.
 *
 * Bahasa visualnya mengikuti issue 102 dan rujukan `screens/peta.tsx`: bilah
 * atas berpenanda keadaan, label seksi huruf besar, baris berikon dengan nilai
 * di ujung, peta yang membawa skala dan atribusi, dan aksi utama yang menempel
 * di dasar layar. Sebelumnya "Simpan geofence" mengambang di ujung isi yang
 * bisa digulir, daftar geofence hanya garis pemisah tanpa judul seksi dan tanpa
 * kotak ikon, dan peta batas digambar tanpa skala sehingga radiusnya tidak bisa
 * dinilai.
 *
 * Peringatan masuk/keluar hanya berguna kalau bisa dipercaya, jadi tiap baris
 * peringatan menyebut waktu dan akurasi. Peringatan tanpa akurasi adalah rumor.
 */

import { Bell, Crosshair, LogIn, LogOut, MapPinned, Plus, ShieldCheck, Timer } from "lucide-react";
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
  LabelSeksi,
  LencanaStatus,
  Pemisah,
  Penuh,
  Tombol,
  gayaLabel,
  gayaTeks,
  usePalet,
} from "../primitives";
import { PetaBatas } from "./geofence-peta";
import { Galat, IzinDitolak, Kosong, Memuat, SpandukKeadaan } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { radius, sentuh, spasi } from "../tokens";


export function KomposisiBuatGeofence({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Buat geofence"
          keterangan="Batas baru · radius 250 m"
          penanda={<LencanaStatus jenis="peringatan">Belum disimpan</LencanaStatus>}
        />
        <PetaBatas tinggi={190} skala="250 m" label="Radius 250 m" warna={p.utama} aksen={p.aksen} />
        <Isi>
          <Kartu judul="Batas" keterangan="Batas disimpan di proyek ini dan diawasi dari perangkat.">
            <Bidang label="Radius" nilai="250" satuan="m" mono />
            <div style={{ display: "flex", gap: spasi.xs, flexWrap: "wrap" }}>
              {["50", "100", "250", "500"].map((nilai) => (
                <Chip key={nilai} terpilih={nilai === "250"}>
                  {nilai} m
                </Chip>
              ))}
            </div>
            <Pemisah />
            <Bidang label="Pusat batas" nilai="-6,914352, 107,609118" satuan="dari GPS" mono />
          </Kartu>
          <Kartu judul="Perilaku" keterangan="Peringatan hanya dikirim untuk kejadian yang dipilih.">
            <BarisDaftar
              ikon={<LogIn size={sentuh.ikon} />}
              judul="Masuk batas"
              keterangan="Sekali saat pertama kali masuk"
              ujung={<LencanaStatus jenis="sukses">Beri tahu</LencanaStatus>}
            />
            <BarisDaftar
              ikon={<LogOut size={sentuh.ikon} />}
              judul="Keluar batas"
              keterangan="Sekali saat meninggalkan batas"
              ujung={<LencanaStatus jenis="sukses">Beri tahu</LencanaStatus>}
            />
            <BarisDaftar
              ikon={<Timer size={sentuh.ikon} />}
              judul="Diam di dalam"
              keterangan="Beri tahu setelah 5 menit diam"
              ujung={<LencanaStatus jenis="netral">Mati</LencanaStatus>}
            />
          </Kartu>
        </Isi>
        <BilahBawah>
          <Tombol varian="sekunder" lebarPenuh>
            Batal
          </Tombol>
          <Tombol lebarPenuh ikon={<ShieldCheck size={sentuh.ikon} />}>
            Simpan geofence
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Buat geofence" />
        <Penuh>
          <Kosong
            judul="Belum ada batas"
            keterangan="Ketuk peta untuk menaruh pusat batas, lalu atur radiusnya. Batas disimpan di proyek ini."
            ikon={<MapPinned size={28} aria-hidden="true" />}
            aksi={<Tombol>Gambar batas</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Buat geofence" />
        <Penuh>
          <Memuat
            judul="Menunggu posisi"
            keterangan="Pusat batas diambil dari posisi perangkat. Kamu juga bisa memilih titik yang sudah ada."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Buat geofence" />
        <Penuh>
          <Galat
            judul="Radius terlalu kecil"
            keterangan="Batas di bawah 20 m lebih kecil dari galat GPS, jadi peringatannya akan salah terus."
            rincian="radius 8 m (minimum 20 m)"
            aksi={<Tombol varian="sekunder">Perbesar radius</Tombol>}
          />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Buat geofence" />
        <Penuh>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Geofence butuh lokasi untuk menentukan pusat batas dan mengawasinya nanti."
          />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Buat geofence">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiDaftarGeofence({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Geofence"
          keterangan="3 batas · 2 aktif"
          penanda={<LencanaStatus jenis="sukses">Pengawasan aktif</LencanaStatus>}
        />
        <Daftar>
          <LabelSeksi>Aktif</LabelSeksi>
          <BarisDaftar
            ikon={<ShieldCheck size={sentuh.ikon} />}
            judul="Blok C"
            keterangan="Radius 250 m · 4 peringatan hari ini"
            ujung={<LencanaStatus jenis="sukses">Aktif</LencanaStatus>}
          />
          <BarisDaftar
            ikon={<MapPinned size={sentuh.ikon} />}
            judul="Kantor desa"
            keterangan="Radius 120 m · 1 peringatan kemarin"
            ujung={<LencanaStatus jenis="sukses">Aktif</LencanaStatus>}
          />
          <LabelSeksi>Nonaktif</LabelSeksi>
          <BarisDaftar
            ikon={<MapPinned size={sentuh.ikon} />}
            judul="Gudang lama"
            keterangan="Radius 80 m · tidak ada peringatan"
            ujung={<LencanaStatus jenis="netral">Nonaktif</LencanaStatus>}
          />
          <div style={{ paddingInline: spasi.lg, paddingBlock: spasi.lg }}>
            <Kartu
              judul="Pengawasan"
              keterangan="Batas diawasi dari perangkat; tidak ada data batas yang dikirim ke server."
            >
              <BarisDaftar
                judul="Izin lokasi latar belakang"
                keterangan="Batas tetap diawasi walau layar mati"
                ujung={<LencanaStatus jenis="sukses">Selalu</LencanaStatus>}
              />
              <BarisDaftar
                judul="Akurasi minimum"
                keterangan="Posisi yang lebih kasar dari ini diabaikan"
                ujung={<LencanaStatus jenis="netral">100 m</LencanaStatus>}
              />
            </Kartu>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Plus size={sentuh.ikon} />}>
            Buat geofence
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Geofence" />
        <Penuh>
          <Kosong
            judul="Belum ada geofence"
            keterangan="Batas yang dibuat akan muncul di sini bersama status pengawasannya."
            ikon={<ShieldCheck size={28} aria-hidden="true" />}
            aksi={<Tombol>Buat geofence</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Geofence" />
        <Penuh>
          <Memuat judul="Memuat geofence" keterangan="Membaca batas tersimpan dan menghitung peringatan terakhir." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Geofence" />
        <Penuh>
          <Galat
            judul="Satu batas tidak terbaca"
            keterangan="Batas ini memakai format lama yang belum dikenali, jadi pengawasannya dilewati."
            rincian="geofence[2].geometry: versi 1 (diharapkan 2)"
            aksi={<Tombol varian="sekunder">Buat ulang batas</Tombol>}
          />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Geofence" />
        <Penuh>
          <IzinDitolak judul="Akses penyimpanan ditolak" keterangan="Batas geofence disimpan di proyek perangkat." />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Daftar geofence">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiPeringatanMasukKeluar({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Peringatan"
          keterangan="Hari ini · 4 peringatan"
          penanda={<LencanaStatus jenis="info">4 baru</LencanaStatus>}
        />
        <Daftar>
          <LabelSeksi>Hari ini</LabelSeksi>
          <BarisDaftar
            ikon={<LogIn size={sentuh.ikon} />}
            judul="Masuk Blok C"
            keterangan="08:14 · akurasi ± 4,1 m · dari barat daya"
            ujung={<LencanaStatus jenis="sukses">Masuk</LencanaStatus>}
          />
          <BarisDaftar
            ikon={<LogOut size={sentuh.ikon} />}
            judul="Keluar Blok C"
            keterangan="07:52 · akurasi ± 3,8 m · dari timur laut"
            ujung={<LencanaStatus jenis="peringatan">Keluar</LencanaStatus>}
          />
          <BarisDaftar
            ikon={<LogIn size={sentuh.ikon} />}
            judul="Masuk Kantor desa"
            keterangan="07:10 · akurasi ± 5,2 m · dari jalan utama"
            ujung={<LencanaStatus jenis="sukses">Masuk</LencanaStatus>}
          />
          <LabelSeksi>Kemarin</LabelSeksi>
          <BarisDaftar
            ikon={<LogOut size={sentuh.ikon} />}
            judul="Keluar Kantor desa"
            keterangan="16:20 · akurasi ± 4,6 m · dari arah sawah"
            ujung={<LencanaStatus jenis="peringatan">Keluar</LencanaStatus>}
          />
          <div style={{ paddingInline: spasi.lg, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="info">
              Peringatan dicatat di perangkat lebih dulu, jadi tetap tercatat saat tidak ada sinyal.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol varian="sekunder" lebarPenuh ikon={<Bell size={sentuh.ikon} />}>
            Atur notifikasi
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Peringatan" />
        <Penuh>
          <Kosong
            judul="Belum ada peringatan"
            keterangan="Peringatan muncul saat kamu melewati batas geofence yang aktif. Tidak ada peringatan berarti belum ada yang dilewati."
            ikon={<Bell size={28} aria-hidden="true" />}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Peringatan" />
        <Penuh>
          <Memuat judul="Membaca peringatan" keterangan="Mengambil catatan peringatan dari penyimpanan lokal." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Peringatan" />
        <Penuh>
          <Galat
            judul="Notifikasi tidak terkirim"
            keterangan="Izin notifikasi mati, jadi peringatan hanya tercatat di aplikasi. Catatannya tetap lengkap."
            rincian="notification: permission denied"
            aksi={<Tombol varian="sekunder">Buka pengaturan notifikasi</Tombol>}
          />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Peringatan" />
        <Penuh>
          <IzinDitolak
            judul="Izin notifikasi ditolak"
            keterangan="Peringatan tetap dicatat, tapi tidak muncul sebagai notifikasi. Aktifkan izin ini kalau ingin diberi tahu saat layar mati."
          />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Peringatan masuk keluar">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiGpsAveraging({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  /** Akurasi tiap sampel dalam desimeter; satu batang ditandai sebagai terbaik. */
  const sampel = [6, 9, 12, 10, 8, 14, 18, 16, 12, 9, 7, 11, 15, 13, 10, 8, 6, 9, 12, 10];
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Rata-rata GPS"
          keterangan="42 sampel · 60 detik"
          penanda={<LencanaStatus jenis="sukses">Layak</LencanaStatus>}
        />
        <PetaBatas tinggi={170} skala="10 m" label="Sebaran ± 0,8 m" warna={p.utama} aksen={p.aksen} />
        <Isi>
          <Kartu judul="Hasil" keterangan="Rata-rata dari seluruh sampel yang masuk, bukan satu bacaan.">
            <Bidang label="Lintang" nilai="-6,9143521" mono />
            <Pemisah />
            <Bidang label="Bujur" nilai="107,6091184" mono />
            <Pemisah />
            <Bidang label="Sebaran" nilai="± 0,8" satuan="m" mono />
            <BilahKemajuan nilai={92} label="Mutu titik hasil perataan" />
          </Kartu>
          <Kartu
            judul="Sampel"
            keterangan="Sebaran ditampilkan supaya kamu bisa menilai sendiri, bukan hanya menerima angka rata-rata."
          >
            <span style={gayaLabel(p.teksLembut)}>Akurasi per sampel</span>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 48 }}>
              {sampel.map((tinggi, i) => (
                <span
                  key={i}
                  style={{
                    flex: 1,
                    height: tinggi * 2,
                    borderRadius: radius.xs,
                    background: i === 6 ? p.aksen : p.permukaanTinggi,
                  }}
                />
              ))}
            </div>
            <span style={gayaTeks("mikro", { warna: p.teksLembut })}>
              makin rendah makin baik · sampel terbaik ditandai
            </span>
          </Kartu>
        </Isi>
        <BilahBawah>
          <Tombol varian="sekunder" lebarPenuh ikon={<Timer size={sentuh.ikon} />}>
            Ulangi
          </Tombol>
          <Tombol lebarPenuh ikon={<Crosshair size={sentuh.ikon} />}>
            Pakai koordinat ini
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Rata-rata GPS" />
        <Penuh>
          <Kosong
            judul="Belum ada sampel"
            keterangan="Rata-rata GPS memperhalus posisi dengan mengambil banyak bacaan di satu tempat. Berdiri diam selama satu menit."
            ikon={<MapPinned size={28} aria-hidden="true" />}
            aksi={<Tombol>Mulai mengambil sampel</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Rata-rata GPS" keterangan="18 dari 60 sampel" />
        <Penuh>
          <Memuat
            judul="Mengambil sampel"
            keterangan="Jangan berpindah tempat sampai selesai; pergerakan membuat sebaran melebar."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Rata-rata GPS" />
        <Penuh>
          <Galat
            judul="Sebaran terlalu lebar"
            keterangan="Sampel tersebar lebih dari 15 m, jadi rata-ratanya belum layak dipakai sebagai koordinat tetap."
            rincian="sebaran 22,4 m (batas 15 m)"
            aksi={<Tombol varian="sekunder">Ulangi di tempat terbuka</Tombol>}
          />
        </Penuh>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Rata-rata GPS" />
        <Penuh>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Rata-rata GPS butuh bacaan lokasi berulang, dan itu hanya bisa dengan izin lokasi."
          />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Rata-rata GPS">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}


