/**
 * Inventaris komposisi visual GeoApps.
 *
 * Satu baris per fungsi produk, dan tiap baris wajib menyebut kelima keadaan:
 * kosong, memuat, galat, offline, izin-ditolak. Nilai `true` berarti keadaan itu
 * digambar di layar; nilai `string` berarti fungsi itu memang tidak punya
 * keadaan tersebut, dan string-nya alasan satu baris yang bisa dibantah.
 *
 * `cek-inventaris.mjs` membandingkan daftar ini dengan komponen yang benar-benar
 * diekspor `screens/*.tsx`. Menambah komposisi tanpa mendaftarkannya di sini
 * membuat pemeriksaan gagal, dan sebaliknya.
 */

export interface Keadaan {
  kosong: true | string;
  memuat: true | string;
  galat: true | string;
  offline: true | string;
  izinDitolak: true | string;
}

export interface Komposisi {
  /** Nama fungsi produk, sama dengan nama berkas tangkapan layar. */
  id: string;
  /**
   * Jalur kerja: peta, lapangan, offline, geofence, sistem.
   *
   * Daftar ini sengaja TIDAK diperluas untuk beranda: `tests/visual-inventaris.test.ts`
   * memegang kontrak `JALUR_SAH`, dan berkas uji itu milik lane `uji`, bukan `visual`.
   * Beranda dan chrome peta masuk jalur `peta` karena keduanya soal peta: daftar peta
   * yang dibuka, dan chrome layar peta. Memperluas taksonomi = unit kerja lane `uji`.
   */
  jalur: "peta" | "lapangan" | "offline" | "geofence" | "sistem";
  /** Berkas komposisi, relatif terhadap `src/visual/`. */
  berkas: string;
  /** Nama komponen yang diekspor. */
  komponen: string;
  /** Judul yang dibaca pengguna saat galeri dibuka. */
  judul: string;
  keadaan: Keadaan;
  catatan: string;
}

const lima = (
  kosong: true | string,
  memuat: true | string,
  galat: true | string,
  offline: true | string,
  izinDitolak: true | string,
): Keadaan => ({ kosong, memuat, galat, offline, izinDitolak });

export const INVENTARIS: readonly Komposisi[] = [
  {
    id: "impor-geopdf",
    jalur: "peta",
    berkas: "screens/peta.tsx",
    komponen: "KomposisiImporGeopdf",
    judul: "Impor GeoPDF",
    keadaan: lima(
      true,
      true,
      true,
      "Berkas PDF dibaca dari penyimpanan lokal, jadi impor tetap jalan tanpa jaringan.",
      "Tidak ada izin sistem yang diminta: pemilih berkas memakai dialog platform.",
    ),
    catatan: "Pratinjau halaman dan georeferensi sebelum peta ditambahkan ke ruang kerja.",
  },
  {
    id: "impor-geotiff",
    jalur: "peta",
    berkas: "screens/peta.tsx",
    komponen: "KomposisiImporGeotiff",
    judul: "Impor GeoTIFF",
    keadaan: lima(
      true,
      true,
      true,
      "Ubin GeoTIFF dibaca dari berkas lokal; tidak ada unduhan yang ditunggu.",
      "Tidak ada izin sistem yang diminta: berkas dipilih lewat dialog platform.",
    ),
    catatan: "Pita warna, rentang nilai, dan resolusi ditampilkan sebelum raster dipasang.",
  },
  {
    id: "impor-geojson",
    jalur: "peta",
    berkas: "screens/peta.tsx",
    komponen: "KomposisiImporGeojson",
    judul: "Impor GeoJSON",
    keadaan: lima(
      true,
      true,
      true,
      "GeoJSON dibaca dari berkas lokal atau tempelan teks, bukan dari server.",
      "Tidak ada izin sistem yang diminta: tidak ada akses perangkat yang terlibat.",
    ),
    catatan: "Jumlah fitur, geometri, dan sistem acuan diperiksa sebelum lapisan dibuat.",
  },
  {
    id: "galeri-peta",
    jalur: "peta",
    berkas: "screens/peta.tsx",
    komponen: "KomposisiGaleriPeta",
    judul: "Galeri peta",
    keadaan: lima(
      true,
      true,
      true,
      "Peta yang sudah diunduh tetap bisa dibuka dan digambar saat jaringan mati.",
      "Tidak ada izin sistem yang diminta: galeri hanya membaca penyimpanan aplikasi.",
    ),
    catatan: "Kartu peta menyebut luas, jumlah lapisan, dan waktu terakhir dibuka.",
  },
  {
    id: "buka-tutup-lapisan",
    jalur: "peta",
    berkas: "screens/peta.tsx",
    komponen: "KomposisiBukaTutupLapisan",
    judul: "Buka dan tutup lapisan",
    keadaan: lima(
      true,
      true,
      true,
      "Lapisan lokal tetap bisa dinyalakan dan dimatikan; hanya ubin daring yang menunggu jaringan.",
      "Tidak ada izin sistem yang diminta: mengubah keterlihatan lapisan tidak menyentuh perangkat.",
    ),
    catatan: "Urutan tumpukan menentukan apa yang menutupi apa, jadi urutannya bisa digeser.",
  },
  {
    id: "atur-gaya-lapisan",
    jalur: "peta",
    berkas: "screens/peta.tsx",
    komponen: "KomposisiAturGayaLapisan",
    judul: "Atur gaya lapisan",
    keadaan: lima(
      true,
      true,
      true,
      "Gaya disimpan di berkas proyek lokal, jadi perubahan tetap berlaku tanpa jaringan.",
      "Tidak ada izin sistem yang diminta: gaya adalah data proyek, bukan sensor.",
    ),
    catatan: "Warna, ketebalan, dan opasitas diubah dengan pratinjau langsung di peta.",
  },
  {
    id: "legenda",
    jalur: "peta",
    berkas: "screens/peta.tsx",
    komponen: "KomposisiLegenda",
    judul: "Legenda",
    keadaan: lima(
      true,
      true,
      true,
      "Legenda dibaca dari gaya lapisan yang tersimpan, bukan dari layanan simbol daring.",
      "Tidak ada izin sistem yang diminta: legenda hanya menampilkan data proyek.",
    ),
    catatan: "Legenda meringkas simbol yang sedang terlihat, bukan seluruh katalog gaya.",
  },
  {
    id: "rekam-jejak",
    jalur: "lapangan",
    berkas: "screens/lapangan-rekam.tsx",
    komponen: "KomposisiRekamJejak",
    judul: "Rekam jejak",
    keadaan: lima(
      "Belum ada jejak terekam: keadaan ini yang tampil sebelum rekaman pertama.",
      "Menunggu sinyal GPS pertama; titik yang masuk dihitung sambil menunggu.",
      true,
      "Jejak direkam ke penyimpanan lokal lebih dulu, jadi rekaman tetap jalan tanpa jaringan.",
      true,
    ),
    catatan: "Akurasi dan jumlah titik terlihat selama merekam supaya mutu jejak bisa dinilai.",
  },
  {
    id: "mulai-jeda-hentikan",
    jalur: "lapangan",
    berkas: "screens/lapangan-rekam.tsx",
    komponen: "KomposisiMulaiJedaHentikan",
    judul: "Mulai, jeda, hentikan",
    keadaan: lima(
      "Belum ada rekaman aktif: hanya tombol mulai yang ditawarkan.",
      true,
      true,
      "Kendali rekaman bekerja lokal; jeda dan hentikan tidak menunggu jaringan.",
      true,
    ),
    catatan: "Satu tombol utama per keadaan; hentikan selalu butuh konfirmasi.",
  },
  {
    id: "ringkasan-jejak",
    jalur: "lapangan",
    berkas: "screens/lapangan-rekam.tsx",
    komponen: "KomposisiRingkasanJejak",
    judul: "Ringkasan jejak",
    keadaan: lima(
      "Belum ada jejak yang bisa diringkas.",
      true,
      true,
      "Ringkasan dihitung dari titik lokal, jadi tetap tersedia tanpa jaringan.",
      "Tidak ada izin sistem yang diminta: ringkasan hanya membaca rekaman yang sudah ada.",
    ),
    catatan: "Panjang, durasi, dan kecepatan rata-rata ditampilkan bersama mutu akurasi.",
  },
  {
    id: "titik-baru",
    jalur: "lapangan",
    berkas: "screens/lapangan-titik.tsx",
    komponen: "KomposisiTitikBaru",
    judul: "Titik baru",
    keadaan: lima(
      "Belum ada titik di proyek ini: formulir tetap terbuka untuk titik pertama.",
      "Menunggu posisi GPS terkunci sebelum koordinat diisi otomatis.",
      true,
      "Titik disimpan lokal dan disinkronkan belakangan, jadi pencatatan jalan tanpa jaringan.",
      true,
    ),
    catatan: "Koordinat bisa diisi dari GPS atau diketik, dengan akurasi yang selalu terlihat.",
  },
  {
    id: "lampirkan-foto",
    jalur: "lapangan",
    berkas: "screens/lapangan-titik.tsx",
    komponen: "KomposisiLampirkanFoto",
    judul: "Lampirkan foto",
    keadaan: lima(
      "Titik ini belum punya foto lampiran.",
      true,
      "Kamera gagal dibuka: sebabnya disebut dan pengguna bisa memilih dari galeri.",
      "Foto disimpan di perangkat lebih dulu, jadi melampirkan tidak butuh jaringan.",
      true,
    ),
    catatan: "Foto menyimpan arah kamera dan waktu, bukan hanya berkasnya.",
  },
  {
    id: "ukur-jarak",
    jalur: "lapangan",
    berkas: "screens/lapangan-ukur.tsx",
    komponen: "KomposisiUkurJarak",
    judul: "Ukur jarak",
    keadaan: lima(
      "Belum ada dua titik: pengukuran dimulai dari keadaan ini.",
      "Menunggu posisi perangkat untuk titik pertama.",
      true,
      "Pengukuran memakai posisi perangkat, bukan layanan peta daring.",
      true,
    ),
    catatan: "Jarak per segmen dan total ditampilkan; satuan mengikuti pengaturan.",
  },
  {
    id: "ukur-luas",
    jalur: "lapangan",
    berkas: "screens/lapangan-ukur.tsx",
    komponen: "KomposisiUkurLuas",
    judul: "Ukur luas",
    keadaan: lima(
      "Belum ada tiga titik: luas belum bisa dihitung dan itu dinyatakan.",
      true,
      "Bidang memotong dirinya sendiri: luas tidak dihitung dan titik yang salah ditandai.",
      "Perhitungan luas berjalan lokal dari koordinat yang sudah ada.",
      true,
    ),
    catatan: "Luas dan keliling ditampilkan bersamaan, dengan peringatan bila bidang menyilang.",
  },
  {
    id: "baca-koordinat",
    jalur: "lapangan",
    berkas: "screens/lapangan-ukur.tsx",
    komponen: "KomposisiBacaKoordinat",
    judul: "Baca koordinat",
    keadaan: lima(
      "Posisi belum terbaca: nilai ditampilkan sebagai tanda hubung, bukan angka palsu.",
      "Menunggu kunci GPS; akurasi ditampilkan selama menunggu.",
      true,
      "GPS perangkat tidak butuh jaringan, jadi pembacaan tetap jalan offline.",
      true,
    ),
    catatan: "Derajat desimal dan derajat-menit-detik ditampilkan berdampingan.",
  },
  {
    id: "salin-koordinat",
    jalur: "lapangan",
    berkas: "screens/lapangan-ukur.tsx",
    komponen: "KomposisiSalinKoordinat",
    judul: "Salin koordinat",
    keadaan: lima(
      "Belum ada koordinat untuk disalin: tombol salin nonaktif dengan alasannya.",
      true,
      "Papan klip menolak akses: teksnya tetap bisa dipilih manual.",
      "Menyalin ke papan klip bekerja lokal tanpa jaringan.",
      true,
    ),
    catatan: "Format salinan dipilih sebelum menyalin, karena tiap alat lapangan beda.",
  },
  {
    id: "unduh-region",
    jalur: "offline",
    berkas: "screens/offline.tsx",
    komponen: "KomposisiUnduhRegion",
    judul: "Unduh region",
    keadaan: lima(
      "Belum ada region terpilih: kotak peta menunggu digambar.",
      true,
      true,
      true,
      "Tidak ada izin sistem yang diminta: unduhan memakai jaringan, bukan sensor.",
    ),
    catatan: "Perkiraan ukuran dan jumlah ubin dihitung sebelum unduhan dimulai.",
  },
  {
    id: "daftar-region",
    jalur: "offline",
    berkas: "screens/offline.tsx",
    komponen: "KomposisiDaftarRegion",
    judul: "Daftar region",
    keadaan: lima(
      true,
      true,
      true,
      "Daftar dibaca dari penyimpanan lokal; region yang ada tetap bisa dipakai offline.",
      "Tidak ada izin sistem yang diminta: daftar hanya membaca penyimpanan aplikasi.",
    ),
    catatan: "Tiap region menyebut ukuran, cakupan, dan tanggal unduh.",
  },
  {
    id: "hapus-region",
    jalur: "offline",
    berkas: "screens/offline.tsx",
    komponen: "KomposisiHapusRegion",
    judul: "Hapus region",
    keadaan: lima(
      "Belum ada region yang bisa dihapus.",
      true,
      true,
      "Menghapus region adalah operasi lokal, jadi tetap bisa dilakukan tanpa jaringan.",
      "Tidak ada izin sistem yang diminta: penghapusan hanya menyentuh penyimpanan aplikasi.",
    ),
    catatan: "Penghapusan menyebut berapa ruang yang dibebaskan dan tidak bisa dibatalkan.",
  },
  {
    id: "status-penyimpanan",
    jalur: "offline",
    berkas: "screens/offline.tsx",
    komponen: "KomposisiStatusPenyimpanan",
    judul: "Status penyimpanan",
    keadaan: lima(
      true,
      true,
      true,
      "Angka pemakaian dihitung dari berkas lokal, jadi tetap akurat tanpa jaringan.",
      "Tidak ada izin sistem yang diminta: status penyimpanan tidak membaca perangkat lain.",
    ),
    catatan: "Rincian per jenis isi, supaya pengguna tahu apa yang layak dihapus.",
  },
  {
    id: "indikator-offline",
    jalur: "offline",
    berkas: "screens/offline.tsx",
    komponen: "KomposisiIndikatorOffline",
    judul: "Indikator offline",
    keadaan: lima(
      "Belum ada perubahan tertunda: indikator tidak ditampilkan sama sekali.",
      true,
      true,
      true,
      "Tidak ada izin sistem yang diminta: indikator hanya membaca status jaringan.",
    ),
    catatan: "Indikator menyebut jumlah perubahan tertunda, bukan hanya ikon awan tercoret.",
  },
  {
    id: "buat-geofence",
    jalur: "geofence",
    berkas: "screens/geofence.tsx",
    komponen: "KomposisiBuatGeofence",
    judul: "Buat geofence",
    keadaan: lima(
      "Belum ada batas digambar: peta menunggu titik pertama.",
      "Menunggu posisi perangkat untuk memusatkan gambar.",
      true,
      "Batas disimpan lokal; pengawasan berjalan di perangkat tanpa jaringan.",
      true,
    ),
    catatan: "Radius dan perilaku masuk/keluar ditentukan sebelum batas disimpan.",
  },
  {
    id: "daftar-geofence",
    jalur: "geofence",
    berkas: "screens/geofence.tsx",
    komponen: "KomposisiDaftarGeofence",
    judul: "Daftar geofence",
    keadaan: lima(
      true,
      true,
      true,
      "Daftar dibaca dari penyimpanan lokal dan pengawasan tetap aktif tanpa jaringan.",
      "Tidak ada izin sistem yang diminta: daftar hanya membaca data proyek.",
    ),
    catatan: "Tiap baris menyebut status aktif dan jumlah peringatan terakhir.",
  },
  {
    id: "peringatan-masuk-keluar",
    jalur: "geofence",
    berkas: "screens/geofence.tsx",
    komponen: "KomposisiPeringatanMasukKeluar",
    judul: "Peringatan masuk dan keluar",
    keadaan: lima(
      "Belum ada peringatan: keadaan ini yang tampil sebelum batas pertama dilewati.",
      true,
      "Peringatan tidak bisa dikirim karena izin notifikasi mati; dicatat tetap jalan.",
      "Peringatan lahir dari posisi perangkat, jadi tetap terdeteksi tanpa jaringan.",
      true,
    ),
    catatan: "Waktu, arah, dan akurasi disebut supaya peringatan bisa dipercaya.",
  },
  {
    id: "gps-averaging",
    jalur: "geofence",
    berkas: "screens/geofence.tsx",
    komponen: "KomposisiGpsAveraging",
    judul: "Rata-rata GPS",
    keadaan: lima(
      "Belum ada sampel: tombol mulai menunggu ditekan.",
      true,
      "Sebaran sampel terlalu lebar: hasil ditandai belum layak dipakai.",
      "Sampel diambil dari GPS perangkat, jadi perataan jalan tanpa jaringan.",
      true,
    ),
    catatan: "Sebaran ditampilkan, bukan hanya nilai rata-rata, supaya mutu titik terbaca.",
  },
  {
    id: "pengaturan",
    jalur: "sistem",
    berkas: "screens/sistem.tsx",
    komponen: "KomposisiPengaturan",
    judul: "Pengaturan",
    keadaan: lima(
      true,
      true,
      true,
      "Pengaturan disimpan lokal dan tetap bisa diubah tanpa jaringan.",
      "Tidak ada izin sistem yang diminta: pengaturan tidak membaca perangkat.",
    ),
    catatan: "Pengaturan dikelompokkan per akibat, bukan per nama teknis.",
  },
  {
    id: "tema",
    jalur: "sistem",
    berkas: "screens/sistem.tsx",
    komponen: "KomposisiTema",
    judul: "Tema",
    keadaan: lima(
      true,
      true,
      true,
      "Pilihan tema tersimpan lokal; tidak ada yang perlu diunduh.",
      "Tidak ada izin sistem yang diminta: tema hanya mengubah token warna.",
    ),
    catatan: "Tema kontras tinggi disediakan setara, bukan sebagai tambahan belakangan.",
  },
  {
    id: "bahasa",
    jalur: "sistem",
    berkas: "screens/sistem.tsx",
    komponen: "KomposisiBahasa",
    judul: "Bahasa",
    keadaan: lima(
      true,
      true,
      true,
      "Berkas terjemahan ikut terpasang, jadi pergantian bahasa bekerja offline.",
      "Tidak ada izin sistem yang diminta: bahasa hanya mengganti katalog teks.",
    ),
    catatan: "Bahasa kanan-ke-kiri diuji di layar ini, karena tata letak harus ikut berbalik.",
  },
  {
    id: "plugin",
    jalur: "sistem",
    berkas: "screens/sistem.tsx",
    komponen: "KomposisiPlugin",
    judul: "Plugin",
    keadaan: lima(
      true,
      true,
      "Plugin gagal dimuat: versi yang diminta dan versi terpasang disebut.",
      "Plugin yang sudah terpasang tetap jalan; pemasangan baru menunggu jaringan.",
      "Tidak ada izin sistem yang diminta: plugin berjalan di dalam aplikasi.",
    ),
    catatan: "Tiap plugin menyebut izin yang diminta sebelum dinyalakan.",
  },
  {
    id: "izin-lokasi-ditolak",
    jalur: "sistem",
    berkas: "screens/sistem.tsx",
    komponen: "KomposisiIzinLokasiDitolak",
    judul: "Izin lokasi ditolak",
    keadaan: lima(
      true,
      true,
      true,
      "Penolakan izin bukan soal jaringan: keadaan ini sama saat daring maupun offline.",
      true,
    ),
    catatan: "Langkah perbaikan disebut per platform, karena jalur pengaturannya berbeda.",
  },
  {
    id: "lokasi-mati",
    jalur: "sistem",
    berkas: "screens/sistem.tsx",
    komponen: "KomposisiLokasiMati",
    judul: "Lokasi mati",
    keadaan: lima(
      true,
      true,
      true,
      "Lokasi mati terjadi di perangkat, bukan di jaringan: pesannya tidak berubah saat offline.",
      true,
    ),
    catatan: "Bedakan lokasi mati dari izin ditolak: yang satu sakelar, yang lain keputusan.",
  },
  {
    id: "beranda",
    jalur: "peta",
    berkas: "screens/beranda.tsx",
    komponen: "KomposisiBeranda",
    judul: "Beranda Peta Saya",
    keadaan: lima(
      true,
      true,
      true,
      "Peta yang sudah diunduh tetap terbuka dan bisa diedit tanpa jaringan; hanya ubin yang belum diunduh yang kosong.",
      "Beranda tidak meminta izin apa pun: izin lokasi baru diminta saat peta dibuka, dan itu digambar layar izin-lokasi-ditolak.",
    ),
    catatan: "Layar pertama: daftar peta terakhir, tombol Tambah Peta, dan tab Peta Saya/Layer.",
  },
  {
    id: "chrome-peta",
    jalur: "peta",
    berkas: "screens/beranda.tsx",
    komponen: "KomposisiChrome",
    judul: "Chrome peta dan sesi lapangan",
    keadaan: lima(
      "Chrome tidak punya keadaan kosong: bilah atas dan tab bawah tetap digambar walau belum ada peta yang terbuka.",
      "Chrome tidak memuat data sendiri; yang memuat adalah isi peta di bawahnya, dan keadaan itu punya komposisinya sendiri.",
      "Galat tampil di isi layar, bukan di chrome; bilah atas dan tab bawah tetap sama saat isi gagal dimuat.",
      true,
      true,
    ),
    catatan: "Bilah atas peta, tab bawah, dan bilah sesi lapangan yang sedang merekam.",
  },
];

/** Jumlah komposisi yang dijanjikan inventaris ini. */
export const JUMLAH_KOMPOSISI = INVENTARIS.length;
