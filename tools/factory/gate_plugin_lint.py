#!/usr/bin/env python3
"""gate_plugin_lint.py - periksa skill hasil adopsi plugin upstream sebelum masuk.

Kenapa ada: berkas di `factory/skills/` adalah hasil tulis ulang dari plugin upstream. Tulis
ulang punya empat cara gagal yang semuanya senyap, dan keempatnya pernah terjadi atau hampir
terjadi di pohon ini:

  1. **Sisa konvensi Cowork** (`CONNECTORS.md`, `$ARGUMENTS`, `~~tool`, `allowed-tools`).
     Skill-nya tetap terbaca agent, tapi menunjuk berkas dan placeholder yang tidak ada di sini.
  2. **Frontmatter hilang atau namanya tidak cocok dengan direktorinya.** Skill tidak terdaftar,
     dan kegagalannya senyap: ia cuma tidak muncul di indeks skill.
  3. **Header sumber hilang atau SHA-nya beda dari yang dipin di `factory/upstream/PIN.md`.**
     Kewajiban atribusi Apache-2.0 tidak terpenuhi, dan jejak versi upstream jadi bohong.
  4. **Berkasnya ada di disk tapi tidak masuk git.** Ini yang paling mahal, dan sudah terjadi:
     pola `.gitignore` `[Dd]ebug/` dari template Visual Studio menelan
     `factory/skills/debug/SKILL.md` tanpa error apa pun, jadi 18 berkas ada di disk sementara
     17 yang ke-commit. Pemeriksa lain tidak akan pernah melihat berkas yang tidak ada di git.

Cara pakai:
  python3 tools/factory/gate_plugin_lint.py                periksa seluruh factory/skills
  python3 tools/factory/gate_plugin_lint.py --akar <dir>   periksa pohon lain (uji mandiri)
  python3 tools/factory/gate_plugin_lint.py --uji-mandiri  buktikan gate ini bisa menolak
"""

import os
import re
import subprocess
import sys
import tempfile

DIR_INI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_INI)
import _umum as u  # noqa: E402

AKAR_BAWAAN = os.path.dirname(os.path.dirname(DIR_INI))

DIR_SKILLS = os.path.join("factory", "skills")
BERKAS_PIN = os.path.join("factory", "upstream", "PIN.md")
BERKAS_SKILL = "SKILL.md"

BATAS_DESKRIPSI = 512

# Konvensi Cowork yang tidak boleh ikut terbawa dari upstream.
LARANGAN = [
    ("CONNECTORS.md", "rujukan konektor Cowork"),
    ("$ARGUMENTS", "placeholder argumen Cowork"),
    ("allowed-tools", "field frontmatter Cowork"),
    ("argument-hint", "field frontmatter Cowork"),
    ("user-invocable", "field frontmatter Cowork"),
    ("compatibility:", "field frontmatter Cowork"),
    ("@$1", "placeholder argumen Cowork"),
    ("~~", "placeholder tool Cowork"),
]

RE_PIN = re.compile(r"SHA dipin[^`]*`([0-9a-f]{40})`")
RE_SUMBER = re.compile(r"Sumber:\s*(\S+)\s*@\s*([0-9a-f]{40})")
RE_NAME = re.compile(r"^name:[ \t]*(\S+)[ \t]*$", re.M)
RE_DESC = re.compile(r"^description:[ \t]*(\S.*)$", re.M)

def baca(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def git(akar, *args):
    hasil = subprocess.run(
        ["git", "-C", akar] + list(args),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    return hasil.returncode, hasil.stdout

def sha_pin(akar):
    """SHA upstream yang dipin, dari PIN.md. None kalau tidak bisa dibaca."""
    path = os.path.join(akar, BERKAS_PIN)
    if not os.path.isfile(path):
        return None
    m = RE_PIN.search(baca(path))
    return m.group(1) if m else None

def berkas_tertrack(akar):
    """Set path relatif yang ter-track git, atau None kalau akar bukan repo git.

    None berarti pemeriksaan ini dilewati, dan itu dilaporkan sebagai catatan, bukan sebagai
    lulus. Diam-diam melewati pemeriksaan lebih buruk daripada tidak punya pemeriksaan.
    """
    kode, keluar = git(akar, "rev-parse", "--is-inside-work-tree")
    if kode != 0 or keluar.strip() != "true":
        return None
    kode, keluar = git(akar, "ls-files", "-z", "--", DIR_SKILLS)
    if kode != 0:
        return None
    return set(p for p in keluar.split("\0") if p)

def periksa(akar):
    """Kembalikan (masalah, jumlah_diperiksa, catatan)."""
    masalah = []
    catatan = []
    dir_skills = os.path.join(akar, DIR_SKILLS)

    pin = sha_pin(akar)
    if pin is None:
        masalah.append("%s tidak ada atau tidak memuat 'SHA dipin'" % BERKAS_PIN)

    nama_skill = []
    if os.path.isdir(dir_skills):
        nama_skill = sorted(
            n for n in os.listdir(dir_skills)
            if os.path.isfile(os.path.join(dir_skills, n, BERKAS_SKILL))
        )
    if not nama_skill:
        masalah.append(
            "%s tidak memuat satu pun %s: lint yang tidak punya apa pun untuk diperiksa harus "
            "berisik, bukan lulus diam-diam" % (DIR_SKILLS, BERKAS_SKILL)
        )
        return masalah, 0, catatan

    for nama in nama_skill:
        rel = "%s/%s/%s" % (DIR_SKILLS, nama, BERKAS_SKILL)
        isi = baca(os.path.join(akar, rel))
        label = "%s: " % rel

        # 1. frontmatter
        if not isi.startswith("---\n"):
            masalah.append(label + "tidak diawali frontmatter YAML (skill tidak akan terdaftar)")
        else:
            ujung = isi.find("\n---", 4)
            if ujung < 0:
                masalah.append(label + "frontmatter tidak ditutup")
            else:
                fm = isi[:ujung]
                m_name = RE_NAME.search(fm)
                m_desc = RE_DESC.search(fm)
                if not m_name:
                    masalah.append(label + "frontmatter tanpa field 'name'")
                elif u.isi_placeholder(m_name.group(1), akar) != u.nama_skill(nama, akar):
                    # Sumber memakai `{{slug}}-<nama>`; yang dibandingkan adalah bentuk
                    # SETELAH diganti, karena itulah yang benar-benar terpasang.
                    masalah.append(
                        label + "name '%s' harus '%s' (direktori '%s')"
                        % (m_name.group(1), u.nama_skill(nama, akar), nama)
                    )
                if not m_desc:
                    masalah.append(label + "frontmatter tanpa field 'description'")
                elif len(u.isi_placeholder(m_desc.group(1), akar)) > BATAS_DESKRIPSI:
                    masalah.append(
                        label + "description %d karakter, batas %d"
                        % (len(u.isi_placeholder(m_desc.group(1), akar)), BATAS_DESKRIPSI)
                    )

        # 2. sisa konvensi Cowork
        for pola, alasan in LARANGAN:
            if pola in isi:
                masalah.append(label + "memuat '%s' (%s)" % (pola, alasan))

        # 3. header sumber dan SHA-nya
        m_sumber = RE_SUMBER.search(isi)
        if not m_sumber:
            masalah.append(
                label + "tanpa header sumber 'Sumber: <path> @ <sha>' (atribusi Apache-2.0)"
            )
        elif pin and m_sumber.group(2) != pin:
            masalah.append(
                label + "SHA sumber %s beda dari pin di PIN.md (%s)"
                % (m_sumber.group(2)[:12], pin[:12])
            )

    # 4. berkasnya harus benar-benar masuk git
    tracked = berkas_tertrack(akar)
    if tracked is None:
        catatan.append("pemeriksaan git dilewati: %s bukan repo git" % akar)
    else:
        for nama in nama_skill:
            rel = "%s/%s/%s" % (DIR_SKILLS, nama, BERKAS_SKILL)
            if rel not in tracked:
                masalah.append(
                    rel + " ada di disk tapi tidak ter-track git (pola .gitignore menelannya?)"
                )

    return masalah, len(nama_skill), catatan

# ---------- uji mandiri ----------

SHA_UJI = "ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1"

def teks_skill(nama=None, sha=SHA_UJI, rusak=None):
    nama = nama or u.nama_skill("uji")
    kepala = (
        "---\n"
        "name: %s\n"
        "description: Skill uji untuk gate lint plugin.\n"
        "---\n\n"
        "<!-- Sumber: engineering/skills/debug @ %s | anthropics/knowledge-work-plugins | "
        "Apache-2.0 | ditulis ulang untuk proyek ini -->\n\n"
        "# Judul\n\nIsi contoh.\n"
    ) % (nama, sha)
    if rusak == "tanpa_frontmatter":
        return kepala.split("---\n", 2)[2]
    if rusak == "nama_beda":
        return kepala.replace("name: %s" % nama, "name: %s-lain" % u.slug())
    if rusak == "connectors":
        return kepala + "\nLihat [CONNECTORS.md](../../CONNECTORS.md).\n"
    if rusak == "arguments":
        return kepala + "\nJalankan dengan $ARGUMENTS.\n"
    if rusak == "tanpa_sumber":
        return kepala.replace(
            "<!-- Sumber: engineering/skills/debug @ %s | anthropics/knowledge-work-plugins | "
            "Apache-2.0 | ditulis ulang untuk proyek ini -->\n" % sha,
            "",
        )
    if rusak == "sha_beda":
        return kepala.replace(SHA_UJI, "b" * 40)
    return kepala

def teks_pin(sha=SHA_UJI):
    return "# PIN upstream\n\n| Item | Nilai |\n|---|---|\n| SHA dipin | `%s` |\n" % sha

def tulis(path, isi):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(isi)

def uji_mandiri():
    gagal = 0
    kasus = []

    def pohon(tmp, rusak=None, dengan_git=False, abaikan=None, kosong=False, nama_dir="uji"):
        # Identitas ikut ditulis: lint membandingkan `name:` setelah placeholder diganti, dan
        # penggantinya membaca factory/identitas.json. Tanpa ini seluruh kasus positifnya
        # gagal karena berkas identitasnya tidak ada, bukan karena skill-nya salah.
        u.tulis_identitas(tmp)
        tulis(os.path.join(tmp, BERKAS_PIN), teks_pin())
        if not kosong:
            tulis(os.path.join(tmp, DIR_SKILLS, nama_dir, BERKAS_SKILL),
                  teks_skill(nama=u.nama_skill(nama_dir), rusak=rusak))
        if abaikan:
            tulis(os.path.join(tmp, ".gitignore"), abaikan + "\n")
        if dengan_git:
            subprocess.run(["git", "init", "-q"], cwd=tmp, stdout=subprocess.DEVNULL)
            subprocess.run(["git", "-C", tmp, "add", "-A"], stdout=subprocess.DEVNULL)
        return tmp

    def jalankan(nama, siapkan, harus_lulus):
        with tempfile.TemporaryDirectory() as tmp:
            siapkan(tmp)
            masalah, jumlah, catatan = periksa(tmp)
            lulus = not masalah
            benar = lulus == harus_lulus
            print("  %s %-46s %s" % ("LULUS " if benar else "GAGAL ", nama,
                                     "harus lulus" if harus_lulus else "harus ditolak"))
            if masalah:
                print("         alasan: %s" % masalah[0])
            for c in catatan:
                print("         catatan: %s" % c)
            return 0 if benar else 1

    kasus = [
        ("skill benar, tanpa git", lambda t: pohon(t), True),
        ("frontmatter hilang", lambda t: pohon(t, rusak="tanpa_frontmatter"), False),
        ("nama tidak cocok direktori", lambda t: pohon(t, rusak="nama_beda"), False),
        ("sisa rujukan CONNECTORS.md", lambda t: pohon(t, rusak="connectors"), False),
        ("sisa placeholder $ARGUMENTS", lambda t: pohon(t, rusak="arguments"), False),
        ("header sumber hilang", lambda t: pohon(t, rusak="tanpa_sumber"), False),
        ("SHA sumber beda dari PIN", lambda t: pohon(t, rusak="sha_beda"), False),
        ("tidak ada SKILL.md sama sekali", lambda t: pohon(t, kosong=True), False),
        ("skill benar, ter-track git", lambda t: pohon(t, dengan_git=True), True),
        # Direktori bernama `debug` ditelan pola .gitignore `[Dd]ebug/` dari template Visual
        # Studio: berkasnya ada di disk, git tidak pernah melihatnya. Ini bug nyata di pohon ini.
        ("ada di disk tapi ditelan .gitignore",
         lambda t: pohon(t, dengan_git=True, abaikan="[Dd]ebug/", nama_dir="debug"), False),
    ]

    for nama, siapkan, harus_lulus in kasus:
        gagal += jalankan(nama, siapkan, harus_lulus)

    negatif = sum(1 for _, _, h in kasus if not h)
    print("")
    print("UJI MANDIRI: %d kasus, %d negatif, %d gagal" % (len(kasus), negatif, gagal))
    if negatif < 2:
        print("GAGAL  gate tanpa sekurangnya dua kontrol negatif belum membuktikan bisa menolak")
        gagal += 1
    return gagal

def main():
    if "--uji-mandiri" in sys.argv:
        return 1 if uji_mandiri() else 0

    akar = AKAR_BAWAAN
    if "--akar" in sys.argv:
        i = sys.argv.index("--akar")
        if i + 1 >= len(sys.argv):
            print("--akar butuh path")
            return 2
        akar = os.path.abspath(os.path.expanduser(sys.argv[i + 1]))

    masalah, jumlah, catatan = periksa(akar)
    for c in catatan:
        print("CATAT  %s" % c)
    if masalah:
        print("GAGAL  lint skill plugin: %d masalah di %d berkas" % (len(masalah), jumlah))
        for m in masalah:
            print("       - %s" % m)
        return 1
    print("LULUS  %d skill lolos lint plugin (frontmatter, konvensi, sumber, git)" % jumlah)
    return 0

if __name__ == "__main__":
    sys.exit(main())
