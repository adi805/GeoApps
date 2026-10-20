/**
 * Komposisi jalur geofence: membuat batas, mengawasinya, dan mempercayai
 * peringatannya.
 *
 * Peringatan masuk/keluar hanya berguna kalau bisa dipercaya, jadi tiap
 * peringatan menyebut akurasi dan waktu. Peringatan tanpa akurasi adalah rumor.
 */

import { Bell, Crosshair, LocateFixed, MapPinned, Plus, ShieldCheck } from "lucide-react";
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
  Peta,
  Tombol,
  gayaTeks,
  usePalet,
} from "../primitives";
import { Galat, IzinDitolak, Kosong, Memuat, Offline, SpandukKeadaan } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { radius, sentuh, spasi } from "../tokens";

export function KomposisiBuatGeofence({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Buat geofence" keterangan="Batas baru · belum disimpan" />
        <Peta tinggi={190}>
          <div
            style={{
              position: "absolute",
              insetBlockStart: "18%",
              insetInlineStart: "22%",
              insetBlockEnd: "20%",
              insetInlineEnd: "24%",
              border: `2px solid ${p.utama}`,
              background: `${p.utama}1A`,
              borderRadius: radius.penuh,
            }}
          />
        </Peta>
        <Isi>
          <Kartu judul="Batas">
            <Bidang label="Radius" nilai="250" satuan="m" mono />
            <Pemisah />
            <Bidang label="Pusat" nilai="-6,914352, 107,609118" mono />
          </Kartu>
          <Kartu judul="Perilaku">
            <div style={{ display: "flex", gap: spasi.xs, flexWrap: "wrap" }}>
              <Chip terpilih>Masuk</Chip>
              <Chip terpilih>Keluar</Chip>
              <Chip>Diam 5 menit</Chip>
            </div>
            <Pemisah />
            <BarisDaftar judul="Beri tahu saat" ujung={<LencanaStatus jenis="info">Masuk &amp; keluar</LencanaStatus>} />
          </Kartu>
          <Tombol lebarPenuh>Simpan geofence</Tombol>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Buat geofence" />
        <Kosong
          judul="Belum ada batas"
          keterangan="Ketuk peta untuk menaruh pusat batas, lalu atur radiusnya. Batas disimpan di proyek ini."
          ikon={<MapPinned size={28} aria-hidden="true" />}
          aksi={<Tombol>Gambar batas</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Buat geofence" />
        <Memuat judul="Menunggu posisi" keterangan="Pusat batas diambil dari posisi perangkat. Kamu juga bisa memilih titik yang sudah ada." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Buat geofence" />
        <Galat
          judul="Radius terlalu kecil"
          keterangan="Batas di bawah 20 m lebih kecil dari galat GPS, jadi peringatannya akan salah terus."
          rincian="radius 8 m (minimum 20 m)"
          aksi={<Tombol varian="sekunder">Perbesar radius</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Buat geofence" />
        <IzinDitolak
          judul="Izin lokasi ditolak"
          keterangan="Geofence butuh lokasi untuk menentukan pusat batas dan mengawasinya nanti."
        />
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
        <BilahAtas judul="Geofence" keterangan="2 aktif dari 3" />
        <Daftar>
          <BarisDaftar
            judul="Blok C"
            keterangan="radius 250 m · 4 peringatan hari ini"
            ujung={<LencanaStatus jenis="sukses">Aktif</LencanaStatus>}
          />
          <BarisDaftar
            judul="Kantor desa"
            keterangan="radius 120 m · 1 peringatan kemarin"
            ujung={<LencanaStatus jenis="sukses">Aktif</LencanaStatus>}
          />
          <BarisDaftar
            judul="Gudang lama"
            keterangan="radius 80 m · tidak ada peringatan"
            ujung={<LencanaStatus jenis="netral">Nonaktif</LencanaStatus>}
          />
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
        <Kosong
          judul="Belum ada geofence"
          keterangan="Batas yang dibuat akan muncul di sini bersama status pengawasannya."
          ikon={<ShieldCheck size={28} aria-hidden="true" />}
          aksi={<Tombol>Buat geofence</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Geofence" />
        <Memuat judul="Memuat geofence" keterangan="Membaca batas tersimpan dan menghitung peringatan terakhir." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Geofence" />
        <Galat
          judul="Satu batas tidak terbaca"
          keterangan="Batas ini memakai format lama yang belum dikenali, jadi pengawasannya dilewati."
          rincian="geofence[2].geometry: versi 1 (diharapkan 2)"
          aksi={<Tombol varian="sekunder">Buat ulang batas</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Geofence" />
        <IzinDitolak judul="Akses penyimpanan ditolak" keterangan="Batas geofence disimpan di proyek perangkat." />
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
        <BilahAtas judul="Peringatan" keterangan="Hari ini · 4 peringatan" />
        <Isi>
          <Kartu
            judul="Masuk Blok C"
            keterangan="08:14 · akurasi ± 4,1 m"
            aksen={p.sukses}
            kaki={<Tombol varian="halus">Buka peta</Tombol>}
          >
            <span style={gayaTeks("kecil", { warna: p.teksLembut })}>Kamu melewati batas dari arah barat daya.</span>
          </Kartu>
          <Kartu
            judul="Keluar Blok C"
            keterangan="07:52 · akurasi ± 3,8 m"
            aksen={p.peringatan}
            kaki={<Tombol varian="halus">Buka peta</Tombol>}
          >
            <span style={gayaTeks("kecil", { warna: p.teksLembut })}>Kamu melewati batas dari arah timur laut.</span>
          </Kartu>
          <SpandukKeadaan jenis="info">
            Peringatan dicatat di perangkat lebih dulu, jadi tetap tercatat saat tidak ada sinyal.
          </SpandukKeadaan>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Peringatan" />
        <Kosong
          judul="Belum ada peringatan"
          keterangan="Peringatan muncul saat kamu melewati batas geofence yang aktif. Tidak ada peringatan berarti belum ada yang dilewati."
          ikon={<Bell size={28} aria-hidden="true" />}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Peringatan" />
        <Memuat judul="Membaca peringatan" keterangan="Mengambil catatan peringatan dari penyimpanan lokal." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Peringatan" />
        <Galat
          judul="Notifikasi tidak terkirim"
          keterangan="Izin notifikasi mati, jadi peringatan hanya tercatat di aplikasi. Catatannya tetap lengkap."
          rincian="notification: permission denied"
          aksi={<Tombol varian="sekunder">Buka pengaturan notifikasi</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Peringatan" />
        <IzinDitolak
          judul="Izin notifikasi ditolak"
          keterangan="Peringatan tetap dicatat, tapi tidak muncul sebagai notifikasi. Aktifkan izin ini kalau ingin diberi tahu saat layar mati."
        />
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
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Rata-rata GPS" keterangan="42 sampel · 60 detik" penanda={<LencanaStatus jenis="sukses">Layak</LencanaStatus>} />
        <Isi>
          <Kartu judul="Hasil">
            <Bidang label="Lintang" nilai="-6,9143521" mono />
            <Pemisah />
            <Bidang label="Bujur" nilai="107,6091184" mono />
            <Pemisah />
            <Bidang label="Sebaran" nilai="± 0,8" satuan="m" mono />
          </Kartu>
          <Kartu judul="Sampel" keterangan="Sebaran ditampilkan supaya kamu bisa menilai sendiri, bukan hanya menerima angka rata-rata.">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 48 }}>
              {[6, 9, 12, 10, 8, 14, 18, 16, 12, 9, 7, 11, 15, 13, 10, 8, 6, 9, 12, 10].map((h, i) => (
                <span
                  key={i}
                  style={{
                    flex: 1,
                    height: h * 2,
                    borderRadius: radius.xs,
                    background: i === 6 ? p.aksen : p.permukaanTinggi,
                  }}
                />
              ))}
            </div>
            <span style={gayaTeks("mikro", { warna: p.teksLembut })}>akurasi per sampel, makin rendah makin baik</span>
          </Kartu>
          <Tombol lebarPenuh ikon={<Crosshair size={sentuh.ikon} />}>
            Pakai koordinat ini
          </Tombol>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Rata-rata GPS" />
        <Kosong
          judul="Belum ada sampel"
          keterangan="Rata-rata GPS memperhalus posisi dengan mengambil banyak bacaan di satu tempat. Berdiri diam selama satu menit."
          ikon={<LocateFixed size={28} aria-hidden="true" />}
          aksi={<Tombol>Mulai mengambil sampel</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Rata-rata GPS" keterangan="18 dari 60 sampel" />
        <Isi>
          <Kartu judul="Mengambil sampel" keterangan="Jangan berpindah tempat sampai selesai; pergerakan membuat sebaran melebar.">
            <Bidang label="Sebaran sementara" nilai="± 1,4" satuan="m" mono />
          </Kartu>
          <SpandukKeadaan jenis="info">Bisa dihentikan kapan saja; hasil memakai sampel yang sudah masuk.</SpandukKeadaan>
        </Isi>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Rata-rata GPS" />
        <Galat
          judul="Sebaran terlalu lebar"
          keterangan="Sampel tersebar lebih dari 15 m, jadi rata-ratanya belum layak dipakai sebagai koordinat tetap."
          rincian="sebaran 22,4 m (batas 15 m)"
          aksi={<Tombol varian="sekunder">Ulangi di tempat terbuka</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Rata-rata GPS" />
        <IzinDitolak
          judul="Izin lokasi ditolak"
          keterangan="Rata-rata GPS butuh bacaan lokasi berulang, dan itu hanya bisa dengan izin lokasi."
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Rata-rata GPS">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}
