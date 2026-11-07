# Bukti 01: APK GeoApps dibangun dan diverifikasi

Tanggal: 2026-11-07 22:37 WIB
Cabang: `feat/offline-basemap-wiring` (HEAD `ea8fb67e`)
Run CI: https://github.com/adi805/GeoApps/actions/runs/42384608244 (success)

## Yang dibangun

| Item | Nilai |
|---|---|
| Berkas | `GeoApps arm64 v0.1.0 071126-2237.apk` |
| Ukuran | 53 MB |
| SHA-256 | `625dcec0f2133baf7264024714f894bca2bc44f81b58ad2c8aaae4f9df7e6615` |
| Package | `com.geokebun.app` (dibaca `aapt2 dump packagename`) |
| versionName / versionCode | `0.1.0` / `1000` |
| Label | `GeoApps` |
| minSdk | 24 (Android 7.0) |
| targetSdk / compileSdk | 37 |
| ABI | `arm64-v8a` |
| Penanda tangan | `CN=GeoApps, O=Geokebun, L=Indonesia, C=ID` |
| Sertifikat SHA-256 | `eb73ac3b059c18a3646474db58a8b45e3042f36ad19e60f8d00405311ef2c8e6` |
| Validitas sertifikat | sampai 2056 |

Pemeriksaan yang dijalankan sesudah unduh:

```
aapt2 dump packagename   -> com.geokebun.app
apksigner verify --print-certs -> Verifies (1 signer)
zipalign -c -P 16 -v 4  -> Verification successful
```

`zipalign -P 16` membuktikan larangan halaman 16 KB terpenuhi (syarat Google Play
sejak 2025-11-01 untuk aplikasi yang menargetkan Android 15+).

## Dari mana APK ini lahir

Runner GitHub Actions `ubuntu-22.04`, job `Build Android APK (release)`, 27 menit.
Rantai langkahnya: `npx tauri android init` → verifikasi package id hasil generate →
ikon + MainActivity → `npx tauri android build --apk --split-per-abi` → verifikasi
package id di dalam APK → verifikasi `lib/*/*.so` selaras 16 KB → `apksigner sign`
dengan keystore rahasia → unggah artefak.

Repo bersifat publik, jadi tidak ada biaya menit Actions untuk run ini.

## Kenapa dibangun di CI, bukan di laptop

- `/home` terpakai 97% (sisa 2,3 GB); build Rust Android butuh lebih dari itu.
- Laptop 4 core dengan load rata-rata ~24 saat pekerjaan ini berjalan; job CI 27 menit
  akan menjadi berjam-jam dan mengunci mesin.
- Runner sudah menyediakan NDK 27.3.13750724, platform 36, build-tools 36.0.0.
  Salinan lokal di `/mnt/ext/android-sdk` baru memuat platform-tools + build-tools.

## Kerahasiaan keystore

Keystore rilis ada di `~/.opencrabs/secrets/geoapps-release.jks` (di luar repo) dan
tidak pernah di-commit. Empat nilai yang dibutuhkan workflow disimpan sebagai
GitHub Actions secret pada `adi805/GeoApps`:

```
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

`gh api repos/adi805/GeoApps/actions/secrets --jq '.total_count'` mengembalikan `4`.

## Cara memasang di HP

USB (debugging USB aktif):

```
export PATH="/mnt/ext/android-sdk/platform-tools:$PATH"
adb install -r "GeoApps arm64 v0.1.0 071126-2237.apk"
```

Nirkabel (Android 11+): aktifkan Wireless debugging di HP, lalu

```
adb pair <ip>:<port>     # kode pairing dari layar HP
adb connect <ip>:5555
adb install -r "GeoApps arm64 v0.1.0 071126-2237.apk"
```

Skrip pembantu: `/tmp/install-apk.sh <path-apk>` (memeriksa perangkat, melepas versi
lama, memasang, lalu mencetak versionName yang benar-benar terpasang).

## Yang BELUM dibuktikan di dokumen ini

Instalasi ke HP dan uji lapangan. Itu isi berkas bukti berikutnya: aplikasi dibuka,
peta tampil, GPS hidup, lalu uji mode pesawat.
