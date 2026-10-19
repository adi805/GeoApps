#!/usr/bin/env python3
"""gate_pemicu_ci.py - tolak penyaring pemicu CI yang mematikan pemeriksa.

Kenapa ada: `.github/workflows/uji-windows.yml` menyaring `pull_request` berdasarkan path supaya
PR yang cuma menyentuh dokumen dan alat factory tidak menyalakan 4 job Linux di runner tunggal.
Penyaring itu punya satu cara gagal yang SENYAP: kalau pohon yang dibaca sebuah job ikut
dikecualikan, job-nya tidak pernah jalan dan tidak ada yang merah. Gejalanya cuma "CI hijau" pada
berkas yang justru diubah. Kelas ini sudah nyaris kejadian di repo ini: `tools/cek_desain.py`
membaca `docs/DESIGN.md`, jadi mengecualikan seluruh `docs/**` tanpa memasukkan berkas itu kembali
mematikan pemeriksa bagi berkas yang diubah.

Yang ditegakkan, semuanya mekanis:
  1. Trigger `pull_request` WAJIB punya penyaring path. Penyaring yang hilang sama saja dengan
     menghapus niatnya, dan itu perubahan yang mudah lolos tanpa dibaca.
  2. `paths` dan `paths-ignore` tidak boleh dipakai bersama untuk satu event, dan `paths-ignore`
     TIDAK menerima negasi. Pola `!` di dalam `paths-ignore` ditolak, bukan diabaikan diam-diam.
  3. Setiap pola negatif WAJIB ada di `BOLEH_TOLAK`. Menambahkan `src/**` ke situ akan mematikan
     seluruh uji dotnet, dan itu ditolak di sini, bukan ditangkap enam bulan kemudian.
  4. Setiap path di `WAJIB_MEMICU` WAJIB masih memicu. Ini yang menangkap "docs/** dikecualikan
     tapi docs/DESIGN.md tidak dimasukkan ulang".
  5. Pola yang bentuknya tidak dikenali pencocok ditolak, bukan dilewati. Gate yang tidak paham
     apa yang dibacanya tidak boleh keluar hijau.
  6. `factory-gate.yml` WAJIB mendengar event `labeled`. Tanpa itu memasang label `lane:<id>`
     sesudah PR terbuka tidak menjalankan ulang pemeriksa cakupan: run lama tetap hijau dengan
     cakupan tidak diperiksa (#225).
  7. Job TIDAK BOLEH menyaring event berdasarkan `github.event.action`. Gate membaca DUA label
     (`lane:` dan `eskalasi`), jadi filter yang cuma menyebut satu label melewati yang lain: run
     untuk label itu lahir, di-SKIP, dan run itulah yang tersisa (terukur 2026-10-11 di PR #227:
     tiga run lahir bersamaan, dua cancelled, satu skipped, dan gate yang seharusnya memeriksa
     justru tidak jalan). Label dibaca live dari PR, jadi tidak ada yang perlu disaring di sini.
  8. Grup `concurrency` WAJIB memuat `github.event.action`. Tanpa itu event `opened` dan `labeled`
     untuk PR yang sama berbagi satu grup dan saling membatalkan; yang bertahan belum tentu yang
     benar. Dengan action di grup, push (`synchronize`) tetap saling membatalkan.

Pencocoknya sengaja bodoh: cuma paham `**`, `DIR/**`, dan path persis, karena itu saja bentuk yang
dipakai berkas ini. Urutan pola dihormati seperti dokumentasi GitHub: pola negatif sesudah positif
mengecualikan, pola positif sesudah negatif memasukkan lagi.

Cara pakai:
  python3 tools/factory/gate_pemicu_ci.py
  python3 tools/factory/gate_pemicu_ci.py --akar DIR
  python3 tools/factory/gate_pemicu_ci.py --uji-mandiri
"""

import argparse
import os
import re
import sys

DIR_INI = os.path.dirname(os.path.abspath(__file__))
AKAR_BAWAAN = os.path.dirname(os.path.dirname(DIR_INI))

BERKAS_WORKFLOW = os.path.join(".github", "workflows", "uji-windows.yml")
BERKAS_GATE = os.path.join(".github", "workflows", "factory-gate.yml")

# Pohon yang BOLEH dikecualikan dari trigger pull_request uji-windows.yml, dengan alasannya.
BOLEH_TOLAK = {
    "factory/**": "gate factory hidup di factory-gate.yml, yang tidak punya penyaring path",
    "tools/factory/**": "idem: gate factory diperiksa factory-gate.yml",
    "docs/**": "prosa; berkas yang dibaca workflow ini (docs/DESIGN.md) dimasukkan ulang",
}

# Path yang WAJIB tetap memicu workflow ini, karena ada job/langkah yang membacanya.
WAJIB_MEMICU = [
    ("src/PMS.App/PMS.App.csproj", "cek_versi membaca sumber kebenaran versi"),
    ("src/PMS.App/Program.cs", "uji-dotnet membangun dan menguji seluruh solusi"),
    ("tests/PMS.Tests/PMS.Tests.csproj", "uji-dotnet menjalankan suite ini"),
    ("installer.iss", "cek_versi dan job MSI membacanya"),
    ("build_msi.py", "cek_versi membacanya"),
    ("tools/build_rilis.sh", "cek_versi membacanya"),
    ("tools/cek_desain.py", "langkah cek-versi menjalankannya"),
    ("docs/DESIGN.md", "tools/cek_desain.py membaca berkas ini; menutupnya mematikan pemeriksanya"),
    ("cloudflare/uji-integrasi-worker.sh", "uji-worker menjalankannya"),
    ("package.json", "uji-ui memasang dan menjalankan uji lewat npm"),
    (".github/workflows/uji-windows.yml", "suntingan workflow ini harus mengujinya sendiri"),
]

RE_ITEM = re.compile(r"^\s*-\s*'([^']*)'\s*$")
RE_JOB = re.compile(r"^  ([A-Za-z0-9_-]+):\s*$")
RE_ITEM_POLOS = re.compile(r"^\s*-\s*([A-Za-z0-9_-]+)\s*$")
RE_ACTION = re.compile(r"github\.event\.action")
RE_GRUP_ACTION = re.compile(r"github\.event\.action")


def baca(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def blok_pull_request(teks):
    """Kembalikan baris-baris di dalam `pull_request:` pada blok `on:`, atau None."""
    baris = teks.splitlines()
    idx_on = None
    for n, b in enumerate(baris):
        if re.match(r"^on:\s*$", b):
            idx_on = n
            break
    if idx_on is None:
        return None
    idx_pr = None
    for n in range(idx_on + 1, len(baris)):
        b = baris[n]
        if b.strip() == "" or b.lstrip().startswith("#"):
            continue
        if not b.startswith(" "):
            break
        if re.match(r"^  pull_request:\s*$", b):
            idx_pr = n
            break
    if idx_pr is None:
        return None
    hasil = []
    for m in range(idx_pr + 1, len(baris)):
        b = baris[m]
        if b.strip() == "" or b.lstrip().startswith("#"):
            hasil.append(b)
            continue
        if re.match(r"^  \S", b) or not b.startswith(" "):
            break
        hasil.append(b)
    return hasil


def penyaring(blok):
    """Kembalikan (jenis, daftar_pola). jenis: 'paths', 'paths-ignore', 'GANDA', atau None."""
    jenis = None
    daftar = []
    for n, b in enumerate(blok):
        m = re.match(r"^    (paths|paths-ignore):\s*$", b)
        if not m:
            continue
        if jenis is not None:
            return "GANDA", []
        jenis = m.group(1)
        for c in blok[n + 1:]:
            mi = RE_ITEM.match(c)
            if mi:
                daftar.append(mi.group(1))
                continue
            if c.strip() == "" or c.lstrip().startswith("#"):
                continue
            break
    return jenis, daftar


def bentuk_dikenali(pola):
    if pola == "**":
        return True
    if pola.endswith("/**"):
        return "*" not in pola[:-3] and "?" not in pola[:-3]
    return "*" not in pola and "?" not in pola


def cocok(pola, path):
    if pola == "**":
        return True
    if pola.endswith("/**"):
        prefiks = pola[:-3]
        return path == prefiks or path.startswith(prefiks + "/")
    return path == pola


def memicu(jenis, urut, path):
    if jenis == "paths-ignore":
        return not any(cocok(p, path) for p in urut)
    aktif = False
    for p in urut:
        negatif = p.startswith("!")
        inti = p[1:] if negatif else p
        if cocok(inti, path):
            aktif = not negatif
    return aktif


def periksa_teks(teks):
    """Kembalikan (lulus, daftar_alasan). Ini satu-satunya keputusan, dipakai main() dan uji."""
    blok = blok_pull_request(teks)
    if blok is None:
        return False, ["trigger `pull_request` tidak ada di blok `on:`"]

    jenis, daftar = penyaring(blok)
    if jenis == "GANDA":
        return False, ["`paths` dan `paths-ignore` dipakai bersama untuk event yang sama"]
    if jenis is None:
        return False, ["trigger `pull_request` tidak punya penyaring path (`paths`/`paths-ignore`)"]
    if not daftar:
        return False, ["`%s` ada tapi daftarnya kosong" % jenis]

    alasan = []
    for p in daftar:
        if not bentuk_dikenali(p.lstrip("!")):
            alasan.append(
                "pola tidak dikenali pencocok: %r (pencocok cuma paham `**`, `DIR/**`, dan path persis)" % p
            )

    if jenis == "paths-ignore":
        for p in daftar:
            if p.startswith("!"):
                alasan.append(
                    "`paths-ignore` tidak menerima negasi (pola %r); pakai `paths` + `!`" % p
                )
        urut = list(daftar)
    else:
        urut = list(daftar)
        if all(p.startswith("!") for p in urut):
            alasan.append("semua pola `paths` negatif; GitHub menuntut minimal satu pola positif")

    for p in urut:
        if p.startswith("!") and p[1:] not in BOLEH_TOLAK:
            alasan.append(
                "`%s` dikecualikan tapi tidak ada di daftar pohon yang boleh dikecualikan (%s)"
                % (p[1:], ", ".join(sorted(BOLEH_TOLAK)))
            )

    for path, kenapa in WAJIB_MEMICU:
        if not memicu(jenis, urut, path):
            alasan.append("`%s` tidak lagi memicu workflow ini (%s)" % (path, kenapa))

    return (len(alasan) == 0), alasan


def grup_concurrency(teks):
    """Kembalikan (ada, baris_grup) untuk blok `concurrency:` tingkat atas."""
    baris = teks.splitlines()
    for n, b in enumerate(baris):
        if re.match(r"^concurrency:\s*$", b):
            for c in baris[n + 1:]:
                m = re.match(r"^  group:\s*(.*)$", c)
                if m:
                    return True, m.group(1)
                if c.strip() == "" or c.lstrip().startswith("#"):
                    continue
                if not c.startswith(" "):
                    break
            return True, ""
    return False, ""

def blok_jobs(teks):
    """Kembalikan [(nama_job, badan_teks)] untuk tiap job, atau None kalau `jobs:` tidak ada."""
    baris = teks.splitlines()
    idx = None
    for n, b in enumerate(baris):
        if re.match(r"^jobs:\s*$", b):
            idx = n
            break
    if idx is None:
        return None
    hasil = []
    nama = None
    buf = []
    for b in baris[idx + 1:]:
        m = RE_JOB.match(b)
        if m:
            if nama is not None:
                hasil.append((nama, "\n".join(buf)))
            nama = m.group(1)
            buf = []
            continue
        if nama is not None:
            buf.append(b)
    if nama is not None:
        hasil.append((nama, "\n".join(buf)))
    return hasil

def _types_pull_request(blok):
    """Kembalikan (ada, daftar, bentuk_dikenali) untuk `types:` di blok `pull_request:`."""
    for n, b in enumerate(blok):
        m = re.match(r"^    types:\s*(.*)$", b)
        if not m:
            continue
        sisa = m.group(1).strip()
        if sisa.startswith("[") and sisa.endswith("]"):
            return True, [x.strip().strip("'\"") for x in sisa[1:-1].split(",") if x.strip()], True
        if sisa == "":
            daftar = []
            for c in blok[n + 1:]:
                mi = RE_ITEM.match(c) or RE_ITEM_POLOS.match(c)
                if mi:
                    daftar.append(mi.group(1))
                    continue
                if c.strip() == "" or c.lstrip().startswith("#"):
                    continue
                break
            return True, daftar, bool(daftar)
        return True, [], False
    return False, [], True

def periksa_label(teks):
    """Kembalikan (lulus, daftar_alasan) untuk trigger `labeled` di factory-gate.yml."""
    blok = blok_pull_request(teks)
    if blok is None:
        return False, ["trigger `pull_request` tidak ada di blok `on:`"]

    alasan = []
    ada, daftar, dikenal = _types_pull_request(blok)
    if not ada:
        alasan.append(
            "`pull_request` tidak punya `types:`; default GitHub cuma opened/synchronize/reopened, "
            "jadi event `labeled` tidak pernah menjalankan ulang pemeriksa cakupan"
        )
    elif not dikenal:
        alasan.append("bentuk `types:` tidak dikenali pencocok (pakai `[a, b]` atau daftar `- a`)")
    elif "labeled" not in daftar:
        alasan.append("`types:` tidak memuat `labeled` (isi: %s)" % ", ".join(daftar))

    jobs = blok_jobs(teks)
    if jobs is None:
        alasan.append("blok `jobs:` tidak ada, jadi penjaga event `labeled` tidak bisa diperiksa")
    elif not jobs:
        alasan.append("blok `jobs:` kosong")
    else:
        for nama, badan in jobs:
            if RE_ACTION.search(badan):
                alasan.append(
                    "job `%s` menyaring `github.event.action`: gate membaca DUA label (`lane:` dan "
                    "`eskalasi`), jadi filter yang cuma menyebut satu label melewati yang lain dan "
                    "run untuk label itu di-SKIP" % nama
                )

    ada, grup = grup_concurrency(teks)
    if not ada:
        alasan.append("blok `concurrency:` tidak ada, jadi event `labeled` dan `opened` saling membatalkan")
    elif not RE_GRUP_ACTION.search(grup):
        alasan.append(
            "grup `concurrency` (%r) tidak memuat `github.event.action`: event `opened` dan "
            "`labeled` untuk PR yang sama berbagi satu grup dan saling membatalkan" % grup
        )

    return (len(alasan) == 0), alasan

def _wf(isi_pull_request):
    return (
        "name: Uji Windows\non:\n  workflow_dispatch:\n  pull_request:\n"
        + isi_pull_request
        + "  push:\n    branches: [main]\njobs:\n  a:\n    runs-on: ubuntu-latest\n"
    )


IF_BENAR = (
    "    if: github.event_name != 'pull_request' || "
    "github.event.pull_request.head.repo.full_name == github.repository\n"
)
TYPES_BENAR = "    types: [opened, synchronize, reopened, labeled]\n"
GRUP_BENAR = "concurrency:\n  group: factory-gate-${{ github.ref }}-${{ github.event.action }}\n"

def _gate_wf(types_baris, daftar_if, grup=GRUP_BENAR):
    """Workflow mirip factory-gate.yml: blok `on:`, blok `concurrency:`, plus sejumlah job."""
    isi = (
        "name: factory-gate\non:\n  pull_request:\n    branches: [main]\n"
        + types_baris
        + "  push:\n    branches: [main]\n"
        + grup
        + "jobs:\n"
    )
    for n, blok_if in enumerate(daftar_if):
        isi += "  j%d:\n    runs-on: ubuntu-latest\n" % n + blok_if + "    steps:\n      - run: echo x\n"
    return isi

def uji_mandiri(akar):
    """Gate yang belum pernah menolak apa pun belum membuktikan apa pun."""
    kasus = []

    # Dua kasus pertama menguji pohon yang sedang dipijak. Di repo mesin berkas workflow-nya
    # memang tidak ikut, jadi keduanya DILEWATI dengan disebut, bukan menggagalkan seluruh uji:
    # sisa kasusnya memakai pohon tiruan dan tetap berjalan di mana pun.
    ada_wf = os.path.exists(os.path.join(akar, BERKAS_WORKFLOW))
    ada_gate = os.path.exists(os.path.join(akar, BERKAS_GATE))
    if ada_wf:
        kasus.append(("pohon ini apa adanya (penyaring path)", periksa_teks,
                      baca(os.path.join(akar, BERKAS_WORKFLOW)), 0))
    else:
        print("LEWAT  kasus pohon ini dilewati: %s tidak ada di %s" % (BERKAS_WORKFLOW, akar))
    if ada_gate:
        kasus.append(("pohon ini apa adanya (trigger labeled)", periksa_label,
                      baca(os.path.join(akar, BERKAS_GATE)), 0))
    else:
        print("LEWAT  kasus pohon ini dilewati: %s tidak ada di %s" % (BERKAS_GATE, akar))

    kasus.append(
        (
            "pohon di luar daftar izin (src/**)",
            _wf("    branches: [main]\n    paths:\n      - '**'\n      - '!src/**'\n"),
            1,
        )
    )

    kasus.append(
        (
            "docs/** dikecualikan tanpa docs/DESIGN.md dimasukkan ulang",
            _wf("    branches: [main]\n    paths:\n      - '**'\n      - '!docs/**'\n"),
            1,
        )
    )

    kasus.append(
        (
            "paths-ignore dipakai dengan negasi",
            _wf("    branches: [main]\n    paths-ignore:\n      - 'docs/**'\n      - '!docs/DESIGN.md'\n"),
            1,
        )
    )

    kasus.append(("penyaring path hilang", _wf("    branches: [main]\n"), 1))

    kasus.append(
        (
            "paths dan paths-ignore dipakai bersama",
            _wf(
                "    branches: [main]\n    paths:\n      - '**'\n"
                "    paths-ignore:\n      - 'factory/**'\n"
            ),
            1,
        )
    )

    kasus.append(
        (
            "pola yang bentuknya tidak dikenali",
            _wf("    branches: [main]\n    paths:\n      - '**'\n      - '!docs/*.md'\n"),
            1,
        )
    )

    kasus.append(
        (
            "semua pola negatif",
            _wf("    branches: [main]\n    paths:\n      - '!factory/**'\n"),
            1,
        )
    )

    kasus.append(("trigger labeled sehat", periksa_label, _gate_wf(TYPES_BENAR, [IF_BENAR, IF_BENAR]), 0))
    kasus.append(
        ("bentuk `types:` daftar blok dikenali", periksa_label,
         _gate_wf("    types:\n      - opened\n      - labeled\n", [IF_BENAR, IF_BENAR]), 0)
    )
    kasus.append(("`types:` hilang (default GitHub)", periksa_label, _gate_wf("", [IF_BENAR, IF_BENAR]), 1))
    kasus.append(
        ("`labeled` dicabut dari `types:`", periksa_label,
         _gate_wf("    types: [opened, synchronize, reopened]\n", [IF_BENAR, IF_BENAR]), 1)
    )
    kasus.append(
        ("bentuk `types:` tidak dikenali", periksa_label, _gate_wf("    types: nope\n", [IF_BENAR, IF_BENAR]), 1)
    )
    # Kelas gagal yang BENAR-BENAR kejadian di PR #227: job menyaring `github.event.action` ke satu
    # label, sehingga run untuk label lain lahir lalu di-SKIP dan gate yang memeriksa tidak jalan.
    kasus.append(
        ("job menyaring action ke satu label saja", periksa_label,
         _gate_wf(TYPES_BENAR, [IF_BENAR,
                  "    if: >-\n"
                  "      (github.event_name != 'pull_request')\n"
                  "      && (github.event.action != 'labeled' || startsWith(github.event.label.name, 'lane:'))\n"]), 1)
    )
    kasus.append(
        ("grup concurrency tanpa action", periksa_label,
         _gate_wf(TYPES_BENAR, [IF_BENAR, IF_BENAR], grup="concurrency:\n  group: factory-gate-${{ github.ref }}\n"), 1)
    )
    kasus.append(
        ("blok concurrency hilang", periksa_label, _gate_wf(TYPES_BENAR, [IF_BENAR, IF_BENAR], grup=""), 1)
    )
    kasus.append(
        ("blok `jobs:` hilang", periksa_label,
         "name: x\non:\n  pull_request:\n    branches: [main]\n" + TYPES_BENAR, 1)
    )

    gagal = 0
    for baris in kasus:
        # Kasus lama cuma membawa teks (diperiksa periksa_teks); kasus trigger `labeled` membawa
        # fungsi pemeriksanya sendiri supaya dua berkas berbeda bisa diuji dalam satu loop.
        if len(baris) == 3:
            nama, teks, harus = baris
            fungsi = periksa_teks
        else:
            nama, fungsi, teks, harus = baris
        lulus, alasan = fungsi(teks)
        keluar = 0 if lulus else 1
        tanda = "LULUS" if keluar == harus else "GAGAL"
        if keluar != harus:
            gagal += 1
        print("%s %s (keluar %d, harus %d)" % (tanda, nama, keluar, harus))
        if keluar != harus:
            for a in alasan:
                print("        - %s" % a)
    print("UJI MANDIRI: %d kasus, %d gagal" % (len(kasus), gagal))
    return 1 if gagal else 0


def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=AKAR_BAWAAN)
    p.add_argument("--uji-mandiri", action="store_true")
    a = p.parse_args()

    akar = os.path.abspath(os.path.expanduser(a.akar))
    if a.uji_mandiri:
        return uji_mandiri(akar)

    # Gate ini menjaga penyaring pemicu di workflow PRODUK, dan workflow itu tidak ikut repo
    # mesin: `ci/` cuma memuat salinan referensinya. Jadi berkasnya memang tidak ada di sini, dan
    # itu BUKAN kegagalan. Yang penting: yang dilewati disebut satu per satu, tidak diam-diam
    # hijau. Dijalankan di pohon produk, seluruh pemeriksaannya tetap penuh.
    hilang = [rel for rel, _, _ in (
        (BERKAS_WORKFLOW, periksa_teks, ""),
        (BERKAS_GATE, periksa_label, ""),
    ) if not os.path.exists(os.path.join(akar, rel))]
    if len(hilang) == 2:
        print("LEWAT  pemeriksaan pemicu CI tidak dijalankan: %s tidak ada di %s."
              % (" dan ".join(hilang), akar))
        print("       Gate ini menjaga workflow produk, dan workflow itu tidak ikut repo mesin.")
        return 0

    gagal = 0
    for rel, fungsi, pesan_lulus in (
        (
            BERKAS_WORKFLOW,
            periksa_teks,
            "penyaring path pull_request uji-windows.yml sehat (%d path wajib memicu)" % len(WAJIB_MEMICU),
        ),
        (
            BERKAS_GATE,
            periksa_label,
            "trigger labeled factory-gate.yml ada di `types:`, job tidak menyaring action, dan concurrency per action",
        ),
    ):
        path = os.path.join(akar, rel)
        if not os.path.exists(path):
            print("GAGAL  berkas tidak ada: %s" % path)
            gagal += 1
            continue
        lulus, alasan = fungsi(baca(path))
        if lulus:
            print("LULUS  %s" % pesan_lulus)
            continue
        print("GAGAL  penyaring pemicu CI mematikan pemeriksa (%s):" % rel)
        for s in alasan:
            print("       - %s" % s)
        gagal += 1
    return 1 if gagal else 0


if __name__ == "__main__":
    sys.exit(main())
