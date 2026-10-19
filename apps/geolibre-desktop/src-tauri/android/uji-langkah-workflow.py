#!/usr/bin/env python3
"""uji-langkah-workflow.py - jalankan langkah workflow android.yml di pohon tiruan.

Kenapa ada: dua langkah di `.github/workflows/android.yml` ("Read Android package
identity" dan "Apply GeoLibre MainActivity") menentukan jalur paket Android. Bug
yang diperbaiki issue #9 lahir justru karena jalur itu ditulis harfiah
(`java/org/geolibre/app`) sementara `identifier` sudah `com.geokebun.app`: `test
-f` gagal, dan pesannya tidak menyebut sebabnya.

Menguji ulang dengan menyalin logika langkahnya ke sini akan menguji salinan, bukan
langkah yang dijalankan CI. Jadi berkas ini **mengekstrak skrip `run:` asli** dari
workflow lewat PyYAML, menjalankannya dengan `bash -euo pipefail` di direktori
sementara yang berisi `gen/android` tiruan, lalu memeriksa exit code dan efeknya.

Yang diperiksa:
  1. jalur tujuan diturunkan dari `identifier` (ganti identifier -> jalur ikut),
  2. salinan berhasil saat paket sumber cocok,
  3. ditolak saat paket sumber tidak cocok, dan berkas tujuan tidak tersentuh,
  4. ditolak saat berkas hasil generate tidak ada, dengan daftar .kt yang ada,
  5. ditolak saat `identifier` bukan nama paket yang sah.

Cara pakai:
  python3 apps/geolibre-desktop/src-tauri/android/uji-langkah-workflow.py
  python3 .../uji-langkah-workflow.py --workflow .github/workflows/android.yml
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile

import yaml

LANGKAH_IDENTITAS = "Read Android package identity"
LANGKAH_MAIN = "Apply GeoLibre MainActivity"
CONF = "apps/geolibre-desktop/src-tauri/tauri.android.conf.json"
SUMBER = "apps/geolibre-desktop/src-tauri/android/MainActivity.kt"


def skrip_langkah(workflow, nama):
    """Kembalikan (skrip, working-directory) persis seperti yang dipakai CI.

    working-directory ikut dibaca: langkah aslinya berjalan di
    apps/geolibre-desktop, dan mengabaikannya membuat harness menguji jalur yang
    salah lalu gagal karena alasan yang tidak ada di CI.
    """
    with open(workflow, encoding="utf-8") as fh:
        dok = yaml.safe_load(fh)
    for langkah in dok["jobs"]["build"]["steps"]:
        if langkah.get("name") == nama:
            return langkah["run"], langkah.get("working-directory") or "."
    raise SystemExit("langkah %r tidak ditemukan di %s" % (nama, workflow))


def tulis(path, isi):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(isi)


def jalankan(akar, langkah, env_tambahan=None):
    skrip, wd = langkah
    env = dict(os.environ)
    env.setdefault("GITHUB_ENV", os.path.join(akar, ".github_env"))
    env.update(env_tambahan or {})
    return subprocess.run(
        ["bash", "-euo", "pipefail", "-c", skrip],
        cwd=os.path.join(akar, wd),
        env=env,
        capture_output=True,
        text=True,
    )


def baca_github_env(path):
    hasil = {}
    if not os.path.exists(path):
        return hasil
    with open(path, encoding="utf-8") as fh:
        for baris in fh:
            if "=" in baris:
                k, v = baris.rstrip("\n").split("=", 1)
                hasil[k] = v
    return hasil


def siapkan_pohon(akar, identifier, paket_sumber, ada_berkas_generate=True):
    tulis(
        os.path.join(akar, CONF),
        '{"identifier": "%s", "productName": "GeoKebun"}\n' % identifier,
    )
    tulis(
        os.path.join(akar, SUMBER),
        "// uji\npackage %s\n\nclass MainActivity\n" % paket_sumber,
    )
    if ada_berkas_generate:
        jalur = os.path.join(
            akar,
            "apps/geolibre-desktop/src-tauri/gen/android/app/src/main/java",
            identifier.replace(".", "/"),
            "MainActivity.kt",
        )
        tulis(jalur, "// hasil generate tauri\npackage %s\n" % identifier)
    os.makedirs(
        os.path.join(akar, "apps/geolibre-desktop/src-tauri/gen/android/app/src/main/java"),
        exist_ok=True,
    )


def kasus(nama, fn):
    akar = tempfile.mkdtemp(prefix="uji-android-")
    try:
        fn(akar)
        print("LULUS %s" % nama)
        return True
    except AssertionError as exc:
        print("GAGAL %s: %s" % (nama, exc))
        return False
    finally:
        shutil.rmtree(akar, ignore_errors=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--workflow", default=".github/workflows/android.yml")
    args = p.parse_args()

    skrip_id = skrip_langkah(args.workflow, LANGKAH_IDENTITAS)
    skrip_main = skrip_langkah(args.workflow, LANGKAH_MAIN)
    gagal = 0

    def positif(akar):
        siapkan_pohon(akar, "com.geokebun.app", "com.geokebun.app")
        r1 = jalankan(akar, skrip_id)
        assert r1.returncode == 0, "langkah identitas exit %d: %s" % (r1.returncode, r1.stderr)
        env = baca_github_env(os.path.join(akar, ".github_env"))
        assert env.get("EXPECTED_PACKAGE") == "com.geokebun.app", env
        assert env.get("PACKAGE_PATH") == "com/geokebun/app", env
        r2 = jalankan(akar, skrip_main, env)
        assert r2.returncode == 0, "langkah MainActivity exit %d: %s" % (r2.returncode, r2.stderr)
        target = os.path.join(
            akar,
            "apps/geolibre-desktop/src-tauri/gen/android/app/src/main/java/com/geokebun/app/MainActivity.kt",
        )
        with open(target, encoding="utf-8") as fh:
            assert "// uji" in fh.read(), "sumber tidak tersalin ke %s" % target

    def jalur_ikut_identifier(akar):
        # identifier lain harus menghasilkan jalur lain: membuktikan nilainya
        # dibaca, bukan dihafal di dalam workflow.
        siapkan_pohon(akar, "id.contoh.app", "id.contoh.app")
        r1 = jalankan(akar, skrip_id)
        assert r1.returncode == 0, r1.stderr
        env = baca_github_env(os.path.join(akar, ".github_env"))
        assert env.get("PACKAGE_PATH") == "id/contoh/app", env
        r2 = jalankan(akar, skrip_main, env)
        assert r2.returncode == 0, r2.stderr

    def paket_tidak_cocok(akar):
        # Sumber masih org.geolibre.app: harus ditolak, dan berkas tujuan tidak
        # boleh tertimpa (kalau tertimpa, build lolos dengan kelas di paket salah).
        siapkan_pohon(akar, "com.geokebun.app", "org.geolibre.app")
        env = baca_github_env(os.path.join(akar, ".github_env"))
        env.update({"EXPECTED_PACKAGE": "com.geokebun.app", "PACKAGE_PATH": "com/geokebun/app"})
        r = jalankan(akar, skrip_main, env)
        assert r.returncode != 0, "salinan paket salah diterima"
        assert "org.geolibre.app" in (r.stdout + r.stderr), r.stdout + r.stderr
        target = os.path.join(
            akar,
            "apps/geolibre-desktop/src-tauri/gen/android/app/src/main/java/com/geokebun/app/MainActivity.kt",
        )
        with open(target, encoding="utf-8") as fh:
            assert "hasil generate tauri" in fh.read(), "berkas tujuan tertimpa walau ditolak"

    def berkas_generate_hilang(akar):
        # Keadaan bug asli: tauri menaruh MainActivity di jalur identifier, dan
        # jalur harfiah lama tidak ada. Harus gagal dengan daftar .kt yang ada.
        siapkan_pohon(akar, "com.geokebun.app", "com.geokebun.app", ada_berkas_generate=False)
        tulis(
            os.path.join(
                akar,
                "apps/geolibre-desktop/src-tauri/gen/android/app/src/main/java/org/geolibre/app/MainActivity.kt",
            ),
            "package org.geolibre.app\n",
        )
        env = {"EXPECTED_PACKAGE": "com.geokebun.app", "PACKAGE_PATH": "com/geokebun/app"}
        r = jalankan(akar, skrip_main, env)
        assert r.returncode != 0, "berkas hilang tidak ditolak"
        gabung = r.stdout + r.stderr
        assert "com/geokebun/app/MainActivity.kt" in gabung, gabung
        assert "org/geolibre/app/MainActivity.kt" in gabung, "daftar .kt tidak dicetak: " + gabung

    def identifier_tidak_sah(akar):
        siapkan_pohon(akar, "com..app", "com..app")
        r = jalankan(akar, skrip_id)
        assert r.returncode != 0, "identifier cacat diterima"
        assert "not a valid Android package id" in (r.stdout + r.stderr), r.stdout + r.stderr

    for nama, fn in [
        ("jalur diturunkan dari identifier, salinan berhasil", positif),
        ("identifier lain -> jalur lain", jalur_ikut_identifier),
        ("paket sumber tidak cocok -> ditolak, tujuan utuh", paket_tidak_cocok),
        ("berkas generate hilang -> ditolak + daftar .kt", berkas_generate_hilang),
        ("identifier cacat -> ditolak", identifier_tidak_sah),
    ]:
        if not kasus(nama, fn):
            gagal += 1

    print("\n%d lulus, %d gagal" % (5 - gagal, gagal))
    return 1 if gagal else 0


if __name__ == "__main__":
    sys.exit(main())
