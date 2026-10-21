/**
 * Komposisi jalur lapangan: mengukur, membaca koordinat, menyalinnya.
 *
 * Angka di sini dipakai untuk keputusan lapangan, jadi satuan, ketelitian, dan
 * asal angkanya selalu disebut. Nilai yang belum ada ditulis sebagai tanda
 * hubung, tidak pernah dikarang.
 *
 * Bahasa visualnya mengikuti issue 102 dan rujukan `screens/peta.tsx`: peta
 * membawa skala dan atribusi, hasil ukur dibaca sebagai baris berikon dengan
 * nilai mono di ujung, dan aksi utama menempel di dasar layar. Sebelumnya peta
 * tanpa skala, tombol aksi mengapung di tengah isi, dan keadaan kosong berhenti
 * di tengah layar.
 */

import { Copy, Crosshair, History, MapPin, Plus, Route, Ruler, ScanLine } from "lucide-react";
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
import { Galat, IzinDitolak, Kosong, Memuat, Offline, SpandukKeadaan } from "../states";
import { Bingkai, pilih, type Varian } from "../keadaan";
import { radius, ruangAman, sentuh, spasi } from "../tokens";

/** Nilai ukur di ujung baris: mono, karena dibandingkan digit per digit. */
function Ukuran({ children, warna }: { children: string; warna: string }) {
  return <span style={gayaTeks("badan", { mono: true, bobot: "tebal", warna })}>{children}</span>;
}

/** Titik sudut pengukuran di atas kanvas. */
function Sudut({ x, y, warna, permukaan }: { x: number; y: number; warna: string; permukaan: string }) {
  return <circle cx={x} cy={y} r="6" fill={permukaan} stroke={warna} strokeWidth="3" />;
}

export function KomposisiUkurJarak({ keadaan = "utama", ...varian }: Varian) {
  const p = usePalet();
  /** Ruas ukur dipakai keadaan utama dan offline: geometrinya tidak berubah. */
  const ruas = (
    <PetaLengkap skala="100 m">
      <svg
        aria-hidden="true"
        viewBox="0 0 360 400"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <path
          d="M48 304 L142 220 L236 256 L302 148"
          fill="none"
          stroke={p.aksen}
          strokeWidth="3"
          strokeDasharray="8 6"
        />
        <Sudut x={48} y={304} warna={p.aksen} permukaan={p.permukaan} />
        <Sudut x={142} y={220} warna={p.aksen} permukaan={p.permukaan} />
        <Sudut x={236} y={256} warna={p.aksen} permukaan={p.permukaan} />
        <Sudut x={302} y={148} warna={p.aksen} permukaan={p.permukaan} />
      </svg>
    </PetaLengkap>
  );
  const segmen = (
    <>
      <LabelSeksi>Segmen</LabelSeksi>
      <BarisDaftar
        ikon={<Ruler size={sentuh.ikon} />}
        judul="Segmen 1"
        keterangan="Titik 1 ke titik 2"
        ujung={<Ukuran warna={p.teks}>94,2 m</Ukuran>}
      />
      <BarisDaftar
        ikon={<Ruler size={sentuh.ikon} />}
        judul="Segmen 2"
        keterangan="Titik 2 ke titik 3"
        ujung={<Ukuran warna={p.teks}>96,1 m</Ukuran>}
      />
      <BarisDaftar
        ikon={<Ruler size={sentuh.ikon} />}
        judul="Segmen 3"
        keterangan="Titik 3 ke titik 4"
        ujung={<Ukuran warna={p.teks}>58,3 m</Ukuran>}
      />
      <LabelSeksi>Total</LabelSeksi>
      <BarisDaftar
        ikon={<Route size={sentuh.ikon} />}
        judul="Panjang total"
        keterangan="Jumlah tiga segmen"
        ujung={<LencanaStatus jenis="sukses">248,6 m</LencanaStatus>}
      />
    </>
  );
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Ukur jarak"
          keterangan="3 segmen · total 248,6 m"
          penanda={<LencanaStatus jenis="info">Bidang datar</LencanaStatus>}
        />
        {ruas}
        <Daftar rapat>
          {segmen}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="info">
              Jarak dihitung di bidang datar pada ketinggian yang sama, bukan jarak lereng.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Plus size={sentuh.ikon} />}>
            Tambah titik ukur
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Ukur jarak" />
        <Penuh>
          <Kosong
            judul="Belum ada titik ukur"
            keterangan="Ketuk peta untuk menaruh titik pertama, lalu titik berikutnya. Jarak dihitung saat titik kedua ada."
            ikon={<Ruler size={28} aria-hidden="true" />}
            aksi={<Tombol>Tambah titik ukur</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Ukur jarak" />
        <Penuh>
          <Memuat
            judul="Menunggu posisi"
            keterangan="Titik pertama diambil dari GPS. Setelah terkunci, titik berikutnya bisa diketuk di peta."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Ukur jarak" />
        <Penuh>
          <Galat
            judul="Titik terlalu berdekatan"
            keterangan="Dua titik berjarak di bawah 0,5 m, jadi segmen ini tidak dihitung agar tidak menambah galat."
            rincian="segmen 4: 0,12 m (minimum 0,5 m)"
            aksi={<Tombol varian="sekunder">Hapus titik terakhir</Tombol>}
          />
        </Penuh>
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Ukur jarak"
          keterangan="3 segmen · total 248,6 m"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        {ruas}
        <Daftar rapat>
          {segmen}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="offline">
              Pengukuran memakai posisi perangkat, bukan layanan peta daring, jadi tetap jalan tanpa jaringan.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Plus size={sentuh.ikon} />}>
            Tambah titik ukur
          </Tombol>
        </BilahBawah>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Ukur jarak" />
        <Penuh>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Titik pertama butuh posisi perangkat. Tanpa izin, pengukuran hanya bisa dari titik yang sudah ada di peta."
            aksi={<Tombol varian="sekunder">Pakai titik yang ada</Tombol>}
          />
        </Penuh>
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
  /** Bidang dan hasilnya dipakai keadaan utama dan offline. */
  const bidang = (
    <PetaLengkap skala="100 m">
      <svg
        aria-hidden="true"
        viewBox="0 0 360 400"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        {/* Poligon digambar di kanvas yang sama dengan titik sudutnya. Memakai
            `bidang` dari primitives akan menaruh poligon di kanvas 360x260,
            sehingga sisinya tidak lagi melewati titik yang jadi alasannya. */}
        <polygon
          points="60,280 150,124 262,176 300,304"
          fill={p.aksen}
          fillOpacity="0.16"
          stroke={p.aksen}
          strokeWidth="2"
          strokeDasharray="7 5"
          strokeLinejoin="round"
        />
        <Sudut x={60} y={280} warna={p.aksen} permukaan={p.permukaan} />
        <Sudut x={150} y={124} warna={p.aksen} permukaan={p.permukaan} />
        <Sudut x={262} y={176} warna={p.aksen} permukaan={p.permukaan} />
        <Sudut x={300} y={304} warna={p.aksen} permukaan={p.permukaan} />
      </svg>
    </PetaLengkap>
  );
  const hasil = (
    <>
      <LabelSeksi>Hasil</LabelSeksi>
      <BarisDaftar
        ikon={<ScanLine size={sentuh.ikon} />}
        judul="Luas"
        keterangan="Rumus bidang datar dari empat titik"
        ujung={<LencanaStatus jenis="sukses">0,42 ha</LencanaStatus>}
      />
      <BarisDaftar
        ikon={<Ruler size={sentuh.ikon} />}
        judul="Keliling"
        keterangan="Jumlah sisi terluar bidang"
        ujung={<Ukuran warna={p.teks}>268,4 m</Ukuran>}
      />
      <BarisDaftar
        ikon={<MapPin size={sentuh.ikon} />}
        judul="Titik batas"
        keterangan="Minimal tiga titik untuk menghitung luas"
        ujung={<Ukuran warna={p.teks}>4</Ukuran>}
      />
    </>
  );
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Ukur luas"
          keterangan="Bidang 4 titik"
          penanda={<LencanaStatus jenis="info">Tertutup</LencanaStatus>}
        />
        {bidang}
        <Daftar rapat>
          {hasil}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="info">
              Luas dihitung dengan rumus bidang datar; pada bidang miring hasilnya sedikit lebih kecil.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Plus size={sentuh.ikon} />}>
            Tambah titik batas
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Ukur luas" />
        <Penuh>
          <Kosong
            judul="Belum ada bidang"
            keterangan="Luas baru bisa dihitung setelah tiga titik. Ketuk peta untuk mulai menggambar batas."
            ikon={<ScanLine size={28} aria-hidden="true" />}
            aksi={<Tombol>Mulai menggambar</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Ukur luas" />
        <Penuh>
          <Memuat
            judul="Menghitung luas"
            keterangan="Menyusun titik menurut urutan gambar dan memeriksa bidang yang menyilang."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Ukur luas" />
        <Penuh>
          <Galat
            judul="Bidang menyilang dirinya sendiri"
            keterangan="Batas yang digambar berpotongan, jadi luasnya tidak bisa dihitung. Titik yang bermasalah sudah ditandai di peta."
            rincian="self-intersection di segmen 3–5"
            aksi={<Tombol varian="sekunder">Perbaiki batas</Tombol>}
          />
        </Penuh>
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Ukur luas"
          keterangan="Bidang 4 titik"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        {bidang}
        <Daftar rapat>
          {hasil}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="offline">
              Perhitungan luas berjalan lokal dari koordinat yang sudah ada, jadi tidak menunggu jaringan.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Plus size={sentuh.ikon} />}>
            Tambah titik batas
          </Tombol>
        </BilahBawah>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Ukur luas" />
        <Penuh>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Menggambar bidang dari posisi perangkat butuh izin lokasi. Menggambar manual di peta tetap bisa."
          />
        </Penuh>
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
  /** Peta dan kedua format koordinat dipakai keadaan utama dan offline. */
  const posisi = (
    <>
      <PetaLengkap tinggi={180} skala="50 m">
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            insetBlockStart: "50%",
            insetInlineStart: "50%",
            transform: "translate(-50%, -50%)",
            color: p.aksen,
          }}
        >
          <Crosshair size={sentuh.ikon + 8} />
        </span>
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
          GPS perangkat
        </span>
      </PetaLengkap>
      <Daftar>
        <LabelSeksi>Derajat desimal</LabelSeksi>
        <BarisDaftar
          ikon={<Crosshair size={sentuh.ikon} />}
          judul="Lintang"
          keterangan="Enam angka di belakang koma"
          ujung={<Ukuran warna={p.teks}>-6,914352</Ukuran>}
        />
        <BarisDaftar
          ikon={<Crosshair size={sentuh.ikon} />}
          judul="Bujur"
          keterangan="Enam angka di belakang koma"
          ujung={<Ukuran warna={p.teks}>107,609118</Ukuran>}
        />
        <LabelSeksi>Derajat menit detik</LabelSeksi>
        <BarisDaftar
          ikon={<Crosshair size={sentuh.ikon} />}
          judul="Lintang"
          keterangan="Format yang dipakai alat survei"
          ujung={<Ukuran warna={p.teks}>6° 54′ 51,7″ S</Ukuran>}
        />
        <BarisDaftar
          ikon={<Crosshair size={sentuh.ikon} />}
          judul="Bujur"
          keterangan="Format yang dipakai alat survei"
          ujung={<Ukuran warna={p.teks}>107° 36′ 32,8″ E</Ukuran>}
        />
        <LabelSeksi>Ketelitian</LabelSeksi>
        <BarisDaftar
          ikon={<MapPin size={sentuh.ikon} />}
          judul="Akurasi"
          keterangan="Ambang catat 10 m"
          ujung={<LencanaStatus jenis="sukses">± 3,2 m</LencanaStatus>}
        />
        <BarisDaftar
          ikon={<Route size={sentuh.ikon} />}
          judul="Diperbarui"
          keterangan="Posisi bergerak, angka ikut berubah"
          ujung={<Ukuran warna={p.teks}>2 dtk lalu</Ukuran>}
        />
      </Daftar>
    </>
  );
  const isi = {
    utama: (
      <>
        <BilahAtas
          judul="Koordinat"
          keterangan="Posisi perangkat saat ini"
          penanda={<LencanaStatus jenis="sukses">± 3,2 m</LencanaStatus>}
        />
        {posisi}
        <BilahBawah>
          <Tombol lebarPenuh ikon={<MapPin size={sentuh.ikon} />}>
            Tandai titik di sini
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Koordinat" />
        <Penuh>
          <Kosong
            judul="Posisi belum terbaca"
            keterangan="Nilai ditampilkan sebagai tanda hubung sampai GPS memberi satu posisi. Angka kosong tidak diisi tebakan."
            ikon={<Crosshair size={28} aria-hidden="true" />}
            aksi={<Tombol varian="sekunder">Buka peta</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Koordinat" />
        <Penuh>
          <Memuat
            judul="Mencari sinyal"
            keterangan="Akurasi membaik selama beberapa detik pertama. Tunggu sampai di bawah 10 m sebelum mencatat."
          />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Koordinat" />
        <Penuh>
          <Galat
            judul="Posisi tidak stabil"
            keterangan="Perangkat melaporkan lompatan lebih dari 200 m dalam 3 detik, jadi nilai ini tidak dipakai."
            rincian="akurasi 412 m · lompatan 3 detik"
            aksi={<Tombol varian="sekunder">Ulangi pembacaan</Tombol>}
          />
        </Penuh>
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Koordinat"
          keterangan="Posisi perangkat saat ini"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        {posisi}
        <BilahBawah>
          <Tombol lebarPenuh ikon={<MapPin size={sentuh.ikon} />}>
            Tandai titik di sini
          </Tombol>
        </BilahBawah>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Koordinat" />
        <Penuh>
          <IzinDitolak
            judul="Izin lokasi ditolak"
            keterangan="Pembacaan koordinat butuh izin lokasi. Tanpa izin, hanya koordinat titik yang sudah tersimpan yang bisa dibaca."
          />
        </Penuh>
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
  const format = ["Desimal", "DMS", "UTM", "GeoJSON"];
  /**
   * Teks tiap format untuk titik yang sama, urutannya mengikuti baris chip.
   * Zona UTM-nya 48M, karena 107,6 BT masuk zona 48 (102-108 BT).
   */
  const TEKS_SALINAN = [
    { format: "Desimal", teks: "-6.914352, 107.609118", aktif: true },
    { format: "DMS", teks: "6° 54′ 51,7″ S, 107° 36′ 32,8″ E", aktif: false },
    { format: "UTM", teks: "48M 285412 9235418", aktif: false },
    { format: "GeoJSON", teks: "[-6.914352, 107.609118]", aktif: false },
  ];
  /** Format, teks, dan riwayat dipakai keadaan utama dan offline. */
  const isiSalin = (
    <>
      <LabelSeksi>Format salinan</LabelSeksi>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: spasi.sm,
          paddingInline: ruangAman.sisi,
          paddingBlock: spasi.md,
        }}
      >
        {format.map((f) => (
          <Chip key={f} terpilih={f === "Desimal"}>
            {f}
          </Chip>
        ))}
      </div>
      <LabelSeksi>Teks yang disalin</LabelSeksi>
      {/* Keempat format ditampilkan sekaligus, yang terpilih ditebalkan. Satu
          baris saja menyisakan pita kosong seperempat layar di atas bilah aksi,
          dan justru inilah alasan format dipilih: teks tiap format berbeda. */}
      <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.md }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: p.permukaanTinggi,
            borderRadius: radius.md,
            overflow: "hidden",
          }}
        >
          {TEKS_SALINAN.map((t, i) => (
            <div
              key={t.format}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: spasi.sm,
                paddingInline: spasi.md,
                paddingBlock: spasi.sm,
                background: t.aktif ? p.permukaan : undefined,
                borderBlockStart: i === 0 ? undefined : `1px solid ${p.garis}`,
              }}
            >
              <span style={{ ...gayaTeks("mikro", { bobot: "tebal", warna: p.teksLembut }), minWidth: 64 }}>
                {t.format}
              </span>
              <code
                style={{
                  ...gayaTeks("kecil", { mono: true, warna: t.aktif ? p.teks : p.teksLembut }),
                  overflowWrap: "anywhere",
                }}
              >
                {t.teks}
              </code>
            </div>
          ))}
        </div>
      </div>
      <LabelSeksi>Riwayat salinan</LabelSeksi>
      <BarisDaftar
        ikon={<History size={sentuh.ikon} />}
        judul="Desimal"
        keterangan="Hari ini 08:14 · ke Google Maps"
        ujung={<LencanaStatus jenis="info">2×</LencanaStatus>}
      />
      <BarisDaftar
        ikon={<History size={sentuh.ikon} />}
        judul="DMS"
        keterangan="18 Okt 15:02 · ke pesan WhatsApp"
        ujung={<LencanaStatus jenis="netral">1×</LencanaStatus>}
      />
      <BarisDaftar
        ikon={<History size={sentuh.ikon} />}
        judul="UTM"
        keterangan="18 Okt 09:20 · ke lembar koordinat tim"
        ujung={<LencanaStatus jenis="netral">1×</LencanaStatus>}
      />
      <BarisDaftar
        ikon={<History size={sentuh.ikon} />}
        judul="GeoJSON"
        keterangan="17 Okt 09:41 · ke QGIS"
        ujung={<LencanaStatus jenis="netral">1×</LencanaStatus>}
      />
    </>
  );
  const isi = {
    utama: (
      <>
        <BilahAtas judul="Salin koordinat" keterangan="Sumur bor 04" />
        <Daftar>
          {isiSalin}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="info">
              Format dipilih sebelum menyalin, karena tiap alat lapangan memakai format berbeda.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Copy size={sentuh.ikon} />}>
            Salin
          </Tombol>
        </BilahBawah>
      </>
    ),
    kosong: (
      <>
        <BilahAtas judul="Salin koordinat" />
        <Penuh>
          <Kosong
            judul="Belum ada koordinat"
            keterangan="Tombol salin baru aktif setelah ada titik yang dipilih. Menyalin teks kosong tidak berguna di alat lain."
            ikon={<Copy size={28} aria-hidden="true" />}
            aksi={<Tombol nonaktif>Salin</Tombol>}
          />
        </Penuh>
      </>
    ),
    memuat: (
      <>
        <BilahAtas judul="Salin koordinat" />
        <Penuh>
          <Memuat judul="Menyiapkan teks" keterangan="Mengubah koordinat ke format yang dipilih." />
        </Penuh>
      </>
    ),
    galat: (
      <>
        <BilahAtas judul="Salin koordinat" />
        <Penuh>
          <Galat
            judul="Papan klip menolak akses"
            keterangan="Aplikasi lain sedang memegang papan klip. Teks di layar tetap bisa dipilih dan disalin manual."
            rincian="clipboard: NotAllowedError"
            aksi={<Tombol varian="sekunder">Pilih teks manual</Tombol>}
          />
        </Penuh>
      </>
    ),
    offline: (
      <>
        <BilahAtas
          judul="Salin koordinat"
          keterangan="Sumur bor 04"
          penanda={<LencanaStatus jenis="peringatan">Offline</LencanaStatus>}
        />
        <Daftar>
          {isiSalin}
          <div style={{ paddingInline: ruangAman.sisi, paddingBlock: spasi.lg }}>
            <SpandukKeadaan jenis="offline">
              Menyalin ke papan klip bekerja lokal tanpa jaringan, jadi koordinat tetap bisa dibawa ke alat lain.
            </SpandukKeadaan>
          </div>
        </Daftar>
        <BilahBawah>
          <Tombol lebarPenuh ikon={<Copy size={sentuh.ikon} />}>
            Salin
          </Tombol>
        </BilahBawah>
      </>
    ),
    izinDitolak: (
      <>
        <BilahAtas judul="Salin koordinat" />
        <Penuh>
          <IzinDitolak
            judul="Izin papan klip ditolak"
            keterangan="Menyalin butuh izin papan klip. Teksnya tetap ditampilkan supaya bisa disalin manual."
          />
        </Penuh>
      </>
    ),
  };
  return (
    <Bingkai varian={{ keadaan, ...varian }} nama="Salin koordinat">
      {pilih(keadaan, isi, isi.utama)}
    </Bingkai>
  );
}
