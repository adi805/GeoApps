# Parameter bawaan alat lapangan geofence (#13)

Semua angka di bawah ini adalah bawaan yang dipakai kalau pemanggil tidak
menyebut nilainya. Tidak ada satu pun yang dipaku di dalam logika: tiap
parameter bisa diganti lewat opsi di kode atau lewat panel pengaturan, karena
kondisi lapangan (kebun terbuka vs di bawah tajuk) mengubah angka yang masuk
akal.

## Rata-rata GPS (`gps-averaging.ts`)

| Parameter | Bawaan | Satuan | Alasan angka ini |
|---|---|---|---|
| `maxSamples` | 15 | sampel | Pada laju 1 sampel/detik, 15 detik cukup untuk meredam goyangan GPS tanpa membuat petugas menunggu. Di bawah 10 sampel simpangan baku masih terlalu lebar. |
| `maxAccuracyM` | 15 | meter | Sampel dengan akurasi lebih buruk dari ini dibuang. Di bawah tajuk kebun, akurasi 10-20 m itu biasa; 15 m adalah batas di mana rata-rata masih berguna. |
| `maxOutlierM` | 40 | meter | Sampel yang lebih jauh dari ini dari rata-rata berjalan dianggap lompatan (multipath, bukan gerak nyata) dan dibuang. Lebih kecil dari ini membuang gerak sah saat berjalan. |

Akurasi hasil dihitung sebagai `max(standardError, rmsSpread)`: galat baku
sendirian terlalu optimistis karena menganggap sampel saling bebas, padahal
galat GPS berkorelasi antar detik.

## Geofence (`maplibre-geofence.ts`, `GEOFENCE_DEFAULTS`)

| Parameter | Bawaan | Satuan | Alasan angka ini |
|---|---|---|---|
| `hysteresisM` | 10 | meter | Lebar pita di tiap sisi batas. GPS yang diam bergoyang 3-8 m; pita 10 m menahan goyangan itu sehingga status tidak berkedip masuk-keluar saat petugas berdiri di batas. |
| `minDistanceM` | 10 | meter | Posisi baru diperiksa setelah alat benar-benar berpindah sejauh ini. |
| `minIntervalMs` | 15000 | milidetik | ...atau setelah 15 detik, mana yang lebih dulu. Kedua syarat ini yang menghemat baterai: memeriksa tiap detik tidak menambah ketepatan untuk zona selebar ratusan meter. |
| `maxEvents` | 500 | peristiwa | Jurnal menyimpan 500 peristiwa terakhir; yang tertua dibuang. Cukup untuk beberapa minggu kerja satu petugas, dan masih muat di `localStorage`. |

Perilaku yang menyertai angka-angka itu:

- Posisi pertama hanya **menetapkan status awal**, tidak menulis peristiwa.
  Membuka aplikasi di dalam zona bukan peristiwa "masuk".
- Status hanya berubah setelah jarak bertanda melewati pita: dari luar butuh
  `signedM <= -hysteresisM` untuk masuk, dari dalam butuh `signedM >= +hysteresisM`
  untuk keluar. Tepat di batas (`signedM = 0`) tidak memicu apa pun.
- Jarak ke batas dihitung dalam meter pada proyeksi lokal berpusat di titik
  yang diukur, dan bujur digeser ke jendela 180 derajat dari titik itu sehingga
  zona yang melintasi garis tanggal tidak terbaca membentang seluruh bumi.

## Format koordinat (`utm-converter.ts`)

| Parameter | Nilai | Catatan |
|---|---|---|
| Batas pita UTM | -80 sampai 84 derajat | Di luar rentang ini UTM tidak terdefinisi; konversi mengembalikan `null`, bukan angka palsu. |
| Datum | WGS84 | Sama dengan yang dipakai `maplibre-graticule.ts`, supaya garis bantu dan hasil konversi tidak berselisih. |
| Ketelitian tulis | 3 desimal meter (milimeter) | Lebih halus dari akurasi GPS mana pun di lapangan. |

## Yang belum bisa diuji di sini

Pemeriksaan geofence saat aplikasi di latar belakang **belum** ada di rilis ini;
ia bergantung pada lapisan pelacakan posisi dari issue #10. Semua uji di
`maplibre-geofence.test.ts` memanggil `GeofenceMonitor` langsung dengan posisi
dan waktu buatan, jadi perilaku latar belakang tidak diklaim lulus di sini.
