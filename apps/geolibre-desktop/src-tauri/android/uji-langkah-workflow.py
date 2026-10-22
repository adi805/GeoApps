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
  5. ditolak saat `identifier` bukan nama paket yang sah,
  6. langkah emulator memakai `script:` SATU perintah, karena action-nya
     memecah input per baris (lihat `parse_script`),
  7. pembungkus `jalankan-ukur.sh` meneruskan exit code pengukuran dan tetap
     meninggalkan bukti saat pengukurannya gagal.

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
LANGKAH_UKUR = "Measure cold start on the emulator"
PEMBUNGKUS = "apps/geolibre-desktop/src-tauri/android/jalankan-ukur.sh"


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


def parse_script(raw):
    """Cermin `src/script-parser.ts` dari android-emulator-runner v2.38.0.

    Action itu tidak menjalankan `script:` sebagai satu blok: input di-trim,
    dipecah per baris, baris kosong dan baris berawalan `#` dibuang, lalu tiap
    baris sisanya dieksekusi sebagai `sh -c` tersendiri. Model ini dipakai untuk
    memastikan langkah emulator cuma menyebut SATU perintah. Run 39340791618
    membuktikannya: continuation `\\` tidak menyambung, baris redirection jalan
    sendirian, dan step mati dengan "Syntax error: end of file unexpected".
    """
    return [
        baris.strip()
        for baris in raw.strip().splitlines()
        if baris.strip() and not baris.strip().startswith("#")
    ]


def tulis(path, isi):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(isi)


def jalankan(akar, langkah, env_tambahan=None):
    skrip, wd = langkah
    env = dict(os.environ)
    # Selalu timpa: di runner GitHub, GITHUB_ENV sudah menunjuk berkas milik
    # runner. Memakai setdefault membuat langkah uji menulis ke sana sementara
    # harness membaca berkas sementaranya sendiri yang tetap kosong, sehingga
    # kasus positif gagal di CI padahal lulus di mesin lokal.
    env["GITHUB_ENV"] = os.path.join(akar, ".github_env")
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
        '{"identifier": "%s", "productName": "GeoApps"}\n' % identifier,
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


STUB_ADB = r"""#!/usr/bin/env bash
# adb tiruan: cukup untuk ukur-waktu-mulai.sh, tidak menyentuh perangkat.
case "$*" in
  *getprop\ ro.product.model*) echo sdk_gphone64_x86_64 ;;
  *getprop\ ro.build.version.release*) echo 16 ;;
  *getprop\ ro.build.version.sdk*) echo 36 ;;
  *getprop\ ro.product.cpu.abi*) echo x86_64 ;;
  *install*) echo Success ;;
  *am\ start*)
    printf 'Status: ok\nActivity: com.geokebun.app/.MainActivity\n'
    if [ "${ADB_TANPA_TOTALTIME:-0}" != "1" ]; then
      printf 'TotalTime: 2416\n'
    fi
    ;;
  *logcat\ -d*)
    echo 'I/ActivityTaskManager(  622): Displayed com.geokebun.app/.MainActivity: +2s416ms'
    ;;
  *) exit 0 ;;
esac
"""

STUB_AAPT2 = r"""#!/usr/bin/env bash
echo com.geokebun.app
"""


def siapkan_pembungkus(akar):
    """Pohon tiruan untuk menguji jalankan-ukur.sh tanpa emulator.

    `adb` dan `aapt2` diganti stub: yang diuji di sini kontrak pembungkusnya
    (exit code diteruskan, bukti tetap ditulis), bukan perilaku emulator.
    """
    bin = os.path.join(akar, "bin")
    for nama, isi in (("adb", STUB_ADB), ("aapt2", STUB_AAPT2)):
        tulis(os.path.join(bin, nama), isi)
        os.chmod(os.path.join(bin, nama), 0o755)
    tulis(os.path.join(akar, "apks", "geolibre-android-x86_64.apk"), "bukan apk asli\n")
    return bin


def jalankan_pembungkus(akar, bin, ringkasan, ulangan, env_tambahan=None):
    env = dict(os.environ)
    env["PATH"] = bin + os.pathsep + env["PATH"]
    env["GITHUB_STEP_SUMMARY"] = ringkasan
    env.update(env_tambahan or {})
    return subprocess.run(
        ["bash", os.path.abspath(PEMBUNGKUS), "apks", ulangan],
        cwd=akar,
        env=env,
        capture_output=True,
        text=True,
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

    def skrip_emulator_satu_perintah(akar):
        # Action memecah `script:` per baris, jadi multi-baris berarti beberapa
        # perintah terpisah. Run 39340791618 mengukur dengan benar lalu mati di
        # baris redirection: continuation `\` tidak menyambung apa pun.
        with open(args.workflow, encoding="utf-8") as fh:
            dok = yaml.safe_load(fh)
        langkah = [
            s for s in dok["jobs"]["ukur-waktu-mulai"]["steps"] if s.get("name") == LANGKAH_UKUR
        ]
        assert langkah, "langkah %r tidak ada di %s" % (LANGKAH_UKUR, args.workflow)
        perintah = parse_script(langkah[0]["with"]["script"])
        assert len(perintah) == 1, "%d perintah akan dijalankan terpisah: %r" % (
            len(perintah),
            perintah,
        )
        assert not perintah[0].endswith("\\"), "continuation `\\` tidak didukung: %r" % perintah[0]

    def pembungkus_meneruskan_hasil(akar):
        # Pembungkus diuji dengan adb/aapt2 tiruan: yang diperiksa kontraknya
        # (exit code, berkas bukti, ringkasan), bukan perilaku emulator.
        bin = siapkan_pembungkus(akar)
        ringkasan = os.path.join(akar, "ringkasan.md")
        r = jalankan_pembungkus(akar, bin, ringkasan, "3")
        assert r.returncode == 0, "pembungkus exit %d: %s" % (r.returncode, r.stderr)
        with open(os.path.join(akar, "startup.txt"), encoding="utf-8") as fh:
            isi = fh.read()
        assert "RINGKAS: n=3" in isi, isi
        assert "sdk_gphone64_x86_64" in isi, isi
        with open(ringkasan, encoding="utf-8") as fh:
            assert "Waktu mulai Android" in fh.read(), "ringkasan langkah tidak ditulis"

    def pembungkus_gagal_tetap_meninggalkan_bukti(akar):
        # Pengukuran yang gagal harus memerahkan langkah CI, tapi keluarannya
        # tetap harus ada: tanpa itu kegagalannya tidak bisa didiagnosis.
        bin = siapkan_pembungkus(akar)
        ringkasan = os.path.join(akar, "ringkasan.md")
        r = jalankan_pembungkus(akar, bin, ringkasan, "1", {"ADB_TANPA_TOTALTIME": "1"})
        assert r.returncode != 0, "pengukuran tanpa TotalTime dianggap lulus"
        with open(os.path.join(akar, "startup.txt"), encoding="utf-8") as fh:
            assert "tidak melaporkan TotalTime" in fh.read(), "bukti tidak ditinggalkan"
        with open(ringkasan, encoding="utf-8") as fh:
            assert "Waktu mulai Android" in fh.read(), "ringkasan hilang saat gagal"

    daftar = [
        ("jalur diturunkan dari identifier, salinan berhasil", positif),
        ("identifier lain -> jalur lain", jalur_ikut_identifier),
        ("paket sumber tidak cocok -> ditolak, tujuan utuh", paket_tidak_cocok),
        ("berkas generate hilang -> ditolak + daftar .kt", berkas_generate_hilang),
        ("identifier cacat -> ditolak", identifier_tidak_sah),
        ("langkah emulator: `script:` satu perintah", skrip_emulator_satu_perintah),
        ("pembungkus meneruskan hasil pengukuran", pembungkus_meneruskan_hasil),
        ("pembungkus gagal tetap meninggalkan bukti", pembungkus_gagal_tetap_meninggalkan_bukti),
    ]
    for nama, fn in daftar:
        if not kasus(nama, fn):
            gagal += 1

    print("\n%d lulus, %d gagal" % (len(daftar) - gagal, gagal))
    return 1 if gagal else 0


if __name__ == "__main__":
    sys.exit(main())
