#!/usr/bin/env python3
"""gate_pemicu_ci.py - jaga pemicu workflow factory-gate tetap tidak bisa dilewati.

Kenapa ada: `.github/workflows/factory-gate.yml` adalah satu-satunya tempat gate hukum proses
dijalankan di CI. Empat kelas kesalahan membuat gate itu tidak jalan padahal berkasnya terlihat
benar:

1. **Penyaring path.** `paths:`/`paths-ignore:` di blok `pull_request` membuat GitHub melewati
   seluruh workflow untuk PR yang tidak menyentuh path itu. Gate cakupan lane justru harus
   memeriksa SETIAP PR: PR yang cuma menyentuh `README.md` pun tetap perlu diperiksa, karena
   label `lane:` bisa dipasang di PR mana pun. Jadi penyaring path di berkas ini DITOLAK, bukan
   diatur isinya.
2. **Event `labeled` tidak terpasang.** Default `types:` GitHub cuma opened/synchronize/reopened.
   Label `lane:<id>` dan `eskalasi` dipasang SESUDAH PR terbuka, jadi tanpa `labeled` di `types:`
   memasang label tidak memeriksa ulang cakupan.
3. **Job menyaring `github.event.action`.** Gate membaca DUA label (`lane:` dan `eskalasi`).
   Filter yang cuma menyebut satu label membuat run untuk label lain lahir lalu di-SKIP, dan gate
   yang seharusnya memeriksa tidak pernah jalan. Kelas ini benar-benar kejadian di PR #227.
4. **Grup `concurrency` tanpa `github.event.action`.** Event `opened` dan `labeled` untuk PR yang
   sama berbagi satu grup dan saling membatalkan; yang bertahan belum tentu yang benar. Dengan
   action di grup, push (`synchronize`) tetap saling membatalkan.

Berkas yang diperiksa satu: `factory-gate.yml`. Versi sebelumnya berkas ini juga memeriksa
`uji-windows.yml`, workflow produk yang tidak ada di pohon ini; pemeriksaan itu dibuang bersama
seluruh mesin pencocok path-nya, karena gate yang menunjuk berkas tidak ada cuma mencetak LEWAT
selamanya dan tidak pernah menolak apa pun.

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

BERKAS_GATE = os.path.join(".github", "workflows", "factory-gate.yml")

RE_ITEM = re.compile(r"^\s*-\s*'([^']*)'\s*$")
RE_ITEM_POLOS = re.compile(r"^\s*-\s*([A-Za-z0-9_-]+)\s*$")
RE_JOB = re.compile(r"^  ([A-Za-z0-9_-]+):\s*$")
RE_ACTION = re.compile(r"github\.event\.action")

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
    """Kembalikan daftar nama penyaring path yang dipakai (`paths`, `paths-ignore`)."""
    hasil = []
    for b in blok:
        m = re.match(r"^    (paths|paths-ignore):", b)
        if m:
            hasil.append(m.group(1))
    return hasil

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

def periksa(teks):
    """Kembalikan (lulus, daftar_alasan). Ini satu-satunya keputusan, dipakai main() dan uji."""
    blok = blok_pull_request(teks)
    if blok is None:
        return False, ["trigger `pull_request` tidak ada di blok `on:`"]

    alasan = []

    for nama in penyaring(blok):
        alasan.append(
            "`%s` ada di blok `pull_request`: penyaring path membuat PR yang tidak menyentuh path "
            "itu melewati SELURUH gate, padahal gate cakupan lane harus memeriksa tiap PR" % nama
        )

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
    elif not RE_ACTION.search(grup):
        alasan.append(
            "grup `concurrency` (%r) tidak memuat `github.event.action`: event `opened` dan "
            "`labeled` untuk PR yang sama berbagi satu grup dan saling membatalkan" % grup
        )

    return (len(alasan) == 0), alasan

IF_BENAR = (
    "    if: github.event_name != 'pull_request' || "
    "github.event.pull_request.head.repo.full_name == github.repository\n"
)
TYPES_BENAR = "    types: [opened, synchronize, reopened, labeled]\n"
GRUP_BENAR = "concurrency:\n  group: factory-gate-${{ github.ref }}-${{ github.event.action }}\n"

def _gate_wf(types_baris=TYPES_BENAR, daftar_if=None, grup=GRUP_BENAR, penyaring_baris=""):
    """Workflow mirip factory-gate.yml: blok `on:`, `concurrency:`, dan sejumlah job."""
    if daftar_if is None:
        daftar_if = [IF_BENAR, IF_BENAR]
    isi = (
        "name: factory-gate\non:\n  pull_request:\n    branches: [main]\n"
        + types_baris
        + penyaring_baris
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

    # Kasus pertama menguji pohon yang sedang dipijak. Kalau berkasnya tidak ikut (pohon mesin
    # tanpa workflow), kasus itu DILEWATI dengan disebut, bukan menggagalkan seluruh uji: sisa
    # kasusnya memakai pohon tiruan dan tetap berjalan di mana pun.
    if os.path.exists(os.path.join(akar, BERKAS_GATE)):
        kasus.append(("pohon ini apa adanya", baca(os.path.join(akar, BERKAS_GATE)), 0))
    else:
        print("LEWAT  kasus pohon ini dilewati: %s tidak ada di %s" % (BERKAS_GATE, akar))

    kasus.append(("bentuk sehat", _gate_wf(), 0))
    kasus.append(
        ("bentuk `types:` daftar blok dikenali",
         _gate_wf(types_baris="    types:\n      - opened\n      - labeled\n"), 0)
    )

    # Negatif: penyaring path, dan kedua bentuknya sekaligus.
    kasus.append(
        ("`paths:` memasang penyaring",
         _gate_wf(penyaring_baris="    paths:\n      - 'factory/**'\n"), 1)
    )
    kasus.append(
        ("`paths-ignore:` memasang penyaring",
         _gate_wf(penyaring_baris="    paths-ignore:\n      - 'docs/**'\n"), 1)
    )
    kasus.append(
        ("`paths` dan `paths-ignore` sekaligus",
         _gate_wf(penyaring_baris="    paths:\n      - '**'\n    paths-ignore:\n      - 'docs/**'\n"), 1)
    )

    # Negatif: trigger labeled tidak terpasang.
    kasus.append(("`types:` hilang (default GitHub)", _gate_wf(types_baris=""), 1))
    kasus.append(
        ("`labeled` dicabut dari `types:`",
         _gate_wf(types_baris="    types: [opened, synchronize, reopened]\n"), 1)
    )
    kasus.append(("bentuk `types:` tidak dikenali", _gate_wf(types_baris="    types: nope\n"), 1))
    kasus.append(
        ("`pull_request` tidak ada di blok `on:`",
         "name: x\non:\n  push:\n    branches: [main]\njobs:\n  a:\n    runs-on: ubuntu-latest\n", 1)
    )

    # Negatif: job menyaring action. Kelas ini benar-benar kejadian di PR #227.
    kasus.append(
        ("job menyaring action ke satu label saja",
         _gate_wf(daftar_if=[
             IF_BENAR,
             "    if: >-\n"
             "      (github.event_name != 'pull_request')\n"
             "      && (github.event.action != 'labeled' || startsWith(github.event.label.name, 'lane:'))\n",
         ]), 1)
    )

    # Negatif: concurrency.
    kasus.append(
        ("grup concurrency tanpa action",
         _gate_wf(grup="concurrency:\n  group: factory-gate-${{ github.ref }}\n"), 1)
    )
    kasus.append(("blok concurrency hilang", _gate_wf(grup=""), 1))

    # Negatif: jobs.
    kasus.append(
        ("blok `jobs:` hilang",
         "name: x\non:\n  pull_request:\n    branches: [main]\n" + TYPES_BENAR, 1)
    )

    gagal = 0
    for nama, teks, harus in kasus:
        lulus, alasan = periksa(teks)
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

    path = os.path.join(akar, BERKAS_GATE)
    if not os.path.exists(path):
        # Pohon tanpa workflow bukan kegagalan, tapi juga bukan hijau diam-diam: yang dilewati
        # disebut, dan runner CI tetap menjalankan uji mandiri di atas pohon tiruan.
        print("LEWAT  pemicu CI tidak diperiksa: %s tidak ada di %s." % (BERKAS_GATE, akar))
        print("       Uji mandiri gate ini tetap berjalan di pohon tiruan.")
        return 0

    lulus, alasan = periksa(baca(path))
    if lulus:
        print("LULUS  %s: tanpa penyaring path, `labeled` ada di `types:`, job tidak menyaring "
              "action, dan concurrency per action" % BERKAS_GATE)
        return 0
    print("GAGAL  %s" % BERKAS_GATE)
    for x in alasan:
        print("       - %s" % x)
    return 1

if __name__ == "__main__":
    sys.exit(main())
