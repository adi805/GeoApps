#!/usr/bin/env python3
"""sync_plugins.py - turunkan skill hasil adopsi plugin ke ~/.opencrabs/skills/.

Kenapa ada: skill di `factory/skills/` ikut di-version di repo, tapi yang dibaca agent saat
bekerja adalah salinan di `~/.opencrabs/skills/`. Dua salinan dari satu isi pasti melenceng,
dan salinan yang melenceng lebih berbahaya daripada tidak ada salinan: agent membaca versi lama
dan percaya itu yang berlaku. Berkas ini membuat salinan kedua bisa diperiksa mesin.

Arah sinkronisasi satu arah dan tidak bisa dibalik: `factory/skills/` adalah sumbernya,
`~/.opencrabs/skills/geoapps-<nama>/` adalah hasilnya. Mengedit salinannya langsung akan hilang
pada sinkronisasi berikutnya, dan `--check` melaporkannya sebagai berbeda sebelum itu terjadi.

Nama direktori tujuan = `name:` di frontmatter berkasnya, jadi keduanya tidak bisa melenceng
tanpa ketahuan; `gate_plugin_lint.py` yang menegakkan aturan itu.

Satu direktori sengaja TIDAK dikelola berkas ini: `geoapps-factory`. Itu hasil
`tools/factory/sync_skill.py` dari `factory/LAW.md`, dan dua penulis untuk satu direktori adalah
cara salinan itu melenceng.

Cara pakai:
  python3 tools/factory/sync_plugins.py              tulis ke ~/.opencrabs/skills
  python3 tools/factory/sync_plugins.py --check      periksa saja, keluar 1 kalau melenceng
  python3 tools/factory/sync_plugins.py --tujuan D   tulis ke akar lain (dipakai uji mandiri)
  python3 tools/factory/sync_plugins.py --uji-mandiri
"""

import os
import shutil
import sys
import tempfile

DIR_INI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_INI)
import _umum as u  # noqa: E402

AKAR = os.path.dirname(os.path.dirname(DIR_INI))
DIR_SUMBER = os.path.join(AKAR, "factory", "skills")

TUJUAN_BAWAAN = u.dir_terluas("skills_dir", "~/.opencrabs/skills")

# Awalan nama skill terpasang, dibaca dari identitas supaya proyek kedua tidak menulis
# skill-nya di bawah nama proyek pertama.
AWALAN = u.slug() + "-"

# Dikelola sync_skill.py dari factory/LAW.md. Bukan urusan berkas ini.
DIKECUALIKAN = {u.nama_skill("factory")}

BERKAS_SKILL = "SKILL.md"

# Placeholder `{{...}}` di sumber skill diganti saat menulis, dari factory/identitas.json.
# Resolvernya hidup di _umum.py supaya gate_plugin_lint menilai bentuk HASIL gantinya,
# bukan placeholder mentahnya.
isi_placeholder = u.isi_placeholder

def baca(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def daftar_sumber(akar=None):
    """Kembalikan {nama_tujuan: isi_berkas} untuk seluruh skill di factory/skills/."""
    keluar = {}
    if not os.path.isdir(DIR_SUMBER):
        return keluar
    for nama in sorted(os.listdir(DIR_SUMBER)):
        berkas = os.path.join(DIR_SUMBER, nama, BERKAS_SKILL)
        if os.path.isfile(berkas):
            # Direktori di repo memakai nama pendek upstream; nama skill dan direktori tujuannya
            # diberi awalan slug supaya tidak bentrok dengan skill yang sudah terpasang
            # (mis. `code-review`).
            keluar[u.nama_skill(nama, akar)] = isi_placeholder(baca(berkas), akar)
    return keluar

def periksa(tujuan_root, sumber):
    """Kembalikan daftar masalah. Kosong berarti salinan sudah sama dengan sumbernya."""
    masalah = []
    if not sumber:
        masalah.append(
            "tidak ada SKILL.md sama sekali di %s: sinkronisasi yang tidak punya apa pun untuk "
            "disalin harus berisik, bukan lulus diam-diam" % os.path.relpath(DIR_SUMBER, AKAR)
        )
        return masalah

    for nama, isi in sorted(sumber.items()):
        tujuan = os.path.join(tujuan_root, nama, BERKAS_SKILL)
        if not os.path.exists(tujuan):
            masalah.append("belum ada: %s" % tujuan)
            continue
        ada = baca(tujuan)
        if ada != isi:
            masalah.append("berbeda dari sumber: %s (%d vs %d byte)" % (tujuan, len(isi), len(ada)))

    # Direktori berawalan slug di tujuan yang tidak punya sumber = sisa skill yang sudah dihapus
    # dari repo. Dibiarkan, ia tetap terdaftar dan agent tetap memuatnya.
    if os.path.isdir(tujuan_root):
        for nama in sorted(os.listdir(tujuan_root)):
            if not nama.startswith(AWALAN) or nama in DIKECUALIKAN:
                continue
            if nama not in sumber:
                masalah.append("sisa tanpa sumber di repo: %s" % os.path.join(tujuan_root, nama))
    return masalah

def tulis(tujuan_root, sumber):
    """Tulis ulang seluruh salinan, dan buang sisa yang tidak punya sumber."""
    dihapus = []
    if os.path.isdir(tujuan_root):
        for nama in sorted(os.listdir(tujuan_root)):
            if nama.startswith(AWALAN) and nama not in DIKECUALIKAN and nama not in sumber:
                shutil.rmtree(os.path.join(tujuan_root, nama))
                dihapus.append(nama)
    for nama, isi in sorted(sumber.items()):
        tujuan = os.path.join(tujuan_root, nama, BERKAS_SKILL)
        os.makedirs(os.path.dirname(tujuan), exist_ok=True)
        with open(tujuan, "w", encoding="utf-8") as f:
            f.write(isi)
    return dihapus

def penjaga_tujuan(tujuan, akar=None, paksa=False):
    """(kode, pesan). Menolak menulis tujuan BAWAAN dari pohon yang bukan pohon kanonik.

    `--tujuan` eksplisit tidak diperiksa: pemanggilnya memilih sendiri berkas mana yang ditulis,
    dan uji mandiri memang menulis ke direktori sementara. Yang berbahaya tujuan bawaan, karena
    itu berkas hidup yang dibaca sesi proyek ini.
    """
    if paksa or os.path.abspath(tujuan) != os.path.abspath(TUJUAN_BAWAAN):
        return 0, "tujuan eksplisit"
    return u.penjaga_pohon(akar or AKAR)

def uji_mandiri():
    """Pemeriksa yang belum pernah menolak apa pun belum membuktikan apa pun."""
    gagal = 0
    kasus = []

    def jalankan(nama, siapkan, harus_lulus):
        sumber = {u.nama_skill("uji"): "# isi uji\n"}
        with tempfile.TemporaryDirectory() as tmp:
            tujuan = os.path.join(tmp, "skills")
            siapkan(tujuan, sumber)
            masalah = periksa(tujuan, sumber)
            lulus = not masalah
            benar = lulus == harus_lulus
            tanda = "LULUS " if benar else "GAGAL "
            harap = "harus lulus" if harus_lulus else "harus ditolak"
            print("  %s %-46s %s" % (tanda, nama, harap))
            if masalah:
                print("         alasan: %s" % masalah[0])
            return 0 if benar else 1

    def simpan(tujuan, sumber):
        for nama, isi in sumber.items():
            p = os.path.join(tujuan, nama, BERKAS_SKILL)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, "w", encoding="utf-8") as f:
                f.write(isi)

    def kosong(tujuan, sumber):
        pass

    def benar(tujuan, sumber):
        simpan(tujuan, sumber)

    def beda_satu_byte(tujuan, sumber):
        simpan(tujuan, sumber)
        p = os.path.join(tujuan, u.nama_skill("uji"), BERKAS_SKILL)
        with open(p, "a", encoding="utf-8") as f:
            f.write("baris tambahan\n")

    def sisa_tanpa_sumber(tujuan, sumber):
        simpan(tujuan, sumber)
        p = os.path.join(tujuan, u.nama_skill("sudah-dihapus"), BERKAS_SKILL)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write("# skill lama\n")

    def factory_bukan_urusan_ini(tujuan, sumber):
        simpan(tujuan, sumber)
        p = os.path.join(tujuan, u.nama_skill("factory"), BERKAS_SKILL)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write("# dikelola sync_skill.py dari LAW.md\n")

    def sumber_kosong(tujuan, sumber):
        simpan(tujuan, {})

    kasus = [
        ("salinan belum ada", kosong, False),
        ("salinan sudah sama", benar, True),
        ("kelebihan satu byte", beda_satu_byte, False),
        ("sisa skill yang sudah dihapus dari repo", sisa_tanpa_sumber, False),
        ("skill factory bukan urusan berkas ini", factory_bukan_urusan_ini, True),
        ("tidak ada sumber sama sekali", sumber_kosong, False),
    ]

    # Placeholder asing diuji terpisah: ia melempar, bukan mengembalikan daftar masalah, dan
    # yang diuji adalah perilaku itu sendiri.
    try:
        isi_placeholder("pohon di {{pohonn}}")
        benar = False
    except ValueError as e:
        benar = "pohonn" in str(e)
    print("  %s %-46s %s" % ("LULUS " if benar else "GAGAL ",
                             "placeholder asing melempar", "ditolak" if benar else "lolos diam"))
    if not benar:
        gagal += 1

    for nama, siapkan, harus_lulus in kasus:
        gagal += jalankan(nama, siapkan, harus_lulus)

    for nama, siapkan, harus_lulus in kasus:
        gagal += jalankan(nama, siapkan, harus_lulus)

    # Penjaga tujuan diuji langsung: tujuan eksplisit lolos, tujuan bawaan ditolak selama pohon
    # ini bukan pohon kanonik proyek, dan `paksa` membukanya. Tanpa kasus ini, penjaga yang selalu
    # menolak dan penjaga yang selalu membolehkan sama-sama tidak terdeteksi.
    with tempfile.TemporaryDirectory() as tmp:
        kanonik = u.pohon_kanonik()
        kode_eksplisit, _ = penjaga_tujuan(os.path.join(tmp, "skills"), akar=tmp)
        kode_bawaan, _ = penjaga_tujuan(TUJUAN_BAWAAN, akar=tmp)
        kode_paksa, _ = penjaga_tujuan(TUJUAN_BAWAAN, akar=tmp, paksa=True)
        harap_bawaan = 0 if os.path.realpath(tmp) == kanonik else 1
        for nama, dapat, harap in (
            ("tujuan eksplisit selalu lolos", kode_eksplisit, 0),
            ("tujuan bawaan dari pohon asing ditolak", kode_bawaan, harap_bawaan),
            ("--paksa membuka penjaga tujuan", kode_paksa, 0),
        ):
            benar = dapat == harap
            print("  %s %-46s exit=%d" % ("LULUS " if benar else "GAGAL ", nama, dapat))
            if not benar:
                gagal += 1

    print("")
    print("UJI MANDIRI: %d kasus, %d gagal" % (len(kasus) + 3, gagal))
    return gagal

def main():
    if "--uji-mandiri" in sys.argv:
        return 1 if uji_mandiri() else 0

    tujuan_root = TUJUAN_BAWAAN
    if "--tujuan" in sys.argv:
        i = sys.argv.index("--tujuan")
        if i + 1 >= len(sys.argv):
            print("--tujuan butuh path")
            return 2
        tujuan_root = os.path.abspath(os.path.expanduser(sys.argv[i + 1]))

    # Penjaga pohon: tujuan bawaan dinamespace slug, jadi repo mesin yang slug-nya sama dengan
    # repo produk akan menulis ke jalur yang sama dan menimpa skill milik proyek itu.
    paksa = "--paksa" in sys.argv
    kode, pesan = penjaga_tujuan(tujuan_root, paksa=paksa)
    if kode != 0:
        if "--check" in sys.argv:
            print("LEWAT  %s" % pesan)
            return 0
        print("GAGAL  %s" % pesan)
        print("       Kalau memang disengaja, pakai --paksa.")
        return 1

    sumber = daftar_sumber()

    if "--check" in sys.argv:
        masalah = periksa(tujuan_root, sumber)
        if not masalah:
            print("LULUS  %d skill sama dengan %s" % (len(sumber), os.path.relpath(DIR_SUMBER, AKAR)))
            return 0
        print("GAGAL  salinan skill melenceng dari sumber:")
        for m in masalah:
            print("       - %s" % m)
        print("       jalankan: python3 tools/factory/sync_plugins.py")
        return 1

    if not sumber:
        print("GAGAL  tidak ada SKILL.md di %s" % DIR_SUMBER)
        return 2

    dihapus = tulis(tujuan_root, sumber)
    for nama in dihapus:
        print("HAPUS  %s (tidak ada sumbernya di repo)" % os.path.join(tujuan_root, nama))
    print("TULIS  %d skill ke %s" % (len(sumber), tujuan_root))
    return 0

if __name__ == "__main__":
    sys.exit(main())
