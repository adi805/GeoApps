#!/usr/bin/env python3
"""gate_ontology.py - tolak sinonim terlarang yang dipakai di prosa repo ini.

Kenapa ada: `ONTOLOGY.md` menyebut, untuk tiap konsep, satu istilah baku dan nama-nama lain yang
ditolak. Daftar itu tidak berarti apa-apa sampai ada yang menolak pemakaiannya, dan tidak ada
compiler, linter, atau test suite yang peduli soal pilihan kata. Gate ini yang peduli.

Tiga keputusan yang disengaja, dan alasannya:

1. **Prosa saja.** Yang diperiksa hanya berkas Markdown dan teks. Berkas kode dan data memuat
   pengenal (`warehouse_doc`, `EmployeeService.cs`, `save_payslip_component`) yang wajib ditulis
   persis dan tidak boleh diterjemahkan, jadi memeriksanya menghasilkan temuan palsu yang akhirnya
   membuat gate diabaikan orang.
2. **Potongan kode dilewati.** Fence ``` dan span `...` dibuang sebelum pencocokan, karena di
   dalamnya yang muncul adalah perintah, path, dan nama berkas, bukan pilihan kata penulisnya.
3. **Nol berkas diperiksa itu GAGAL, bukan lulus.** Gate yang menyisir nol objek lalu keluar 0
   menghasilkan laporan kosong yang terbaca seperti hijau, dan itu lebih mahal daripada gate merah.
   Jumlah berkas yang diperiksa selalu dicetak.

Cara pakai:
  python3 tools/factory/gate_ontology.py
  python3 tools/factory/gate_ontology.py --rinci
  python3 tools/factory/gate_ontology.py --cakupan "docs/**"
  python3 tools/factory/gate_ontology.py --uji-mandiri
"""

import argparse
import os
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _umum as u  # noqa: E402

BERKAS_ONTOLOGY = "ONTOLOGY.md"
CAKUPAN_BAWAAN = ["factory/**", "docs/**"]
EKSTENSI_BAWAAN = [".md", ".txt"]
LEWATI_DIR = {".git", "__pycache__", "node_modules", "bin", "obj", "dist"}
PEMISAH = re.compile(r"^\|[\s:|-]+\|$")
KODE_FENCE = re.compile(r"```.*?```", re.S)
KODE_SPAN = re.compile(r"`[^`\n]*`")

def tanpa_kode(teks):
    """Buang fence dan span kode, TAPI pertahankan jumlah baris.

    Fence bisa memuat banyak baris, jadi isinya diganti baris kosong sebanyak baris yang dibuang.
    Kalau isinya dihapus begitu saja, nomor baris pada laporan ikut bergeser dan laporan yang
    menunjuk baris salah lebih buruk daripada tidak ada laporan.
    """
    teks = KODE_FENCE.sub(lambda m: "\n" * m.group(0).count("\n"), teks)
    return KODE_SPAN.sub("", teks)

def tabel(teks, kolom):
    """Ambil baris tabel yang headernya memuat SEMUA nama kolom di `kolom`.

    None kalau tabelnya tidak ada. Itu dibedakan dari daftar kosong: tabel yang tidak ada berarti
    gate-nya tidak bisa bekerja, dan gate yang tidak bisa bekerja wajib menolak, bukan diam.
    """
    baris = teks.splitlines()
    for i, b in enumerate(baris):
        if not b.strip().startswith("|"):
            continue
        sel = [s.strip().lower() for s in b.strip().strip("|").split("|")]
        if not all(k in sel for k in kolom):
            continue
        if i + 1 >= len(baris) or not PEMISAH.match(baris[i + 1].strip()):
            continue
        idx = {k: sel.index(k) for k in kolom}
        hasil = []
        for lanjut in baris[i + 2:]:
            if not lanjut.strip().startswith("|"):
                break
            isi = [s.strip() for s in lanjut.strip().strip("|").split("|")]
            hasil.append({k: (isi[v] if v < len(isi) else "") for k, v in idx.items()})
        return hasil
    return None

def bersihkan(sel):
    """Buang backtick dan tanda baca pinggir dari isi sel tabel."""
    return sel.strip().strip("`").strip()

def varian_dari(baris_vok):
    """Kembalikan [(istilah, varian, berkas)] dari baris tabel ontology."""
    hasil = []
    for b in baris_vok:
        istilah = bersihkan(b.get("istilah", ""))
        for v in b.get("dilarang", "").split(","):
            v = bersihkan(v)
            if not v or v == "-":
                continue
            hasil.append((istilah, v))
    return hasil

def kecuali_dari(baris_kecuali):
    return [bersihkan(b.get("dikecualikan", "")) for b in (baris_kecuali or [])
            if bersihkan(b.get("dikecualikan", ""))]

def berkas_dalam_cakupan(akar, cakupan, kecuali, ekstensi):
    hasil = []
    for root, dirs, files in os.walk(akar):
        dirs[:] = [d for d in dirs if d not in LEWATI_DIR]
        for f in files:
            p = os.path.join(root, f)
            rel = os.path.relpath(p, akar).replace(os.sep, "/")
            if os.path.splitext(f)[1].lower() not in ekstensi:
                continue
            if not any(u.cocok(pat, rel) for pat in cakupan):
                continue
            if any(u.cocok(pat, rel) for pat in kecuali):
                continue
            hasil.append((rel, p))
    return sorted(hasil)

def temuan_di(teks, varian):
    """[(baris, varian)] untuk tiap kemunculan kata utuh, tanpa peduli besar-kecil."""
    teks = tanpa_kode(teks)
    hasil = []
    for b in varian:
        pola = re.compile(r"\b" + re.escape(b) + r"\b", re.IGNORECASE)
        for no, baris in enumerate(teks.splitlines(), 1):
            if pola.search(baris):
                hasil.append((no, b))
    return hasil

def periksa(akar, cakupan, kecuali_tambahan, ekstensi, rinci=False):
    """Kembalikan (lulus, daftar_alasan, jumlah_berkas, daftar_varian)."""
    ont = os.path.join(akar, BERKAS_ONTOLOGY)
    if not os.path.exists(ont):
        return False, ["%s tidak ada di %s" % (BERKAS_ONTOLOGY, akar)], 0, []
    if os.path.getsize(ont) == 0:
        return False, ["%s kosong" % BERKAS_ONTOLOGY], 0, []

    teks = u.baca(ont)
    baris_vok = tabel(teks, ["istilah", "dilarang"])
    if baris_vok is None:
        return False, [
            "%s tidak punya tabel dengan kolom `istilah` dan `dilarang`: gate ini tidak bisa "
            "bekerja tanpa daftarnya, dan gate yang tidak bisa bekerja tidak boleh diam" % BERKAS_ONTOLOGY
        ], 0, []

    varian = varian_dari(baris_vok)
    if not varian:
        return False, [
            "%s punya tabelnya tapi tidak memuat satu pun sinonim terlarang: aturan yang tidak "
            "punya isi tidak menolak apa pun" % BERKAS_ONTOLOGY
        ], 0, []

    kecuali = kecuali_dari(tabel(teks, ["dikecualikan"])) + list(kecuali_tambahan)
    berkas = berkas_dalam_cakupan(akar, cakupan, kecuali, set(ekstensi))

    if rinci:
        print("ISTILAH  %d istilah, %d sinonim terlarang" % (len(baris_vok), len(varian)))
        for istilah, v in varian:
            print("         %-20s dilarang: %s" % (istilah, v))
        print("CAKUPAN  %s" % ", ".join(cakupan))
        print("KECUALI  %s" % (", ".join(kecuali) if kecuali else "(tidak ada)"))
        print("BERKAS   %d diperiksa" % len(berkas))
        print("")

    if not berkas:
        return False, [
            "nol berkas diperiksa di cakupan %s: pohon yang salah atau glob yang salah tidak "
            "boleh terbaca sebagai hijau" % ", ".join(cakupan)
        ], 0, varian

    alasan = []
    for rel, p in berkas:
        for no, v in temuan_di(u.baca(p), [x[1] for x in varian]):
            istilah = next(i for i, x in varian if x == v)
            alasan.append("%s:%d  `%s` seharusnya `%s`" % (rel, no, v, istilah))

    return (not alasan), alasan, len(berkas), varian

# ---------------------------------------------------------------- uji mandiri

ONT_CONTOH = """# Ontologi contoh

| istilah | dipakai | dilarang |
|---|---|---|
| karyawan | master karyawan | pegawai |
| gudang | modul logistik | warehouse |

| dikecualikan | alasan |
|---|---|
| `docs/arsip/**` | riwayat |
"""

def tulis(path, isi):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(isi)

def pohon(tmp, ont=ONT_CONTOH, dokumen=("# Dokumen\n\nSemua karyawan terdaftar.\n"),
          nama_dokumen="docs/panduan.md"):
    if ont is not None:
        tulis(os.path.join(tmp, BERKAS_ONTOLOGY), ont)
    if dokumen is not None:
        tulis(os.path.join(tmp, nama_dokumen), dokumen)
    return tmp

def jln(akar):
    """Jalankan gate ini pada pohon lain. cwd tidak penting: skripnya disebut absolut."""
    skrip = os.path.abspath(__file__)
    hasil = subprocess.run(
        [sys.executable, skrip, "--akar", akar],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    return hasil.returncode

DOK_BERSIH = "# Dokumen\n\nSemua karyawan terdaftar di master karyawan.\n"
DOK_PELANGGAR = "# Dokumen\n\nData pegawai tetap disimpan di sini.\n"
DOK_KODE = "# Dokumen\n\n```\npegawai di dalam fence\n```\n\nSpan `pegawai` di prosa.\n"
DOK_BESAR_KECIL = "# Dokumen\n\nPegawai tetap wajib absen.\n"
DOK_KATA_LAIN = "# Dokumen\n\nUrusan pegawaian ada di bagian lain.\n"
ONT_TANPA_DILARANG = "# Ontologi contoh\n\n| istilah | dipakai |\n|---|---|\n| karyawan | SDM |\n"
ONT_TANPA_VARIAN = "# Ontologi contoh\n\n| istilah | dipakai | dilarang |\n|---|---|---|\n| karyawan | SDM | - |\n"

def pohon_arsip(tmp):
    """Berkas yang dikecualikan memuat sinonimnya, dan ada satu berkas lain yang bersih."""
    pohon(tmp, dokumen=DOK_BERSIH, nama_dokumen="docs/panduan.md")
    tulis(os.path.join(tmp, "docs", "arsip", "lama.md"), DOK_PELANGGAR)
    return tmp

def pohon_kode(tmp):
    """Prosa bersih, tapi berkas kode di cakupan memuat sinonimnya."""
    pohon(tmp, dokumen=DOK_BERSIH, nama_dokumen="docs/lain.md")
    tulis(os.path.join(tmp, "docs", "kode.cs"), "var pegawai = 1;\n")
    tulis(os.path.join(tmp, "docs", "data.json"), '{"pegawai": 1}\n')
    return tmp

def uji_mandiri():
    """Gate yang cuma pernah bilang lulus belum membuktikan ia bisa menolak."""
    kasus = [
        ("positif: prosa bersih", True,
         lambda t: pohon(t, dokumen=DOK_BERSIH)),
        ("negatif: sinonim terlarang di prosa", False,
         lambda t: pohon(t, dokumen=DOK_PELANGGAR)),
        ("positif: sinonim cuma di potongan kode", True,
         lambda t: pohon(t, dokumen=DOK_KODE)),
        ("positif: sinonim di berkas yang dikecualikan", True, pohon_arsip),
        ("negatif: beda besar-kecil tetap ditolak", False,
         lambda t: pohon(t, dokumen=DOK_BESAR_KECIL)),
        ("positif: sinonim di dalam kata lain tidak dihitung", True,
         lambda t: pohon(t, dokumen=DOK_KATA_LAIN)),
        ("positif: berkas kode tidak diperiksa", True, pohon_kode),
        ("negatif: tabel tanpa kolom dilarang", False,
         lambda t: pohon(t, ont=ONT_TANPA_DILARANG, dokumen=DOK_BERSIH)),
        ("negatif: tabel tanpa satu pun sinonim", False,
         lambda t: pohon(t, ont=ONT_TANPA_VARIAN, dokumen=DOK_BERSIH)),
        ("negatif: ONTOLOGY.md tidak ada", False,
         lambda t: pohon(t, ont=None, dokumen=DOK_BERSIH)),
        ("negatif: nol berkas diperiksa", False,
         lambda t: pohon(t, dokumen=None)),
    ]

    gagal = 0
    negatif = 0
    print("%-52s %-6s %-5s %s" % ("KASUS", "HARAP", "EXIT", "STATUS"))
    for nama, harap_lulus, siapkan in kasus:
        with tempfile.TemporaryDirectory() as tmp:
            siapkan(tmp)
            kode = jln(tmp)
        dapat_lulus = kode == 0
        benar = dapat_lulus == harap_lulus
        if not harap_lulus:
            negatif += 1
        if not benar:
            gagal += 1
        print("%-52s %-6s %-5s %s" % (
            nama, "LULUS" if harap_lulus else "TOLAK", kode, "OK" if benar else "BEDA"))

    if negatif == 0:
        print("GAGAL  tidak ada kasus negatif: gate ini belum membuktikan bisa menolak")
        gagal += 1
    print("UJI MANDIRI: %d kasus, %d negatif, %d gagal" % (len(kasus), negatif, gagal))
    return 1 if gagal else 0

def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=u.akar_factory())
    p.add_argument("--cakupan", action="append", default=None)
    p.add_argument("--kecuali", action="append", default=[])
    p.add_argument("--ekstensi", action="append", default=None)
    p.add_argument("--rinci", action="store_true")
    p.add_argument("--uji-mandiri", action="store_true")
    a = p.parse_args()

    if a.uji_mandiri:
        return uji_mandiri()

    akar = os.path.abspath(os.path.expanduser(a.akar))
    cakupan = a.cakupan or CAKUPAN_BAWAAN
    ekstensi = a.ekstensi or EKSTENSI_BAWAAN
    lulus, alasan, jumlah, varian = periksa(akar, cakupan, a.kecuali, ekstensi, a.rinci)
    if lulus:
        return u.lulus(
            "kosakata terkendali: %d berkas diperiksa, %d sinonim terlarang, tidak ada pelanggaran"
            % (jumlah, len(varian))
        )
    return u.tolak("kosakata terkendali ditolak", alasan)

if __name__ == "__main__":
    sys.exit(main())
