#!/usr/bin/env bash
# Debug cepat lapisan web GeoApps di emulasi HP: Chrome + Playwright, nol emulator.
#
#   bash factory/scripts/mobile-web.sh serve    # sajikan dist yang ADA di :4173
#   bash factory/scripts/mobile-web.sh field    # spec offline/arsip GeoPDF (~1 menit)
#   bash factory/scripts/mobile-web.sh smoke    # suite core repo (boot + peta + tabel)
#   bash factory/scripts/mobile-web.sh watch    # spec offline, jendela terlihat
#   bash factory/scripts/mobile-web.sh all      # serve + field
#
# Kenapa ini ada: emulator Android di laptop ini jalan TANPA KVM (VT-x mati di
# BIOS), jadi boot API 30 lewat TCG tidak selesai dalam 36 menit. Jalur Chrome
# memakai build yang sama dengan APK untuk lapisan web, jadi iterasi hitungan
# detik, bukan menit. Yang TIDAK bisa dibuktikan di sini: wake lock layar, izin
# kamera content://, GPS asli, background track recording, dan pemulihan proyek
# saat app dibuka lagi. Itu tetap butuh HP atau emulator ber-KVM.

set -euo pipefail

PORT="${E2E_PORT:-4173}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

up() {
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "http://localhost:$PORT/" || true)
    [ "$code" = "200" ]
}

serve() {
    if up; then
        echo "preview sudah hidup di :$PORT"
        return 0
    fi
    # dist harus ada; kalau tidak, bangun sekali (mahal, dan rawan OOM).
    if [ ! -f apps/geolibre-desktop/dist/index.html ]; then
        echo "dist belum ada, membangun (tsc + vite, bisa lama)..." >&2
        NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2560}" npm run build
    fi
    echo "menyalakan preview di :$PORT"
    setsid nohup npm run preview -w geolibre-desktop -- --port "$PORT" --strictPort \
        > /tmp/geoapps-preview.log 2>&1 < /dev/null &
    for _ in $(seq 1 25); do
        up && { echo "preview siap: http://localhost:$PORT"; return 0; }
        sleep 2
    done
    echo "preview gagal hidup; log terakhir:" >&2
    tail -15 /tmp/geoapps-preview.log >&2
    return 1
}

# Tiga spec lapangan: G1 (arsip GeoPDF lintas restart proses), G2 (wake lock
# saat merekam), G3 (foto dikecilkan sebelum disimpan). Dijalankan serial
# karena SwiftShader memakai CPU, dan tiap spec membuka proses Chrome sendiri.
FIELD_SPECS=(
    e2e/mobile-offline-field.spec.ts
    e2e/mobile-wake-lock.spec.ts
    e2e/mobile-photo-downscale.spec.ts
)

field() {
    up || serve
    local headed="${1:-}"
    local extra=()
    # `[ ... ] && extra=(--headed)` di bawah `set -e` akan menghentikan skrip
    # saat kondisinya salah: exit status daftar `&&` yang gagal tetap 1. Pakai if.
    if [ "$headed" = "watch" ]; then
        extra=(--headed)
    fi
    E2E_PORT="$PORT" npx playwright test "${FIELD_SPECS[@]}" \
        --project=features --reporter=list --workers=1 "${extra[@]}"
}

case "${1:-help}" in
serve) serve ;;
field) field ;;
watch) field watch ;;
smoke) up || serve; E2E_PORT="$PORT" npx playwright test --project=core --reporter=list ;;
all) serve; field ;;
*)
    cat <<'USAGE'
pakai: bash factory/scripts/mobile-web.sh <serve|field|watch|smoke|all>

  serve  sajikan build yang sudah ada di :4173 (nol rebuild)
  field  spec offline + arsip GeoPDF lintas restart proses
  watch  sama, tapi jendela Chrome terlihat (pakai HEADED=1 di mesin ber-display)
  smoke  suite core repo: app boot, peta render, tabel atribut
  all    serve lalu field
USAGE
    ;;
esac
