#!/usr/bin/env python3
"""sinkron_pohon.py - sinkronkan pohon kanonik ke `origin/main` dengan aman.

Kenapa ada: penjaga branch (#160) membuat keempat skrip factory yang dijalankan cron menolak jalan
kalau `main` ketinggalan `origin/main`, tapi crontab tidak punya langkah sinkronisasi. Akibatnya tiap
kali ada PR merge ke `main`, pacemaker/skor/lapor/pintu berhenti (exit 1, alasannya tercetak di log)
sampai ada yang menyinkronkan pohon kanonik dengan tangan. Hari ini `main` menerima 4 merge dalam 20
menit, jadi ketergantungan itu nyata (#169, u-HQ-8491e4 opsi 2).

`git fetch && git merge --ff-only` saja **tidak cukup**. Git menolak merge kalau ada berkas terlacak
yang kotor dan merge itu akan memperbaruinya, walaupun isi lokalnya identik dengan versi yang datang:

    error: Your local changes to the following files would be overwritten by merge:
            f.jsonl
    Please commit your changes or stash them before you merge.
    Aborting

Terukur di repo scratch (dua repro, satu di antaranya bentuk lokal = superset dari yang datang).
Berkas jejak seperti `factory/usulan.jsonl` memang sering kotor: `lapor.py` menandai opsi yang sudah
dikirim, dan keputusan ditulis ke sana sebelum di-commit. Jadi keputusannya diambil di sini, dan
dibuat eksplisit:

  - berkas kotor yang isinya SAMA dengan versi `origin/main` -> dibuang (tidak ada yang hilang), lalu
    merge. Membuangnya aman justru karena isinya sama: tidak ada satu byte pun yang hanya ada di lokal.
  - berkas kotor yang isinya BEDA -> BERHENTI dan lapor. Membuangnya berarti menghapus kerja yang
    belum di-commit, dan itu bukan keputusan alat sinkronisasi. PENGECUALIAN: berkas jejak append-only
    (`berkas_jejak()`, yaitu `factory/usulan*.jsonl`) diperlakukan lain: baris lokal yang belum ada di
    `origin/main` disimpan, berkasnya disetel ulang, merge dijalankan, lalu baris itu ditulis ulang di
    atas versi origin. Alasannya berkas itu memang ditulis alat lain di pohon yang sama, dan
    menghentikan sinkronisasi karenanya justru mematikan cron (#169).
  - berkas tak terlacak yang ADA di `origin/main` -> BERHENTI, karena merge akan menabraknya. Yang
    tidak ada di `origin/main` dilewati: merge tidak menyentuhnya.
  - `merge --ff-only` gagal (pohon divergen, bukan sekadar ketinggalan) -> BERHENTI, jangan merge
    biasa: itu menyatukan dua riwayat, dan itu bukan kerja sinkronisasi.

Dua hal yang sengaja TIDAK dilakukan: tidak ada `reset --hard`/`checkout -f`/`clean -fd` (semuanya
bisa menghapus kerja yang belum di-commit), dan tidak ada push otomatis. Sinkronisasi cuma menarik,
tidak pernah mendorong.

Kode keluarnya dibedakan supaya log cron bisa dibaca tanpa menebak: 0 sukses, 2 fetch/status gagal,
3 berkas tak terlacak menabrak, 4 berkas kotor berbeda, 5 merge gagal.

Cara pakai:
  python3 tools/factory/sinkron_pohon.py [--akar DIR] [--kering]
  python3 tools/factory/sinkron_pohon.py --cron            # dipakai crontab: cap waktu, selalu 0
  python3 tools/factory/sinkron_pohon.py --uji-mandiri

Dijalankan crontab TANPA pembungkus shell (#169). Tiga hal yang dulu jadi alasan mempertahankan
pembungkus di luar repo dikerjakan di sini, dan satu lagi ditambahkan:

  - **HOME dipin.** `git fetch` butuh kredensial dari `$HOME`; tanpa itu gagal "could not read
    Username". Nilainya dari `pwd.getpwuid`, bukan path yang di-hardcode.
  - **Batas waktu.** `fetch` dan `merge` dibatasi `BATAS_GIT` detik. Tanpa batas, satu fetch yang
    menggantung menahan baris crontab itu selamanya.
  - **Cap waktu.** `--cap-waktu` (dan `--cron`) memberi cap waktu ISO di awal tiap baris, jadi log
    cron bisa dibedakan antara replay dan laporan baru.
  - **Kunci satu-instance.** Empat baris crontab memanggil alat ini, dan `*/15`, `*/20`, `*/30`
    bertemu di menit :00. Tanpa kunci, dua `git merge` berebut `index.lock` dan yang kalah menulis
    kegagalan yang menyesatkan di log. Yang kedua sekarang keluar 0 dengan "LEWAT".

Berkasnya ada DI DALAM repo, ter-version, dan teruji, jadi tidak ada salinan di luar repo yang bisa
melenceng dari sumbernya.
"""

import argparse
import datetime
import os
import subprocess
import sys
import tempfile

try:
    import fcntl
except ImportError:  # Windows: kunci satu-instance dilewati, bukan gagal
    fcntl = None

try:
    import pwd
except ImportError:  # Windows
    pwd = None

DIR_INI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_INI)
import _umum as u  # noqa: E402

KELUAR_OK = 0
KELUAR_FETCH = 2
KELUAR_UNTRACKED = 3
KELUAR_BEDA = 4
KELUAR_FF = 5

# Batas waktu `git fetch` dan `git merge` (#169). 120 dan bukan 60: alat ini juga menjalankan merge,
# dan timeout di tengah merge lebih buruk daripada menunggu lebih lama. Tanpa batas, satu fetch yang
# menggantung menahan baris crontab itu selamanya.
BATAS_GIT = 120

# Berkas jejak append-only: baris lokal yang belum ada di `origin/main` harus SELAMAT, bukan dibuang
# dan bukan bikin sinkronisasi berhenti. Ini akar yang wajib diselesaikan bersama sinkronisasi (#169):
# `usulan.py putuskan` dan `catat` menulis ke berkas yang dilacak git, jadi pohon kanonik bisa kotor
# di situ, dan `--ff-only` menolak merge yang memperbarui berkas kotor. Perbandingannya baris utuh
# (bukan diff), karena berkasnya append-only: yang perlu dijawab cuma "baris ini sudah ada di origin
# atau belum".
def berkas_jejak(path):
    """True kalau `path` berkas jejak usulan: `factory/usulan.jsonl` atau `factory/usulan-<lane>.jsonl`.

    Sejak #217 (keputusan agent u-HQ-f406ac opsi 2) tiap lane menulis berkasnya sendiri, jadi "berkas
    jejak" bukan lagi satu nama berkas. Berkas lama tetap ikut selama ada: salinan lane yang belum
    sinkron masih memakai `usulan.py` lama dan menulis ke sana.
    """
    d, n = os.path.split(path)
    return d == "factory" and (n == "usulan.jsonl"
                               or (n.startswith("usulan-") and n.endswith(".jsonl")))


def pin_home():
    """Setel `HOME` kalau kosong; kembalikan nilai yang dipakai (None kalau tidak bisa).

    `git fetch` butuh kredensial dari `$HOME`, dan tanpa itu gagal "could not read Username". Cron
    asli menyetelnya, tapi pemanggil dari lingkungan minimal (`env -i`, unit systemd tanpa
    `Environment=`) tidak. Nilainya dari `pwd.getpwuid`, bukan path yang di-hardcode, supaya tidak
    ada path host yang masuk ke repo.
    """
    if os.environ.get("HOME"):
        return os.environ["HOME"]
    if pwd is None:
        return None
    try:
        rumah = pwd.getpwuid(os.getuid()).pw_dir
    except (KeyError, OSError):
        return None
    if rumah:
        os.environ["HOME"] = rumah
    return rumah


def cap_waktu():
    """Cap waktu ISO dengan offset zona, sebentuk `date -Is`."""
    return datetime.datetime.now().astimezone().replace(microsecond=0).isoformat()


def jalur_kunci(akar):
    """Berkas kunci DI DALAM direktori git, jadi tidak pernah ikut terlacak.

    `rev-parse --absolute-git-dir` dipakai, bukan `<akar>/.git`: di worktree `.git` itu berkas
    penunjuk, bukan direktori, jadi membuka `<akar>/.git/<nama>` di sana gagal ENOTDIR dan kuncinya
    diam-diam tidak pernah terpasang.
    """
    kode, keluar = u.git(akar, "rev-parse", "--absolute-git-dir")
    dasar = keluar.strip() if kode == 0 and keluar.strip() else os.path.join(akar, ".git")
    # `u.slug()` TANPA `akar`: nama kuncinya milik proyek yang MENJALANKAN alat ini, bukan
    # milik pohon yang sedang disinkronkan. Pohon tiruan di uji mandiri tidak punya
    # identitas, dan membacanya dari sana akan melempar. Isolasi per-pohon sudah dijamin
    # jalurnya sendiri, karena `dasar` adalah git dir pohon itu.
    return os.path.join(dasar, "%s-sinkron.lock" % u.slug())


def ambil_kunci(akar):
    """(dapat, berkas). `dapat` False kalau kunci sedang dipegang proses lain.

    Empat baris crontab memanggil alat ini, dan `*/15`, `*/20`, `*/30` bertemu di menit :00. Tanpa
    kunci, dua `git merge` berebut `index.lock` dan yang kalah menulis kegagalan yang menyesatkan di
    log. Kalau berkas kuncinya sendiri tidak bisa dibuat, alat ini JALAN saja: mematikan cron karena
    masalah kunci lebih buruk daripada kehilangan kunci.
    """
    if fcntl is None:
        return True, None
    try:
        berkas = open(jalur_kunci(akar), "w", encoding="utf-8")
    except OSError:
        return True, None
    try:
        fcntl.flock(berkas.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        berkas.close()
        return False, None
    return True, berkas


def git_berbatas(akar, *args, **kw):
    """`u.git()` dengan batas waktu. Kembalikan (kode, keluaran); kode 124 kalau lewat batas.

    `_umum.git()` sengaja TIDAK diubah: ia dipakai banyak gate, dan menambahkan batas waktu di sana
    mengubah perilaku semua pemanggilnya. Yang butuh batas cuma dua perintah jaringan di sini.
    """
    batas = kw.pop("batas", BATAS_GIT)
    try:
        hasil = subprocess.run(
            ["git", "-C", akar] + list(args),
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=batas,
        )
    except subprocess.TimeoutExpired:
        return 124, "lewat batas waktu %d detik" % batas
    return hasil.returncode, hasil.stdout.strip()


def baris_berkas(akar, path):
    """Baris berkas lokal `path` sebagai daftar. None kalau tidak terbaca."""
    p = os.path.join(akar, path)
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as f:
        return [b for b in f.read().splitlines() if b.strip()]


def baris_origin(akar, path):
    """Baris berkas `path` di `origin/main`. Daftar kosong kalau berkasnya tidak ada di sana."""
    kode, keluar = u.git(akar, "show", "origin/main:%s" % path)
    if kode != 0:
        return []
    return [b for b in keluar.splitlines() if b.strip()]


def baris_ekstra(akar, path):
    """Baris lokal yang TIDAK ada di `origin/main`, urutannya dipertahankan.

    Perbandingan per baris utuh, bukan diff: berkas jejak itu append-only, dan yang perlu dijawab
    cuma "baris ini sudah ada di origin atau belum". Baris yang sudah ada di origin tidak perlu
    ditulis ulang, dan baris yang cuma ada di lokal tidak boleh hilang.
    """
    lokal = baris_berkas(akar, path)
    if lokal is None:
        return []
    ada = set(baris_origin(akar, path))
    return [b for b in lokal if b not in ada]


def baris_kotor(akar):
    """[(kode, path)] dari `git status --porcelain -z`. None kalau status tidak terbaca.

    `-z` (NUL-separated) wajib, dan `u.git()` sengaja TIDAK dipakai di sini. `u.git()` mengembalikan
    `stdout.strip()`, dan `strip()` memotong spasi depan baris pertama keluaran porcelain: `' M f.jsonl'`
    jadi `'M f.jsonl'`, sehingga `baris[:2]` dan `baris[3:]` bergeser satu karakter dan path terbaca
    `.jsonl`. Bug itu nyata 2026-10-10: berkas kotor yang isinya SAMA dengan `origin/main` dilaporkan
    BEDA, jadi sinkronisasi berhenti di kasus yang justru paling sering terjadi. `-z` tidak punya
    masalah itu karena pemisahnya NUL, bukan newline, dan tiap record memuat `XY path` utuh.
    """
    hasil = subprocess.run(
        ["git", "-C", akar, "status", "--porcelain", "-z"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    if hasil.returncode != 0:
        return None
    rekaman = [r for r in hasil.stdout.split("\0") if r]
    keluaran = []
    i = 0
    while i < len(rekaman):
        rec = rekaman[i]
        if len(rec) < 4:
            i += 1
            continue
        kode_st, path = rec[:2], rec[3:]
        keluaran.append((kode_st, path))
        # Rename/copy menulis path asal sebagai record TAMBAHAN di `-z`; lewati supaya tidak dibaca
        # sebagai berkas kedua yang kotor.
        i += 2 if kode_st[0] in ("R", "C") else 1
    return keluaran


def blob_origin(akar, path):
    """Sha blob `path` di `origin/main`, atau None kalau tidak ada di sana.

    `--verify --quiet` wajib di sini. Tanpa keduanya, `git rev-parse origin/main:<path>` yang gagal
    tetap MENULIS argumennya sendiri ke stdout (exit 128), jadi path yang tidak ada terbaca seolah
    ada, dan penjaga berkas tak terlacak jadi salah tuduh. Terukur 2026-10-10 di repo scratch.
    """
    kode, keluar = u.git(akar, "rev-parse", "--verify", "--quiet", "origin/main:%s" % path)
    if kode != 0:
        return None
    return keluar.strip() or None


def blob_lokal(akar, path):
    kode, keluar = u.git(akar, "hash-object", path)
    if kode != 0:
        return None
    return keluar.strip() or None


def sinkron(akar, kering=False, catat=print):
    """(kode_keluar, pesan). Membuang hanya berkas kotor yang isinya SAMA dengan `origin/main`."""
    kode, pesan_fetch = git_berbatas(akar, "fetch", "-q", "origin", "main")
    if kode != 0:
        return KELUAR_FETCH, "fetch `origin main` gagal (%s), sinkronisasi dibatalkan" % (
            pesan_fetch.replace("\n", " ") or "tanpa pesan")

    kotor = baris_kotor(akar)
    if kotor is None:
        return KELUAR_FETCH, "`git status` tidak terbaca, sinkronisasi dibatalkan"

    # Baris jejak yang cuma ada di lokal, disimpan untuk ditulis ulang SESUDAH merge. Tanpa ini,
    # berkas jejak yang kotor akan menghentikan sinkronisasi (isi beda dari origin) atau kehilangan
    # peristiwanya (kalau dibuang). Dua-duanya salah (#169).
    jejak_ekstra = []

    def _tulis_jejak(dipulihkan):
        """Tulis ulang baris jejak lokal di ATAS versi origin/main (#169, #303).

        Berkas jejak sudah disetel ulang di dalam loop di bawah, jadi barisnya cuma hidup di memori
        sampai sini: SETIAP jalur keluar sesudah reset wajib memanggil ini, bukan cuma jalur sukses.
        Tanpa itu, merge yang gagal membuang peristiwa yang belum di-commit (#303: pohon kanonik
        terparkir di branch kerja, `--ff-only` gagal, dan baris keputusan hilang). Berkasnya
        append-only dan baris yang sudah ada di origin tidak ikut ditulis, jadi memanggilnya lebih
        dari sekali tidak menduplikasi; daftarnya dikuras supaya itu tetap benar.
        """
        while jejak_ekstra:
            path, ekstra = jejak_ekstra.pop(0)
            if not ekstra:
                continue
            with open(os.path.join(akar, path), "a", encoding="utf-8") as f:
                for baris in ekstra:
                    f.write(baris + "\n")
            catat("%s %s: %d baris jejak lokal dikembalikan"
                  % ("PULIH  " if dipulihkan else "TULIS  ", path, len(ekstra)))

    def _keluar(kode, pesan):
        """Keluar non-OK sambil mengembalikan baris jejak yang sudah disetel ulang (#303)."""
        _tulis_jejak(dipulihkan=True)
        return kode, pesan

    for kode_st, path in kotor:
        jauh = blob_origin(akar, path)
        if kode_st == "??":
            if jauh is not None:
                return KELUAR_UNTRACKED, (
                    "berkas tak terlacak `%s` ada di `origin/main`, jadi merge akan menabraknya"
                    % path)
            catat("LEWATI  %s tak terlacak, tidak ada di origin/main" % path)
            continue
        lokal = blob_lokal(akar, path)
        if lokal is not None and lokal == jauh:
            if kering:
                catat("KERING  akan buang %s (isi sama dengan origin/main)" % path)
                continue
            kode_ck, pesan_ck = u.git(akar, "checkout", "--", path)
            if kode_ck != 0:
                return _keluar(KELUAR_BEDA,
                               "gagal membuang `%s`: %s" % (path, pesan_ck.replace("\n", " ")))
            catat("BUANG   %s (isi sama dengan origin/main, tidak ada yang hilang)" % path)
            continue
        if berkas_jejak(path):
            ekstra = baris_ekstra(akar, path)
            if kering:
                catat("KERING  akan simpan %d baris jejak %s lalu tulis ulang sesudah merge"
                      % (len(ekstra), path))
                continue
            kode_ck, pesan_ck = u.git(akar, "checkout", "--", path)
            if kode_ck != 0:
                return _keluar(KELUAR_BEDA, "gagal menyetel ulang `%s`: %s"
                               % (path, pesan_ck.replace("\n", " ")))
            jejak_ekstra.append((path, ekstra))
            catat("SIMPAN  %s: %d baris lokal yang belum ada di origin/main, ditulis ulang sesudah "
                  "merge" % (path, len(ekstra)))
            continue
        return _keluar(KELUAR_BEDA,
                       ("berkas kotor `%s` isinya BEDA dari `origin/main`, jadi membuangnya "
                        "berarti menghapus kerja yang belum di-commit" % path))

    if kering:
        return KELUAR_OK, "kering: merge tidak dijalankan"

    kode_ff, pesan_ff = git_berbatas(akar, "merge", "--ff-only", "origin/main")
    if kode_ff != 0:
        return _keluar(KELUAR_FF, "`merge --ff-only` gagal: %s" % pesan_ff.replace("\n", " "))

    # Tulis ulang baris jejak lokal di ATAS versi origin/main. Berkasnya append-only, dan baris yang
    # sudah ada di origin tidak ikut ditulis, jadi tidak ada duplikat.
    _tulis_jejak(dipulihkan=False)

    _, sha = u.git(akar, "rev-parse", "--short", "HEAD")
    return KELUAR_OK, "pohon sekarang di %s" % sha


def sinkron_terkunci(akar, kering=False, catat=print):
    """`sinkron()` dengan kunci satu-instance (#169)."""
    dapat, berkas = ambil_kunci(akar)
    if not dapat:
        return KELUAR_OK, "LEWAT sudah ada sinkronisasi lain berjalan, dilewati"
    try:
        return sinkron(akar, kering=kering, catat=catat)
    finally:
        if berkas is not None:
            berkas.close()  # menutup berkas melepas flock


def _jalankan(*argv, cwd=None):
    return subprocess.run(argv, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)


def _commit(repo, path, isi, pesan):
    tujuan = os.path.join(repo, path)
    os.makedirs(os.path.dirname(tujuan), exist_ok=True)
    with open(tujuan, "w", encoding="utf-8") as f:
        f.write(isi)
    _jalankan("git", "-C", repo, "add", path)
    return _jalankan("git", "-C", repo, "-c", "user.email=uji@contoh", "-c", "user.name=uji",
                     "commit", "-q", "-m", pesan)


def _push(penerbit):
    return _jalankan("git", "-C", penerbit, "push", "-q", "origin", "HEAD:main")


def uji_mandiri():
    """Cermin: tiap kelas keputusan diuji, termasuk yang harus BERHENTI.

    Hidup di sini, bukan di skrip pemanggil, supaya perilakunya cuma punya satu salinan. Repo git
    sungguhan dipakai karena yang diuji adalah perilaku git, bukan tiruannya.
    """
    gagal = 0
    total = 0

    def cek(nama, lolos, detail=""):
        nonlocal gagal, total
        total += 1
        print("  %s %-52s %s" % ("LULUS " if lolos else "GAGAL ", nama, detail))
        if not lolos:
            gagal += 1

    def siapkan(tmp, nama):
        """(penerbit, kerja) dengan `main` berisi `f.jsonl` = 'A\\n'."""
        bare = os.path.join(tmp, "%s-bare.git" % nama)
        os.makedirs(bare)
        _jalankan("git", "init", "-q", "--bare", "--initial-branch=main", bare)
        penerbit = os.path.join(tmp, "%s-penerbit" % nama)
        _jalankan("git", "clone", "-q", bare, penerbit)
        _commit(penerbit, "f.jsonl", "A\n", "awal")
        _push(penerbit)
        kerja = os.path.join(tmp, "%s-kerja" % nama)
        _jalankan("git", "clone", "-q", bare, kerja)
        return penerbit, kerja

    def diam(*a, **k):
        pass

    with tempfile.TemporaryDirectory() as tmp:
        # 1. bersih dan mutakhir: tetap sukses, dan itu yang terjadi tiap 20 menit saat sepi.
        penerbit, kerja = siapkan(tmp, "s1")
        kode, pesan = sinkron(kerja, catat=diam)
        cek("bersih dan mutakhir diloloskan", kode == KELUAR_OK, pesan)

        # 2. bersih tapi ketinggalan: kelas yang jadi alasan alat ini ada.
        _commit(penerbit, "f.jsonl", "A\nB\n", "tambah B")
        _push(penerbit)
        kode, pesan = sinkron(kerja, catat=diam)
        _, sha = u.git(kerja, "rev-parse", "--short", "HEAD")
        _, sha_jauh = u.git(kerja, "rev-parse", "--short", "origin/main")
        cek("bersih tapi ketinggalan disinkronkan", kode == KELUAR_OK and sha == sha_jauh,
            "%s vs %s" % (sha, sha_jauh))

        # 3. kotor dengan isi SAMA dengan origin/main: dibuang, lalu merge. Ini kasus nyata
        #    `factory/usulan.jsonl` yang cuma berisi ulang baris yang sudah ada di main.
        penerbit, kerja = siapkan(tmp, "s3")
        _commit(penerbit, "f.jsonl", "A\nB\n", "tambah B")
        _push(penerbit)
        _jalankan("git", "-C", kerja, "reset", "-q", "--hard", "HEAD~0")
        with open(os.path.join(kerja, "f.jsonl"), "w", encoding="utf-8") as f:
            f.write("A\nB\n")
        kode, pesan = sinkron(kerja, catat=diam)
        _, sha = u.git(kerja, "rev-parse", "--short", "HEAD")
        _, sha_jauh = u.git(kerja, "rev-parse", "--short", "origin/main")
        cek("kotor dengan isi sama dibuang lalu disinkronkan",
            kode == KELUAR_OK and sha == sha_jauh, "%s (%s)" % (pesan, sha))

        # 4. kotor dengan isi BEDA: BERHENTI, dan isinya harus selamat. Ini penjaga yang paling
        #    penting: alat ini tidak boleh menghapus kerja yang belum di-commit.
        penerbit, kerja = siapkan(tmp, "s4")
        _commit(penerbit, "f.jsonl", "A\nB\n", "tambah B")
        _push(penerbit)
        with open(os.path.join(kerja, "f.jsonl"), "w", encoding="utf-8") as f:
            f.write("A\nkerja-belum-commit\n")
        kode, pesan = sinkron(kerja, catat=diam)
        isi = open(os.path.join(kerja, "f.jsonl"), encoding="utf-8").read()
        cek("kotor dengan isi beda ditolak", kode == KELUAR_BEDA, "exit=%d" % kode)
        cek("isi lokal yang beda tidak dihapus", "kerja-belum-commit" in isi, repr(isi[:24]))

        # 5. berkas tak terlacak yang TIDAK ada di origin/main: dilewati, merge jalan. Merge tidak
        #    menyentuh path itu, jadi menolak di sini cuma bikin cron mati tanpa alasan.
        penerbit, kerja = siapkan(tmp, "s5")
        _commit(penerbit, "f.jsonl", "A\nB\n", "tambah B")
        _push(penerbit)
        with open(os.path.join(kerja, "catatan.txt"), "w", encoding="utf-8") as f:
            f.write("scratch\n")
        kode, pesan = sinkron(kerja, catat=diam)
        ada = os.path.exists(os.path.join(kerja, "catatan.txt"))
        cek("tak terlacak yang tidak ada di origin dilewati", kode == KELUAR_OK and ada, pesan)

        # 6. berkas tak terlacak yang ADA di origin/main: BERHENTI, karena merge akan menabraknya.
        #    Kasus ini yang bikin `--verify --quiet` di `blob_origin()` wajib: tanpa itu, path yang
        #    tidak ada terbaca ada, dan kasus 5 jadi salah tuduh.
        penerbit, kerja = siapkan(tmp, "s6")
        _commit(penerbit, "baru.txt", "milik-penerbit\n", "tambah baru.txt")
        _push(penerbit)
        with open(os.path.join(kerja, "baru.txt"), "w", encoding="utf-8") as f:
            f.write("versi-lokal\n")
        kode, pesan = sinkron(kerja, catat=diam)
        cek("tak terlacak yang ada di origin ditolak", kode == KELUAR_UNTRACKED, "exit=%d" % kode)
        isi = open(os.path.join(kerja, "baru.txt"), encoding="utf-8").read()
        cek("tak terlacak yang ditolak tidak dihapus", isi == "versi-lokal\n", repr(isi))

        # 7. mode kering tidak boleh mengubah apa pun.
        penerbit, kerja = siapkan(tmp, "s7")
        _commit(penerbit, "f.jsonl", "A\nB\n", "tambah B")
        _push(penerbit)
        _, sebelum = u.git(kerja, "rev-parse", "--short", "HEAD")
        kode, pesan = sinkron(kerja, kering=True, catat=diam)
        _, sesudah = u.git(kerja, "rev-parse", "--short", "HEAD")
        cek("mode kering tidak merge", kode == KELUAR_OK and sebelum == sesudah,
            "%s -> %s" % (sebelum, sesudah))

        # 8. FIXTURE WAJIB (#169): pohon kotor HANYA di berkas jejak, dan `origin/main` menyentuh
        #    berkas yang SAMA. Ini kejadian nyata: cron menulis penanda ke `usulan.jsonl` yang
        #    dilacak, sementara lane lain meng-commit perubahan di berkas itu juga. Yang harus terjadi:
        #    sinkronisasi tetap JALAN, baris jejak lokal TIDAK hilang, dan origin-nya ikut masuk.
        #    Tanpa penanganan khusus, dua-duanya gagal: isi beda -> berhenti, atau dibuang -> hilang.
        penerbit, kerja = siapkan(tmp, "s8")
        _commit(penerbit, "factory/usulan.jsonl", '{"event":"usulan","id":"u-a"}\n', "jejak awal")
        _push(penerbit)
        _jalankan("git", "-C", kerja, "fetch", "-q", "origin", "main")
        _jalankan("git", "-C", kerja, "merge", "-q", "--ff-only", "origin/main")
        # lokal: tambah baris yang TIDAK ada di origin (keputusan belum di-commit)
        with open(os.path.join(kerja, "factory/usulan.jsonl"), "a", encoding="utf-8") as f:
            f.write('{"event":"diputuskan","id":"u-a","pilihan":1,"oleh":"HQ"}\n')
        # origin: sentuh berkas yang SAMA dengan baris berbeda
        _commit(penerbit, "factory/usulan.jsonl",
                '{"event":"usulan","id":"u-a"}\n{"event":"usulan","id":"u-b"}\n',
                "tambah usulan b di origin")
        _push(penerbit)
        kode, pesan = sinkron(kerja, catat=diam)
        isi = open(os.path.join(kerja, "factory/usulan.jsonl"), encoding="utf-8").read()
        cek("jejak kotor + origin menyentuh berkas sama tetap jalan", kode == KELUAR_OK,
            "exit=%d %s" % (kode, pesan))
        cek("baris jejak lokal tidak hilang", "diputuskan" in isi and '"u-a","pilihan":1' in isi,
            "%d baris" % len(isi.splitlines()))
        cek("baris dari origin ikut masuk", '"u-b"' in isi, repr(isi[:60]))
        cek("tidak ada baris yang terduplikasi",
            len(isi.splitlines()) == len(set(isi.splitlines())),
            "%d baris, %d unik" % (len(isi.splitlines()), len(set(isi.splitlines()))))
        _, sha_kerja = u.git(kerja, "rev-parse", "--short", "HEAD")
        _, sha_jauh = u.git(kerja, "rev-parse", "--short", "origin/main")
        cek("HEAD ikut maju ke origin/main", sha_kerja == sha_jauh, "%s vs %s" % (sha_kerja, sha_jauh))

        # 9. Jejak kotor yang barisnya SUDAH ada di origin: tidak boleh digandakan. Ini kejadian
        #    paling sering: pohon sudah menerima baris itu, lalu cron menuliskannya lagi.
        penerbit, kerja = siapkan(tmp, "s9")
        _commit(penerbit, "factory/usulan.jsonl", '{"event":"usulan","id":"u-a"}\n', "jejak awal")
        _push(penerbit)
        _jalankan("git", "-C", kerja, "fetch", "-q", "origin", "main")
        _jalankan("git", "-C", kerja, "merge", "-q", "--ff-only", "origin/main")
        _commit(penerbit, "factory/usulan.jsonl",
                '{"event":"usulan","id":"u-a"}\n{"event":"usulan","id":"u-b"}\n', "tambah b")
        _push(penerbit)
        with open(os.path.join(kerja, "factory/usulan.jsonl"), "a", encoding="utf-8") as f:
            f.write('{"event":"usulan","id":"u-b"}\n')
        kode, pesan = sinkron(kerja, catat=diam)
        isi = open(os.path.join(kerja, "factory/usulan.jsonl"), encoding="utf-8").read()
        cek("jejak yang sudah ada di origin tidak digandakan",
            kode == KELUAR_OK and isi.count('"u-b"') == 1,
            "exit=%d, %d kemunculan u-b" % (kode, isi.count('"u-b"')))

        # 10. Kunci satu-instance: proses kedua TIDAK boleh merge sambil yang pertama jalan. Empat
        #     baris crontab memanggil alat ini, dan */15, */20, */30 bertemu di menit :00.
        penerbit, kerja = siapkan(tmp, "s10")
        _commit(penerbit, "f.jsonl", "A\nB\n", "tambah B")
        _push(penerbit)
        dapat, kunci = ambil_kunci(kerja)
        cek("kunci bisa diambil saat bebas", dapat and kunci is not None)
        # Yang diperiksa HEAD tidak BERGESER, bukan "masih beda dari origin/main": tanpa fetch,
        # `origin/main` lokal juga belum bergerak, jadi perbandingan itu meloloskan sync yang jalan.
        _, sha_sebelum = u.git(kerja, "rev-parse", "--short", "HEAD")
        kode, pesan = sinkron_terkunci(kerja, catat=diam)
        _, sha_sesudah = u.git(kerja, "rev-parse", "--short", "HEAD")
        cek("jalan kedua dilewati selama kunci dipegang",
            kode == KELUAR_OK and sha_sebelum == sha_sesudah and "LEWAT" in pesan,
            "exit=%d %s" % (kode, pesan))
        if kunci is not None:
            kunci.close()
        kode, pesan = sinkron_terkunci(kerja, catat=diam)
        _, sha = u.git(kerja, "rev-parse", "--short", "HEAD")
        _, sha_jauh = u.git(kerja, "rev-parse", "--short", "origin/main")
        cek("setelah kunci dilepas, sinkronisasi jalan lagi",
            kode == KELUAR_OK and sha == sha_jauh, "%s vs %s" % (sha, sha_jauh))

        # 11. Kontrol negatif batas waktu: git yang menggantung HARUS dipotong. Tanpa kasus ini,
        #     batas waktu cuma angka yang tidak pernah dibuktikan.
        if os.name == "posix":
            dir_palsu = os.path.join(tmp, "git-lambat")
            os.makedirs(dir_palsu)
            jalur_palsu = os.path.join(dir_palsu, "git")
            with open(jalur_palsu, "w", encoding="utf-8") as f:
                f.write("#!/bin/sh\nsleep 30\n")
            os.chmod(jalur_palsu, 0o755)
            asal_path = os.environ.get("PATH", "")
            os.environ["PATH"] = dir_palsu + os.pathsep + asal_path
            try:
                kode, pesan = git_berbatas(kerja, "fetch", "origin", "main", batas=1)
            finally:
                os.environ["PATH"] = asal_path
            cek("git yang menggantung dipotong batas waktu", kode == 124,
                "exit=%d %s" % (kode, pesan))

        # 12. Pin HOME: tanpa HOME, `git fetch` gagal "could not read Username". Cron asli
        #     menyetelnya, pemanggil dari lingkungan minimal tidak.
        asal_home = os.environ.pop("HOME", None)
        try:
            rumah = pin_home()
            cek("HOME kosong diisi ulang", bool(rumah) and os.environ.get("HOME") == rumah,
                "%s" % rumah)
        finally:
            if asal_home is None:
                os.environ.pop("HOME", None)
            else:
                os.environ["HOME"] = asal_home
        cek("HOME yang sudah ada tidak diubah", pin_home() == os.environ.get("HOME"),
            "%s" % os.environ.get("HOME"))

        # 13. `--cap-waktu` diuji lewat proses sungguhan, bukan cuma bentuk fungsinya: yang penting
        #     TIAP baris keluaran ber-cap waktu, karena itu yang membedakan replay dari laporan baru.
        hasil = _jalankan(sys.executable, os.path.abspath(__file__), "--akar", kerja,
                          "--kering", "--cap-waktu")
        baris = [b for b in hasil.stdout.splitlines() if b.strip()]
        cek("--cap-waktu memberi cap waktu di tiap baris",
            hasil.returncode == 0 and bool(baris)
            and all(b[:4].isdigit() and "T" in b[:20] for b in baris),
            "exit=%d, %d baris" % (hasil.returncode, len(baris)))

        # 14. Mode cron SELALU keluar 0, termasuk saat sinkronisasinya sendiri gagal. Kalau tidak,
        #     satu fetch yang gagal mematikan sisa baris crontab itu.
        bukan_repo = os.path.join(tmp, "bukan-repo")
        os.makedirs(bukan_repo)
        hasil = _jalankan(sys.executable, os.path.abspath(__file__), "--akar", bukan_repo, "--cron")
        cek("--cron keluar 0 walau akar bukan repo git", hasil.returncode == 0,
            "exit=%d" % hasil.returncode)

        # 15. FIXTURE WAJIB (#303): merge GAGAL (pohon divergen) sambil berkas jejak kotor.
        #     Baris jejak lokal harus SELAMAT walau sinkronisasinya gagal. Kejadian nyata
        #     2026-10-12: pohon kanonik terparkir di branch kerja, `--ff-only` gagal, dan baris
        #     keputusan `u-uji-644962` hilang karena penulisan ulangnya cuma ada di jalur sukses.
        penerbit, kerja = siapkan(tmp, "s15")
        _commit(penerbit, "factory/usulan-x.jsonl", '{"event":"usulan","id":"u-x"}\n', "jejak awal")
        _push(penerbit)
        _jalankan("git", "-C", kerja, "fetch", "-q", "origin", "main")
        _jalankan("git", "-C", kerja, "merge", "-q", "--ff-only", "origin/main")
        # lokal: commit sendiri -> pohon divergen terhadap origin/main
        _commit(kerja, "lokal.txt", "B\n", "commit lokal")
        # origin: commit lain -> divergen makin jauh
        _commit(penerbit, "lain.txt", "C\n", "commit penerbit")
        _push(penerbit)
        # berkas jejak kotor: satu baris keputusan yang belum ada di origin
        with open(os.path.join(kerja, "factory/usulan-x.jsonl"), "a", encoding="utf-8") as f:
            f.write('{"event":"diputuskan","id":"u-x","pilihan":1,"oleh":"agent"}\n')
        kode, pesan = sinkron(kerja, catat=diam)
        isi = open(os.path.join(kerja, "factory/usulan-x.jsonl"), encoding="utf-8").read()
        cek("merge yang gagal tetap gagal berisik", kode == KELUAR_FF, "exit=%d %s" % (kode, pesan))
        cek("baris jejak lokal SELAMAT walau merge gagal (#303)",
            "diputuskan" in isi and len(isi.splitlines()) == 2,
            "%d baris: %r" % (len(isi.splitlines()), isi[:90]))

    print("")
    print("UJI MANDIRI: %d kasus, %d gagal" % (total, gagal))
    return gagal


def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=u.akar_factory(),
                   help="pohon yang disinkronkan (default: pohon alat ini sendiri)")
    p.add_argument("--kering", action="store_true",
                   help="tunjukkan rencananya tanpa membuang atau merge")
    p.add_argument("--cap-waktu", dest="cap_waktu", action="store_true",
                   help="cap waktu ISO di awal tiap baris (dipakai log cron)")
    p.add_argument("--cron", action="store_true",
                   help="mode crontab: seperti --cap-waktu, dan SELALU keluar 0")
    p.add_argument("--uji-mandiri", action="store_true")
    a = p.parse_args()

    if a.uji_mandiri:
        return 1 if uji_mandiri() else 0

    if a.cron:
        a.cap_waktu = True

    # Dipin SEBELUM git pertama dipanggil: `fetch` butuh kredensial dari $HOME.
    pin_home()

    akar = os.path.abspath(os.path.expanduser(a.akar))

    def cetak(pesan):
        print("%s %s" % (cap_waktu(), pesan) if a.cap_waktu else pesan)

    kode, pesan = sinkron_terkunci(akar, kering=a.kering, catat=cetak)
    cetak(("SYNC    " if kode == KELUAR_OK else "GAGAL   ") + pesan)
    cetak("selesai exit=%d" % kode)
    # Mode cron selalu 0: kegagalan sinkronisasi bukan alasan mematikan baris crontab. Yang
    # memutuskan "jalan atau berhenti" tetap penjaga branch di masing-masing skrip factory.
    return 0 if a.cron else kode


if __name__ == "__main__":
    sys.exit(main())
