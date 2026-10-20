#!/usr/bin/env bash
# jalankan-ukur.sh - pembungkus pengukuran untuk langkah emulator di CI.
#
# Kenapa ada: `ReactiveCircus/android-emulator-runner` TIDAK menjalankan input
# `script:` sebagai satu blok. `src/script-parser.ts` di action itu memecahnya
# per baris, membuang baris kosong dan baris berawalan `#`, lalu mengeksekusi
# TIAP baris sebagai perintah `sh -c` tersendiri. Konsekuensinya continuation
# `\` tidak menyambung apa pun dan blok `{ ... }` tidak bisa melintasi baris.
# Run 39340791618 mengukur dengan benar (n=3, median 2416 ms) lalu mati di baris
# `> startup.txt 2>&1 || {` dengan "Syntax error: end of file unexpected".
#
# Jadi seluruh urutan di bawah ini dipanggil dari SATU baris `script:` di
# .github/workflows/android.yml. Kalau isi berkas ini bertambah, jangan pindahkan
# ke YAML: taruh di sini.
#
# Yang dilakukan: jalankan ukur-waktu-mulai.sh, simpan keluarannya ke berkas
# (bukan pipe ke tee, supaya exit code pengukuran tidak tertutup oleh tee),
# cetak ke log, lalu salin ke ringkasan langkah.
#
# Cara pakai:
#   bash jalankan-ukur.sh <direktori-apk> [jumlah-peluncuran-dingin]

set -euo pipefail

direktori_apk="${1:?direktori APK wajib diberikan}"
ulangan="${2:-3}"
keluaran="startup.txt"
di_sini="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Exit code pengukuran disimpan dulu, bukan ditelan: langkah CI harus merah kalau
# pengukurannya gagal, tapi berkas buktinya tetap harus ada untuk dibaca.
kode=0
bash "$di_sini/ukur-waktu-mulai.sh" "$direktori_apk" "$ulangan" >"$keluaran" 2>&1 || kode=$?

cat "$keluaran"

# Di runner GitHub variabel ini selalu diset. Di mesin lokal dibiarkan opsional
# supaya skripnya bisa diuji tanpa menulis ke ringkasan milik siapa pun.
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Waktu mulai Android"
    echo
    echo '```'
    cat "$keluaran"
    echo '```'
  } >>"$GITHUB_STEP_SUMMARY"
fi

exit "$kode"
