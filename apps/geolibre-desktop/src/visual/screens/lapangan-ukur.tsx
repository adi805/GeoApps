/**
 * Komposisi jalur lapangan: mengukur, membaca koordinat, menyalinnya.
 *
 * Angka di sini dipakai untuk keputusan lapangan, jadi satuan, ketelitian, dan
 * asal angkanya selalu disebut. Nilai yang belum ada ditulis sebagai tanda
 * hubung, tidak pernah dikarang.
 */

import { Copy, Crosshair, Ruler, ScanLine } from "lucide-react";
import {
  BarisDaftar,
  BilahAtas,
  Bidang,
  Chip,
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

export function KomposisiUkurJarak({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Ukur jarak" keterangan="3 segmen · total 248,6 m" />
        <Peta tinggi={190}>
          <svg width="100%" height="100%" viewBox="0 0 360 190" aria-hidden="true">
            <path d="M48 148 L142 108 L236 124 L302 70" fill="none" stroke={p.aksen} strokeWidth="3" strokeDasharray="8 6" />
            {[
              [48, 148],
              [142, 108],
              [236, 124],
              [302, 70],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill={p.permukaan} stroke={p.aksen} strokeWidth="3" />
            ))}
          </svg>
        </Peta>
        <Isi>
          <Kartu>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={gayaTeks("badan", { warna: p.teksLembut })}>Total</span>
              <span style={gayaTeks("angka", { bobot: "tebal", warna: p.teks, mono: true })}>248,6 m</span>
            </div>
            <Pemisah />
            <BarisDaftar judul="Segmen 1" ujung={<span style={gayaTeks("badan", { mono: true, warna: p.teks })}>94,2 m</span>} />
            <BarisDaftar judul="Segmen 2" ujung={<span style={gayaTeks("badan", { mono: true, warna: p.teks })}>96,1 m</span>} />
            <BarisDaftar judul="Segmen 3" ujung={<span style={gayaTeks("badan", { mono: true, warna: p.teks })}>58,3 m</span>} />
          </Kartu>
          <SpandukKeadaan jenis="info">Jarak dihitung di bidang datar pada ketinggian yang sama, bukan jarak lereng.</SpandukKeadaan>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Ukur jarak" />
        <Kosong
          judul="Belum ada titik ukur"
          keterangan="Ketuk peta untuk menaruh titik pertama, lalu titik berikutnya. Jarak dihitung saat titik kedua ada."
          ikon={<Ruler size={28} aria-hidden="true" />}
          aksi={<Tombol>Tambah titik ukur</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Ukur jarak" />
        <Memuat judul="Menunggu posisi" keterangan="Titik pertama diambil dari GPS. Setelah terkunci, titik berikutnya bisa diketuk di peta." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Ukur jarak" />
        <Galat
          judul="Titik terlalu berdekatan"
          keterangan="Dua titik berjarak di bawah 0,5 m, jadi segmen ini tidak dihitung agar tidak menambah galat."
          rincian="segmen 4: 0,12 m (minimum 0,5 m)"
          aksi={<Tombol varian="sekunder">Hapus titik terakhir</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Ukur jarak" />
        <IzinDitolak
          judul="Izin lokasi ditolak"
          keterangan="Titik pertama butuh posisi perangkat. Tanpa izin, pengukuran hanya bisa dari titik yang sudah ada di peta."
          aksi={<Tombol varian="sekunder">Pakai titik yang ada</Tombol>}
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Ukur jarak">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiUkurLuas({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Ukur luas" keterangan="Bidang 4 titik" />
        <Peta tinggi={190}>
          <svg width="100%" height="100%" viewBox="0 0 360 190" aria-hidden="true">
            <path d="M60 140 L150 62 L262 88 L300 152 Z" fill={p.aksen} fillOpacity="0.22" stroke={p.aksen} strokeWidth="3" />
          </svg>
        </Peta>
        <Isi>
          <Kartu>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={gayaTeks("badan", { warna: p.teksLembut })}>Luas</span>
              <span style={gayaTeks("angka", { bobot: "tebal", warna: p.teks, mono: true })}>0,42 ha</span>
            </div>
            <Pemisah />
            <BarisDaftar judul="Keliling" ujung={<span style={gayaTeks("badan", { mono: true, warna: p.teks })}>268,4 m</span>} />
            <BarisDaftar judul="Titik" ujung={<span style={gayaTeks("badan", { mono: true, warna: p.teks })}>4</span>} />
          </Kartu>
          <SpandukKeadaan jenis="info">Luas dihitung dengan rumus bidang datar; pada bidang miring hasilnya sedikit lebih kecil.</SpandukKeadaan>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Ukur luas" />
        <Kosong
          judul="Belum ada bidang"
          keterangan="Luas baru bisa dihitung setelah tiga titik. Ketuk peta untuk mulai menggambar batas."
          ikon={<ScanLine size={28} aria-hidden="true" />}
          aksi={<Tombol>Mulai menggambar</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Ukur luas" />
        <Memuat judul="Menghitung luas" keterangan="Menyusun titik menurut urutan gambar dan memeriksa bidang yang menyilang." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Ukur luas" />
        <Galat
          judul="Bidang menyilang dirinya sendiri"
          keterangan="Batas yang digambar berpotongan, jadi luasnya tidak bisa dihitung. Titik yang bermasalah sudah ditandai di peta."
          rincian="self-intersection di segmen 3–5"
          aksi={<Tombol varian="sekunder">Perbaiki batas</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Ukur luas" />
        <IzinDitolak
          judul="Izin lokasi ditolak"
          keterangan="Menggambar bidang dari posisi perangkat butuh izin lokasi. Menggambar manual di peta tetap bisa."
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Ukur luas">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiBacaKoordinat({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Koordinat" keterangan="Diperbarui 2 detik lalu" penanda={<LencanaStatus jenis="sukses">± 3,2 m</LencanaStatus>} />
        <Peta tinggi={170}>
          <div
            style={{
              position: "absolute",
              insetBlockStart: "50%",
              insetInlineStart: "50%",
              transform: "translate(-50%, -50%)",
              color: p.aksen,
            }}
          >
            <Crosshair size={sentuh.ikon + 8} aria-hidden="true" />
          </div>
        </Peta>
        <Isi>
          <Kartu judul="Derajat desimal">
            <Bidang label="Lintang" nilai="-6,914352" mono />
            <Pemisah />
            <Bidang label="Bujur" nilai="107,609118" mono />
          </Kartu>
          <Kartu judul="Derajat menit detik">
            <Bidang label="Lintang" nilai="6° 54′ 51,7″ S" mono />
            <Pemisah />
            <Bidang label="Bujur" nilai="107° 36′ 32,8″ E" mono />
          </Kartu>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Koordinat" />
        <Kosong
          judul="Posisi belum terbaca"
          keterangan="Nilai ditampilkan sebagai tanda hubung sampai GPS memberi satu posisi. Angka kosong tidak diisi tebakan."
          ikon={<Crosshair size={28} aria-hidden="true" />}
          aksi={<Tombol varian="sekunder">Buka peta</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Koordinat" />
        <Memuat judul="Mencari sinyal" keterangan="Akurasi membaik selama beberapa detik pertama. Tunggu sampai di bawah 10 m sebelum mencatat." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Koordinat" />
        <Galat
          judul="Posisi tidak stabil"
          keterangan="Perangkat melaporkan lompatan lebih dari 200 m dalam 3 detik, jadi nilai ini tidak dipakai."
          rincian="akurasi 412 m · lompatan 3 detik"
          aksi={<Tombol varian="sekunder">Ulangi pembacaan</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Koordinat" />
        <IzinDitolak
          judul="Izin lokasi ditolak"
          keterangan="Pembacaan koordinat butuh izin lokasi. Tanpa izin, hanya koordinat titik yang sudah tersimpan yang bisa dibaca."
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Baca koordinat">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}

export function KomposisiSalinKoordinat({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Salin koordinat" keterangan="Sumur bor 04" />
        <Isi>
          <Kartu judul="Format salinan" keterangan="Tiap alat lapangan memakai format berbeda; pilih yang cocok sebelum menyalin.">
            <div style={{ display: "flex", gap: spasi.xs, flexWrap: "wrap" }}>
              <Chip terpilih>Desimal</Chip>
              <Chip>DMS</Chip>
              <Chip>UTM</Chip>
              <Chip>GeoJSON</Chip>
            </div>
          </Kartu>
          <Kartu judul="Teks yang disalin">
            <code
              style={{
                ...gayaTeks("badan", { mono: true, warna: p.teks }),
                display: "block",
                padding: spasi.md,
                background: p.permukaanTinggi,
                borderRadius: 10,
                overflowWrap: "anywhere",
              }}
            >
              -6.914352, 107.609118
            </code>
          </Kartu>
          <Tombol lebarPenuh ikon={<Copy size={sentuh.ikon} />}>
            Salin
          </Tombol>
        </Isi>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Salin koordinat" />
        <Kosong
          judul="Belum ada koordinat"
          keterangan="Tombol salin baru aktif setelah ada titik yang dipilih. Menyalin teks kosong tidak berguna di alat lain."
          ikon={<Copy size={28} aria-hidden="true" />}
          aksi={<Tombol nonaktif>Salin</Tombol>}
        />
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Salin koordinat" />
        <Memuat judul="Menyiapkan teks" keterangan="Mengubah koordinat ke format yang dipilih." />
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Salin koordinat" />
        <Galat
          judul="Papan klip menolak akses"
          keterangan="Aplikasi lain sedang memegang papan klip. Teks di bawah tetap bisa dipilih dan disalin manual."
          rincian="clipboard: NotAllowedError"
          aksi={<Tombol varian="sekunder">Pilih teks manual</Tombol>}
        />
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Salin koordinat" />
        <IzinDitolak
          judul="Izin papan klip ditolak"
          keterangan="Menyalin butuh izin papan klip. Teksnya tetap ditampilkan supaya bisa disalin manual."
        />
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Salin koordinat">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}
