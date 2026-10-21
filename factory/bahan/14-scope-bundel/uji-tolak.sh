#!/usr/bin/env bash
# Membuktikan alat ini BISA MENOLAK, bukan cuma menerima.
#
# Gate yang cuma pernah hijau tidak membuktikan apa pun. Skrip ini membuang
# `fs:default` dari SALINAN capability (berkas aslinya tidak disentuh), menjalankan
# alatnya, lalu menuntut dua hal: alat itu keluar 1, dan jumlah baris `SALAH`
# tepat 6 (satu per perintah). Kalau alatnya tetap hijau di capability yang
# seharusnya gagal, skrip ini yang gagal.
#
# Pakai: ./uji-tolak.sh   (sesudah ./siapkan.sh && cargo build --release)
set -eu

cd "$(dirname "$0")"

CAP=../../../apps/geolibre-desktop/src-tauri/capabilities/default.json
SALINAN=/tmp/cap-tanpa-fs-default.json

python3 - "$CAP" "$SALINAN" <<'PY'
import json
import sys

sumber, tujuan = sys.argv[1], sys.argv[2]
with open(sumber, encoding="utf-8") as f:
    isi = json.load(f)
isi["permissions"] = [p for p in isi["permissions"] if p != "fs:default"]
with open(tujuan, "w", encoding="utf-8") as f:
    json.dump(isi, f, indent=2)
print(f"fs:default dibuang dari salinan: {tujuan}")
PY

set +e
KELUARAN=$(./target/release/scope-bundel "$SALINAN" permissions-fs-2.7.1 2>&1)
KODE=$?
set -e

echo "$KELUARAN" | sed -n '/### S0/,/### S1/p' | grep -E '^  SALAH' || true
JUMLAH=$(echo "$KELUARAN" | sed -n '/### S0/,/### S1/p' | grep -cE '^  SALAH' || true)

if [ "$KODE" -ne 1 ]; then
  echo "GAGAL: alat keluar $KODE, diharapkan 1" >&2
  exit 1
fi
if [ "$JUMLAH" -ne 6 ]; then
  echo "GAGAL: $JUMLAH baris SALAH di S0, diharapkan 6" >&2
  exit 1
fi

echo "ok: alat menolak capability tanpa fs:default (exit 1, $JUMLAH baris SALAH di S0)"
