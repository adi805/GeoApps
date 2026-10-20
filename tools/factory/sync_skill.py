#!/usr/bin/env python3
"""sync_skill.py - jaga SKILL.md factory tetap sama dengan factory/LAW.md.

Kenapa ada: hukum proses factory ini hidup di `factory/LAW.md` supaya ikut di-version bersama
kodenya, tapi yang dibaca agent saat bekerja adalah skill di `~/.opencrabs/skills/`. Dua salinan
dari satu aturan pasti melenceng, dan salinan yang melenceng lebih berbahaya daripada tidak ada
salinan: agent membaca aturan lama dan percaya itu yang berlaku. Berkas ini membuat salinan kedua
bisa diperiksa mesin.

Arah sinkronisasi satu arah dan tidak bisa dibalik: `LAW.md` adalah sumbernya, `SKILL.md` adalah
hasilnya. Mengedit `SKILL.md` langsung akan hilang pada sinkronisasi berikutnya, dan `--check`
melaporkannya sebagai berbeda sebelum itu terjadi.

**Berkas ini menulis ke berkas hidup di luar repo, dan itu dibatasi (#105).** Path tujuannya dibaca
SEMUA sesi, jadi branch mana pun yang menjalankan alat ini menimpa skill yang sedang dipakai sesi
lain. Terukur 2026-10-10: `--check` gagal di `main` dengan angka milik branch LAW lain, lalu gagal
di branch itu dengan arah terbalik, karena berkas yang sama ditulis bergantian oleh dua worktree.
Dua akibatnya ditangani di sini:

  - Penulisan DITOLAK kalau branch repo bukan `main`, kecuali `--paksa`. Perubahan hukum yang sudah
    di-merge tetap tersinkron, karena sesi yang bekerja di `main` tetap boleh menulis.
  - Tiap penulisan meninggalkan berkas pendamping `.sumber.json` di sebelah `SKILL.md`, memuat versi
    LAW, SHA isinya, SHA hasil, dan branch yang menghasilkannya. `--check` melaporkan asal-usul itu,
    jadi selisihnya terbaca sebagai "ditulis dari branch X" dan bukan drift misterius.

Berkas pendamping yang belum ada bukan kegagalan: ia berarti berkas hidup itu dihasilkan sebelum
asal-usul dicatat. Yang diperiksa tetap isinya.

Cara pakai:
  python3 tools/factory/sync_skill.py              tulis ulang SKILL.md dari LAW.md
  python3 tools/factory/sync_skill.py --check      periksa saja, keluar 1 kalau berbeda
  python3 tools/factory/sync_skill.py --tujuan P   tulis ke path lain (dipakai uji mandiri)
  python3 tools/factory/sync_skill.py --akar D     pakai pohon lain (dipakai uji mandiri)
  python3 tools/factory/sync_skill.py --paksa      tulis walau branch repo bukan main
  python3 tools/factory/sync_skill.py --uji-mandiri
"""

import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

DIR_INI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_INI)
import _umum as u  # noqa: E402

AKAR = os.path.dirname(os.path.dirname(DIR_INI))
BERKAS_LAW = os.path.join(AKAR, "factory", "LAW.md")

SLUG = u.nama_skill("factory")

# Satu-satunya branch yang boleh menulis berkas hidup. Lihat #105: tujuannya dibaca semua sesi,
# jadi menulisnya dari worktree fitur berarti menimpa skill yang sedang dipakai sesi lain.
BRANCH_SAH = "main"

# Berkas pendamping di direktori SKILL.md, memuat asal-usul hasil generate.
BERKAS_SUMBER = ".sumber.json"

def deskripsi(akar=None):
    """Kalimat pemicu skill. Nama proyek, daftar lane, dan repo dibaca dari identitas dan
    lanes.json supaya proyek kedua tidak mewarisi kalimat proyek pertama."""
    lanes = u.baca_json(os.path.join(akar or AKAR, "factory", "lanes.json"))
    nama_lane = ", ".join(l["id"] for l in lanes.get("lane") or [])
    return ("Hukum proses factory %s: %d lane (%s), briefing, dispatch, definisi selesai, "
            "closing, escalation, gate mekanis, dan jalur commit. Muat sebelum mengerjakan "
            "unit kerja di repo %s." % (
                u.idn("proyek", "proyek ini", akar), len(lanes.get("lane") or []), nama_lane,
                u.idn("repo.github", "repo ini", akar)))

def globs(akar=None):
    """Pola pemicu, sengaja lebar: sesi bisa jalan dari worktree mana pun
    (~/<slug>, ~/<slug>-<nama>), dan skill ini harus ikut terpicu di semuanya."""
    s = u.slug(akar)
    return ["**/%s/**" % s, "**/%s-*/**" % s] + list(u.idn("glob_pemicu", [], akar))

DESKRIPSI = deskripsi()
GLOBS = globs()

PENANDA = "<!-- DIHASILKAN DARI factory/LAW.md OLEH tools/factory/sync_skill.py - JANGAN DIEDIT TANGAN -->"

TUJUAN_BAWAAN = os.path.join(
    u.dir_terluas("skills_dir", "~/.opencrabs/skills"), SLUG, "SKILL.md"
)


def bangun(isi_law):
    """Rakit isi SKILL.md dari isi LAW.md.

    Placeholder `{{...}}` di LAW.md diisi DI SINI. Tanpa langkah ini, `{{proyek}}` dan
    `{{skill_factory}}` masuk ke SKILL.md apa adanya, dan agent yang membacanya melihat teks
    kurung kurawal di tengah instruksi: rusak, tapi tidak ada satu pun pemeriksa yang menolak.
    `u.isi_placeholder` juga MELEMPAR pada placeholder asing, jadi salah ketik di LAW.md muncul
    sebagai kegagalan generate, bukan sebagai teks di berkas terpasang.
    """
    isi_law = u.isi_placeholder(isi_law)
    baris_glob = "\n".join('  - "%s"' % g for g in GLOBS)
    frontmatter = (
        "---\n"
        "name: %s\n"
        "description: %s\n"
        "globs:\n"
        "%s\n"
        "---\n"
    ) % (SLUG, DESKRIPSI, baris_glob)
    return frontmatter + "\n" + PENANDA + "\n\n" + isi_law.lstrip("\n")


def baca(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def sidik(isi):
    return hashlib.sha256(isi.encode("utf-8")).hexdigest()


def versi_law(isi):
    m = re.search(r"^\*\*Versi:\*\*\s*(\S+)\s*$", isi, re.MULTILINE)
    return m.group(1) if m else None


def branch_sekarang(akar):
    """Nama branch HEAD pohon `akar`, atau None kalau tidak bisa ditentukan (bukan repo git)."""
    try:
        h = subprocess.run(["git", "-C", akar, "rev-parse", "--abbrev-ref", "HEAD"],
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    except OSError:
        return None
    if h.returncode != 0:
        return None
    return h.stdout.strip() or None


def path_sumber(tujuan):
    return os.path.join(os.path.dirname(os.path.abspath(tujuan)), BERKAS_SUMBER)


def asal_usul(tujuan):
    """Ringkasan asal-usul berkas hidup dari berkas pendampingnya, atau None kalau tidak ada."""
    path = path_sumber(tujuan)
    if not os.path.exists(path):
        return None
    try:
        d = json.loads(baca(path))
    except (OSError, json.JSONDecodeError) as e:
        return "berkas pendamping %s tidak terbaca: %s" % (os.path.basename(path), e)
    return ("dihasilkan dari LAW versi %s (sha256 %s) di branch `%s`, %s"
            % (d.get("versi_law"), str(d.get("sha256_law"))[:12], d.get("branch"), d.get("ts")))


def catat_sumber(tujuan, isi_skill, akar):
    """Tulis berkas pendamping berisi asal-usul hasil generate (#105)."""
    isi_law = baca(BERKAS_LAW) if os.path.exists(BERKAS_LAW) else None
    d = {
        "versi_law": versi_law(isi_law) if isi_law is not None else None,
        "sha256_law": sidik(isi_law) if isi_law is not None else None,
        "sha256_skill": sidik(isi_skill),
        "branch": branch_sekarang(akar),
        "ts": datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(
            timespec="seconds"),
        "catatan": "ditulis tools/factory/sync_skill.py; jangan diedit tangan",
    }
    tulis(path_sumber(tujuan), json.dumps(d, indent=2, ensure_ascii=False) + "\n")
    return d


def periksa(tujuan):
    """Kembalikan (cocok, pesan). cocok True berarti SKILL.md sudah sama dengan LAW.md."""
    if not os.path.exists(BERKAS_LAW):
        return False, "sumber tidak ada: %s" % os.path.relpath(BERKAS_LAW, AKAR)
    if not os.path.exists(tujuan):
        return False, "belum ada: %s" % tujuan

    harap = bangun(baca(BERKAS_LAW))
    ada = baca(tujuan)
    if harap == ada:
        return True, "sama"
    if ada.startswith("---\n") is False:
        return False, "tidak ada frontmatter YAML (skill tidak akan terdaftar)"
    return False, "berbeda dari LAW.md (%d vs %d byte)" % (len(harap), len(ada))


def tulis(tujuan, isi):
    os.makedirs(os.path.dirname(tujuan), exist_ok=True)
    with open(tujuan, "w", encoding="utf-8") as f:
        f.write(isi)


def uji_mandiri():
    """Pemeriksa yang belum pernah menolak apa pun belum membuktikan apa pun.

    Semua kasus dijalankan di direktori sementara, tidak pernah menyentuh skill yang hidup.
    """
    global BERKAS_LAW

    law_asli = BERKAS_LAW
    gagal = 0
    kasus = []

    def jalankan(nama, siapkan, harus_cocok):
        global BERKAS_LAW
        gagal_lokal = 0
        with tempfile.TemporaryDirectory() as tmp:
            law = os.path.join(tmp, "LAW.md")
            tujuan = os.path.join(tmp, "skills", SLUG, "SKILL.md")
            with open(law, "w", encoding="utf-8") as f:
                f.write("# Hukum contoh\n\nIsi contoh.\n")
            BERKAS_LAW = law
            siapkan(law, tujuan)
            cocok, pesan = periksa(tujuan)
            benar = cocok == harus_cocok
            if not benar:
                gagal_lokal = 1
            tanda = "LULUS " if benar else "GAGAL "
            harap = "harus cocok" if harus_cocok else "harus ditolak"
            print("  %s %-46s %s" % (tanda, nama, harap))
            if not cocok:
                print("         alasan: %s" % pesan)
        return gagal_lokal

    def biarkan_kosong(law, tujuan):
        pass

    def tulis_benar(law, tujuan):
        tulis(tujuan, bangun(baca(law)))

    def beda_satu_kata(law, tujuan):
        tulis(tujuan, bangun(baca(law)).replace("dispatch", "DISPATCH"))

    def beda_satu_byte(law, tujuan):
        tulis(tujuan, bangun(baca(law)) + "\n")

    def tanpa_frontmatter(law, tujuan):
        tulis(tujuan, baca(law))

    def law_sudah_berubah(law, tujuan):
        tulis(tujuan, bangun(baca(law)))
        with open(law, "a", encoding="utf-8") as f:
            f.write("\nAturan baru yang belum disinkronkan.\n")

    def law_hilang(law, tujuan):
        tulis(tujuan, bangun(baca(law)))
        os.remove(law)

    def nama_salah(law, tujuan):
        isi = bangun(baca(law)).replace("name: %s" % SLUG, "name: %s-lama" % u.slug())
        tulis(tujuan, isi)

    def placeholder_asing(law, tujuan):
        with open(law, "w", encoding="utf-8") as f:
            f.write("Hukum {{proyek}} dengan {{salah_ketik}} di dalamnya.\n")

    kasus = [
        ("SKILL.md belum ada", biarkan_kosong, False),
        ("SKILL.md sudah sama", tulis_benar, True),
        ("satu kata diubah", beda_satu_kata, False),
        ("kelebihan satu byte", beda_satu_byte, False),
        ("frontmatter hilang", tanpa_frontmatter, False),
        ("LAW.md berubah, SKILL.md belum", law_sudah_berubah, False),
        ("LAW.md tidak ada", law_hilang, False),
        ("nama skill salah", nama_salah, False),
        ("placeholder asing di LAW ditolak", placeholder_asing, False),
    ]

    for nama, siapkan, harus_cocok in kasus:
        gagal += jalankan(nama, siapkan, harus_cocok)

    # Tiga kasus penulisan berkas hidup (#105). Yang diuji di sini KEPUTUSAN menulis, bukan hasil
    # `periksa`: penjaganya hidup di `main()`, jadi jalurnya CLI, bukan pemanggilan fungsi.
    def repo(tmp, branch):
        subprocess.run(["git", "init", "-q", tmp], check=True)
        subprocess.run(["git", "-C", tmp, "symbolic-ref", "HEAD", "refs/heads/%s" % branch],
                       check=True)
        subprocess.run(["git", "-C", tmp, "-c", "user.email=uji@contoh", "-c", "user.name=uji",
                        "commit", "-q", "--allow-empty", "-m", "awal"], check=True)
        law = os.path.join(tmp, "factory", "LAW.md")
        os.makedirs(os.path.dirname(law), exist_ok=True)
        with open(law, "w", encoding="utf-8") as f:
            f.write("# Hukum contoh\n\n**Versi:** 9.9.9\n\nIsi contoh.\n")

    def cek(nama, benar, detail=""):
        nonlocal gagal
        kasus.append(nama)
        if not benar:
            gagal += 1
        print("  %s %-46s %s" % ("LULUS " if benar else "GAGAL ", nama, detail))

    def tulis_cli(tmp, branch, paksa):
        repo(tmp, branch)
        tujuan = os.path.join(tmp, "keluaran", "skills", SLUG, "SKILL.md")
        argv = [sys.executable, os.path.abspath(__file__), "--akar", tmp, "--tujuan", tujuan]
        if paksa:
            argv.append("--paksa")
        return subprocess.run(argv, capture_output=True, text=True), tujuan

    with tempfile.TemporaryDirectory() as tmp:
        r, tujuan = tulis_cli(os.path.join(tmp, "fitur"), "factory/sesuatu", paksa=False)
        cek("branch bukan main menolak tulis",
            r.returncode != 0 and not os.path.exists(tujuan),
            "exit=%d, berkas=%s" % (r.returncode, "ada" if os.path.exists(tujuan) else "tidak ada"))
        r, tujuan = tulis_cli(os.path.join(tmp, "paksa"), "factory/sesuatu", paksa=True)
        cek("--paksa menulis dari branch bukan main",
            r.returncode == 0 and os.path.exists(tujuan),
            "exit=%d" % r.returncode)
        cek("--paksa meninggalkan asal-usul branch-nya",
            os.path.exists(path_sumber(tujuan))
            and json.loads(baca(path_sumber(tujuan))).get("branch") == "factory/sesuatu",
            "branch tercatat: %s" % (json.loads(baca(path_sumber(tujuan))).get("branch")
                                     if os.path.exists(path_sumber(tujuan)) else "tidak ada"))
        r, tujuan = tulis_cli(os.path.join(tmp, "utama"), "main", paksa=False)
        cek("branch main menulis",
            r.returncode == 0 and os.path.exists(tujuan), "exit=%d" % r.returncode)
        asal = asal_usul(tujuan) or ""
        cek("asal-usul memuat versi LAW, SHA, dan branch",
            "versi 9.9.9" in asal and "sha256" in asal and "`main`" in asal, asal)

    BERKAS_LAW = law_asli
    print("")
    print("UJI MANDIRI: %d kasus, %d gagal" % (len(kasus), gagal))
    return gagal


def main():
    global BERKAS_LAW, AKAR

    if "--uji-mandiri" in sys.argv:
        return 1 if uji_mandiri() else 0

    tujuan = TUJUAN_BAWAAN
    if "--tujuan" in sys.argv:
        i = sys.argv.index("--tujuan")
        if i + 1 >= len(sys.argv):
            print("--tujuan butuh path")
            return 2
        tujuan = os.path.abspath(os.path.expanduser(sys.argv[i + 1]))

    if "--akar" in sys.argv:
        i = sys.argv.index("--akar")
        if i + 1 >= len(sys.argv):
            print("--akar butuh path")
            return 2
        AKAR = os.path.abspath(os.path.expanduser(sys.argv[i + 1]))
        BERKAS_LAW = os.path.join(AKAR, "factory", "LAW.md")

    paksa = "--paksa" in sys.argv

    # Penjaga pohon HANYA untuk tujuan bawaan. `--tujuan` berarti pemanggilnya memilih sendiri
    # berkas mana yang ditulis, dan uji mandiri memang memakainya untuk menulis ke direktori
    # sementara. Yang berbahaya adalah tujuan bawaan: itu berkas hidup milik pohon kanonik.
    if tujuan == TUJUAN_BAWAAN and not paksa:
        kode, pesan = u.penjaga_pohon(AKAR)
        if kode != 0:
            if "--check" in sys.argv:
                print("LEWAT  %s" % pesan)
                return 0
            print("GAGAL  %s" % pesan)
            print("       Kalau memang disengaja, pakai --paksa.")
            return 1

    if "--check" in sys.argv:
        cocok, pesan = periksa(tujuan)
        asal = asal_usul(tujuan)
        if asal:
            print("       asal  : %s" % asal)
        else:
            print("       asal  : tidak diketahui (belum ada %s; berkas hidup ini dihasilkan "
                  "sebelum asal-usul dicatat)" % BERKAS_SUMBER)
        if cocok:
            print("LULUS  %s sama dengan %s" % (os.path.relpath(tujuan, os.path.expanduser("~")),
                                                os.path.relpath(BERKAS_LAW, AKAR)))
            return 0
        print("GAGAL  %s: %s" % (os.path.relpath(tujuan, os.path.expanduser("~")), pesan))
        print("       jalankan: python3 tools/factory/sync_skill.py")
        return 1

    if not os.path.exists(BERKAS_LAW):
        print("GAGAL  sumber tidak ada: %s" % BERKAS_LAW)
        return 2

    # Berkas tujuannya dibaca SEMUA sesi, jadi yang boleh menulisnya cuma sesi yang bekerja di
    # `main` (#105). Sebelum penjaga ini, tiap worktree yang menjalankan suite gate-nya menimpa
    # skill hidup, dan `--check` gagal bergantian dengan arah yang saling bertolak.
    branch = branch_sekarang(AKAR)
    if branch is not None and branch != BRANCH_SAH and not paksa:
        print("GAGAL  branch pohon ini `%s`, bukan `%s`. %s dibaca semua sesi, jadi menulisnya dari "
              "worktree fitur menimpa skill yang sedang dipakai sesi lain (#105)."
              % (branch, BRANCH_SAH, os.path.relpath(tujuan, os.path.expanduser("~"))))
        print("       Sinkronkan dari pohon `%s` sesudah perubahan hukumnya di-merge, atau pakai "
              "--paksa kalau memang disengaja." % BRANCH_SAH)
        return 1

    isi = bangun(baca(BERKAS_LAW))
    tulis(tujuan, isi)
    sumber = catat_sumber(tujuan, isi, AKAR)
    print("TULIS  %s (%d byte) dari LAW versi %s di branch `%s`"
          % (os.path.relpath(tujuan, os.path.expanduser("~")), len(isi),
             sumber.get("versi_law"), sumber.get("branch")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
