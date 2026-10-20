#!/usr/bin/env bash
# ukur-waktu-mulai.sh - ukur waktu mulai aplikasi Android di emulator.
#
# Kenapa ada: issue #9 menuntut angka waktu mulai, bukan pernyataan bahwa
# aplikasinya "terasa cepat". Angka itu harus datang dari perangkat atau
# emulator yang disebut namanya, supaya bisa diulang orang lain.
#
# Yang diukur, dan definisinya (jangan ditukar diam-diam):
#   `am start -W` -> TotalTime
#     Waktu dari ActivityManager menerima startActivity sampai frame pertama
#     Activity itu tampil. Pada peluncuran dingin (proses belum hidup), angka ini
#     mencakup fork proses, Application.onCreate, Activity.onCreate, dan frame
#     pertama WebView.
#   Ini BUKAN "sampai peta siap". Peta siap adalah keadaan di sisi WebView, dan
#   penandanya harus `performance.mark` di aplikasi web (apps/geolibre-desktop/
#   src/**), yang di luar cakupan lane android. Yang dilaporkan di sini adalah
#   batas atas yang bisa diukur tanpa menyentuh kode frontend; lihat receipt.
#
# Emulator menjalankan WebGL lewat SwiftShader (software), jadi angkanya lebih
# lambat daripada perangkat dengan GPU. Itu disebut di receipt, bukan disembunyikan.
#
# Cara pakai:
#   bash ukur-waktu-mulai.sh <direktori-apk> [jumlah-peluncuran-dingin]
# Contoh:
#   bash apps/geolibre-desktop/src-tauri/android/ukur-waktu-mulai.sh apks 3

set -euo pipefail

direktori_apk="${1:?direktori APK wajib diberikan}"
ulangan="${2:-3}"

if [ ! -d "$direktori_apk" ]; then
  echo "::error::direktori APK tidak ada: $direktori_apk" >&2
  exit 1
fi

# x86_64 dulu: emulator CI memakai arch itu. APK per-ABI lain tidak bisa dipasang.
apk="$(find "$direktori_apk" -name '*x86_64*.apk' | head -n 1)"
if [ -z "$apk" ]; then
  echo "::error::tidak ada APK x86_64 di $direktori_apk; yang ada:" >&2
  find "$direktori_apk" -name '*.apk' -printf '  %f\n' >&2 || true
  exit 1
fi

# aapt2 tidak selalu ada di PATH; di runner ia hidup di build-tools terbaru.
if command -v aapt2 >/dev/null 2>&1; then
  aapt2_bin="$(command -v aapt2)"
else
  aapt2_bin="$(find "${ANDROID_HOME:?ANDROID_HOME belum diset}/build-tools" -name aapt2 -type f |
    sort -V | tail -n 1)"
fi
paket="$("$aapt2_bin" dump packagename "$apk")"
echo "APK     : $apk"
echo "paket   : $paket"

# Nama perangkat/emulator dicatat dari adb, bukan dari nama AVD yang kita
# harapkan: yang dilaporkan harus perangkat yang benar-benar menjalankan uji.
perangkat="$(adb shell getprop ro.product.model | tr -d '\r')"
versi_android="$(adb shell getprop ro.build.version.release | tr -d '\r')"
sdk="$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
abi="$(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
echo "perangkat: $perangkat (Android $versi_android, API $sdk, $abi)"

adb install -r "$apk" >/dev/null
adb shell am force-stop "$paket"

# Peluncuran pemanasan: halaman pertama sebuah WebView membayar kompilasi JIT,
# deksripsi aset, dan cache disk. Tanpa ini, angka pertama mengukur hal yang
# tidak dialami pengguna pada peluncuran kedua dan seterusnya.
echo "--- pemanasan (tidak dihitung) ---"
adb logcat -c || true
adb shell am start -W -n "$paket/.MainActivity" >/dev/null
sleep 5
adb shell am force-stop "$paket"
sleep 2

total_ms=()
for i in $(seq 1 "$ulangan"); do
  adb logcat -c || true
  keluaran="$(adb shell am start -W -n "$paket/.MainActivity")"
  t="$(printf '%s\n' "$keluaran" | sed -n 's/^TotalTime: *//p' | tr -d '\r')"
  if [ -z "$t" ]; then
    echo "::error::peluncuran ke-$i tidak melaporkan TotalTime:" >&2
    printf '%s\n' "$keluaran" >&2
    exit 1
  fi
  total_ms+=("$t")
  echo "peluncuran dingin $i: ${t} ms"
  # Baris Displayed dari logcat adalah ukuran kedua yang independen dari
  # `am start -W`; kalau keduanya berpisah jauh, ada yang salah dengan
  # interpretasi, dan itu perlu terlihat.
  adb logcat -d -v brief 2>/dev/null | grep -m1 "Displayed $paket" || true
  adb shell am force-stop "$paket"
  sleep 2
done

printf '%s\n' "${total_ms[@]}" | sort -n | awk '
  { a[NR] = $1 }
  END {
    median = (NR % 2) ? a[(NR + 1) / 2] : int((a[NR / 2] + a[NR / 2 + 1]) / 2)
    printf "RINGKAS: n=%d min=%d median=%d maks=%d ms\n", NR, a[1], median, a[NR]
  }'
