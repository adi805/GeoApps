#!/usr/bin/env python3
"""skor.py - skor factory ini terhadap 8 kriteria day-1 rubrik quality-criteria v0.5.

Kenapa ada: rubrik 19 kriteria itu berguna justru karena memaksa angka keluar. Tanpa resolver
mekanis, "seberapa sehat factory ini" cuma pendapat, dan pendapat selalu naik. Berkas ini
menghitungnya dari keadaan repo, mencetak BUKTI tiap skor, dan menolak memberi nilai pada hal yang
tidak bisa ditunjukkan.

Yang diambil cuma tier **Day-1 Mandatory** (8 kriteria, maksimum 32):
  Documentation  D1 subject matter specification, D2 process specification & criteria,
                 D4 documentation consistency
  Law            L1 law freshness, L2 vocabulary conformance, L3 single-writer state
  Machine        M1 specification clarity, M4 boundary clarity

Tier Early Operational dan Volume-Earned sengaja belum: yang kedua butuh riwayat, dan mengukur
laju sebelum ada sampel cuma menghasilkan derau.

Skala per kriteria 0-4, dan angkanya adalah JUMLAH syarat yang lulus, bukan selera. Karena itu
tiap kriteria punya tepat empat syarat yang menaik: ada -> tertulis -> diperiksa mesin -> diperiksa
mesin yang jalan sendiri di CI. Syarat yang cuma ada di kepala operator tidak menaikkan skor.

Berkas ini tidak menulis apa pun ke repo.

Cara pakai:
  python3 tools/factory/skor.py               tabel skor
  python3 tools/factory/skor.py --rinci       plus tiap syarat dan buktinya
  python3 tools/factory/skor.py --json
  python3 tools/factory/skor.py --uji-mandiri
"""

import argparse
import glob
import json
import os
import re
import subprocess
import sys
import tempfile

DIR_INI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_INI)
import _umum as u  # noqa: E402

# ---------------------------------------------------------------------------
# Kosakata pemeriksa. Tiap syarat mengembalikan (lulus, bukti).
# ---------------------------------------------------------------------------

def ada(akar, rel, min_byte=1):
    """Berkas ada DAN tidak kosong. Berkas kosong dihitung tidak ada: nama berkas bukan isi."""
    p = os.path.join(akar, rel)
    if not os.path.isfile(p):
        return False, "%s tidak ada" % rel
    if os.path.getsize(p) < min_byte:
        return False, "%s ada tapi kosong" % rel
    return True, rel

def ada_salah_satu(akar, daftar):
    for rel in daftar:
        lulus, bukti = ada(akar, rel)
        if lulus:
            return True, rel
    return False, "tidak ada satu pun dari: %s" % ", ".join(daftar)

def ada_glob(akar, pola):
    temuan = sorted(glob.glob(os.path.join(akar, pola), recursive=True))
    temuan = [t for t in temuan if os.path.isfile(t) and os.path.getsize(t) > 0]
    return bool(temuan), ("%d berkas berisi: %s" % (len(temuan), pola) if temuan else "tidak ada: %s" % pola)

def berisi(akar, rel, teks):
    p = os.path.join(akar, rel)
    if not os.path.isfile(p):
        return False, "%s tidak ada" % rel
    try:
        with open(p, "r", encoding="utf-8") as f:
            isi = f.read()
    except OSError as e:
        return False, "tidak bisa baca %s: %s" % (rel, e)
    return teks in isi, ("%s memuat %r" % (rel, teks) if teks in isi else "%s TIDAK memuat %r" % (rel, teks))

def hitung_baris(akar, rel, pola, mulai=None, sampai=None):
    p = os.path.join(akar, rel)
    if not os.path.isfile(p):
        return 0, "%s tidak ada" % rel
    with open(p, "r", encoding="utf-8") as f:
        baris = f.read().splitlines()
    if mulai:
        i = next((n for n, b in enumerate(baris) if b.startswith(mulai)), None)
        baris = baris[i:] if i is not None else []
    if sampai:
        j = next((n for n, b in enumerate(baris) if b.startswith(sampai)), None)
        baris = baris[:j] if j is not None else baris
    n = sum(1 for b in baris if re.match(pola, b))
    return n, "%d baris cocok %r" % (n, pola)

def perintah(akar, argv, timeout=300):
    """Jalankan perintah di dalam pohon. Berkas kosong dihitung tidak ada, dan skrip kosong
    `python3` keluar 0 tanpa memeriksa apa pun: itu gate yang lolos karena tidak berisi."""
    p = os.path.join(akar, argv[0])
    if not os.path.isfile(p) or os.path.getsize(p) == 0:
        return False, "%s tidak ada atau kosong" % argv[0]
    try:
        h = subprocess.run([sys.executable] + argv, cwd=akar, stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT, text=True, timeout=timeout)
    except (OSError, subprocess.SubprocessError) as e:
        return False, "tidak bisa jalan: %s" % e
    return h.returncode == 0, "%s -> exit %d" % (" ".join(argv), h.returncode)

CI = ".github/workflows/factory-gate.yml"

def di_ci(akar, nama):
    lulus, bukti = berisi(akar, CI, nama)
    return lulus, ("%s dipanggil di %s" % (nama, CI) if lulus else "%s TIDAK dipanggil di %s" % (nama, CI))

# ---------------------------------------------------------------------------
# Delapan kriteria day-1.
# ---------------------------------------------------------------------------

def kriteria(akar):
    def cek(fn, *a):
        return lambda: fn(akar, *a)

    return [
        ("D1", "Documentation", "Subject matter specification", [
            ("kosakata terkendali: ONTOLOGY.md", cek(ada, "ONTOLOGY.md")),
            ("model domain: PRD atau ARCHITECTURE atau CODE-MAP",
             cek(ada_salah_satu, ["docs/prd/PRD.md", "docs/ARCHITECTURE.md", "docs/CODE-MAP.md"])),
            ("inti metodologi: docs/methodology/*.md", cek(ada_glob, "docs/methodology/*.md")),
            ("kartu peran: tabel lane di LAW.md + skill lane",
             lambda: _dua(berisi(akar, "factory/LAW.md", "## 2. Lane"),
                          ada_glob(akar, "factory/skills/*/SKILL.md"))),
        ]),
        ("D2", "Documentation", "Process specification & criteria", [
            ("lima bagian proses tertulis di LAW.md",
             lambda: _semua(berisi(akar, "factory/LAW.md", h) for h in
                            ("## 3. Briefing", "## 4. Dispatch", "## 5. Definisi selesai",
                             "## 6. Closing", "## 7. Escalation"))),
            ("definisi selesai punya >= 4 syarat yang bisa diperiksa",
             lambda: _minimal(hitung_baris(akar, "factory/LAW.md", r"^\|\s*\d+\s*\|",
                                           "## 5. Definisi selesai", "## 6."), 4)),
            ("brief wajib memuat kriteria selesai yang bisa dijalankan",
             cek(berisi, "factory/LAW.md", "perintah yang bisa dijalankan")),
            ("gate bukti closing ada dan dijalankan CI",
             lambda: _dua(ada(akar, "tools/factory/gate_receipt.py"), di_ci(akar, "gate_receipt.py"))),
        ]),
        ("D4", "Documentation", "Documentation consistency", [
            ("pemeriksa lintas lapisan lulus", cek(perintah, ["tools/audit_consistency.py"])),
            ("angka dokumen cocok dengan kode", cek(perintah, ["tools/verifikasi_dokumen.py"])),
            ("versi satu tempat", cek(perintah, ["tools/cek_versi.py"])),
            ("pemeriksa konsistensi dijalankan CI",
             lambda: _dua(di_ci(akar, "audit_consistency.py"), di_ci(akar, "verifikasi_dokumen.py"))),
        ]),
        ("L1", "Law", "Law freshness", [
            ("berkas hukum memuat nomor versi",
             lambda: (bool(re.search(r"\*\*Versi:\*\*\s*\d+\.\d+\.\d+",
                                     _baca(akar, "factory/LAW.md"))), "nomor versi di factory/LAW.md")),
            ("baseline isi hukum masih cocok", cek(perintah, ["tools/factory/gate_law_fresh.py"])),
            ("salinan SKILL.md tersinkron", cek(perintah, ["tools/factory/sync_skill.py", "--check"])),
            ("gate hukum dijalankan CI", lambda: di_ci(akar, "gate_law_fresh.py")),
        ]),
        ("L2", "Law", "Vocabulary conformance", [
            ("ontology ada", cek(ada, "ONTOLOGY.md")),
            ("ontology memuat tabel sinonim terlarang",
             cek(berisi, "ONTOLOGY.md", "dilarang")),
            ("pemeriksa ontology jalan dan hijau", cek(perintah, ["tools/factory/gate_ontology.py"])),
            ("pemeriksa itu dijalankan CI", lambda: di_ci(akar, "gate_ontology.py")),
        ]),
        ("L3", "Law", "Single-writer state", [
            ("tiap artefak state menyebut penulisnya",
             lambda: _dua(berisi(akar, "factory/LAW.md", "Siapa yang menulis"),
                          berisi(akar, "factory/LAW.md", "ledger.jsonl"))),
            ("penulis tunggal ledger ditegakkan", cek(perintah, ["tools/factory/gate_ledger.py"])),
            ("tidak ada penulis kedua untuk ledger.jsonl", lambda: _penulis_tunggal(akar)),
            ("gate ledger dijalankan CI", lambda: di_ci(akar, "gate_ledger.py")),
        ]),
        ("M1", "Machine", "Specification clarity", [
            ("brief punya daftar isi minimum", lambda: _minimal(
                hitung_baris(akar, "factory/LAW.md", r"^\d+\.\s", "## 3. Briefing", "## 4."), 5)),
            ("kriteria selesai wajib punya perintah dan exit code",
             cek(berisi, "tools/factory/gate_receipt.py", '"exit"')),
            ("sudah ada minimal 3 receipt untuk ditinjau",
             lambda: _minimal(_hitung_berisi(akar, "factory/receipts/*.json"), 3)),
            ("tinjauan dua-ahli tercatat di kadens",
             cek(berisi, "factory/SKOR.md", "Kadens")),
        ]),
        ("M4", "Machine", "Boundary clarity", [
            ("apa yang dimiliki factory tertulis", cek(berisi, "factory/LAW.md", "## 1. Apa ini")),
            ("tetangga dan mode interaksinya tertulis",
             lambda: _dua(berisi(akar, "factory/LAW.md", "## 9. Larangan di joyboy"),
                          berisi(akar, "factory/LAW.md", "## 10. Di mana aturan tinggal"))),
            ("batas lane ditegakkan mesin",
             lambda: _dua(ada(akar, "tools/factory/gate_commit_paths.py"),
                          ada(akar, "factory/lanes.json"))),
            ("gate cakupan lane dijalankan CI", lambda: di_ci(akar, "gate_commit_paths.py")),
        ]),
    ]

def _baca(akar, rel):
    try:
        with open(os.path.join(akar, rel), "r", encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ""

def _dua(a, b):
    return (a[0] and b[0], "%s | %s" % (a[1], b[1]))

def _hitung_berisi(akar, pola):
    """Berkas yang cocok DAN berisi. Berkas kosong bukan receipt."""
    temuan = [p for p in glob.glob(os.path.join(akar, pola), recursive=True)
              if os.path.isfile(p) and os.path.getsize(p) > 0]
    return len(temuan), "%d berkas berisi cocok %s" % (len(temuan), pola)

def _semua(pasangan):
    pasangan = list(pasangan)
    return (all(p[0] for p in pasangan), " | ".join(p[1] for p in pasangan))

def _minimal(pasangan, ambang):
    n, bukti = pasangan
    return n >= ambang, "%s (butuh >= %d)" % (bukti, ambang)

def _penulis_tunggal(akar):
    """Penulis ledger.jsonl harus cuma satu berkas, dan berkas itu harus ada.

    Tanpa syarat "harus ada", pohon kosong lolos: tidak ada penulis kedua karena tidak ada penulis
    sama sekali. Syarat yang benar hanya karena subjeknya hilang itu bukan syarat.
    """
    if not ada(akar, "tools/factory/ledger.py")[0]:
        return False, "tools/factory/ledger.py tidak ada atau kosong: tidak ada penulisnya"
    # `skor.py` memuat fixture untuk pemeriksaan ini, jadi ia memuat pola tulis ledger sebagai
    # TEKS. Diukur 2026-10-09: tanpa pengecualian ini, skor.py melaporkan dirinya sendiri sebagai
    # penulis kedua. Yang dikecualikan cuma berkas yang memuat fixture-nya; penulis kedua di tempat
    # lain tetap ditangkap, dan itu punya kasus negatifnya sendiri di uji mandiri.
    penulis = []
    for p in glob.glob(os.path.join(akar, "tools/**/*.py"), recursive=True):
        if os.path.basename(p) in ("ledger.py", "skor.py"):
            continue
        try:
            with open(p, "r", encoding="utf-8", errors="ignore") as f:
                isi = f.read()
        except OSError:
            continue
        # Pola ini wajib menuntut kutip SETELAH `open(`, bukan sekadar `open(` lalu apa saja.
        # Bentuk yang longgar (`open\([^)]*ledger\.jsonl`) cocok dengan berkas ini sendiri, karena
        # berkas ini MEMUAT pola itu sebagai teks: diukur 2026-10-09, skor.py dilaporkan sebagai
        # penulis kedua ledger-nya sendiri. Detektor yang menangkap dirinya sendiri bukan detektor.
        if re.search(r'open\(\s*[\'"][^\'"]*ledger\.jsonl', isi):
            penulis.append(os.path.relpath(p, akar))
    return (not penulis, "penulis lain: %s" % ", ".join(penulis) if penulis else "hanya tools/factory/ledger.py")

def skor_semua(akar):
    hasil = []
    for kode, keluarga, nama, syarat in kriteria(akar):
        dinilai = []
        for label, fn in syarat:
            try:
                lulus, bukti = fn()
            except Exception as e:  # noqa: BLE001 - syarat yang meledak dihitung gagal, bukan lolos
                lulus, bukti = False, "syarat meledak: %s" % e
            dinilai.append({"syarat": label, "lulus": bool(lulus), "bukti": bukti})
        hasil.append({
            "kode": kode, "keluarga": keluarga, "nama": nama,
            "skor": min(sum(1 for d in dinilai if d["lulus"]), 4),
            "maks": 4, "syarat": dinilai,
        })
    return hasil

def cetak(hasil, rinci):
    total = sum(h["skor"] for h in hasil)
    maks = sum(h["maks"] for h in hasil)
    print("%-42s %-6s %s" % ("KRITERIA", "SKOR", "KELUARGA"))
    for h in hasil:
        print("%-42s %d/%-4d %s" % ("%s (%s)" % (h["nama"], h["kode"]), h["skor"], h["maks"], h["keluarga"]))
        if rinci:
            for d in h["syarat"]:
                print("      %s %s" % ("[x]" if d["lulus"] else "[ ]", d["syarat"]))
                print("          bukti: %s" % d["bukti"])
    print("")
    print("TOTAL day-1: %d / %d (%.1f%%)" % (total, maks, 100.0 * total / maks if maks else 0.0))
    band = "Provisional" if total <= 8 else "Operational" if total <= 16 else "Scalable" if total <= 24 else "Optimizing"
    print("Band day-1: %s (Provisional 0-8, Operational 9-16, Scalable 17-24, Optimizing 25-32)" % band)

def uji_mandiri():
    """Resolver yang cuma pernah bilang 'tinggi' belum membuktikan ia bisa bilang 'nol'."""
    gagal = 0
    kasus = []

    def pohon(tmp, kosong=False, isi=True, ci=True, syarat=5, gate=0, penulis_kedua=False):
        if kosong:
            return
        def tulis(rel, teks):
            p = os.path.join(tmp, rel)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                f.write(teks if isi else "")
        def skrip(rel, kode):
            tulis(rel, "#!/usr/bin/env python3\nimport sys\nsys.exit(%d)\n" % kode)

        tulis("ONTOLOGY.md", "| istilah | dipakai | dilarang |\n|---|---|---|\n| upah | upah | gaji |\n")
        tulis("docs/prd/PRD.md", "# PRD\n")
        tulis("docs/methodology/01-penghitung.md", "# metodologi\n")
        tulis("factory/skills/uji/SKILL.md", "---\nname: uji\ndescription: uji\n---\n")
        tulis("factory/lanes.json", json.dumps({"grup": "-100", "penulis_ledger": "HQ",
                                                "lane": [{"id": "HQ", "topic": 23, "glob": ["factory/**"]}]}))
        tulis("factory/ledger.jsonl", "{}\n")
        tulis("factory/SKOR.md", "# Skor\n\nKadens: bulanan.\n")
        baris = "\n".join("| %d | syarat %d | cara |" % (i, i) for i in range(1, syarat + 1))
        tulis("factory/LAW.md", "\n".join([
            "# Hukum", "**Versi:** 0.7.0",
            "## 1. Apa ini", "## 2. Lane", "| `HQ` | 23 | hukum |",
            "## 3. Briefing", "1. nomor", "2. cakupan", "3. kriteria selesai, dalam bentuk perintah yang bisa dijalankan",
            "4. worktree", "5. batas",
            "## 4. Dispatch", "## 5. Definisi selesai", baris,
            "## 6. Closing", "## 7. Escalation", "## 8. Gate",
            "### 8.2 Artefak yang dibaca gate",
            "| `factory/ledger.jsonl` | catatan | `ledger.py` |",
            "Siapa yang menulis: tabel di atas.",
            "## 9. Larangan di joyboy", "## 10. Di mana aturan tinggal",
        ]))
        for rel in ("tools/audit_consistency.py", "tools/verifikasi_dokumen.py", "tools/cek_versi.py",
                    "tools/factory/gate_law_fresh.py", "tools/factory/gate_ledger.py",
                    "tools/factory/gate_commit_paths.py", "tools/factory/gate_ontology.py"):
            skrip(rel, gate)
        skrip("tools/factory/sync_skill.py", gate)
        skrip("tools/factory/ledger.py", 0)
        tulis("tools/factory/gate_receipt.py", ("#!/usr/bin/env python3\nimport sys\nsys.exit(%d)\n" % gate)
              + '"""menolak kalau "exit" != 0"""\n')
        for i in range(1, 4):
            tulis("factory/receipts/%d.json" % i, '{"issue": %d}\n' % i)
        if penulis_kedua:
            tulis("tools/lain.py", "with open('factory/ledger.jsonl', 'w') as f:\n    f.write('')\n")
        daftar_ci = ["gate_receipt.py", "audit_consistency.py", "verifikasi_dokumen.py",
                     "gate_law_fresh.py", "gate_ledger.py", "gate_commit_paths.py", "gate_ontology.py"]
        tulis(CI, "name: factory-gate\n" + ("\n".join("run: python3 tools/factory/%s" % d for d in daftar_ci)
                                            if ci else "run: python3 tools/factory/uji_gate_mandiri.py") + "\n")

    def jalankan(nama, harap_total=None, harap_skor=None, **opsi):
        with tempfile.TemporaryDirectory() as tmp:
            pohon(tmp, **opsi)
            hasil = skor_semua(tmp)
            total = sum(h["skor"] for h in hasil)
            benar = True
            if harap_total is not None:
                benar = benar and total == harap_total
            if harap_skor is not None:
                peta = {h["kode"]: h["skor"] for h in hasil}
                benar = benar and all(peta[k] == v for k, v in harap_skor.items())
            print("  %s %-44s total=%d%s" % (
                "LULUS " if benar else "GAGAL ", nama, total,
                "" if harap_total is None else " (harap %d)" % harap_total))
            if not benar:
                print("         skor: %s" % {h["kode"]: h["skor"] for h in hasil})
            return 0 if benar else 1

    kasus = [
        ("pohon kosong: semua nol", dict(kosong=True), dict(harap_total=0)),
        ("pohon lengkap dan hijau: semua penuh", dict(), dict(harap_total=32)),
        ("berkas ada tapi kosong", dict(isi=False), dict(harap_total=0)),
        ("gate merah dihitung gagal", dict(gate=1),
         dict(harap_skor={"D1": 4, "D2": 4, "D4": 1, "L1": 2, "L2": 3, "L3": 3, "M1": 4, "M4": 4})),
        ("CI tidak memanggil gate", dict(ci=False),
         dict(harap_skor={"D2": 3, "D4": 3, "L1": 3, "L2": 3, "L3": 3, "M4": 3})),
        ("definisi selesai cuma 2 syarat", dict(syarat=2), dict(harap_skor={"D2": 3})),
        ("ada penulis kedua untuk ledger", dict(penulis_kedua=True), dict(harap_skor={"L3": 3})),
    ]
    for nama, opsi, harap in kasus:
        gagal += jalankan(nama, **opsi, **harap)

    # Skor yang dihitung dari pohon yang terparkir melaporkan keadaan yang sudah tidak ada (#160).
    n_jaga, gagal_jaga = u.uji_penjaga_branch()
    kasus.extend(["penjaga-branch"] * n_jaga)
    gagal += gagal_jaga

    print("")
    print("UJI MANDIRI: %d kasus, %d gagal" % (len(kasus), gagal))
    return gagal

def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=u.akar_factory())
    p.add_argument("--rinci", action="store_true")
    p.add_argument("--json", action="store_true")
    p.add_argument("--uji-mandiri", action="store_true")
    a = p.parse_args()

    if a.uji_mandiri:
        return 1 if uji_mandiri() else 0

    # Pohon tempat skrip ini hidup harus `main` dan mutakhir: skor yang dihitung dari kode basi
    # melaporkan keadaan yang sudah tidak ada (#160).
    if u.jalankan_penjaga_branch():
        return 1

    hasil = skor_semua(os.path.abspath(os.path.expanduser(a.akar)))
    if a.json:
        print(json.dumps({"kriteria": hasil,
                          "total": sum(h["skor"] for h in hasil),
                          "maks": sum(h["maks"] for h in hasil)}, indent=2, ensure_ascii=False))
    else:
        cetak(hasil, a.rinci)
    return 0

if __name__ == "__main__":
    sys.exit(main())
