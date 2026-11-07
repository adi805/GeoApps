#!/usr/bin/env bash
# Sumberkan skrip ini sebelum build Android:
#   source factory/scripts/android-env.sh
# Cek kesiapan tanpa mengubah shell:
#   bash factory/scripts/android-env.sh --check
#
# SDK sengaja di /mnt/ext, bukan /home: partisi /home cuma sisa 3,5 GB
# sementara SDK + NDK + cache gradle butuh belasan GB.
#
# Versi di bawah HARUS sama dengan .github/workflows/android.yml dan
# docs/android.md. Kalau salah satu naik, naikkan di tiga tempat sekaligus.

export ANDROID_HOME="${ANDROID_HOME:-/mnt/ext/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# NDK r27 LTS = lini yang didukung Tauri v2. r27 BELUM 16 KB-aligned secara
# default (r28 baru), makanya RUSTFLAGS di bawah wajib.
export NDK_VERSION="${NDK_VERSION:-27.3.13750724}"
export NDK_HOME="$ANDROID_HOME/ndk/$NDK_VERSION"
export ANDROID_PLATFORM="platforms;android-36"
export ANDROID_BUILD_TOOLS_VERSION="36.0.0"
export ANDROID_BUILD_TOOLS="$ANDROID_HOME/build-tools/$ANDROID_BUILD_TOOLS_VERSION"

export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}"

# /home cuma sisa ~2,7 GB (96% penuh). Satu build release arm64 mengisi target
# Rust beberapa GB, dan gradle menyimpan cache distribusi + artefak di home.
# Dua-duanya dialihkan ke /mnt/ext supaya build tidak mati di tengah karena ENOSPC.
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-/mnt/ext/geoapps-build/target}"
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-/mnt/ext/geoapps-build/gradle}"
mkdir -p "$CARGO_TARGET_DIR" "$GRADLE_USER_HOME" 2>/dev/null || true

# Play menolak .so yang LOAD segment-nya bukan 16 KB sejak app target Android 15+.
# WAJIB lewat env RUSTFLAGS, bukan target.<triple>.rustflags di .cargo/config.toml:
# Tauri CLI men-set RUSTFLAGS sendiri dan env menang atas file config, jadi bentuk
# file config diabaikan tanpa error.
export RUSTFLAGS="${RUSTFLAGS:--C link-arg=-Wl,-z,max-page-size=16384 -C link-arg=-Wl,-z,common-page-size=16384}"

case ":$PATH:" in
  *":$ANDROID_HOME/platform-tools:"*) ;;
  *) PATH="$ANDROID_HOME/platform-tools:$PATH" ;;
esac
case ":$PATH:" in
  *":$ANDROID_HOME/cmdline-tools/latest/bin:"*) ;;
  *) PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH" ;;
esac
export PATH

if [ "$1" = "--check" ]; then
  fail=0
  cek() {
    if [ -e "$2" ]; then
      printf 'OK    %-24s %s\n' "$1" "$2"
    else
      printf 'GAGAL %-24s %s\n' "$1" "$2"
      fail=1
    fi
  }
  cek "adb"         "$ANDROID_HOME/platform-tools/adb"
  cek "sdkmanager"  "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
  cek "build-tools" "$ANDROID_BUILD_TOOLS/apksigner"
  cek "zipalign"    "$ANDROID_BUILD_TOOLS/zipalign"
  cek "platform-36" "$ANDROID_HOME/platforms/android-36/android.jar"
  cek "ndk clang"   "$NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/clang"
  cek "ndk source"  "$NDK_HOME/source.properties"
  cek "java"        "$JAVA_HOME/bin/java"
  for t in aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android; do
    if ~/.cargo/bin/rustup target list --installed 2>/dev/null | grep -qx "$t"; then
      printf 'OK    %-24s %s\n' "rust target" "$t"
    else
      printf 'GAGAL %-24s %s\n' "rust target" "$t"
      fail=1
    fi
  done
  exit $fail
fi
