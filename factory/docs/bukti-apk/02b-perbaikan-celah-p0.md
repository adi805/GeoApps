# Bukti 02b: celah P0 G1-G3 ditutup di kode

Tanggal: 2026-11-11 21:10 WIB
Cabang: `feat/offline-basemap-wiring`
Patokan: `02-audit-p0.md` bagian 4 (celah G1, G2, G3). G4 tetap daftar uji lapangan.

Dokumen ini mencatat apa yang **diubah** dan apa yang **terbukti di kode serta
uji Node**. Perilaku di HP Adi tetap belum terbukti di sini; itu tugas
`03-uji-offline.md`.

## 1. G1: byte PDF GeoPDF tidak selamat setelah app ditutup

**Masalah.** Ubin GeoPDF punya cache IndexedDB, tetapi renderer hanya bisa
membuat ubin baru kalau byte PDF-nya masih terbaca. Di Android, impor lewat
pemilih berkas HP tidak mencatat path sama sekali, dan URI `content://` yang
dicatat pun grant bacanya mati bersama proses. Akibatnya proyek yang dibuka
ulang menunjuk `geopdf://<hash>/...` tanpa renderer: peta PDF hilang.

**Perbaikan.**

| Bagian | Berkas | Isi |
|---|---|---|
| Arsip byte | `packages/plugins/src/plugins/geopdf/geopdf-pdf-archive.ts` (baru) | IndexedDB `geolibre-geopdf-pdfs`, berkunci SHA-256 huruf kecil, batas 96 MB per PDF (`MAX_ARCHIVED_PDF_BYTES`, baris 42), byte disimpan apa adanya bukan base64 |
| Simpan saat impor | `geopdf-render.ts:225` | `addGeoPdfToMap` mengarsipkan byte tepat setelah hash dihitung; gagal arsip hanya jadi peringatan, impor tetap jalan |
| Daftar ulang dari arsip | `geopdf-render.ts:175` | `registerGeoPdfTileSetFromArchive(hash)` memuat byte lalu memakai jalur `registerGeoPdfTileSet` yang sudah ada |
| Pemulihan saat proyek dibuka | `maplibre-raster.ts:1002` | `restoreGeoPdfTileSets` mencoba arsip **lebih dulu**, lalu path lokal sebagai cadangan |
| Hapus | `geopdf-render.ts:288` | `deleteGeoPdfTileCache` (kini async) ikut membuang byte arsipnya |

Urutannya sengaja arsip dulu: byte di arsip selalu lokal dan tidak bisa basi,
sedangkan path di Android bisa berupa URI mati.

**Batas yang diketahui.** Arsip belum dibersihkan saat layer GeoPDF dihapus dari
proyek: `deleteGeoPdfTileCache` sudah ikut membuang byte arsipnya, tapi fungsi
itu belum punya pemanggil (cache ubinnya pun sudah begitu sebelum perubahan ini).
Jadi menghapus layer meninggalkan byte PDF di IndexedDB sampai kuota IndexedDB
sendiri mendorong pembersihan. Ini utang, bukan perilaku yang diinginkan.

**Uji.** `packages/plugins/src/plugins/geopdf/geopdf-pdf-archive.test.ts` (baru),
9 uji atas kebijakan arsip di atas tabel `Map`: simpan-lalu-baca utuh, hash
dinormalkan, hash tak dikenal balik null, berkas di atas batas dilewati tanpa
menyimpan separuh, byte kosong ditolak, hapus satu arsip tidak menyentuh yang
lain, nilai `Blob` dan view tetap terbaca, dan error penyimpanan diteruskan
(bukan ditelan).

```
node --import tsx --test packages/plugins/src/plugins/geopdf/geopdf-pdf-archive.test.ts \
  packages/plugins/src/plugins/geopdf/geopdf-parser.test.ts
  # tests 22  pass 22  fail 0
```

## 2. G2: rekaman jejak berhenti diam-diam saat layar mati

**Masalah.** Wake lock hanya dipakai mode navigasi (`useNavigationDrive.ts`).
Dialog rekam jejak tidak memintanya, jadi layar mati, WebView di-pause, timer
berhenti, dan rekaman berhenti tanpa satu pun peringatan.

**Perbaikan.**

| Bagian | Berkas | Isi |
|---|---|---|
| Kunci layar dipisah | `apps/geolibre-desktop/src/lib/wake-lock.ts` (baru) | `requestScreenWakeLock` pindah ke modul sendiri supaya dialog rekam tidak menarik seluruh mesin navigasi ke jalur boot |
| Re-export | `lib/navigation/device.ts:17` | Pemanggil lama tetap jalan lewat satu pintu yang sama |
| Dipakai saat merekam | `GpsTrackingDialog.tsx:361-388` | Selama `recording === "recording"` kunci dipegang, dilepas saat jeda/stop, dan diambil ulang saat halaman kembali terlihat (kunci otomatis hilang ketika halaman disembunyikan) |

**Batasnya, ditulis jujur.** Ini tahap 1: kunci layar dari WebView. Kalau
platform menolak atau WebView-nya terlalu tua, `requestScreenWakeLock` balik
null dan perilakunya sama seperti sebelum perbaikan. Merekam saat app benar-benar
di background tetap butuh foreground service, dan itu **belum** dikerjakan.

## 3. G3: foto 2 MB jadi base64, proyek membengkak

**Masalah.** Foto disimpan sebagai data URL base64 di properti
`geolibre_photos`, dan berkas di atas 2 MB ditolak mentah-mentah. Foto kamera HP
4 sampai 8 MB, jadi pilihan yang tersedia cuma "ditolak" atau "proyek bengkak".

**Perbaikan.**

| Bagian | Berkas | Isi |
|---|---|---|
| Kebijakan ukuran | `apps/geolibre-desktop/src/lib/photo-downscale.ts` (baru) | `planPhotoResize` (murni) memotong sisi terpanjang ke 1600 px dan menjaga rasio; `shrinkPhotoToDataUrl` menggambar ke kanvas lalu encode ulang JPEG 0.82, PNG tetap PNG supaya transparansi tidak jadi hitam |
| Foto kecil tidak diutak-atik | `photo-downscale.ts:88` | Gambar yang sudah muat balik null, jadi byte aslinya yang dipakai, kualitasnya tidak turun tanpa alasan |
| Dipakai dialog | `FieldCollectionDialog.tsx:120`, `:805` | `readPhotoDataUrl` mencoba perkecil dulu, jatuh ke `FileReader` kalau kanvas tidak ada; batas 2 MB tetap diperiksa pada panjang data URL hasilnya |
| Batas masukan | `field-collection.ts:93` | `MAX_PHOTO_INPUT_BYTES` 64 MB hanya penjaga agar berkas patologis tidak didecode, bukan batas yang harus dipikirkan pengguna |

**Uji.** `tests/photo-downscale.test.ts` (baru), 9 uji: potong lanskap dan
potret, gambar yang sudah muat balik null, batas tepat di angka, batas khusus
pemanggil, rasio ekstrem tidak menghasilkan sisi nol, ukuran tak masuk akal
ditolak, dan tanpa kanvas fungsinya balik null supaya byte aslinya dipakai.

```
node --import tsx --test tests/photo-downscale.test.ts tests/field-collection.test.ts
  # tests 45  pass 45  fail 0
```

## 4. Gerbang tipe

Dijalankan ulang sendiri di laptop ini (bukan hanya laporan sesi lain) pada
2026-11-11 14:23 WIB, HEAD `de178dee`:

```
NODE_OPTIONS=--max-old-space-size=2560 npm run typecheck > /tmp/typecheck.log 2>&1
  # EXIT:0
  # grep -c "error TS" /tmp/typecheck.log -> 0
```

`npm run typecheck` di repo ini adalah `npm run build`, yaitu prebuild
`tsc -p tsconfig.build.json` (@geolibre/embed) lalu `tsc -b && vite build`.
Jadi exit 0 berarti gerbang tipe DAN bundel produksi dua-duanya lolos pada
commit di atas. Tanpa batas `--max-old-space-size`, `npx tsc -b` di mesin ini
terbunuh OOM (`Killed`, exit 137) karena RAM 7.7 GB + `earlyoom` aktif; batas
2.5 GB membuatnya selesai.

## 5. Yang belum dibuktikan

- Peta PDF di HP Adi setelah force close, dengan mode pesawat. Ini inti G1 dan
  baru bisa dibuktikan di perangkat (task 10).
- Kunci layar benar-benar menahan layar saat merekam di HP. Di emulator tidak
  ada yang bisa diverifikasi soal perilaku layar.
- Foto kamera HP: apakah hasil perkecilan masih layak dibaca di popup dan ekspor.
- Merekam jejak saat app di background (butuh foreground service, belum ada).

## 6. Cara menguji G1 di HP

1. Buka app, impor satu peta PDF dari storage HP.
2. Simpan proyek (kalau belum), lalu tutup app sepenuhnya (bukan cuma ke home).
3. Nyalakan mode pesawat, buka app lagi, buka proyeknya.
4. Peta PDF harus tetap tergambar saat digeser ke area yang belum pernah dibuka.
   Sebelum perbaikan ini, area baru akan kosong.
