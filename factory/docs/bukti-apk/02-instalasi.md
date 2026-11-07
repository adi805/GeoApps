# Bukti 02: APK terpasang dan berjalan

Tanggal: 2026-11-07 22:45 WIB
APK: `GeoApps arm64 v0.1.0 071126-2237.apk`
SHA-256: `625dcec0f2133baf7264024714f894bca2bc44f81b58ad2c8aaae4f9df7e6615`

## 1. Terpasang dan diluncurkan di emulator (bukti mesin)

Job `Measure app startup (emulator)` pada run CI 42384608244 menjalankan APK
`geolibre-android-x86_64.apk` di emulator resmi Android, lalu membaca log sistem.
Keluaran mentah `startup.txt` yang diunggah sebagai artefak `android-startup-measurement`:

```
APK     : apks/geolibre-android-x86_64.apk
paket   : com.geokebun.app
perangkat: sdk_gphone64_x86_64 (Android 16, API 36, x86_64)
--- pemanasan (tidak dihitung) ---
peluncuran dingin 1: 1364 ms
I/ActivityTaskManager(  626): Displayed com.geokebun.app/.MainActivity for user 0: +1s364ms
peluncuran dingin 2: 2588 ms
peluncuran dingin 3: 3073 ms
I/ActivityTaskManager(  626): Displayed com.geokebun.app/.MainActivity for user 0: +3s73ms
RINGKAS: n=3 min=1364 median=2588 maks=3073 ms
```

Yang dibuktikan baris `Displayed com.geokebun.app/.MainActivity`: aplikasi benar-benar
terpasang, prosesnya hidup, dan layar utamanya tampil. APK yang gagal saat start tidak
akan pernah mengeluarkan baris itu, dan langkah pengukuran akan gagal.

Yang TIDAK dibuktikan oleh emulator: perilaku di HP Adi (peta offline, GPS asli,
mode pesawat). Emulator tidak punya sinyal GPS nyata.

## 2. Dikirim ke HP Adi

Batas unggah Telegram Bot API adalah 50 MB, APK ini 52,4 MiB, sehingga pengiriman
lewat `telegram_send` ditolak (`Request Entity Too Large`). Dikirim lewat WhatsApp
(batas dokumen 100 MB):

```
Document sent to 6282361295343@s.whatsapp.net via WhatsApp.
Document sent to 62895393276975@s.whatsapp.net via WhatsApp.
```

Berkas yang sama bisa diunduh ulang dari artefak CI:

```
gh run download 42384608244 -R adi805/GeoApps -n geolibre-android-release-apks -D .
```

## 3. Pemasangan lewat adb (belum dijalankan)

`adb devices` pada 2026-11-07 22:40 WIB mengembalikan daftar kosong: belum ada HP
yang tersambung ke laptop, dan pairing nirkabel butuh kode dari layar HP. Perintah
yang siap dipakai begitu perangkat tersambung:

```
export PATH="/mnt/ext/android-sdk/platform-tools:$PATH"
adb install -r "GeoApps arm64 v0.1.0 071126-2237.apk"
adb shell pm list packages | grep geokebun
adb shell dumpsys package com.geokebun.app | grep -E 'versionName|versionCode'
adb logcat -d | grep -i -E 'geokebun|AndroidRuntime' | tail -30
```

Kriteria terima yang belum terpenuhi, dan karena itu dicatat apa adanya:

- [ ] `adb shell pm list packages | grep -q com.geokebun.app` (perlu HP tersambung)
- [ ] aplikasi dibuka di HP Adi tanpa crash
- [ ] peta tampil tanpa jaringan
- [ ] GPS hidup
- [ ] uji mode pesawat setelah aplikasi ditutup paksa

Empat butir terakhir adalah isi berkas `03-uji-offline.md`, yang hanya bisa diisi
setelah pemasangan di perangkat nyata.
