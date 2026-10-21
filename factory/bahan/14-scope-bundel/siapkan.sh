#!/usr/bin/env bash
# Ambil berkas permission plugin fs yang PERSIS dipakai aplikasi.
#
# Yang diunduh adalah paket crate dari crates.io, bukan salinan yang ditempel di
# repo, supaya isinya tidak bisa basi tanpa ketahuan: versi dan sha256 ditulis di
# sini, dan alatnya menolak jalan kalau `apps/geolibre-desktop/src-tauri/Cargo.lock`
# memuat versi lain.
#
# Pakai: ./siapkan.sh   lalu   ./target/release/scope-bundel
set -eu

VERSI="2.7.1"
SHA256="5d58eb1d4984e535f47a642ffec09a2da6f5c18a12b5902d12126cb7626d628b"
TUJUAN="permissions-fs-${VERSI}"
URL="https://static.crates.io/crates/tauri-plugin-fs/tauri-plugin-fs-${VERSI}.crate"

if [ -d "$TUJUAN" ]; then
  echo "sudah ada: $TUJUAN (hapus dulu kalau mau unduh ulang)"
  exit 0
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "unduh $URL"
curl -fsSL -A "opencrabs/1.0" "$URL" -o "$TMP/paket.crate"

DAPAT=$(sha256sum "$TMP/paket.crate" | cut -d' ' -f1)
if [ "$DAPAT" != "$SHA256" ]; then
  echo "sha256 tidak cocok" >&2
  echo "  diharapkan: $SHA256" >&2
  echo "  didapat   : $DAPAT" >&2
  exit 1
fi

tar -xzf "$TMP/paket.crate" -C "$TMP"
mkdir -p "$TUJUAN"
cp -r "$TMP/tauri-plugin-fs-${VERSI}/permissions/." "$TUJUAN/"
echo "ok: $TUJUAN ($(find "$TUJUAN" -name '*.toml' | wc -l) berkas toml, sha256 paket $SHA256)"
