# Audit fitur P0 Avenza di jalur Android

Bukti pendamping: `01-build-dan-pasang.md` (build dan tanda tangan) dan `02-instalasi.md` (terpasang dan jalan di emulator).

Tanggal: 2026-11-11 13:45 WIB
Repo: `adi805/GeoApps`, branch `feat/offline-basemap-wiring`, HEAD `a50982da`
Patokan fitur: `factory/docs/riset/2026-10-19-paritas-avenza-android.md` bagian 3.1 (P0 nomor 1 sampai 7)

## 1. Metode

Tiga lapis, dipisah supaya jelas mana yang sudah terbukti dan mana yang belum:

1. **Baca kode** di HEAD `a50982da`, dengan nomor baris. Ini bukti bahwa jalurnya ada, bukan bukti bahwa jalurnya jalan di HP.
2. **Jalankan uji Node** yang menyentuh tiap modul, dengan jumlah lulus yang dicatat.
3. **Jalur Android** dicek terpisah: apakah fitur itu bisa dicapai dari chrome HP (`MobileShell` / `MobileTabBar`), dan apakah ia selamat dari proses yang mati.

Yang **tidak** dibuktikan di dokumen ini: perilaku di HP Adi. Tidak ada `adb devices` yang tersambung saat audit ini ditulis, dan emulator tidak punya GPS nyata. Uji lapangan ada di `03-uji-offline.md` (task 10).

### Bukti uji yang dijalankan

```
node --import tsx --test packages/plugins/src/plugins/geopdf/geopdf-parser.test.ts
  # tests 12  pass 12  fail 0

node --import tsx --test tests/geopdf-fixtures.test.ts tests/offline-basemap-archive.test.ts tests/offline-basemap-restore.test.ts
  # tests 51  pass 51  fail 0

node --import tsx --test tests/gps-tracking.test.ts tests/field-collection.test.ts tests/field-collection-map.test.ts
  # tests 68  pass 68  fail 0
```

## 2. Ringkasan

| # | Kemampuan P0 | Status | Bukti utama |
|---|---|---|---|
| 1 | Impor PDF bergeoreferensi | **ADA**, pemulihan sesudah app ditutup **BELUM** | `geopdf-parser.ts:4`, `maplibre-raster.ts:453`, `maplibre-raster.ts:980` |
| 2 | Posisi GPS langsung, tanpa internet | **ADA** | `geolocation.ts:30`, `capabilities/default.json:23` |
| 3 | Rekam jejak perjalanan | **ADA** untuk sesi aktif, **BELUM** tahan layar mati | `gps-tracking.ts:11`, `GpsTrackingDialog.tsx:547` |
| 4 | Ukur jarak dan luas | **ADA** | `measure.ts:51`, `MobileTabBar.tsx:33` |
| 5 | Titik + foto + catatan | **ADA** | `field-collection.ts:55`, `FieldCollectionDialog.tsx:1562` |
| 6 | Tahan tutup app tanpa sinyal | **SEBAGIAN**: proyek dan basemap PMTiles selamat, GeoPDF tidak | `startup-project-snapshot.ts:1`, `offline-basemap-archive.ts:1` |
| 7 | Aplikasi tidak macet | Akar masalah lama sudah ditutup di kode, bukti di HP belum | `geopdf-tiles.ts:21`, `geopdf-tile-cache.ts:31` |

Empat celah nyata ada di bagian 4, dan tiga di antaranya masuk lingkup task 8.

## 3. Rincian per fitur

### 3.1 Impor GeoPDF

Parser sekarang membaca kamus halaman, bukan lagi regex metadata:

- `/VP` sampai `/Measure` (Adobe/ISO, ESRI) di `packages/plugins/src/plugins/geopdf/geopdf-parser.ts:4-5`, penurunan affine di `geopdf-derive.ts:6-10`.
- `/LGIDict` (OGC Best Practice) di `geopdf-crs.ts:6-8` dan `geopdf-derive.ts:227`.
- Empat berkas nyata sebagai bahan uji: `tests/fixtures/geopdf/` (ESRI UTM 20N, OGC 4326, QGIS 3857, satu PDF tanpa georeferensi yang wajib ditolak).

Jalurnya tersambung ke impor raster: berkas `File` berakhiran `.pdf` langsung masuk `addGeoPdfToMap` (`packages/plugins/src/plugins/maplibre-raster.ts:453-461`), tanpa melewati kontrol raster yang cuma paham GeoTIFF.

Render tidak lagi satu kanvas raksasa: ubin 512 px (`geopdf-tiles.ts:21`) dengan batas `MAX_TEXTURE_SIZE`, dan cache ubin persisten di IndexedDB, 32 MiB per proyek (`geopdf-tile-cache.ts:31-40`).

Di HP, jalurnya ada di sheet Proyek: tombol `Impor peta PDF` (`MobileShell.tsx:147-153`) dengan `accept=".pdf,.geotiff,.tif,.tiff,.png,.jpg,.jpeg"` (`MobileShell.tsx:56`), diteruskan ke `handleMobileImportFile` (`DesktopShell.tsx:394-406`).

**Celah:** pemulihan sesudah app ditutup. `restoreGeoPdfTileSets` (`maplibre-raster.ts:980-1005`) butuh dua hal: `localRasterFileReader` dan `metadata.localFilePath`. Impor dari HP tidak pernah mengisi `localFilePath` karena `handleMobileImportFile` cuma mengirim `{ name }` (`DesktopShell.tsx:398`), dan metadata itu hanya diisi kalau `options.localPath` ada (`geopdf-render.ts:199-210`). Tanpa PDF yang bisa dibaca ulang, `registerGeoPdfTileSet` (`geopdf-render.ts:147`) tidak bisa membuat renderer, jadi ubin yang belum pernah dikunjungi tidak bisa dirender. Ubin yang sudah ada di cache tetap terpakai, tapi peta yang baru pertama kali dibuka tidak.

### 3.2 Posisi GPS

Di mobile, posisi dibaca lewat `@tauri-apps/plugin-geolocation`, bukan `navigator.geolocation` (`geolocation.ts:30-32`). Alasannya tertulis di kepala berkas itu: WebView Android menolak izin lokasi karena manifest hasil generate tidak mendeklarasikannya. Plugin-nya membawa izinnya sendiri (`vendor/tauri-plugin-geolocation/.../AndroidManifest.xml:3-4`: `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`), terdaftar di `Cargo.toml:45` dan `lib.rs:460`, dan izin Tauri-nya ada di `capabilities/default.json:23-27`. Interval pembaruan native 1000 ms (`geolocation.ts:86`).

Tidak butuh jaringan: plugin membaca fused location provider, bukan tile peta.

### 3.3 Rekam jejak GPS

Dialog rekam jejak memakai `watchPosition` dari `lib/geolocation` (`GpsTrackingDialog.tsx:63`, `:547`), jadi di Android ia ikut jalur native yang sama. Hasil rekaman disimpan sebagai layer `geojson` bertanda khusus (`gps-tracking.ts:11-13`), sehingga ikut tersimpan di `.geolibre.json` seperti layer lain, dan bisa diekspor ke GPX.

**Celah:** tidak ada yang menjaga layar tetap hidup selama perekaman. Wake lock hanya dipakai di mode navigasi (`useNavigationDrive.ts:422-425`), tidak di dialog rekam jejak. Tidak ada `FLAG_KEEP_SCREEN_ON` di `MainActivity.kt` (isi berkasnya cuma edge-to-edge), dan tidak ada plugin foreground service di `Cargo.toml` (hanya dialog, fs, geolocation, http, opener, persisted-scope, deep-link, single-instance). Konsekuensinya: layar mati, WebView di-pause, timer JS berhenti, rekaman berhenti tanpa peringatan.

### 3.4 Ukur jarak dan luas

Panel ukur dibuka lewat `openMeasurePanel` (`packages/plugins/src/plugins/components/measure.ts:51`), dipanggil dari tab Ukur di HP (`MobileTabBar.tsx:33`, `DesktopShell.tsx:329-331`). Interaksinya `map.on("click")` untuk menaruh titik dan `map.on("mousemove")` untuk pratinjau (`maplibre-dimensions.ts:945-946`).

Ketuk untuk menambah titik jalan di layar sentuh karena MapLibre memetakan tap ke `click`. Yang belum diverifikasi: menggeser titik sudut setelah digambar, karena itu bergantung pada event mouse. Masuk daftar uji lapangan, bukan daftar celah kode.

### 3.5 Titik, foto, catatan

Data koleksi lapangan di `field-collection.ts` (368 baris), foto disimpan sebagai data URL di properti `geolibre_photos` (`field-collection.ts:55`), dengan batas 2 MiB per foto (`field-collection.ts:84`). Di HP, dua tombol membuka dialog yang sama: `Taruh titik di sini` dan `Ambil foto` (`MobileShell.tsx:154-166`), keduanya memanggil `openFieldTool("fieldCollection")` (`DesktopShell.tsx:687`, `:690`).

Pemilih foto sengaja tanpa atribut `capture` (`FieldCollectionDialog.tsx:1562-1571`), jadi pengguna bisa memilih foto lama atau memotret baru; `capture="environment"` akan memaksa kamera dan itu hanya diinginkan di iOS.

**Risiko, bukan celah:** foto 2 MiB jadi base64 di dalam JSON proyek, jadi 10 foto bisa membengkak sekitar 27 MB. Untuk HP kelas menengah ini masih jalan, tapi proyek lapangan yang panjang akan berat saat dibuka. Calon perbaikan: perkecil ke sisi terpanjang 1600 px sebelum disimpan.

### 3.6 Tahan tutup app tanpa sinyal

Tiga mekanisme terpisah, dan cakupannya berbeda:

| Yang diselamatkan | Mekanisme | Berkas |
|---|---|---|
| Teks proyek (`.geolibre.json`) | salinan ke `$APPLOCALDATA/startup-projects` karena URI `content://` mati bersama proses | `startup-project-snapshot.ts:1-20`, `capabilities/default.json:33-40`, `project-files.ts:313-319` |
| Byte basemap PMTiles | arsip di IndexedDB, dipulihkan saat startup | `offline-basemap-archive.ts:1-20`, `useOfflineBasemapRestore.ts:20` |
| Ubin GeoPDF yang sudah dikunjungi | cache IndexedDB 32 MiB per PDF | `geopdf-tile-cache.ts:31-40` |
| **PDF GeoPDF aslinya** | **tidak ada** | lihat 3.1 |

Jadi proyek dan basemap offline selamat, tapi peta PDF yang diimpor dari HP tidak bisa dibuka ulang penuh. Itu bertabrakan langsung dengan permintaan owner: impor peta PDF lalu dipakai offline.

### 3.7 Tidak macet

Akar masalah yang dicatat riset 19 Oktober (satu kanvas A1, sekitar 95 juta piksel, sekitar 380 MB RAM) sudah ditutup: render per ubin 512 px (`geopdf-tiles.ts:21`), batas ukuran kanvas dilacak (`geopdf-tiles.ts:451`), render dijalankan di worker (`geopdf-tile.worker.ts`), dan cache dibatasi 32 MiB per proyek. Di emulator, peluncuran dingin median 2588 ms dengan n=3 dan tidak ada ANR (`01-instalasi.md`).

Yang belum: pemakaian memori saat membuka lembar A1 di HP nyata, dan perilaku saat RAM sempit.

## 4. Celah, urut dampak

| # | Celah | Dampak | Rencana |
|---|---|---|---|
| G1 | Byte PDF GeoPDF tidak diarsipkan; impor dari HP tidak mengisi `localFilePath` | peta PDF mati sesudah app ditutup, tepat fitur nomor satu yang diminta | arsipkan byte PDF ke IndexedDB berkunci hash, pola sama dengan `offline-basemap-archive.ts`, lalu `restoreGeoPdfTileSets` membaca arsip itu lebih dulu sebelum jatuh ke `localFilePath` |
| G2 | Tidak ada wake lock atau foreground service saat merekam jejak | rekaman berhenti diam-diam saat layar mati | tahap 1: `FLAG_KEEP_SCREEN_ON` selama rekaman aktif (kecil, cukup untuk layar mati); tahap 2: foreground service kalau app harus tetap merekam saat di background |
| G3 | Foto 2 MiB disimpan base64 di properti | proyek membengkak, lambat dibuka di HP | perkecil gambar di klien sebelum base64 |
| G4 | Geser titik sudut ukur di layar sentuh belum diuji | mungkin tidak bisa merapikan hasil ukur | uji lapangan dulu, baru putuskan perlu handler sentuh khusus |

## 5. Yang belum dibuktikan

Daftar ini sengaja ditulis, supaya tidak ada yang membaca dokumen ini sebagai "semua beres":

- Peta PDF di HP Adi setelah app di-force close, dengan mode pesawat. Ini inti G1 dan baru bisa dibuktikan sesudah G1 ditutup.
- GPS asli (bukan emulator) untuk posisi dan rekaman jejak.
- Kamera HP untuk foto placemark.
- Pemakaian RAM saat membuka lembar peta besar di HP.
- Ukur dengan jari: tap, geser titik, dan tombol hapus.
