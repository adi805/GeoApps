# Bukti 03: uji offline di HP (mode pesawat + tutup paksa)

Status: **BELUM DIJALANKAN.** Dokumen ini menyiapkan prosedur, perintah, dan
kolom hasil. Angka dan centang hanya diisi dari keluaran alat yang benar-benar
dijalankan di perangkat; tidak ada baris PASS yang ditulis tanpa keluaran.

Tanggal disusun: 2026-11-11 WIB
Cabang: `feat/offline-basemap-wiring`
Patokan kode: `94e1d519` (G1 arsip byte GeoPDF, G2 wake lock, G3 kompres foto)
Patokan celah: `02-audit-p0.md` bagian 4, penutupan di `02b-perbaikan-celah-p0.md`

## 1. APK yang harus diuji

Uji ini hanya sah untuk APK yang dibangun dari `94e1d519` atau lebih baru.
APK di HP saat ini berasal dari run 2026-11-07 (`ea8fb67e`) dan **tidak** memuat
G1-G3.

| Item | Nilai |
|---|---|
| Workflow | `.github/workflows/android.yml` (`workflow_dispatch`) |
| Run | 42978727740 |
| Ref | `feat/offline-basemap-wiring` |
| Commit | `94e1d519` |
| Artifact | `geolibre-android-release-apks` |

APK diambil dari artifact run itu, bukan dibangun ulang di laptop: build Rust
lintas arsitektur + Gradle tidak dijalankan di mesin ini (RAM 7.7 GB, `earlyoom`
aktif, build Rust lokal sudah terbunuh di `VmRSS ~4.7 GiB`).

## 2. Alat uji

Seluruh langkah dilakukan lewat `adb`, jadi hasilnya berupa keluaran perintah
yang bisa dibaca ulang, bukan ingatan.

| Keperluan | Perintah |
|---|---|
| Perangkat terpasang | `adb devices -l` |
| Pasang APK | `adb install -r <apk>` |
| Versi terpasang | `adb shell dumpsys package com.geokebun.app \| grep -E "versionName\|firstInstallTime\|lastUpdateTime"` |
| Nyalakan mode pesawat | `adb shell cmd connectivity airplane-mode enable` |
| Matikan mode pesawat | `adb shell cmd connectivity airplane-mode disable` |
| Cek jaringan benar-benar mati | `adb shell dumpsys connectivity \| grep -m3 "Active default network"` |
| Tutup paksa | `adb shell am force-stop com.geokebun.app` |
| Buka app | `adb shell monkey -p com.geokebun.app -c android.intent.category.LAUNCHER 1` |
| Log app | `adb logcat -d -s RustStdoutStderr:V WebView:V chromium:V \| tail -80` |
| Isi IndexedDB (arsip PDF) | `adb shell run-as com.geokebun.app ls -la app_webview/Default/IndexedDB/` |
| Tangkapan layar | `adb exec-out screencap -p > <berkas>.png` |

Catatan: aplikasi rilis ditandatangani, jadi `run-as` hanya jalan kalau
`android:debuggable` aktif. Kalau tidak, bukti arsip diambil dari perilaku
(peta PDF muncul lagi setelah tutup paksa), bukan dari isi folder.

## 3. Skenario

Tiap skenario punya satu hal yang harus terlihat. Skenario tanpa bukti terlihat
dianggap belum lulus.

| Kode | Langkah | Yang harus terlihat | Celah yang diuji |
|---|---|---|---|
| S1 | Mode pesawat nyala, buka app | App terbuka, tidak ada layar error jaringan | dasar offline |
| S2 | Buka proyek yang punya basemap offline | Basemap tergambar dari ubin lokal, bukan kotak kosong | basemap offline |
| S3 | Buka proyek yang punya layer GeoPDF | Peta PDF tergambar | G1 |
| S4 | Tutup paksa, buka lagi, mode pesawat masih nyala | Layer GeoPDF masih tergambar tanpa impor ulang | G1 |
| S5 | Nyalakan GPS, ambil posisi | Titik biru muncul, koordinat masuk | GPS |
| S6 | Rekam jejak 2 menit, layar jangan disentuh | Rekaman tidak terputus walau layar meredup | G2 |
| S7 | Taruh placemark + foto dari kamera | Foto tersimpan, ukuran wajar (sisi panjang 1600 px) | G3 |
| S8 | Tutup paksa, buka lagi | Proyek, track, placemark, dan foto masih ada | ketahanan |

## 4. Hasil

Diisi setelah tiap perintah dijalankan. Kolom bukti memuat keluaran ringkas
perintah yang mendukungnya.

| Kode | Hasil | Bukti |
|---|---|---|
| S1 | belum dijalankan | - |
| S2 | belum dijalankan | - |
| S3 | belum dijalankan | - |
| S4 | belum dijalankan | - |
| S5 | belum dijalankan | - |
| S6 | belum dijalankan | - |
| S7 | belum dijalankan | - |
| S8 | belum dijalankan | - |

### Sudah dibuktikan otomatis, tanpa HP

Tiga bagian dari skenario di atas punya bukti mesin di lapisan browser, jadi
kalau S1-S8 gagal nanti, ada pembanding untuk memisahkan "kode-nya salah" dari
"perangkatnya beda". Bukti lengkap + angkanya: `03b-jalur-uji-cepat.md`.

| Celah | Yang sudah dibuktikan | Perintah |
|---|---|---|
| G1 | byte PDF bertahan di IndexedDB setelah proses app dibunuh, jaringan luar diblokir | `mobile-web.sh field` |
| G2 | kunci layar diminta saat merekam, dilepas saat jeda, dan penolakan platform tidak merusak rekaman | `mobile-web.sh field` |
| G3 | foto 3200x2400 tersimpan 1600x1200 (237.639 byte), rasio 4:3 terjaga | `mobile-web.sh field` |

Yang tetap HARUS diuji di HP dan tidak boleh dianggap selesai karena tabel di
atas: layar benar-benar menyala, kamera `content://`, GPS asli, pemulihan peta
GeoPDF setelah app dibuka lagi, dan rekaman di latar belakang.

## 5. Yang tidak diuji di dokumen ini

- **G4 (geser vertex di layar sentuh).** Butuh tangan di layar; tidak bisa
  diperiksa lewat `adb`. Tetap daftar uji lapangan di `02-audit-p0.md`.
- **Rekam jejak saat app di latar belakang.** Belum ada foreground service;
  S6 hanya membuktikan layar tidak mati saat app di depan.
- **Pembersihan byte arsip saat layer GeoPDF dihapus.** `deleteGeoPdfTileCache`
  belum punya pemanggil, jadi arsip hanya dibatasi 96 MB per PDF dan tidak
  dibersihkan otomatis.
- **Kualitas hasil kompres foto.** S7 membuktikan ukuran, bukan ketajaman.

## 6. Berkas APK yang sudah diverifikasi di laptop

Artifact run 42978727740 diunduh ke `~/g98/apk-out/` pada 2026-11-11 14:50 WIB.
Pemeriksaan di bawah dijalankan di laptop, bukan di HP: ini membuktikan berkasnya
utuh dan benar-benar hasil build `94e1d519`, belum membuktikan perilaku di perangkat.

| Perintah | Keluaran |
|---|---|
| `gh run view 42978727740 --json conclusion,headSha` | `conclusion=success`, `headSha=94e1d51937891c3a73873e3e8c0d7efa2961817e` |
| `gh run view 42978727740 --json jobs` | `Build Android APK (release) => success`, `Measure app startup (emulator) => success` |
| `python3 -c "zipfile.ZipFile(...).testzip()"` | `zip_ok True`, 703 entri, `AndroidManifest.xml` + `.dex` ada |
| `aapt dump badging` | `com.geokebun.app`, `versionCode=1000`, `versionName=0.1.0`, `sdkVersion=24`, `targetSdkVersion=37` |
| `apksigner verify --print-certs` | `CN=GeoApps, O=Geokebun, L=Indonesia, C=ID`, SHA-256 `eb73ac3b059c18a3646474db58a8b45e3042f36ad19e60f8d00405311ef2c8e6` |

| Berkas | Ukuran | SHA-256 |
|---|---|---|
| `geolibre-android-arm64.apk` | 54.906.940 B | `d960210dca510310f7a56dce6560bafe665d9d1ac1ea901a98d5514ec35a4e72` |
| `geolibre-android-arm.apk` | 49 MB | `fb67eadf62f2e846bcc537c96a12ee3275ddccccf7d350df0fc6bdb4263c8793` |
| `geolibre-android-x86_64.apk` | 54 MB | `ad793e888acabea917f98337784c6131a552e77007ace3464cc515a049969905` |
| `geolibre-android-x86.apk` | 54 MB | `c3cbfb470972f42805e01a26fdabdd75914e5baa3ac1d72a0e0f906887e73a9e` |

Untuk HP Adi (Tecno Pova 6, arm64): `geolibre-android-arm64.apk`.

Per 2026-11-11 14:52 WIB `adb devices -l` **kosong** (nol perangkat) dan
`tailscale status` menampilkan `tecno-pova-6` (100.99.233.81) `offline, last seen
6d ago`. Karena itu S1-S8 belum bisa dijalankan dan tabel bagian 4 tetap kosong.
