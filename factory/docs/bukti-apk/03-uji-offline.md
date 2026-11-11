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

## 5. Yang tidak diuji di dokumen ini

- **G4 (geser vertex di layar sentuh).** Butuh tangan di layar; tidak bisa
  diperiksa lewat `adb`. Tetap daftar uji lapangan di `02-audit-p0.md`.
- **Rekam jejak saat app di latar belakang.** Belum ada foreground service;
  S6 hanya membuktikan layar tidak mati saat app di depan.
- **Pembersihan byte arsip saat layer GeoPDF dihapus.** `deleteGeoPdfTileCache`
  belum punya pemanggil, jadi arsip hanya dibatasi 96 MB per PDF dan tidak
  dibersihkan otomatis.
- **Kualitas hasil kompres foto.** S7 membuktikan ukuran, bukan ketajaman.
