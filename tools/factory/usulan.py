#!/usr/bin/env python3
"""usulan.py - catat opsi pekerjaan dari lane, dan lacak keputusannya.

Kenapa ada: `pacemaker.py` membangunkan sesi lane kalau ada sinyal kerja, arah owner -> lane. Tidak
ada jalur sebaliknya. Ketika sebuah lane punya opsi pekerjaan yang butuh keputusan, tidak ada cara
baku melaporkannya ke owner: keputusan menumpuk di kepala lane, dan owner harus mengejar sendiri.
Berkas ini membuka jalur itu, dan `lapor.py` yang mengantar digest-nya ke owner.

Berkas ini adalah penulis TUNGGAL `factory/usulan.jsonl`. Isinya append-only, satu objek JSON per
baris, dan status sebuah usulan adalah baris TERAKHIR dengan id itu:

  {"event": "usulan",     "id": "u-payroll-a3f1c9", ...}   opsi dicatat, status menunggu
  {"event": "dilaporkan", "id": "u-payroll-a3f1c9", ...}   digest sudah dikirim ke owner
  {"event": "diputuskan", "id": "u-payroll-a3f1c9", ...}   owner memilih: pilihan + oleh

**Penanda `dilaporkan` TIDAK di berkas itu (#169).** `lapor.py` menulisnya dari cron, dan menulis ke
berkas yang dilacak git berarti pohon kanonik kotor tiap 30 menit; begitu `origin/main` juga
menyentuh berkas yang sama, `merge --ff-only` gagal permanen dan sinkronisasi buntu (kejadian nyata:
commit `200fccb` harus dibuat dengan tangan supaya pohon bersih lagi). Penanda itu sekarang hidup di
`factory/state/dilaporkan.jsonl` yang tidak dilacak git, dan `baca_semua()` menggabungkan keduanya
supaya statusnya tetap terbaca. Yang tetap dilacak git hanya peristiwa yang perlu dibaca manusia dan
di-commit lewat PR: entri `usulan` dan `diputuskan`.

Lane tidak menulis berkasnya dengan tangan; mereka memanggil `usulan.py catat`. Berkas dikunci
flock, dan id diterbitkan DI DALAM kunci.

**Id tidak boleh diurutkan dari isi berkas (#121).** Dulu id-nya `u-<nomor urut>`, dihitung dari
nomor terbesar di salinan berkas yang sedang dibuka. Itu benar untuk satu salinan, tapi tiap lane
bekerja di worktree sendiri dengan salinan sendiri, jadi flock-nya tidak mengunci apa pun lintas
lane: dua lane yang mencatat di hari yang sama sama-sama dapat `u-0021`, dan setelah branch-nya
di-merge, status usulan yang satu menimpa yang lain tanpa error apa pun. Kejadian nyata 2026-10-10:
`u-0002` punya tiga arti sekaligus (gh-ops, vps-verify, gudang), dan di hari yang sama `u-0021`
dipakai gh-ops sekaligus payroll. Sekarang id dibentuk dari lane + akar acak, jadi dua salinan
terpisah tidak bisa menghasilkan id yang sama walau keduanya mencatat di detik yang sama.

**Tulis hanya ke salinan pemanggil (#121).** Akar repo diturunkan dari lokasi skrip, bukan dari
branch pemanggil, jadi lane yang memanggil `~/pms-tsj/tools/factory/usulan.py` dari worktree-nya
sendiri menulis ke worktree `main` yang dipakai bersama, dalam keadaan tidak ter-commit, dan
`git checkout .` menghapusnya tanpa jejak. Sekarang penulisan DITOLAK kalau branch worktree tujuan
bukan branch pemanggil, dengan pesan yang menyebut kedua branch-nya. `--paksa` ada untuk kasus yang
memang disengaja. Kalau branch pemanggil tidak bisa ditentukan (dijalankan dari luar repo git),
penulisan dilanjutkan dan alasannya tidak disembunyikan.

Cara pakai:
  python3 tools/factory/usulan.py catat --lane sync --ringkas "..." \
      --opsi "pisah schema_sync_ext.sql" --opsi "biarkan schema_extra.sql" --rekomendasi 1
  python3 tools/factory/usulan.py daftar [--status menunggu] [--json]
  python3 tools/factory/usulan.py putuskan u-payroll-a3f1c9 --pilihan 1 --oleh owner
  python3 tools/factory/usulan.py --uji-mandiri

`--oleh` WAJIB dan tidak punya default. Dulu defaultnya `owner`, dan akibatnya keputusan agent
tercatat sebagai keputusan owner: petunjuk yang dikirim `lapor.py` menyuruh agent memanggil
`putuskan <id> --pilihan <n>` tanpa `--oleh`, jadi setiap agent yang menuruti petunjuk itu salah
atribusi. `oleh` adalah satu-satunya jejak tentang siapa yang memutuskan, dan itu pembeda inti
LAW 8.5, jadi atribusi tidak boleh terjadi karena lupa.

**Keputusan yang BERBALIK arah butuh `--ganti` (#164).** Status sebuah usulan adalah baris TERAKHIR
dengan id itu, dan berkas ini penulisnya tunggal, jadi keputusan yang dibalik tidak bisa dicatat
dengan menyunting berkasnya. Tanpa jalur ini status yang terbaca gate berikutnya tetap opsi LAMA,
padahal arahnya sudah berubah. Kejadian nyatanya `u-0014`: owner menegaskan ulang dan memilih arah
sebaliknya, tapi berkasnya tetap terbaca sebagai perintah menambal sumber laporan keuangan
perusahaan. Karena itu pembalikan butuh niat yang eksplisit: `--ganti` disertai `--alasan`, dan
event-nya memuat `mengganti_pilihan`, `mengganti_oleh`, dan `alasan_ganti` supaya riwayatnya
terbaca. Penolakan lama dipertahankan: tanpa `--ganti`, usulan yang sudah diputuskan tetap ditolak,
dan `--ganti` pada usulan yang BELUM diputuskan juga ditolak, karena itu kekeliruan, bukan
pembalikan.
"""

import argparse
import datetime
import fcntl
import json
import os
import secrets
import subprocess
import sys
import tempfile

DIR_INI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_INI)
import _umum as u  # noqa: E402

STATUS = ("menunggu", "dilaporkan", "diputuskan")

def sekarang():
    return datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(timespec="seconds")

def path_usulan(akar, lane=None):
    """Berkas jejak usulan. Dengan `lane`, berkas lane itu; tanpa, berkas lama yang dipakai bersama.

    Sejak #217 (keputusan agent u-HQ-f406ac opsi 2) tiap lane menulis berkasnya sendiri
    (`factory/usulan-<lane>.jsonl`), supaya dua PR jejak dari lane berbeda tidak lagi menyentuh
    berkas yang sama dan bertabrakan di ujungnya.
    """
    if lane:
        return os.path.join(akar, "factory", "usulan-%s.jsonl" % lane)
    return os.path.join(akar, "factory", "usulan.jsonl")

def berkas_usulan(akar):
    """Semua berkas jejak usulan yang ada, terurut.

    `factory/usulan.jsonl` ikut dibaca selama ada: salinan lane yang belum sinkron masih memakai
    `usulan.py` lama dan menulis ke sana, dan pembaca yang mengabaikannya akan kehilangan usulan
    yang baru dicatat.
    """
    d = os.path.join(akar, "factory")
    if not os.path.isdir(d):
        return []
    return sorted(os.path.join(d, n) for n in os.listdir(d)
                  if n == "usulan.jsonl" or (n.startswith("usulan-") and n.endswith(".jsonl")))

def berkas_pemilik(akar, usulan_id):
    """Berkas yang memuat entri `usulan` untuk id ini, atau None kalau tidak ada.

    Semua peristiwa satu id sebaiknya tinggal di satu berkas supaya jejaknya terbaca sebagai satu
    riwayat. Sejak #231 status tidak lagi ditentukan urutan baca lintas berkas (yang menang `ts`
    terbesar), tapi `putuskan` tetap menulis ke berkas yang memuat entri `usulan`-nya: memecah satu id
    ke dua berkas membuat `grep` dan mata manusia kehilangan separuh riwayatnya.
    """
    for path in berkas_usulan(akar):
        with open(path, encoding="utf-8") as f:
            for b in f:
                if not b.strip():
                    continue
                try:
                    e = json.loads(b)
                except json.JSONDecodeError:
                    continue
                if e.get("event") == "usulan" and e.get("id") == usulan_id:
                    return path
    return None

def path_status(akar):
    """Berkas penanda `dilaporkan` yang TIDAK dilacak git (#169).

    Dipisah dari `usulan.jsonl` karena `lapor.py` menulis penanda ini dari cron, dan menulis ke berkas
    yang dilacak git berarti pohon kanonik jadi kotor tiap 30 menit. Begitu `origin/main` juga
    menyentuh berkas itu, `merge --ff-only` gagal permanen dan sinkronisasi buntu (#169). Kejadian
    nyatanya commit `200fccb` harus dibuat dengan tangan supaya pohon bersih lagi.

    Yang tetap dilacak git adalah peristiwa yang perlu dibaca manusia dan di-commit lewat PR: entri
    `usulan` dan `diputuskan`. Penanda `dilaporkan` cuma state operasional "digest ini sudah dikirim",
    nilainya lokal dan sesaat, jadi tempatnya bukan di riwayat git.
    """
    return os.path.join(akar, "factory", "state", "dilaporkan.jsonl")

def sidik_usulan(e):
    """Sidik isi sebuah entri `usulan`, untuk mendeteksi id yang dipakai dua usulan berbeda."""
    return json.dumps({k: e.get(k) for k in ("lane", "ringkas", "opsi", "rekomendasi")},
                      sort_keys=True, ensure_ascii=False)


def tabrakan(events):
    """Id yang dipakai lebih dari satu entri `usulan` dengan ISI BERBEDA (#144).

    Id urut per pohon sudah diganti id lane + akar acak (#121), tapi itu mencegah tabrakan BARU, bukan
    menangkap tabrakan yang sudah masuk. Penggabungan dua salinan masih bisa membawa dua entri
    `usulan` ber-id sama dengan isi berbeda, dan tanpa pemeriksa ini yang menang adalah entri ber-`ts`
    terbesar: usulan yang satu hilang tanpa error apa pun. Berkas ini justru dipakai untuk menjawab "siapa
    memutuskan apa", jadi kehilangan senyap di situ membatalkan alasan keberadaannya.

    Dua entri ber-id sama dengan isi SAMA bukan tabrakan: itu salinan identik dari pohon yang sama,
    dan menggabungkannya tidak menghilangkan apa pun.
    """
    per = {}
    for e in events:
        if e.get("event") != "usulan" or not e.get("id"):
            continue
        per.setdefault(e["id"], set()).add(sidik_usulan(e))
    return sorted(i for i, sidik in per.items() if len(sidik) > 1)


PERINGKAT_EVENT = {"usulan": 0, "dilaporkan": 1, "diputuskan": 2}

def keadaan(events):
    """Lipat event jadi satu record per id; yang menang `ts` TERBESAR, bukan posisi baris.

    Sebelum #231 pelipatannya menurut posisi, dan itu benar hanya selama semua peristiwa sebuah id
    datang dari satu berkas terlacak yang urutannya kronologis. Begitu penanda `dilaporkan` pindah ke
    berkas terpisah (#169) dan `baca_semua()` menaruhnya di BELAKANG, penanda itu selalu menang:
    usulan yang dilaporkan lalu diputuskan (urutan yang normal) terbaca `dilaporkan` selamanya.
    Terukur 2026-10-11: 9 dari 45 id salah baca, dan `daftar --status menunggu` balas kosong padahal
    4 opsi memang belum diputuskan. Angka itu hampir diteruskan ke owner sebagai 11 opsi menunggu,
    dan owner disodori keputusan yang sudah dia jawab sendiri.

    Urutannya (ts, peringkat), bukan ts saja: dua peristiwa bisa ber-ts sama persis (resolusi detik),
    dan pada seri itu keputusan harus menang atas penanda operasional `dilaporkan`, bukan kalah
    karena kebetulan diletakkan lebih dulu. Peristiwa tanpa `ts` dianggap paling tua, jadi penanda
    cacat tidak bisa membungkam keputusan yang bertanggal.
    """
    per = {}
    for e in events:
        i = e.get("id")
        if not i or e.get("event") not in PERINGKAT_EVENT:
            continue
        per.setdefault(i, []).append(e)
    hasil = {}
    for i, evs in per.items():
        r = {"id": i, "status": "menunggu"}
        for e in sorted(evs, key=lambda x: (x.get("ts") or "", PERINGKAT_EVENT[x["event"]])):
            r.update(e)
            if e["event"] != "usulan":
                r["status"] = "dilaporkan" if e["event"] == "dilaporkan" else "diputuskan"
        hasil[i] = r
    return hasil

def id_baru(lane, events):
    """Id unik yang TIDAK dihitung dari isi berkas salinan ini (#121).

    Bentuknya `u-<lane>-<6 heksadesimal>`. Lane di dalam id membuat dua lane tidak mungkin bertabrakan,
    dan akar acaknya menutup sisa kasusnya: dua salinan berkas dari lane yang SAMA, masing-masing
    menghitung nomor urut sendiri, tetap tidak menghasilkan id yang sama. Menghitung nomor urut dari
    isi berkas tidak bisa dipakai di sini, karena itulah cacatnya: tiap lane bekerja di salinan
    sendiri, jadi flock tidak mengunci apa pun lintas lane.

    Pemeriksaan terhadap `events` tetap ada, tapi perannya berubah: bukan lagi sumber id, cuma
    penjaga terakhir kalau akar acaknya kebetulan mengulang di berkas yang sama.
    """
    ada = {e.get("id") for e in events}
    for _ in range(100):
        kandidat = "u-%s-%s" % (lane, secrets.token_hex(3))
        if kandidat not in ada:
            return kandidat
    raise RuntimeError("tidak bisa menerbitkan id unik untuk lane %s" % lane)


def branch_kerja(path):
    """Nama branch HEAD worktree yang memuat `path`, atau None kalau tidak bisa ditentukan.

    None bukan galat: `usulan.py` juga dipanggil dari luar repo (uji mandiri memakai direktori
    sementara, cron menjalankannya dari $HOME). Yang dijaga cuma kasus berbahaya, yaitu pemanggil
    yang JELAS berada di branch lain daripada worktree yang akan ditulisinya.
    """
    try:
        h = subprocess.run(["git", "-C", path, "rev-parse", "--abbrev-ref", "HEAD"],
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    except OSError:
        return None
    if h.returncode != 0:
        return None
    return h.stdout.strip() or None


def periksa_penulis(akar, paksa):
    """Tolak menulis kalau worktree tujuan bukan worktree pemanggil (#121). Kembalikan pesan galat."""
    if paksa:
        return None
    tujuan = branch_kerja(akar)
    pemanggil = branch_kerja(os.getcwd())
    if tujuan is None or pemanggil is None:
        return None
    if tujuan != pemanggil:
        return ("worktree tujuan bukan worktree pemanggil: %s ada di branch `%s`, sedangkan kamu di "
                "branch `%s`. Tulisannya akan mendarat di salinan bersama yang tidak kamu commit, dan "
                "hilang tanpa jejak pada `git checkout .` berikutnya. Jalankan dari worktree-mu "
                "sendiri, atau pakai --paksa kalau memang itu yang dimaksud."
                % (os.path.abspath(akar), tujuan, pemanggil))
    return None

def dengan_kunci(path, fn):
    """Buka berkas di bawah flock, serahkan isinya ke fn, tulis hasilnya. Id diterbitkan di sini."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a+", encoding="utf-8") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            f.seek(0)
            events = []
            for i, baris in enumerate(f, 1):
                baris = baris.strip()
                if not baris:
                    continue
                try:
                    events.append(json.loads(baris))
                except json.JSONDecodeError as e:
                    return [], "usulan.jsonl baris %d bukan JSON: %s" % (i, e)
            baru, pesan = fn(events)
            if baru:
                f.seek(0, os.SEEK_END)
                for e in baru:
                    f.write(json.dumps(e, ensure_ascii=False) + "\n")
                f.flush()
                os.fsync(f.fileno())
            return baru, pesan
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)

def baca_event(akar):
    """Semua peristiwa dari SEMUA berkas jejak usulan (#217: jejak dipecah per lane)."""
    events = []
    for path in berkas_usulan(akar):
        with open(path, encoding="utf-8") as f:
            events.extend(json.loads(b) for b in f if b.strip())
    return events

def baca_status(akar):
    """Penanda `dilaporkan` dari berkas yang tidak dilacak git (#169)."""
    path = path_status(akar)
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(b) for b in f if b.strip()]

def baca_semua(akar):
    """Gabungan berkas terlacak dan penanda tidak terlacak.

    Status sebuah usulan adalah peristiwa ber-`ts` TERBESAR untuk id itu (#231), jadi urutan
    penggabungan di sini TIDAK lagi menentukan status; yang menentukan `ts` tiap baris. Penggabungan
    ini tetap perlu: tanpa penanda `dilaporkan` ikut terbaca, usulan yang sudah dilaporkan terbaca
    `menunggu` lagi dan digest-nya terkirim ulang tiap 30 menit.

    Asumsi lama "penanda selalu ditulis SESUDAH entri `usulan`-nya, jadi letakkan di belakang" benar
    untuk `usulan` tapi keliru untuk `diputuskan`: dilaporkan lalu diputuskan itu urutan yang normal.
    """
    return baca_event(akar) + baca_status(akar)

def periksa_baru(akar, lane, ringkas, opsi, rekomendasi):
    """Validasi yang tidak butuh berkas. Kembalikan pesan galat, atau None kalau lolos."""
    lanes = u.baca_json(os.path.join(akar, "factory", "lanes.json"))
    if u.cari_lane(lanes, lane) is None:
        return "lane `%s` tidak ada di factory/lanes.json" % lane
    if not ringkas.strip():
        return "ringkas tidak boleh kosong"
    if not (2 <= len(opsi) <= 3):
        return "butuh 2 sampai 3 opsi, dapat %d" % len(opsi)
    if rekomendasi is not None and not (1 <= rekomendasi <= len(opsi)):
        return "rekomendasi %d di luar rentang 1..%d" % (rekomendasi, len(opsi))
    return None

def catat(akar, lane, ringkas, opsi, rekomendasi, dampak, issue, paksa=False):
    opsi = [o.strip() for o in opsi if o.strip()]
    galat = periksa_baru(akar, lane, ringkas, opsi, rekomendasi)
    if galat:
        return 1, galat
    galat = periksa_penulis(akar, paksa)
    if galat:
        return 1, galat

    def bangun(events):
        # Tabrakan diperiksa SEBELUM menulis apa pun (#144). Berkas yang sudah punya id kembar tidak
        # boleh ditambah atau diputuskan: tiap tulis di atasnya memperbesar kerusakannya, dan yang
        # paling berbahaya justru `putuskan`, karena ia memutuskan usulan yang mungkin bukan yang
        # dimaksud pemanggilnya.
        kembar = tabrakan(events)
        if kembar:
            return [], ("berkas usulan punya id kembar dengan isi berbeda: %s. Bereskan dulu "
                        "(beri id baru ke salah satunya), karena selama ini ada, keputusan bisa "
                        "mendarat di usulan yang bukan dimaksud." % ", ".join(kembar))
        now = sekarang()
        terakhir = max((e.get("ts", "") for e in events), default="")
        if terakhir and now < terakhir:
            return [], "ts mundur: %s lebih tua dari entri terakhir %s" % (now, terakhir)
        return [{
            "event": "usulan", "id": id_baru(lane, events), "ts": now, "lane": lane,
            "ringkas": ringkas.strip(), "opsi": opsi, "rekomendasi": rekomendasi,
            "dampak_tunda": (dampak or "").strip(), "issue": issue, "status": "menunggu",
        }], ""

    # Tabrakan diperiksa lintas SEMUA berkas, bukan cuma berkas lane ini (#144 + #217): setelah jejak
    # dipecah, dua salinan bisa membawa id yang sama di berkas BERBEDA, dan pemeriksaan per-berkas
    # tidak akan melihatnya.
    kembar = tabrakan(baca_event(akar))
    if kembar:
        return 1, ("jejak usulan punya id kembar dengan isi berbeda: %s. Bereskan dulu (beri id baru "
                   "ke salah satunya), karena selama ini ada, keputusan bisa mendarat di usulan yang "
                   "bukan dimaksud." % ", ".join(kembar))
    baru, pesan = dengan_kunci(path_usulan(akar, lane), bangun)
    if not baru:
        return 1, pesan
    event = baru[0]
    return 0, "tercatat %s dari lane %s: %s" % (event["id"], lane, event["ringkas"][:60])

def putuskan(akar, usulan_id, pilihan, oleh, paksa=False, ganti=False, alasan=""):
    galat = periksa_penulis(akar, paksa)
    if galat:
        return 1, galat

    def bangun(events):
        # Sama seperti `catat`: id kembar ditolak SEBELUM memutuskan (#144). Di sinilah akibatnya
        # paling mahal, karena `keadaan()` melipat satu record per id, jadi keputusan bisa mendarat
        # di usulan yang bukan dimaksud pemanggilnya.
        kembar = tabrakan(events)
        if kembar:
            return [], ("berkas usulan punya id kembar dengan isi berbeda: %s. Bereskan dulu, karena "
                        "selama ini ada, keputusan bisa mendarat di usulan yang bukan dimaksud."
                        % ", ".join(kembar))
        r = keadaan(events).get(usulan_id)
        if r is None:
            return [], "usulan `%s` tidak ada" % usulan_id
        opsi = r.get("opsi") or []
        if not (1 <= pilihan <= len(opsi)):
            return [], "pilihan %d di luar rentang 1..%d" % (pilihan, len(opsi))
        sudah = r.get("status") == "diputuskan"
        # Pembalikan keputusan (#164). Status sebuah usulan adalah baris TERAKHIR dengan id itu, jadi
        # tanpa jalur ini keputusan yang berbalik arah tidak bisa dicatat sama sekali, dan status yang
        # terbaca gate berikutnya tetap opsi LAMA. Penolakan tanpa `--ganti` tetap dipertahankan: dua
        # panggilan berturut-turut biasanya kekeliruan, bukan pembalikan. Kejadian nyatanya u-0014:
        # owner menegaskan ulang arah sebaliknya, tapi berkasnya tetap terbaca sebagai perintah
        # menambal sumber laporan keuangan perusahaan.
        if sudah and not ganti:
            return [], "usulan `%s` sudah diputuskan" % usulan_id
        if ganti and not sudah:
            return [], ("usulan `%s` belum diputuskan, jadi `--ganti` tidak berlaku (itu kekeliruan, "
                        "bukan pembalikan)" % usulan_id)
        if ganti and not alasan.strip():
            return [], "`--ganti` wajib disertai `--alasan`"
        baru = {"event": "diputuskan", "id": usulan_id, "ts": sekarang(),
                "pilihan": pilihan, "teks_pilihan": opsi[pilihan - 1], "oleh": oleh}
        if ganti:
            baru["mengganti_pilihan"] = r.get("pilihan")
            baru["mengganti_oleh"] = r.get("oleh")
            baru["alasan_ganti"] = alasan.strip()
        return [baru], ""

    path = berkas_pemilik(akar, usulan_id)
    if path is None:
        return 1, "usulan `%s` tidak ada" % usulan_id
    baru, pesan = dengan_kunci(path, bangun)
    if not baru:
        return 1, pesan
    event = baru[0]
    awalan = "DIBALIK " if ganti else ""
    return 0, "%s%s diputuskan: opsi %d (%s)" % (awalan, usulan_id, pilihan,
                                                 event["teks_pilihan"][:50])

def tandai_dilaporkan(akar, ids):
    """Catat bahwa digest berisi id-id ini sudah dikirim ke owner.

    Dipanggil `lapor.py`, dan menulis ke berkas penanda yang TIDAK dilacak git (#169). Dulu penanda
    ini masuk `usulan.jsonl` yang dilacak, jadi cron mengotori pohon kanonik tiap 30 menit; begitu
    `origin/main` menyentuh berkas yang sama, `merge --ff-only` gagal permanen. Aturan penulis tunggal
    tetap dihormati: `usulan.py` satu-satunya penulis KEDUA berkas.

    Hanya id yang masih berstatus `menunggu` yang ditandai; yang sudah diputuskan tidak diusik.
    """
    def bangun(events):
        # `events` cuma isi berkas penanda di bawah kunci; status sebenarnya hidup di berkas terlacak,
        # jadi keduanya digabung. Sejak #231 urutan penggabungan tidak menentukan apa pun (yang menang
        # `ts` terbesar), dan itu justru yang diinginkan: penanda yang baru ditulis ber-`ts` paling
        # muda, jadi ia menang tanpa perlu diletakkan di belakang. Sebelumnya urutan inilah yang
        # membuat penanda LAMA menimpa keputusan yang lebih baru.
        ada = keadaan(baca_event(akar) + events)
        baru = [i for i in ids if ada.get(i, {}).get("status") == "menunggu"]
        if not baru:
            return [], "tidak ada usulan menunggu yang perlu ditandai"
        now = sekarang()
        return [{"event": "dilaporkan", "id": i, "ts": now, "status": "dilaporkan"} for i in baru], ""

    baru, pesan = dengan_kunci(path_status(akar), bangun)
    if not baru:
        return 0, pesan
    return 0, "%d usulan ditandai dilaporkan: %s" % (len(baru), ", ".join(b["id"] for b in baru))

def daftar(akar, status):
    rec = sorted(keadaan(baca_semua(akar)).values(), key=lambda r: r.get("id", ""))
    if status:
        rec = [r for r in rec if r.get("status") == status]
    return rec

def path_status_dari_usulan(path):
    """Berkas penanda `dilaporkan` yang sepadan dengan berkas usulan `path`.

    `menunggu_di_path()` dipanggil `pacemaker.py` dengan path eksplisit, jadi ia tidak bisa memakai
    `path_status(akar)`. Berkas penandanya diturunkan dari direktori berkas usulan: keduanya hidup di
    bawah `factory/`, jadi `<...>/factory/usulan.jsonl` berpasangan dengan
    `<...>/factory/state/dilaporkan.jsonl`. Kalau berkasnya tidak ada, pemanggil kembali ke perilaku
    lama: hanya berkas usulan yang dibaca, dan uji mandiri yang memakai direktori sementara tidak
    ikut membaca state repo.
    """
    return os.path.join(os.path.dirname(path), "state", "dilaporkan.jsonl")

def menunggu_di_path(path):
    """Opsi berstatus `menunggu` di berkas `path`, bukan di path bawaan akar.

    Dipakai `pacemaker.py`, yang butuh path eksplisit supaya uji mandirinya tidak ikut membaca
    berkas repo: kalau ia membaca yang bawaan, hasil uji berubah begitu ada usulan asli tercatat,
    dan uji yang berubah karena data itu bukan uji.

    Status dibaca sebagai GABUNGAN berkas usulan dan penanda `dilaporkan` (LAW 8: "Status sebuah
    usulan tetap dibaca sebagai gabungan"). Tanpa penggabungan ini, usulan yang sudah dilaporkan
    terbaca `menunggu` lagi selama keputusannya belum mendarat di berkas yang dilacak git, jadi
    pacemaker membangunkan lane berulang kali untuk opsi yang digest-nya sudah dikirim (#189).
    """
    if not os.path.exists(path):
        return []
    return menunggu_di_paths([path])

def menunggu_di_paths(paths):
    """Opsi berstatus `menunggu` dari BEBERAPA berkas jejak (#217: jejak dipecah per lane).

    Dipakai `pacemaker.py`, yang butuh path eksplisit supaya uji mandirinya tidak ikut membaca berkas
    repo. Penanda `dilaporkan` tetap satu berkas global, jadi ia digabung bersama semua berkas jejak;
    yang menentukan status adalah `ts` terbesar per id (#231), bukan urutan penggabungan. Tanpa
    penggabungan ini, usulan yang sudah dilaporkan terbaca `menunggu` lagi dan
    pacemaker membangunkan lane berulang kali untuk opsi yang digest-nya sudah dikirim (#189).
    """
    if isinstance(paths, str):
        paths = [paths]
    events = []
    for path in paths:
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                events.extend(json.loads(b) for b in f if b.strip())
    dilihat = set()
    for path in paths:
        penanda = path_status_dari_usulan(path)
        if penanda and penanda not in dilihat and os.path.exists(penanda):
            dilihat.add(penanda)
            with open(penanda, encoding="utf-8") as f:
                events.extend(json.loads(b) for b in f if b.strip())
    return [r for r in sorted(keadaan(events).values(), key=lambda r: r.get("id", ""))
            if r.get("status") == "menunggu"]

def pisah_berkas(akar, paksa=False):
    """Pecah `factory/usulan.jsonl` jadi satu berkas per lane (#217, keputusan u-HQ-f406ac opsi 2).

    Semua peristiwa satu id dipindah ke berkas lane pemilik id-nya, supaya riwayat satu id tidak
    terbelah dua berkas. Idempoten: baris yang sudah ada di berkas tujuan
    tidak ditulis ulang, dan berkas lama yang tidak ada bukan galat.
    """
    lama = path_usulan(akar)
    if not os.path.exists(lama):
        return 0, "tidak ada factory/usulan.jsonl: tidak ada yang dipisah"
    galat = periksa_penulis(akar, paksa)
    if galat:
        return 1, galat
    with open(lama, encoding="utf-8") as f:
        rows = []
        for i, b in enumerate(f, 1):
            b = b.strip()
            if not b:
                continue
            try:
                rows.append(json.loads(b))
            except json.JSONDecodeError as e:
                return 1, "usulan.jsonl baris %d bukan JSON: %s" % (i, e)
    pemilik = {}
    for e in rows:
        if e.get("event") == "usulan" and e.get("id"):
            pemilik[e["id"]] = e.get("lane")
    per_lane = {}
    yatim = []
    for e in rows:
        lane = pemilik.get(e.get("id"))
        if not lane:
            yatim.append(str(e.get("id")))
            continue
        per_lane.setdefault(lane, []).append(e)
    if yatim:
        return 1, ("id tanpa lane tidak bisa dipisah (semua peristiwanya harus ikut): %s"
                   % ", ".join(sorted(set(yatim))))
    for lane in sorted(per_lane):
        path = path_usulan(akar, lane)
        sudah = set()
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                sudah = {b.strip() for b in f if b.strip()}
        with open(path, "a", encoding="utf-8") as f:
            for e in per_lane[lane]:
                baris = json.dumps(e, ensure_ascii=False)
                if baris not in sudah:
                    f.write(baris + "\n")
    os.remove(lama)
    ringkas = ", ".join("%s=%d" % (l, len(per_lane[l])) for l in sorted(per_lane))
    return 0, "dipisah %d baris jadi %d berkas: %s" % (len(rows), len(per_lane), ringkas)


def uji_mandiri():
    """Cermin: jalur positif, jalur negatif, dan id yang tidak boleh tertukar."""
    gagal = 0
    total = 0

    def cek(nama, lolos, detail=""):
        nonlocal gagal, total
        total += 1
        print("  %s %-46s %s" % ("LULUS " if lolos else "GAGAL ", nama, detail))
        if not lolos:
            gagal += 1

    def akar_uji(tmp, lanes=("sync", "HQ")):
        os.makedirs(os.path.join(tmp, "factory"), exist_ok=True)
        with open(os.path.join(tmp, "factory", "lanes.json"), "w", encoding="utf-8") as f:
            json.dump({"versi": 1, "lane": [{"id": i, "topic": 20 + n}
                                            for n, i in enumerate(lanes)]}, f)
        return tmp

    with tempfile.TemporaryDirectory() as tmp:
        akar = akar_uji(tmp)
        kode, pesan = catat(akar, "sync", "pisah tabel sync", ["pisah", "biarkan"], 1, "blokir #55", None)
        cek("catat usulan pertama", kode == 0)
        id_sync = pesan.split()[1]
        kode, pesan = catat(akar, "HQ", "urutan lane", ["A", "B", "C"], 2, "", 92)
        cek("catat usulan kedua", kode == 0)
        id_hq = pesan.split()[1]
        rec = daftar(akar, "menunggu")
        cek("dua usulan menunggu", len(rec) == 2, "dapat %d" % len(rec))
        # Id memuat lane-nya, dan bukan nomor urut: nomor urut dari isi berkas itulah cacat #121.
        cek("id memuat lane dan berbeda satu sama lain",
            id_sync.startswith("u-sync-") and id_hq.startswith("u-HQ-") and id_sync != id_hq,
            "%s %s" % (id_sync, id_hq))

        kode, pesan = catat(akar, "tidak-ada", "x", ["A", "B"], None, "", None)
        cek("lane asing ditolak", kode == 1 and "tidak ada" in pesan)
        kode, pesan = catat(akar, "sync", "x", ["A"], None, "", None)
        cek("satu opsi ditolak", kode == 1 and "2 sampai 3" in pesan)
        kode, pesan = catat(akar, "sync", "x", ["A", "B", "C", "D"], None, "", None)
        cek("empat opsi ditolak", kode == 1 and "2 sampai 3" in pesan)
        kode, pesan = catat(akar, "sync", "x", ["A", "B"], 3, "", None)
        cek("rekomendasi di luar rentang ditolak", kode == 1 and "rentang" in pesan)
        kode, pesan = catat(akar, "sync", "   ", ["A", "B"], None, "", None)
        cek("ringkas kosong ditolak", kode == 1 and "kosong" in pesan)

        kode, pesan = putuskan(akar, id_sync, 2, "owner")
        cek("putuskan mencatat pilihan", kode == 0 and "biarkan" in pesan)
        rec = daftar(akar, "menunggu")
        cek("yang diputuskan keluar dari menunggu", len(rec) == 1 and rec[0]["id"] == id_hq)
        kode, pesan = putuskan(akar, id_sync, 1, "owner")
        cek("putuskan dua kali ditolak", kode == 1 and "sudah diputuskan" in pesan)
        kode, pesan = putuskan(akar, "u-tidak-ada-999999", 1, "owner")
        cek("id asing ditolak", kode == 1 and "tidak ada" in pesan)
        kode, pesan = putuskan(akar, id_hq, 9, "owner")
        cek("pilihan di luar rentang ditolak", kode == 1 and "rentang" in pesan)

        # Pembalikan keputusan (#164). Akar sendiri, supaya hitungan baris di blok berikutnya tidak
        # bergeser: kasus-kasus di bawah mengandalkan jumlah event yang tepat.
        akar_balik = akar_uji(os.path.join(tmp, "balik"))
        _, pesan = catat(akar_balik, "sync", "uji pembalikan", ["A", "B"], 1, "", None)
        id_balik = pesan.split()[1]
        kode, pesan = putuskan(akar_balik, id_balik, 1, "owner", ganti=True, alasan="x")
        cek("--ganti pada usulan yang belum diputuskan ditolak",
            kode == 1 and "belum diputuskan" in pesan, pesan)
        kode, pesan = putuskan(akar_balik, id_balik, 1, "owner")
        cek("keputusan pertama diterima", kode == 0, pesan)
        kode, pesan = putuskan(akar_balik, id_balik, 2, "owner", ganti=True)
        cek("--ganti tanpa --alasan ditolak", kode == 1 and "alasan" in pesan, pesan)
        sebelum_balik = len(baca_event(akar_balik))
        kode, pesan = putuskan(akar_balik, id_balik, 2, "owner", ganti=True,
                               alasan="owner menegaskan arah sebaliknya")
        cek("pembalikan diterima", kode == 0 and "DIBALIK" in pesan, pesan)
        rec_balik = keadaan(baca_event(akar_balik)).get(id_balik, {})
        cek("pembalikan mengubah pilihan yang terbaca", rec_balik.get("pilihan") == 2,
            "pilihan=%s" % rec_balik.get("pilihan"))
        cek("pembalikan menyimpan medan pengganti",
            rec_balik.get("mengganti_pilihan") == 1 and rec_balik.get("mengganti_oleh") == "owner"
            and "sebaliknya" in rec_balik.get("alasan_ganti", ""),
            "mengganti_pilihan=%s mengganti_oleh=%s" % (rec_balik.get("mengganti_pilihan"),
                                                        rec_balik.get("mengganti_oleh")))
        cek("pembalikan menulis tepat satu event", len(baca_event(akar_balik)) == sebelum_balik + 1,
            "%d baris" % len(baca_event(akar_balik)))
        kode, pesan = putuskan(akar_balik, id_balik, 1, "owner")
        cek("sesudah pembalikan, tanpa --ganti tetap ditolak",
            kode == 1 and "sudah diputuskan" in pesan, pesan)

        # CLI: `--oleh` wajib. Dulu defaultnya `owner`, jadi keputusan agent tercatat sebagai
        # keputusan owner tanpa ada yang menolak. Kasus ini menguji lapisan argparse, bukan
        # fungsinya, karena di situlah defaultnya dulu hidup.
        akar_cli = akar_uji(os.path.join(tmp, "cli"))
        _, pesan = catat(akar_cli, "sync", "uji atribusi", ["A", "B"], 1, "", None)
        id_cli = pesan.split()[1]
        sebelum = len(baca_event(akar_cli))
        r = subprocess.run([sys.executable, os.path.abspath(__file__), "--akar", akar_cli,
                            "putuskan", id_cli, "--pilihan", "1"],
                           capture_output=True, text=True)
        cek("CLI tanpa --oleh ditolak", r.returncode != 0, "exit=%d" % r.returncode)
        cek("CLI tanpa --oleh tidak menulis", len(baca_event(akar_cli)) == sebelum,
            "%d baris" % len(baca_event(akar_cli)))
        r = subprocess.run([sys.executable, os.path.abspath(__file__), "--akar", akar_cli,
                            "putuskan", id_cli, "--pilihan", "1", "--oleh", "agent"],
                           capture_output=True, text=True)
        cek("CLI dengan --oleh diterima", r.returncode == 0, "exit=%d" % r.returncode)
        cek("CLI mencatat oleh=agent",
            keadaan(baca_event(akar_cli)).get(id_cli, {}).get("oleh") == "agent")

        # CLI pembalikan (#164): `--ganti` harus sampai ke fungsinya lewat argparse, dan `--alasan`
        # ikut tersimpan. Dua-duanya hidup di lapisan CLI, bukan di `putuskan()`, jadi lapisan itu
        # diuji terpisah seperti `--oleh` di atas.
        r = subprocess.run([sys.executable, os.path.abspath(__file__), "--akar", akar_cli,
                            "putuskan", id_cli, "--pilihan", "2", "--oleh", "owner", "--ganti"],
                           capture_output=True, text=True)
        cek("CLI --ganti tanpa --alasan ditolak", r.returncode != 0, "exit=%d" % r.returncode)
        r = subprocess.run([sys.executable, os.path.abspath(__file__), "--akar", akar_cli,
                            "putuskan", id_cli, "--pilihan", "2", "--oleh", "owner",
                            "--ganti", "--alasan", "owner membalik arah"],
                           capture_output=True, text=True)
        cek("CLI pembalikan diterima", r.returncode == 0, "exit=%d %s" % (r.returncode, r.stdout.strip()[:60]))
        cek("CLI pembalikan tersimpan",
            keadaan(baca_event(akar_cli)).get(id_cli, {}).get("alasan_ganti") == "owner membalik arah")

        semua = keadaan(baca_event(akar))
        cek("keadaan menyimpan teks opsi terpilih",
            semua.get(id_sync, {}).get("teks_pilihan") == "biarkan")

        # Pembaca yang dipakai `pacemaker.py` harus melihat hal yang sama dengan `daftar()`.
        # Sebelum #189 ia membaca HANYA berkas usulan, jadi usulan yang sudah dilaporkan terbaca
        # `menunggu` lagi dan pacemaker membangunkan lane berulang kali untuk opsi yang digest-nya
        # sudah dikirim. Dua kasus di bawah mengunci kedua sisinya: sebelum ditandai ia muncul,
        # sesudah ditandai ia hilang.
        cek("menunggu_di_path melihat yang menunggu",
            [r["id"] for r in menunggu_di_paths(berkas_usulan(akar))] == [id_hq],
            "%s" % [r["id"] for r in menunggu_di_paths(berkas_usulan(akar))])

        kode, pesan = tandai_dilaporkan(akar, [id_hq, id_sync])
        cek("tandai hanya yang menunggu", kode == 0 and "1 usulan" in pesan, pesan)
        sesudah = keadaan(baca_semua(akar))
        cek("yang ditandai jadi dilaporkan",
            sesudah.get(id_hq, {}).get("status") == "dilaporkan")
        cek("yang diputuskan tidak diusik",
            sesudah.get(id_sync, {}).get("status") == "diputuskan")
        kode, pesan = tandai_dilaporkan(akar, [id_hq])
        cek("tandai ulang tidak menulis", kode == 0 and "tidak ada" in pesan, pesan)

        # Penanda `dilaporkan` tidak boleh mendarat di berkas yang dilacak git (#169). Kalau ia
        # mendarat di situ, cron mengotori pohon kanonik tiap 30 menit, dan begitu origin/main
        # menyentuh berkas yang sama `merge --ff-only` gagal permanen. Jadi dua hal diuji terpisah:
        # berkas terlacak tetap 3 baris (2 catat + 1 putuskan), dan penandanya ada di berkas lain.
        cek("berkas terlacak hanya peristiwa yang perlu di-commit", len(baca_event(akar)) == 3,
            "%d baris" % len(baca_event(akar)))
        cek("penanda dilaporkan ada di berkas tidak terlacak", len(baca_status(akar)) == 1,
            "%d baris" % len(baca_status(akar)))
        # Dan status gabungannya tetap terbaca, jadi memisahkan berkasnya tidak menghilangkan apa pun.
        cek("status gabungan membaca kedua berkas",
            keadaan(baca_semua(akar)).get(id_hq, {}).get("status") == "dilaporkan"
            and len(daftar(akar, "dilaporkan")) == 1,
            "%d dilaporkan" % len(daftar(akar, "dilaporkan")))
        # Usulan yang dilaporkan tidak boleh terkirim ulang: itu fungsi penanda ini sejak awal.
        cek("yang dilaporkan tidak masuk daftar menunggu",
            [r["id"] for r in daftar(akar, "menunggu")] == [], 
            "%s" % [r["id"] for r in daftar(akar, "menunggu")])

        # Sisi kedua dari kasus yang sama: pembaca pacemaker harus ikut berhenti melihatnya.
        cek("menunggu_di_path tidak lagi melihat yang dilaporkan",
            menunggu_di_paths(berkas_usulan(akar)) == [],
            "%s" % [r["id"] for r in menunggu_di_paths(berkas_usulan(akar))])
        # Dua pembaca status yang berbeda harus sepakat: `pacemaker.py` memakai `menunggu_di_path`,
        # sedangkan `daftar()` (dipakai gate dan manusia) memakai `baca_semua()`. Perbedaan keduanya
        # adalah akar #189, jadi kesepakatannya diuji langsung, bukan cuma masing-masing sisinya.
        cek("kedua pembaca status sepakat",
            [r["id"] for r in menunggu_di_paths(berkas_usulan(akar))]
            == [r["id"] for r in daftar(akar, "menunggu")],
            "pacemaker=%s daftar=%s" % ([r["id"] for r in menunggu_di_paths(berkas_usulan(akar))],
                                        [r["id"] for r in daftar(akar, "menunggu")]))

        # #231: urutan yang NORMAL justru yang salah baca. Sebuah usulan DILAPORKAN dulu (penanda di
        # berkas tidak terlacak, ditulis `lapor.py` dari cron), lalu DIPUTUSKAN (peristiwa di berkas
        # terlacak). Lipat-menurut-posisi menaruh penanda di belakang, jadi keputusan yang lebih baru
        # kalah dan statusnya macet `dilaporkan` selamanya. Terukur 2026-10-11 di data repo: 9 dari 45
        # id salah baca, dan `daftar --status dilaporkan` menyodorkan 11 opsi sebagai "menunggu
        # keputusan" padahal 9 di antaranya sudah diputuskan. Akar sendiri supaya hitungan baris blok
        # di atas tidak bergeser.
        akar_urut = akar_uji(os.path.join(tmp, "urut"))
        _, pesan = catat(akar_urut, "sync", "dilaporkan lalu diputuskan", ["A", "B"], 1, "", None)
        id_urut = pesan.split()[1]
        _, pesan = catat(akar_urut, "sync", "dilaporkan saja", ["A", "B"], 1, "", None)
        id_urut2 = pesan.split()[1]
        kode, pesan = tandai_dilaporkan(akar_urut, [id_urut, id_urut2])
        cek("dua usulan ditandai dilaporkan", kode == 0 and "2 usulan" in pesan, pesan)
        cek("sesudah ditandai terbaca dilaporkan",
            keadaan(baca_semua(akar_urut)).get(id_urut, {}).get("status") == "dilaporkan")
        kode, pesan = putuskan(akar_urut, id_urut, 2, "owner")
        cek("keputusan diterima walau sudah dilaporkan", kode == 0, pesan)
        # Di sinilah bug #231 muncul. Kasus ini GAGAL pada kode sebelum perbaikan: statusnya tetap
        # `dilaporkan` walau keputusannya ber-ts lebih baru.
        rec_urut = keadaan(baca_semua(akar_urut))
        cek("dilaporkan LALU diputuskan terbaca diputuskan",
            rec_urut.get(id_urut, {}).get("status") == "diputuskan",
            "terbaca=%s" % rec_urut.get(id_urut, {}).get("status"))
        cek("medan keputusannya ikut terbaca, bukan cuma statusnya",
            rec_urut.get(id_urut, {}).get("pilihan") == 2
            and rec_urut.get(id_urut, {}).get("oleh") == "owner",
            "pilihan=%s oleh=%s" % (rec_urut.get(id_urut, {}).get("pilihan"),
                                    rec_urut.get(id_urut, {}).get("oleh")))
        cek("yang cuma dilaporkan tetap dilaporkan",
            rec_urut.get(id_urut2, {}).get("status") == "dilaporkan")
        cek("daftar dilaporkan tinggal satu",
            [r["id"] for r in daftar(akar_urut, "dilaporkan")] == [id_urut2],
            "%s" % [r["id"] for r in daftar(akar_urut, "dilaporkan")])
        # Pembaca pacemaker harus sepakat untuk urutan INI juga, bukan cuma untuk urutan lama.
        cek("kedua pembaca sepakat pada urutan dilaporkan-lalu-diputuskan",
            [r["id"] for r in menunggu_di_paths(berkas_usulan(akar_urut))] == [],
            "pacemaker=%s" % [r["id"] for r in menunggu_di_paths(berkas_usulan(akar_urut))])
        # Arah sebaliknya, supaya perbaikannya tidak berubah jadi "keputusan selalu menang": penanda
        # yang BENAR-BENAR lebih baru tetap menang. Ditulis manual karena `tandai_dilaporkan` menolak
        # menandai yang sudah diputuskan, jadi jalur normal tidak bisa menghasilkan bentuk ini.
        _, pesan = catat(akar_urut, "sync", "keputusan lalu penanda baru", ["A", "B"], 1, "", None)
        id_urut3 = pesan.split()[1]
        putuskan(akar_urut, id_urut3, 1, "owner")
        with open(path_status(akar_urut), "a", encoding="utf-8") as f:
            f.write(json.dumps({"event": "dilaporkan", "id": id_urut3,
                                "ts": "2099-01-01T00:00:00+07:00", "status": "dilaporkan"}) + "\n")
        cek("penanda yang benar-benar lebih baru menang atas keputusan",
            keadaan(baca_semua(akar_urut)).get(id_urut3, {}).get("status") == "dilaporkan",
            "terbaca=%s" % keadaan(baca_semua(akar_urut)).get(id_urut3, {}).get("status"))
        # Seri `ts` (resolusi detik): keputusan harus menang, bukan kalah karena posisi. Tanpa
        # peringkat event, penanda yang ditulis pada detik yang sama akan menang di sini.
        _, pesan = catat(akar_urut, "sync", "ts seri", ["A", "B"], 1, "", None)
        id_urut4 = pesan.split()[1]
        with open(path_status(akar_urut), "a", encoding="utf-8") as f:
            f.write(json.dumps({"event": "dilaporkan", "id": id_urut4,
                                "ts": "2099-06-01T00:00:00+07:00", "status": "dilaporkan"}) + "\n")
        with open(os.path.join(akar_urut, "factory", "usulan-sync.jsonl"), "a",
                  encoding="utf-8") as f:
            f.write(json.dumps({"event": "diputuskan", "id": id_urut4,
                                "ts": "2099-06-01T00:00:00+07:00", "pilihan": 1,
                                "oleh": "owner"}) + "\n")
        cek("ts seri dimenangkan keputusan",
            keadaan(baca_semua(akar_urut)).get(id_urut4, {}).get("status") == "diputuskan",
            "terbaca=%s" % keadaan(baca_semua(akar_urut)).get(id_urut4, {}).get("status"))
        # Peristiwa tanpa `ts` dianggap paling tua, jadi penanda cacat tidak membungkam keputusan.
        _, pesan = catat(akar_urut, "sync", "tanpa ts", ["A", "B"], 1, "", None)
        id_urut5 = pesan.split()[1]
        with open(os.path.join(akar_urut, "factory", "usulan-sync.jsonl"), "a",
                  encoding="utf-8") as f:
            f.write(json.dumps({"event": "diputuskan", "id": id_urut5,
                                "ts": "2099-07-01T00:00:00+07:00", "pilihan": 2,
                                "oleh": "owner"}) + "\n")
        with open(path_status(akar_urut), "a", encoding="utf-8") as f:
            f.write(json.dumps({"event": "dilaporkan", "id": id_urut5}) + "\n")
        cek("penanda tanpa ts tidak membungkam keputusan",
            keadaan(baca_semua(akar_urut)).get(id_urut5, {}).get("status") == "diputuskan",
            "terbaca=%s" % keadaan(baca_semua(akar_urut)).get(id_urut5, {}).get("status"))

        # Berkas penanda diturunkan dari direktori berkas usulan. Layout di luar `factory/` (mis.
        # berkas di direktori sementara) tidak boleh berubah perilakunya, dan tidak boleh meledak
        # saat berkas penandanya tidak ada.
        lepas = os.path.join(tmp, "usulan-lepas.jsonl")
        with open(lepas, "w", encoding="utf-8") as f:
            f.write(json.dumps({"event": "usulan", "id": "u-HQ-999999", "lane": "HQ",
                                "ringkas": "di luar layout factory", "opsi": ["A", "B"]}) + "\n")
        cek("layout tanpa factory/ tetap membaca berkasnya",
            [r["id"] for r in menunggu_di_path(lepas)] == ["u-HQ-999999"],
            "%s" % [r["id"] for r in menunggu_di_path(lepas)])

        # Dua salinan berkas terpisah, masing-masing mencatat satu usulan, lalu digabung. Sebelum
        # #121 keduanya mendapat id yang sama, dan setelah digabung yang satu menimpa yang lain tanpa
        # error apa pun, karena satu id cuma menyimpan satu status. Dua salinan
        # dari lane yang SAMA dipakai di sini dengan sengaja: prefiks lane saja belum cukup menutup
        # kasus itu, akar acaknya yang menutup.
        salinan_a = akar_uji(os.path.join(tmp, "salinan-a"))
        salinan_b = akar_uji(os.path.join(tmp, "salinan-b"))
        _, pesan_a = catat(salinan_a, "sync", "dari salinan a", ["A", "B"], 1, "", None)
        _, pesan_b = catat(salinan_b, "sync", "dari salinan b", ["A", "B"], 1, "", None)
        id_a, id_b = pesan_a.split()[1], pesan_b.split()[1]
        cek("dua salinan lane sama tidak dapat id sama", id_a != id_b, "%s %s" % (id_a, id_b))
        gabung = akar_uji(os.path.join(tmp, "gabung"))
        with open(path_usulan(gabung), "w", encoding="utf-8") as f:
            for p in (salinan_a, salinan_b):
                with open(berkas_usulan(p)[0], encoding="utf-8") as g:
                    f.write(g.read())
        rec = daftar(gabung, None)
        cek("gabungan memuat dua usulan, bukan satu", len(rec) == 2, "%d" % len(rec))

        # Tulis hanya ke salinan pemanggil (#121). Kasus ini butuh repo git sungguhan: pemeriksanya
        # membandingkan branch worktree tujuan dengan branch pemanggil, dan akar repo diturunkan dari
        # lokasi skrip, jadi lane yang memanggil skrip dari worktree-nya sendiri menulis ke worktree
        # bersama. Tulisannya tidak ter-commit dan hilang pada `git checkout .` berikutnya.
        def repo_git(path, branch):
            subprocess.run(["git", "init", "-q", path], check=True)
            subprocess.run(["git", "-C", path, "symbolic-ref", "HEAD", "refs/heads/%s" % branch],
                           check=True)
            subprocess.run(["git", "-C", path, "-c", "user.email=uji@contoh", "-c",
                            "user.name=uji", "commit", "-q", "--allow-empty", "-m", "awal"],
                           check=True)
            return path

        tujuan = akar_uji(repo_git(os.path.join(tmp, "repo-tujuan"), "main"))
        pemanggil = repo_git(os.path.join(tmp, "repo-pemanggil"), "lane-lain")
        skrip = os.path.abspath(__file__)
        argv = [sys.executable, skrip, "--akar", tujuan, "catat", "--lane", "sync",
                "--ringkas", "dari worktree lain", "--opsi", "A", "--opsi", "B"]
        r = subprocess.run(argv, cwd=pemanggil, capture_output=True, text=True)
        cek("tulis ke worktree lain ditolak",
            r.returncode != 0 and "bukan worktree pemanggil" in r.stdout,
            "exit=%d %s" % (r.returncode, r.stdout.strip()[:60]))
        cek("tulisan yang ditolak tidak mendarat", baca_event(tujuan) == [],
            "%d baris" % len(baca_event(tujuan)))
        r = subprocess.run(argv + ["--paksa"], cwd=pemanggil, capture_output=True, text=True)
        cek("--paksa menembus penjaga", r.returncode == 0,
            "exit=%d %s" % (r.returncode, r.stdout.strip()[:60]))
        # Penjaga tidak boleh menyalak saat branch pemanggil tidak bisa ditentukan: uji mandiri
        # memakai direktori sementara, dan cron menjalankan alat ini dari luar repo.
        luar = os.path.join(tmp, "bukan-repo")
        os.makedirs(luar, exist_ok=True)
        r = subprocess.run(argv, cwd=luar, capture_output=True, text=True)
        cek("pemanggil di luar repo dilanjutkan", r.returncode == 0,
            "exit=%d %s" % (r.returncode, r.stdout.strip()[:60]))

        # Id kembar dengan isi berbeda (#144). Id urut per pohon sudah diganti id lane + akar acak
        # (#121), tapi itu mencegah tabrakan baru, bukan menangkap yang sudah masuk lewat
        # penggabungan. Tanpa penolakan ini yang menang entri ber-`ts` terbesar, dan usulan lain hilang
        # tanpa error: berkas ini dipakai untuk menjawab "siapa memutuskan apa".
        kembar = akar_uji(os.path.join(tmp, "kembar"))
        satu = {"event": "usulan", "id": "u-sync-aaaaaa", "ts": "2026-10-10T00:00:00+07:00",
                "lane": "sync", "ringkas": "usulan pertama", "opsi": ["A", "B"],
                "rekomendasi": 1, "status": "menunggu"}
        dua = dict(satu, ringkas="usulan LAIN dengan id yang sama", lane="HQ")
        with open(path_usulan(kembar), "w", encoding="utf-8") as f:
            for e in (satu, dua):
                f.write(json.dumps(e, ensure_ascii=False) + "\n")
        cek("detektor menemukan id kembar berisi beda", tabrakan(baca_event(kembar)) == ["u-sync-aaaaaa"],
            str(tabrakan(baca_event(kembar))))
        kode, pesan = catat(kembar, "sync", "usulan baru", ["A", "B"], 1, "", None)
        cek("catat ditolak saat ada id kembar", kode == 1 and "kembar" in pesan, pesan[:70])
        kode, pesan = putuskan(kembar, "u-sync-aaaaaa", 1, "agent")
        cek("putuskan ditolak saat ada id kembar", kode == 1 and "kembar" in pesan, pesan[:70])
        cek("penolakan tidak menulis apa pun", len(baca_event(kembar)) == 2,
            "%d baris" % len(baca_event(kembar)))
        # Kontrol negatif: salinan IDENTIK dari pohon yang sama bukan tabrakan, dan harus tetap lolos.
        # Tanpa kasus ini, detektor yang menyalak pada apa pun akan terlihat benar.
        sama = akar_uji(os.path.join(tmp, "sama"))
        with open(path_usulan(sama), "w", encoding="utf-8") as f:
            for e in (satu, satu):
                f.write(json.dumps(e, ensure_ascii=False) + "\n")
        cek("salinan identik bukan tabrakan", tabrakan(baca_event(sama)) == [],
            str(tabrakan(baca_event(sama))))
        kode, _ = catat(sama, "sync", "usulan baru", ["A", "B"], 1, "", None)
        cek("catat tetap jalan pada salinan identik", kode == 0)

        # #217 (keputusan agent u-HQ-f406ac opsi 2): jejak dipecah per lane. Yang dikunci di sini
        # janji pokoknya, bukan bentuk berkasnya: dua lane TIDAK menyentuh berkas yang sama.
        pisah217 = akar_uji(os.path.join(tmp, "pisah217"))
        catat(pisah217, "sync", "usulan sync", ["A", "B"], 1, "", None)
        catat(pisah217, "HQ", "usulan hq", ["A", "B"], 1, "", None)
        cek("lane menulis berkasnya sendiri, bukan berkas bersama",
            os.path.exists(os.path.join(pisah217, "factory", "usulan-sync.jsonl"))
            and os.path.exists(os.path.join(pisah217, "factory", "usulan-HQ.jsonl"))
            and not os.path.exists(os.path.join(pisah217, "factory", "usulan.jsonl")))
        cek("dua berkas lane terbaca sebagai satu jejak", len(baca_event(pisah217)) == 2,
            "%d baris" % len(baca_event(pisah217)))
        cek("berkas_usulan mengembalikan dua berkas", len(berkas_usulan(pisah217)) == 2)
        m217 = menunggu_di_paths(berkas_usulan(pisah217))
        cek("menunggu_di_paths melihat semua berkas", len(m217) == 2, "%d" % len(m217))
        # `putuskan` harus mendarat di berkas yang memuat entri `usulan`-nya. Sejak #231 status tidak
        # lagi bergantung urutan baca lintas berkas (yang menang `ts` terbesar), tapi riwayat satu id
        # yang terbelah dua berkas tetap merugikan: `grep` dan mata manusia kehilangan separuhnya.
        pilih = m217[0]
        jalur = berkas_pemilik(pisah217, pilih["id"]) or ""
        cek("berkas_pemilik menunjuk berkas lane-nya",
            jalur.endswith("usulan-%s.jsonl" % pilih["lane"]), jalur)
        kode, _ = putuskan(pisah217, pilih["id"], 1, "agent")
        cek("putuskan berhasil di berkas per lane", kode == 0)
        baris_jalur = -1
        if jalur and os.path.exists(jalur):
            with open(jalur, encoding="utf-8") as f:
                baris_jalur = f.read().count(chr(10))
        cek("hanya berkas pemilik yang bertambah", baris_jalur == 2, "%d baris" % baris_jalur)
        cek("status terbaca dari berkas pemilik",
            [r["id"] for r in daftar(pisah217, "diputuskan")] == [pilih["id"]])
        lain = "sync" if pilih["lane"] == "HQ" else "HQ"
        baris_lain = -1
        p_lain = path_usulan(pisah217, lain)
        if os.path.exists(p_lain):
            with open(p_lain, encoding="utf-8") as f:
                baris_lain = f.read().count(chr(10))
        cek("berkas lane lain tidak tersentuh", baris_lain == 1, "%d baris" % baris_lain)

        # Migrasi berkas bersama jadi per lane: seluruh baris harus ikut, dan peristiwa satu id tidak
        # boleh terbelah dua berkas.
        mig217 = akar_uji(os.path.join(tmp, "mig217"))
        u1 = {"event": "usulan", "id": "u-0001", "ts": "2026-10-10T00:00:00+07:00", "lane": "sync",
              "ringkas": "lama sync", "opsi": ["A", "B"], "rekomendasi": 1, "status": "menunggu"}
        u2 = {"event": "usulan", "id": "u-0002", "ts": "2026-10-10T00:00:01+07:00", "lane": "HQ",
              "ringkas": "lama hq", "opsi": ["A", "B"], "rekomendasi": 1, "status": "menunggu"}
        k1 = {"event": "diputuskan", "id": "u-0001", "ts": "2026-10-10T01:00:00+07:00",
              "pilihan": 1, "teks_pilihan": "A", "oleh": "owner"}
        with open(path_usulan(mig217), "w", encoding="utf-8") as f:
            for e in (u1, u2, k1):
                f.write(json.dumps(e, ensure_ascii=False) + chr(10))
        kode, pesan = pisah_berkas(mig217)
        cek("pisah-berkas melaporkan jumlah baris", kode == 0 and "3 baris" in pesan, pesan[:70])
        cek("berkas bersama dihapus", not os.path.exists(path_usulan(mig217)))
        cek("seluruh baris pindah", len(baca_event(mig217)) == 3,
            "%d baris" % len(baca_event(mig217)))
        cek("peristiwa satu id tidak terbelah",
            len([e for e in baca_event(mig217) if e.get("id") == "u-0001"]) == 2)
        cek("status per id tetap terbaca",
            keadaan(baca_event(mig217)).get("u-0001", {}).get("status") == "diputuskan")
        kode, pesan = pisah_berkas(mig217)
        cek("pisah-berkas idempoten", kode == 0 and len(baca_event(mig217)) == 3, pesan[:60])

    print("")
    print("UJI MANDIRI: %d kasus, %d gagal" % (total, gagal))
    return gagal

def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=u.akar_factory())
    p.add_argument("--uji-mandiri", action="store_true")
    p.add_argument("--periksa", action="store_true",
                   help="periksa id kembar dengan isi berbeda di berkas jejak usulan (#144, #217)")
    sub = p.add_subparsers(dest="cmd")

    c = sub.add_parser("catat")
    c.add_argument("--lane", required=True)
    c.add_argument("--ringkas", required=True)
    c.add_argument("--opsi", action="append", default=[], required=True)
    c.add_argument("--rekomendasi", type=int)
    c.add_argument("--dampak-tunda", default="")
    c.add_argument("--issue", type=int)
    c.add_argument("--paksa", action="store_true",
                   help="tulis walau worktree tujuan bukan worktree pemanggil (#121)")

    d = sub.add_parser("daftar")
    d.add_argument("--status", choices=STATUS)
    d.add_argument("--json", action="store_true")

    m = sub.add_parser("pisah-berkas",
                       help="pecah factory/usulan.jsonl jadi factory/usulan-<lane>.jsonl (#217)")
    m.add_argument("--paksa", action="store_true",
                   help="tulis walau worktree tujuan bukan worktree pemanggil (#121)")

    k = sub.add_parser("putuskan")
    k.add_argument("id")
    k.add_argument("--pilihan", type=int, required=True)
    k.add_argument("--oleh", required=True)
    k.add_argument("--ganti", action="store_true",
                   help="catat keputusan yang BERBALIK arah; wajib disertai --alasan (#164)")
    k.add_argument("--alasan", default="",
                   help="alasan pembalikan, tersimpan sebagai alasan_ganti (#164)")
    k.add_argument("--paksa", action="store_true",
                   help="tulis walau worktree tujuan bukan worktree pemanggil (#121)")

    a = p.parse_args()
    if a.uji_mandiri:
        return 1 if uji_mandiri() else 0
    akar = os.path.abspath(os.path.expanduser(a.akar))

    if a.periksa:
        kembar = tabrakan(baca_event(akar))
        if kembar:
            print("GAGAL  id kembar dengan isi berbeda: %s" % ", ".join(kembar))
            print("       keputusan pada id itu bisa mendarat di usulan yang bukan dimaksud. "
                  "Beri id baru ke salah satunya.")
            return 1
        jumlah = len({e["id"] for e in baca_event(akar)
                      if e.get("event") == "usulan" and e.get("id")})
        print("LULUS  tidak ada id kembar: %d usulan ber-id unik" % jumlah)
        return 0

    if a.cmd == "catat":
        kode, pesan = catat(akar, a.lane, a.ringkas, a.opsi, a.rekomendasi, a.dampak_tunda,
                            a.issue, a.paksa)
        print(("USULAN  " if kode == 0 else "GAGAL   ") + pesan)
        return kode
    if a.cmd == "putuskan":
        kode, pesan = putuskan(akar, a.id, a.pilihan, a.oleh, a.paksa, a.ganti, a.alasan)
        print(("PUTUS   " if kode == 0 else "GAGAL   ") + pesan)
        return kode
    if a.cmd == "daftar":
        rec = daftar(akar, a.status)
        if a.json:
            print(json.dumps(rec, ensure_ascii=False, indent=2))
            return 0
        if not rec:
            print("tidak ada usulan%s" % (" berstatus %s" % a.status if a.status else ""))
            return 0
        for r in rec:
            print("%s  [%s/%s] %s" % (r["id"], r.get("lane", "?"), r.get("status", "?"),
                                      r.get("ringkas", "")))
            for n, o in enumerate(r.get("opsi", []), 1):
                tanda = "->" if r.get("rekomendasi") == n else "  "
                print("     %s %d. %s" % (tanda, n, o))
            if r.get("dampak_tunda"):
                print("     dampak tunda: %s" % r["dampak_tunda"])
        return 0
    if a.cmd == "pisah-berkas":
        kode, pesan = pisah_berkas(akar, a.paksa)
        print(("PISAH   " if kode == 0 else "GAGAL   ") + pesan)
        return kode
    p.print_help()
    return 2

if __name__ == "__main__":
    sys.exit(main())
