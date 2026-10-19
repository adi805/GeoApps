#!/usr/bin/env python3
"""_umum.py - potongan yang dipakai lebih dari satu gate factory.

Bukan gate, dan tidak punya pintu masuk sendiri. Dipisah supaya pencocokan pola path dan
pemeriksaan keberadaan commit tidak ditulis lima kali dengan lima perilaku berbeda.

Catatan pencocokan pola: **peka huruf besar-kecil**, dan itu disengaja. Repo ini menamai berkas
dengan CamelCase (`PayrollEngine.cs`, `Backend.Gudang.cs`) sementara berkas lain memakai huruf
kecil (`schema_payroll_ext.sql`, `master-gudang.js`). Pencocokan yang mengabaikan besar-kecil
membuat pola `*Kas*` ikut menangkap `Berkas.cs`, jadi gate-nya jadi terlalu longgar: berkas di
luar cakupan lane lolos tanpa ditolak. Pola harus menulis kapitalnya persis.

  **   cocok lintas direktori (termasuk nol direktori)
  *    cocok dalam satu segmen path
  ?    satu karakter dalam satu segmen path
"""

import json
import os
import re
import subprocess


def baca(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def baca_json(path):
    return json.loads(baca(path))

# --- Identitas proyek (#cleanup) ------------------------------------------------------------
#
# Seluruh identitas proyek hidup di `factory/identitas.json`, dan skrip di direktori ini
# membacanya lewat fungsi di bawah. Sebelumnya nilai-nilai itu ditulis literal di 11 skrip
# (grup Telegram, jalur pohon kanonik, direktori log dan state, awalan nama skill), sehingga
# memakai mesin ini di proyek kedua berarti menyunting 11 berkas dan mudah melenceng.
#
# Env `FACTORY_IDENTITAS` menang atas jalur bawaan. Itu yang dipakai uji mandiri: ia menunjuk
# berkas sementara, jadi ujinya bisa membuktikan perilaku identitas tanpa menyentuh identitas
# proyek yang sedang jalan.

BERKAS_IDENTITAS = "factory/identitas.json"
ENV_IDENTITAS = "FACTORY_IDENTITAS"

def jalur_identitas(akar=None):
    if os.environ.get(ENV_IDENTITAS):
        return os.environ[ENV_IDENTITAS]
    return os.path.join(akar or akar_factory(), BERKAS_IDENTITAS)

def identitas(akar=None):
    return baca_json(jalur_identitas(akar))

def idn(kunci, bawaan=None, akar=None):
    """Satu medan identitas, boleh bersarang: `idn("repo.github")`. Bawaan dipakai kalau absen."""
    d = identitas(akar)
    for bagian in kunci.split("."):
        if not isinstance(d, dict) or bagian not in d:
            return bawaan
        d = d[bagian]
    return d

def slug(akar=None):
    return idn("slug", "factory", akar)

def nama_skill(nama, akar=None):
    """Nama skill terpasang. Repo menamai direktori dengan nama pendek upstream, tujuan
    pemasangan memakai awalan slug supaya tidak bentrok dengan skill yang sudah terpasang."""
    return "%s-%s" % (slug(akar), nama)

def grup(akar=None):
    return idn("grup", None, akar)

def kanal_owner(akar=None):
    """Kunci kanal owner, bentuk `[chat:<grup>:topic:<N>]`.

    Diambil APA ADANYA dari identitas kalau medannya ada, bukan diturunkan: gate_kanal memeriksa
    bentuknya, dan nilai yang selalu diturunkan tidak pernah bisa salah bentuk sehingga gate-nya
    kehilangan kontrol negatifnya. Turunan grup+topic hanya dipakai kalau medan itu kosong, supaya
    proyek baru cukup mengisi `grup` dan `owner.topik`.
    """
    eksplisit = idn("owner.kanal", None, akar)
    if eksplisit:
        return eksplisit
    g, t = grup(akar), idn("owner.topik", None, akar)
    if g is None or t is None:
        return None
    return "[chat:%d:topic:%d]" % (int(g), int(t))

def tulis_identitas(akar, **ubah):
    """Tulis `factory/identitas.json` di dalam `akar`, untuk uji mandiri.

    Nilainya diambil dari identitas proyek lalu ditimpa `ubah`, jadi ujinya tidak perlu menyalin
    seluruh medan dan tidak ikut basi saat medan baru ditambahkan.
    """
    d = dict(identitas())
    d.update(ubah)
    os.makedirs(os.path.join(akar, "factory"), exist_ok=True)
    path = os.path.join(akar, "factory", "identitas.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
    return path

# --- Placeholder identitas di berkas sumber ------------------------------------------------
#
# Berkas di `factory/skills/` dan `factory/LAW.md` memakai `{{slug}}`, `{{proyek}}`, `{{repo}}`,
# dan `{{pohon}}`, bukan nilai jadi. Alasannya sama dengan alasan identitas dipusatkan: berkas
# sumber yang memuat nama proyek pertama akan membawa nama itu ke proyek kedua, dan itu terjadi
# tanpa satu pun error. Nilainya diisi saat berkas itu dipasang atau dibangkitkan.

RE_PLACEHOLDER = re.compile(r"\{\{([a-z_]+)\}\}")

def nilai_placeholder(akar=None):
    skills = dir_terluas("skills_dir", "~/.opencrabs/skills", akar)
    return {
        "slug": slug(akar),
        "proyek": idn("proyek", "", akar),
        "repo": idn("repo.github", "", akar),
        "pohon": idn("pohon", "", akar),
        "skills_dir": skills,
        "skill_factory": os.path.join(skills, nama_skill("factory", akar)),
    }

def isi_placeholder(teks, akar=None):
    """Ganti seluruh `{{...}}`. Placeholder asing MELEMPAR, bukan dibiarkan.

    Placeholder yang tidak dikenal hampir selalu salah ketik. Kalau dibiarkan, berkas hasilnya
    memuat `{{pohonn}}` di tengah instruksi dan agent membacanya sebagai teks biasa: rusak, tapi
    senyap. Yang melempar di sini memaksa salah ketiknya muncul di uji mandiri.
    """
    nilai = nilai_placeholder(akar)
    asing = sorted({m.group(1) for m in RE_PLACEHOLDER.finditer(teks)} - set(nilai))
    if asing:
        raise ValueError("placeholder tidak dikenal: %s" % ", ".join(asing))
    return RE_PLACEHOLDER.sub(lambda m: nilai[m.group(1)], teks)

def pohon_kanonik():
    """Jalur pohon kanonik PROYEK INI, dibaca dari identitas repo tempat skrip ini hidup.

    Sengaja tidak menerima `akar`: identitas proyek selalu dibaca dari repo yang menjalankan
    skrip, bukan dari pohon yang sedang diperiksa. Kalau parameternya ada, pemeriksa bisa
    diarahkan ke pohon yang identitasnya dibuat-buat, dan penjaganya jadi tidak bermakna.
    """
    p = idn("pohon", None)
    return os.path.realpath(os.path.expanduser(p)) if p else None

def penjaga_pohon(akar=None):
    """(kode, pesan). Menolak kalau pohon yang jalan BUKAN pohon kanonik proyek ini.

    Kenapa ada: jalur berkas di luar repo dinamespace dengan slug (`~/.opencrabs/skills/<slug>-*`,
    `~/.opencrabs/state/<slug>-*.json`, `~/.opencrabs/logs/<slug>-*.log`). Dua pohon dengan slug
    yang sama, misalnya repo mesin dan repo produk yang sama-sama bernama `pms-tsj`, menulis ke
    jalur yang SAMA. Sesi yang menjalankan alat dari pohon yang salah lalu menimpa skill hidup
    milik proyek yang benar, dan yang kelihatan cuma "skill-nya berubah sendiri".

    Penjaga branch (#160) tidak menangkap ini: repo mesin juga ada di branch `main`.
    """
    kanonik = pohon_kanonik()
    if kanonik is None:
        return 0, "identitas tidak menyebut `pohon`, penjaga pohon dilewati"
    akar = os.path.realpath(os.path.expanduser(akar or akar_factory()))
    if akar == kanonik:
        return 0, "pohon kanonik proyek ini"
    return 1, ("pohon ini %s, bukan pohon kanonik proyek ini (%s). Jalur di luar repo dinamespace "
               "slug, jadi menulis dari sini menimpa berkas milik proyek yang benar."
               % (akar, kanonik))

def dir_terluas(kunci, bawaan, akar=None):
    return os.path.expanduser(idn(kunci, bawaan, akar))

def jalur_log(nama, akar=None):
    return os.path.join(dir_terluas("log_dir", "~/.opencrabs/logs", akar),
                        "%s-%s.log" % (slug(akar), nama))

def jalur_state(nama, akar=None):
    return os.path.join(dir_terluas("state_dir", "~/.opencrabs/state", akar),
                        "%s-%s.json" % (slug(akar), nama))


def baca_json_teks(teks):
    """Parse satu baris JSON. Dipakai ledger, yang satu entri per baris."""
    return json.loads(teks)


def pola_ke_regex(pola):
    """Ubah pola glob jadi regex. `**/` boleh cocok dengan nol direktori."""
    keluar = []
    i = 0
    while i < len(pola):
        c = pola[i]
        if c == "*":
            if pola[i:i + 2] == "**":
                if pola[i:i + 3] == "**/":
                    keluar.append("(?:.*/)?")
                    i += 3
                else:
                    keluar.append(".*")
                    i += 2
                continue
            keluar.append("[^/]*")
        elif c == "?":
            keluar.append("[^/]")
        else:
            keluar.append(re.escape(c))
        i += 1
    return "^" + "".join(keluar) + "$"


def cocok(pola, path):
    return re.match(pola_ke_regex(pola), path) is not None


def cocok_salah_satu(daftar_pola, path):
    for pola in daftar_pola:
        if cocok(pola, path):
            return True, pola
    return False, None


def git(akar, *args):
    """Jalankan git, kembalikan (exit_code, stdout+stderr). Tidak pernah melempar."""
    hasil = subprocess.run(
        ["git", "-C", akar] + list(args),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    return hasil.returncode, hasil.stdout.strip()


def ada_commit(akar, sha):
    """True kalau sha adalah objek commit di repo akar."""
    if not sha or len(sha) < 7:
        return False
    kode, keluar = git(akar, "cat-file", "-t", sha)
    return kode == 0 and keluar.strip() == "commit"


def sha_penuh(akar, sha):
    """Resolusi sha pendek, penuh, atau ref jadi 40 karakter. None kalau bukan commit."""
    if not sha:
        return None
    kode, keluar = git(akar, "rev-parse", "--verify", "--quiet", "%s^{commit}" % sha)
    if kode != 0:
        return None
    return keluar.strip()


def sha_pendek(akar, sha, n=7):
    """Bentuk pendek sha supaya gaya jangkar ledger seragam. None kalau tidak ada."""
    kode, keluar = git(akar, "rev-parse", "--short=%d" % n, str(sha))
    if kode != 0:
        return None
    return keluar.strip()


def baca_paths(akar, berkas, base, head):
    """Kembalikan daftar path yang berubah. Utamakan berkas eksplisit, lalu git diff."""
    if berkas:
        return [b.strip() for b in baca(berkas).splitlines() if b.strip()], None
    if base and head:
        # Base bisa saja sudah maju sejak branch ini dibuat. `git diff base head` itu dua-pohon,
        # jadi ia ikut menghitung kerja lane lain yang sudah masuk base sebagai kerja branch ini:
        # diuji 2026-10-09, 8 path milik lane lain dilaporkan sebagai pelanggaran cakupan HQ.
        # Yang benar adalah perubahan sejak titik pisah branch, jadi base-nya `git merge-base`.
        # Di CI (head = commit merge GitHub) titik pisahnya tetap tip base, jadi hasilnya sama
        # seperti sebelumnya; yang berubah hanya run lokal di atas branch yang belum di-merge.
        kode, mb = git(akar, "merge-base", base, head)
        if kode != 0:
            return [], "git merge-base %s %s gagal: %s" % (base, head, mb)
        titik = mb.strip()
        kode, keluar = git(akar, "diff", "--name-only", "%s..%s" % (titik, head))
        if kode != 0:
            return [], "git diff gagal: %s" % keluar
        return [b for b in keluar.splitlines() if b.strip()], None
    return [], "tidak ada sumber path: pakai --paths atau --base/--head"


def tolak(judul, alasan):
    print("GAGAL  %s" % judul)
    for s in alasan:
        print("       - %s" % s)
    return 1


def lulus(pesan):
    print("LULUS  %s" % pesan)
    return 0


def cari_lane(lanes, lane_id):
    for l in lanes["lane"]:
        if l["id"] == lane_id:
            return l
    return None


def akar_factory():
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# --- Penjaga branch pohon (#160) ------------------------------------------------------------
#
# Skrip factory dijalankan crontab dari pohon kanonik, dan crontab tidak tahu pohon itu sedang
# checkout apa. Terukur 2026-10-10: `~/pms-tsj` terparkir di branch kerjaan yang sudah selesai,
# 7 commit di BELAKANG `main`, jadi pacemaker yang bangun tiap 20 menit menjalankan kode basi dan
# perbaikan yang baru di-merge tidak pernah dieksekusi. Nol gate menolak, karena tiap gate hanya
# membaca pohon tempat ia dijalankan.
#
# Dua kelasnya dipisah, dan pemisahan itu yang penting: memeriksa "HEAD bukan ancestor origin/main"
# saja SALAH untuk kelas kedua, sebab pohon yang terparkir di belakang main punya HEAD yang ADALAH
# ancestor origin/main. Yang benar: branch harus `main`, DAN `main` harus tidak ketinggalan.
#
# Batas yang disengaja: yang dibandingkan adalah `origin/main` yang ADA DI DISK, yaitu hasil fetch
# terakhir. Penjaga ini tidak menjalankan `git fetch` (cron tiap 20 menit tidak perlu jaringan), jadi
# pohon yang lama tidak di-fetch bisa lolos kelas kedua. Kelas pertama (branch salah) tidak
# terpengaruh oleh itu, dan kelas pertama itulah yang benar-benar kejadian.

BRANCH_SAH = "main"
ENV_PAKSA_BRANCH_BAWAAN = "FACTORY_PAKSA_BRANCH"

def env_paksa_branch(akar=None):
    """Nama env yang melewati penjaga branch. Dibaca dari identitas supaya proyek kedua
    tidak mewarisi awalan proyek pertama."""
    return idn("env_paksa_branch", ENV_PAKSA_BRANCH_BAWAAN, akar)


def branch_sekarang(akar):
    """Nama branch HEAD pohon `akar`. None kalau tidak bisa dibaca (bukan repo git)."""
    kode, keluar = git(akar, "rev-parse", "--abbrev-ref", "HEAD")
    if kode != 0:
        return None
    return keluar.strip() or None


def ketinggalan_main(akar):
    """Jumlah commit HEAD di belakang `origin/main`. None kalau tidak bisa diukur."""
    kode, keluar = git(akar, "rev-list", "--count", "HEAD..origin/main")
    if kode != 0:
        return None
    try:
        return int(keluar.strip())
    except ValueError:
        return None


def penjaga_branch(akar=None, paksa=None):
    """(kode, pesan): 0 boleh jalan, 1 tolak. Alasannya DIKEMBALIKAN, bukan didiamkan.

    `paksa` bawaannya dibaca dari env `PMS_TSJ_PAKSA_BRANCH`, supaya uji mandiri bisa lewat tanpa
    menambah flag baru: `--paksa` di skrip-skrip ini sudah berarti hal lain (abaikan state dedup),
    dan arti kedua tidak ditumpangkan ke sana.
    """
    if paksa is None:
        paksa = bool(os.environ.get(env_paksa_branch()))
    if paksa:
        return 0, "dilewati: %s diset" % env_paksa_branch()
    akar = akar or akar_factory()
    branch = branch_sekarang(akar)
    if branch is None:
        return 0, "bukan repo git, penjaga branch dilewati"
    if branch != BRANCH_SAH:
        return 1, ("pohon ini di branch `%s`, bukan `%s`. Skrip factory dijalankan cron dari pohon "
                   "kanonik, jadi branch lain berarti kode yang jalan bisa basi atau milik kerjaan "
                   "yang belum di-merge (#160)." % (branch, BRANCH_SAH))
    n = ketinggalan_main(akar)
    if n is None:
        return 1, ("branch `%s` tapi `origin/main` tidak terbaca, jadi kemutakhiran pohon ini tidak "
                   "bisa dibuktikan. Jalankan `git fetch` dulu (#160)." % BRANCH_SAH)
    if n > 0:
        return 1, ("branch `%s` tapi ketinggalan %d commit dari `origin/main`, jadi kode yang jalan "
                   "bukan yang terbaru (#160)." % (BRANCH_SAH, n))
    return 0, "branch `%s`, mutakhir terhadap `origin/main`" % BRANCH_SAH


def uji_penjaga_branch():
    """Buktikan penjaganya bisa MENOLAK, bukan cuma pernah bilang boleh.

    Hidup di sini, bukan disalin ke empat skrip, supaya perilakunya cuma punya satu salinan.
    Mengembalikan (jumlah_kasus, jumlah_gagal) dan mencetak tiap kasusnya.
    """
    import tempfile

    def siapkan(tmp, branch=BRANCH_SAH, ketinggalan=0, ada_origin=True):
        git(tmp, "init", "-q", "-b", BRANCH_SAH)
        git(tmp, "config", "user.email", "uji@contoh.id")
        git(tmp, "config", "user.name", "Uji")
        with open(os.path.join(tmp, "a.txt"), "w", encoding="utf-8") as f:
            f.write("awal\n")
        git(tmp, "add", "-A")
        git(tmp, "commit", "-q", "-m", "awal")
        if ada_origin:
            git(tmp, "update-ref", "refs/remotes/origin/main", "HEAD")
        for i in range(ketinggalan):
            git(tmp, "commit", "-q", "--allow-empty", "-m", "maju %d" % i)
            git(tmp, "update-ref", "refs/remotes/origin/main", "HEAD")
        # `main` ditarik MUNDUR supaya `origin/main` ada di depannya. Bentuk itulah yang terparkir
        # di belakang, dan bentuk itulah yang lolos kalau yang diperiksa cuma "ancestor origin/main".
        if ketinggalan:
            git(tmp, "reset", "-q", "--hard", "HEAD~%d" % ketinggalan)
        if branch != BRANCH_SAH:
            git(tmp, "checkout", "-q", "-b", branch)
        return tmp

    hasil = []

    def cek(nama, harap_kode, harap_teks=None, **siapkan_kw):
        with tempfile.TemporaryDirectory() as tmp:
            kode, pesan = penjaga_branch(siapkan(tmp, **siapkan_kw))
        benar = kode == harap_kode and (harap_teks is None or harap_teks in pesan)
        hasil.append(benar)
        print("  %s %-46s exit=%d" % ("LULUS " if benar else "GAGAL ", nama, kode))

    cek("penjaga: branch bukan main ditolak", 1, "bukan `main`", branch="kerja")
    cek("penjaga: main ketinggalan 1 commit ditolak", 1, "ketinggalan 1 commit", ketinggalan=1)
    cek("penjaga: main ketinggalan 3 commit ditolak", 1, "ketinggalan 3 commit", ketinggalan=3)
    cek("penjaga: main mutakhir lolos", 0)
    cek("penjaga: origin/main tidak terbaca ditolak", 1, "tidak bisa dibuktikan", ada_origin=False)

    # Jalur env diuji, bukan cuma parameternya: env inilah yang dipakai uji mandiri dan operasi.
    env = env_paksa_branch()
    lama = os.environ.get(env)
    os.environ[env] = "1"
    try:
        cek("penjaga: paksa lewat env melewati penolakan", 0, "dilewati", branch="kerja")
    finally:
        if lama is None:
            os.environ.pop(env, None)
        else:
            os.environ[env] = lama

    return len(hasil), hasil.count(False)


def jalankan_penjaga_branch():
    """Cetak hasil penjaganya ke log dan kembalikan exit code: 0 lanjut, 1 tolak.

    Dipakai `main()` keempat skrip cron, jadi alasan penolakannya masuk log yang sama dengan
    keluarannya: penolakan yang senyap sama buruknya dengan tidak ada penjaga.
    """
    kode, pesan = penjaga_branch()
    print("%s  %s" % ("GAGAL" if kode else "PENJAGA", pesan))
    return kode
