#!/usr/bin/env python3
"""pacemaker.py - bangunkan sesi lane hanya kalau ada kerjaan, tanpa satu pun token LLM.

Kenapa ada: sesi lane yang menunggu tidak bangun sendiri. Tanpa denyut berkala, dispatch berhenti
begitu operator berhenti mengetik, dan factory yang "otonom" itu sebenarnya dijalankan tangan.
Tapi cron yang bangun tiap 15 menit dan bilang "tidak ada apa-apa" itu bakar token untuk nol
informasi: satu tick cron OpenCrabs terukur ~60 ribu token input (~$0.18) karena system prompt dan
brain file dibayar ulang tiap bangun.

Jadi berkas ini memisahkan GATE dari LLM. Gate-nya Python + `gh`, nol token:

  1. baca sinyal kerja (PR dengan check merah, issue terbuka tanpa label lane)
  2. tidak ada sinyal              -> keluar, nol token
  3. sinyal sama seperti run lalu  -> keluar, nol token (state berkas)
  4. sinyal baru + sesi lane ada   -> `opencrabs session notify`, dan HANYA di sini token dibayar

Yang dibayar pun bukan sesi cron baru: notify masuk ke sesi lane yang sudah ada, jadi konteksnya
konteks lane itu, bukan sesi sekali pakai.

Notify-nya selalu membawa `ATURAN_KEPUTUSAN`: lane tidak boleh menanyakan keputusan langsung ke
owner, karena pesan "ada keputusan menunggu" tanpa alamat akan dijawab lane dengan bertanya ke owner
(kejadian 2026-10-10 05:40 WIB, lane HQ menembus pintu LAW 8.5).

Berkas ini tidak pernah menulis ke repo. State-nya di luar repo, karena itu state runtime mesin ini,
bukan artefak proyek.

Cara pakai:
  python3 tools/factory/pacemaker.py --kering        putuskan saja, jangan panggil apa pun
  python3 tools/factory/pacemaker.py                 jalankan
  python3 tools/factory/pacemaker.py --paksa         abaikan state, bangunkan kalau ada sinyal
  python3 tools/factory/pacemaker.py --uji-mandiri
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile

DIR_INI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_INI)
import _umum as u  # noqa: E402
import cek_lane  # noqa: E402
import gate_pr_link  # noqa: E402
import usulan  # noqa: E402

STATE_BAWAAN = u.jalur_state("pacemaker")
LABEL_LANE = "lane:"

def path_state_lane(state_path, lane_id):
    """Berkas state dedup untuk satu lane.

    Fan-out tidak bisa memakai SATU berkas state bersama: tiap lane menulis digest-nya sendiri ke
    berkas yang sama, jadi lane A menulis digest_A, lane B melihat digest_A != digest_B lalu bangun
    dan menulis digest_B, dan tick berikutnya lane A bangun lagi. Hasilnya tiap lane dibangunkan
    tiap tick, bukan tiap ada perubahan: justru kebisingan yang gate ini ada untuk mencegahnya.
    HQ memakai berkas lama supaya state yang sudah ada tidak hilang saat rilis ini mendarat.
    """
    if lane_id in (None, "HQ"):
        return state_path
    dasar, ext = os.path.splitext(state_path)
    return "%s-%s%s" % (dasar, lane_id, ext)

LABEL_ESKALASI = "eskalasi"
# Label terminal ketiga (#142, keputusan agent u-HQ-8fd82e opsi 1). Issue yang usulannya sudah
# diputuskan atau sudah dilaporkan ke owner tidak bisa dikerjakan lane sampai keputusan itu turun,
# jadi melaporkannya cuma membangunkan lane untuk sinyal yang tidak bisa dieksekusi: bentuk
# kebisingan yang sama dengan `eskalasi` (#97). Label ini sudah ada di repo dan nol dipakai; lane
# memasangnya saat usulan terkait sudah diputuskan atau dilaporkan. Dipilih sebagai state yang bisa
# dibaca langsung, bukan peta issue-ke-usulan yang belum ada dan rawan basi.
LABEL_BLOCKED = "ai-blocked"
# Label terminal keempat (keputusan agent u-HQ-52b3f1 opsi 1). Issue INDUK/EPIC tidak punya PR
# sendiri karena kerjanya dipecah ke turunan (#255-258 dari #253), jadi sinyal "nol PR terbuka"
# adalah false positive di sini: turunannya sudah menyalakan sinyal yang sama, dan melaporkan
# induknya cuma membangunkan lane untuk kerjaan yang bukan miliknya. Kelasnya sama dengan
# `eskalasi`/`ai-blocked`: tidak ada langkah lane yang bisa diambil PADA issue itu sendiri.
LABEL_INDUK = "induk"

# Rujukan issue di judul, badan, atau nama branch PR. NALARNYA TIDAK DISALIN LAGI di sini: ia diimpor
# dari `gate_pr_link.nomor_deklarasi`, satu-satunya tempat yang menjawab "issue nomor berapa yang
# dinyatakan PR ini sebagai tanggungannya?" (#142, keputusan agent u-HQ-719710 opsi 1). Sebelum ini
# pacemaker memakai pola `#N` apa adanya, jadi PR yang sekadar MENYEBUT `#55` sudah cukup memadamkan
# sinyal issue #55 tanpa mengerjakannya. Sekarang yang dihitung cuma rujukan yang menyatakan diri:
# klaim penutup berbahasa Inggris (`Closes`/`Fixes`/`Resolves #N`) dan rujukan non-penutup
# (`Refs #N`), dengan kutipan di dalam backtick dilewati. Klaim berbahasa Indonesia ("Menutup #N")
# tidak dihitung justru karena GitHub tidak memprosesnya: issue-nya tetap terbuka, jadi sinyalnya
# harus tetap menyala.


def nomor_di(teks):
    return gate_pr_link.nomor_deklarasi(teks)

# Teks aturan yang WAJIB ikut tiap notify ke lane. Kenapa ada: 2026-10-10 05:40 WIB pacemaker
# membangunkan lane HQ dengan "ada yang menunggu keputusan" tanpa menyebut ke mana keputusan itu
# pergi, dan lane menanyakannya langsung ke OWNER lewat `suggest_options` (tombolnya muncul di
# topic 23). Sumbernya bukan niat lane, tapi teks notify ini: pesan yang bilang "ada keputusan
# menunggu" tanpa alamat akan dicarikan alamat sendiri oleh penerimanya. Aturan ikut di sini supaya
# tiap bangun membawa alamatnya, tanpa bergantung pada konteks lane yang bisa basi.
ATURAN_KEPUTUSAN = (
    "Aturan keputusan: kerjakan yang bisa kamu putuskan sendiri. Keputusan yang bukan milikmu\n"
    "dicatat lewat `python3 tools/factory/usulan.py catat`; agent yang mengantarkan ke owner.\n"
    "JANGAN memanggil `suggest_options` - itu menanyakan keputusan langsung ke owner, dilarang\n"
    "`factory/LAW.md` 8.5."
)

def jalan(cmd):
    """Jalankan perintah, kembalikan (exit_code, stdout, stderr). Tidak pernah melempar."""
    try:
        h = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError) as e:
        return 127, "", str(e)
    return h.returncode, h.stdout, h.stderr

def slug_repo(akar):
    """owner/nama repo. Dari remote origin, dan kalau tidak ada dari `repo.github` di identitas.

    Fallback-nya penting untuk mesin yang dipasang di proyek baru: pohon yang di-clone lokal, atau
    yang remote-nya bernama lain, tidak punya `origin`, dan tanpa fallback pacemaker-nya diam
    selamanya dengan alasan yang terbaca seperti kerusakan repo. Identitas proyek sudah memegang
    repo mana yang jadi papan tugasnya, jadi nilainya dipakai kalau git tidak bisa menjawab.
    """
    kode, keluar = u.git(akar, "remote", "get-url", "origin")
    if kode != 0 or not keluar.strip():
        try:
            # Dibaca dari `akar`, bukan dari repo tempat skrip ini hidup: yang diperiksa adalah
            # pohon yang dijalankan cron, dan di produksi keduanya memang pohon yang sama.
            dari_identitas = u.idn("repo.github", akar=akar)
        except (OSError, ValueError):
            return None
        return dari_identitas or None
    url = keluar.strip()
    if url.endswith(".git"):
        url = url[:-4]
    if ":" in url and not url.startswith("http"):
        url = url.split(":", 1)[1]
    bagian = [b for b in url.split("/") if b]
    if len(bagian) < 2:
        return None
    return "/".join(bagian[-2:])

def sinyal(akar, gh_bin, path_usulan=None, lane_id=None):
    """Kembalikan (daftar_sinyal, masalah). Masalah bukan sinyal: gate yang rusak tidak bangunkan apa pun.

    `lane_id` menyaring sinyal 3 supaya tiap lane cuma dibangunkan oleh kerjaannya sendiri:
    `None`/`HQ` = perilaku lama (sinyal 3 global, HQ mengawasi seluruh lane), lane lain = cuma
    issue berlabel `lane:<lane_id>`. Sinyal 1, 2, dan 4 cuma dikirim ke HQ: PR merah, issue belum
    berlabel, dan opsi menunggu keputusan tidak punya pemilik lane yang bisa dibaca dari sinyalnya,
    jadi mengirimnya ke lane modul cuma membangunkan lane untuk kerjaan yang bukan miliknya. HQ
    tetap menerima sinyal 3 SELURUH lane, supaya lane yang sesinya mati kelihatan dari HQ dan bukan
    jadi lubang yang cuma terlihat oleh dirinya sendiri.
    """
    # gh menebak repo dari direktori kerja, dan cron menjalankannya dari $HOME: tanpa --repo
    # perintahnya mati dengan "fatal: not a git repository" dan gate-nya diam selamanya. Diukur
    # 2026-10-09, dijalankan dari /tmp.
    slug = slug_repo(akar)
    if slug is None:
        return [], ("tidak bisa membaca repo dari %s: tidak ada remote origin, dan identitas "
                    "proyek tidak memuat repo.github" % akar)

    kode, keluar, galat = jalan([gh_bin, "issue", "list", "--repo", slug, "--state", "open",
                                 "--limit", "100", "--json", "number,title,labels"])
    if kode != 0:
        return [], "gh issue list gagal (exit %d): %s" % (kode, (galat or keluar).strip()[:200])
    try:
        issues = json.loads(keluar or "[]")
    except json.JSONDecodeError as e:
        return [], "keluaran gh issue list bukan JSON: %s" % e

    # `body` dan `headRefName` ikut dibaca karena sinyal keempat (#142) mencocokkan rujukan issue di
    # ketiganya, sama seperti yang dituntut gate_pr_link ke setiap PR repo ini.
    kode, keluar, galat = jalan([gh_bin, "pr", "list", "--repo", slug, "--state", "open",
                                 "--limit", "50", "--json",
                                 "number,title,body,headRefName,statusCheckRollup"])
    if kode != 0:
        return [], "gh pr list gagal (exit %d): %s" % (kode, (galat or keluar).strip()[:200])
    try:
        prs = json.loads(keluar or "[]")
    except json.JSONDecodeError as e:
        return [], "keluaran gh pr list bukan JSON: %s" % e

    daftar = []
    # Sinyal yang cakupannya tidak bisa dibaca dari sinyalnya sendiri (PR merah, issue belum
    # berlabel, opsi menunggu keputusan) cuma dikirim ke pengawas. HQ = pengawas.
    pengawas = lane_id in (None, "HQ")

    merah = []
    for pr in prs:
        for cek in (pr.get("statusCheckRollup") or []):
            kesimpulan = (cek.get("conclusion") or cek.get("state") or "").upper()
            if kesimpulan in ("FAILURE", "ERROR", "TIMED_OUT", "STARTUP_FAILURE"):
                merah.append(pr["number"])
                break
    if merah and pengawas:
        daftar.append("PR dengan check merah: %s" % ", ".join("#%d" % n for n in sorted(merah)))

    # `eskalasi` diperlakukan sebagai label terminal, sama seperti label lane. Kenapa: issue yang
    # menyentuh path eskalasi (.github/workflows, installer, rilis) langkah berikutnya adalah
    # persetujuan OWNER, bukan kerja lane, jadi tidak ada lane yang bisa ditugaskan sebelum owner
    # memutuskan. Sebelum ini pacemaker menghitungnya "belum berlabel lane" selamanya, dan tiap
    # 20 menit membangunkan lane untuk sinyal yang tidak bisa dikerjakan siapa pun (#97).
    # `ai-blocked` sama kelasnya dan diperlakukan sama (#142): usulannya sudah diputuskan atau sudah
    # dilaporkan ke owner, jadi langkah berikutnya bukan kerja lane. Tanpa ini, issue yang usulannya
    # sudah diantar tetap muncul sebagai "belum berlabel lane" dan sebagai sinyal 3 sekaligus.
    tanpa_lane = []
    for isu in issues:
        label = [l.get("name", "") for l in (isu.get("labels") or [])]
        if any(n.startswith(LABEL_LANE)
               or n in (LABEL_ESKALASI, LABEL_BLOCKED, LABEL_INDUK) for n in label):
            continue
        tanpa_lane.append(isu["number"])
    if tanpa_lane and pengawas:
        daftar.append("%d issue terbuka belum berlabel %s: %s"
                      % (len(tanpa_lane), LABEL_LANE, ", ".join("#%d" % n for n in sorted(tanpa_lane))))

    # Issue berlabel lane yang belum punya PR terbuka (#142). Sebelum sinyal ini, board yang bersih
    # dan berlabel justru menghasilkan senyap: makin tertib papannya, makin sepi lane-nya. Kejadian
    # nyata 2026-10-10: lane HQ diam sekitar 5 jam dengan 6 issue berlabel kebuka (#120, #121, #124,
    # #125, #84, #105), nol sinyal, dan yang membangunkan akhirnya agent secara manual.
    #
    # Tiga hal yang bikin sinyal ini tidak jadi kebisingan, semuanya dari kejadian nyata di sinyal
    # lain:
    #   - `eskalasi` juga terminal di sini. Issue yang menunggu keputusan owner tidak bisa dikerjakan
    #     lane mana pun, jadi melaporkannya cuma membangunkan lane untuk sinyal yang tidak bisa
    #     dieksekusi (#97). Issue yang punya label lane DAN eskalasi diperlakukan sama: eskalasi menang.
    #   - `ai-blocked` juga terminal (#142). Kelasnya sama: usulannya sudah diputuskan atau sudah
    #     dilaporkan, jadi tidak ada langkah lane yang bisa diambil sebelum owner menjawab.
    #   - `gh pr list` dipanggil dengan `--state open`, jadi PR yang sudah ditutup tidak pernah masuk
    #     daftar ini. Tanpa itu, issue yang PR-nya ditutup akan diam selamanya.
    #
    # Rujukan yang dihitung bukan lagi `#N` apa adanya, tapi deklarasi resmi lewat
    # `gate_pr_link.nomor_deklarasi`: `Closes`/`Fixes`/`Resolves #N` atau `Refs #N`. Sebelumnya PR yang
    # sekadar MENYEBUT `#55` (mis. PR jejak yang menyebutnya untuk konteks) sudah cukup memadamkan
    # sinyal issue #55 tanpa mengerjakannya (u-HQ-719710 opsi 1).
    nomor_pr = set()
    for pr in prs:
        nomor_pr |= nomor_di(pr.get("title", ""))
        nomor_pr |= nomor_di(pr.get("body", ""))
        nomor_pr |= nomor_di(pr.get("headRefName", ""))

    menunggu_pr = []
    for isu in issues:
        label = [l.get("name", "") for l in (isu.get("labels") or [])]
        if not any(n.startswith(LABEL_LANE) for n in label):
            continue
        if any(n in (LABEL_ESKALASI, LABEL_BLOCKED, LABEL_INDUK) for n in label):
            continue
        # Penyaring per lane. `HQ` sengaja tidak disaring: kalau cuma lane itu sendiri yang
        # melihat kerjanya, lane yang sesinya mati jadi lubang yang tidak kelihatan dari mana pun.
        if lane_id not in (None, "HQ") and (LABEL_LANE + lane_id) not in label:
            continue
        if isu["number"] not in nomor_pr:
            menunggu_pr.append(isu["number"])
    if menunggu_pr:
        daftar.append("%d issue berlabel %s tanpa PR terbuka: %s"
                      % (len(menunggu_pr), LABEL_LANE,
                         ", ".join("#%d" % n for n in sorted(menunggu_pr))))

    # Opsi pekerjaan yang menunggu keputusan. Sinyal ini dibaca dari berkas, bukan dari `gh`, dan
    # path-nya bisa diarahkan supaya uji mandiri tidak ikut membaca berkas repo.
    if path_usulan is None:
        # Sejak #217 (keputusan u-HQ-f406ac opsi 2) jejak usulan dipecah per lane, jadi pembacanya
        # menggabungkan SEMUA berkas jejak. Membaca satu berkas akan melaporkan nol opsi menunggu.
        menunggu = usulan.menunggu_di_paths(usulan.berkas_usulan(akar))
    else:
        menunggu = usulan.menunggu_di_path(path_usulan)
    if menunggu and pengawas:
        daftar.append("%d opsi pekerjaan menunggu keputusan: %s"
                      % (len(menunggu), ", ".join(r["id"] for r in menunggu)))

    return daftar, None

def baca_state(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}

def tulis_state(path, isi):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(isi, f, indent=2, ensure_ascii=False)

def sesi_lane(db_path, akar, lane_id):
    """Sesi yang terikat ke topic lane itu, atau (None, alasan).

    Aturan verdict-nya tinggal di `cek_lane.sesi_lane` supaya `lapor.py` memakai alamat push yang
    sama; dua salinan aturan itu pasti melenceng.
    """
    lanes = u.baca_json(os.path.join(akar, "factory", "lanes.json"))
    db, masalah = cek_lane.buka_db(db_path)
    if db is None:
        return None, masalah
    return cek_lane.sesi_lane(db, u.grup(akar), lanes, lane_id)

def uji_mandiri():
    """Gate yang cuma pernah bilang "bangunkan" belum membuktikan ia bisa diam."""
    gagal = 0
    kasus = []
    akar = u.akar_factory()
    grup = u.grup(akar)
    # Lane dan topic dibaca dari lanes.json proyek ini, bukan ditulis harfiah: uji yang
    # memakai topic proyek lain akan merah karena alasan yang salah, dan merah palsu
    # membuat gate-nya berhenti dipercaya.
    lanes = u.baca_json(os.path.join(akar, "factory", "lanes.json"))
    lane_hq = next(l for l in lanes["lane"] if l["id"] == "HQ")
    topic_hq = lane_hq["topic"]
    lane_lain = next(l for l in lanes["lane"] if l["id"] != "HQ")
    lane_id = lane_lain["id"]
    topic_lane = lane_lain["topic"]

    def siapkan_gh(tmp, issues, prs, rusak=False):
        path = os.path.join(tmp, "gh-palsu")
        argv_log = path + ".argv"
        with open(path, "w", encoding="utf-8") as f:
            f.write("#!/usr/bin/env python3\nimport json,sys\n")
            # Argumennya dicatat supaya uji ini bisa MEMBUKTIKAN `gh pr list` benar-benar dipanggil
            # dengan `--state open`, bukan cuma memercayai bahwa PR tertutup tidak ikut terbaca.
            f.write("open(%r,'a').write(' '.join(sys.argv[1:])+'\\n')\n" % argv_log)
            if rusak:
                f.write("sys.exit(1)\n")
            else:
                f.write("d=json.loads(%r)\n" % json.dumps({"issue": issues, "pr": prs}))
                f.write("print(json.dumps(d['issue'] if sys.argv[1]=='issue' else d['pr']))\n")
        os.chmod(path, 0o755)
        return path

    def siapkan_db(tmp, terikat):
        path = os.path.join(tmp, "uji.db")
        import sqlite3
        c = sqlite3.connect(path)
        c.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, channel_chat_key TEXT, archived_at INTEGER)")
        c.execute("CREATE TABLE session_bindings (session_id TEXT PRIMARY KEY, channel TEXT, "
                  "chat_id TEXT, thread_id INTEGER, updated_at INTEGER)")
        if terikat:
            sid = "33333333-3333-3333-3333-333333333333"
            key = cek_lane.kunci_chat(grup, topic_hq)
            c.execute("INSERT INTO sessions VALUES (?,?,NULL)", (sid, key))
            c.execute("INSERT INTO session_bindings VALUES (?,?,?,?,0)", (sid, "telegram", str(grup), topic_hq))
        c.commit()
        c.close()
        return path

    def jalankan(nama, terikat, issues, prs, rusak, harap_aksi, harap_notify):
        with tempfile.TemporaryDirectory() as tmp:
            gh = siapkan_gh(tmp, issues, prs, rusak)
            db = siapkan_db(tmp, terikat)
            log = os.path.join(tmp, "notify.log")
            oc = os.path.join(tmp, "opencrabs-palsu")
            with open(oc, "w", encoding="utf-8") as f:
                f.write("#!/bin/sh\necho \"$@\" >> %s\n" % log)
            os.chmod(oc, 0o755)
            state = os.path.join(tmp, "state.json")

            aksi, pesan = putuskan(akar, gh, db, state, "HQ", False, oc,
                                   path_usulan=os.path.join(tmp, "usulan.jsonl"))
            dipanggil = os.path.isfile(log)
            # Notify yang tidak membawa aturan keputusan itu notify yang bikin lane bertanya ke
            # owner: isinya harus diperiksa, bukan cuma keberadaannya.
            isi_log = ""
            if dipanggil:
                with open(log, "r", encoding="utf-8") as f:
                    isi_log = f.read()
            bawa_aturan = "usulan.py" in isi_log and "suggest_options" in isi_log
            # PR tertutup tidak boleh dihitung sebagai PR terbuka (#142): itu cuma benar kalau `gh`
            # benar-benar dipanggil dengan `--state open`, jadi argumennya diperiksa, bukan diandaikan.
            argv = ""
            argv_log = gh + ".argv"
            if os.path.isfile(argv_log):
                with open(argv_log, encoding="utf-8") as f:
                    argv = f.read()
            baris_pr = [b for b in argv.splitlines() if b.startswith("pr list")]
            # Kalau `pr list` memang tidak pernah dipanggil, itu hanya boleh terjadi di jalur gagal
            # (gh mati di panggilan pertama), bukan di jalur normal.
            state_open = all("--state open" in b for b in baris_pr) if baris_pr else rusak
            benar = (aksi == harap_aksi and dipanggil == harap_notify
                     and (bawa_aturan or not harap_notify) and state_open)
            print("  %s %-44s aksi=%-10s notify=%s" % (
                "LULUS " if benar else "GAGAL ", nama, aksi, "ya" if dipanggil else "tidak"))
            if not benar:
                print("         harap aksi=%s notify=%s state_open=%s; %s"
                      % (harap_aksi, harap_notify, state_open, pesan))
            return 0 if benar else 1

    isu_tanpa_lane = [{"number": 55, "title": "x", "labels": []}]
    isu_berlabel = [{"number": 55, "title": "x", "labels": [{"name": "lane:" + lane_id}]}]
    # Issue yang menyentuh path eskalasi tidak bisa dikerjakan lane mana pun sebelum owner
    # memutuskan: menghitungnya "belum berlabel lane" membuat pacemaker membangunkan lane selamanya
    # untuk sinyal yang tidak bisa dikerjakan siapa pun (#97). Aturan yang sama berlaku di sinyal
    # keempat (#142), jadi label eskalasi diperlakukan terminal di sana juga.
    isu_eskalasi = [{"number": 63, "title": "z", "labels": [{"name": "eskalasi"}]}]
    isu_lane_eskalasi = [{"number": 63, "title": "z",
                          "labels": [{"name": "lane:" + lane_id}, {"name": "eskalasi"}]}]
    # `ai-blocked` kelasnya sama (#142, keputusan agent u-HQ-8fd82e): usulannya sudah diputuskan
    # atau sudah dilaporkan, jadi tidak ada langkah lane yang bisa diambil. Dua bentuknya diuji:
    # bersama label lane (sinyal 3 harus diam) dan tanpa label lane (sinyal 2 harus diam).
    isu_lane_blocked = [{"number": 64, "title": "z",
                         "labels": [{"name": "lane:" + lane_id}, {"name": "ai-blocked"}]}]
    isu_blocked = [{"number": 64, "title": "z", "labels": [{"name": "ai-blocked"}]}]
    # Issue induk/epic (keputusan agent u-HQ-52b3f1 opsi 1): #253 memecah kerjanya ke turunan
    # #255-258, jadi ia tidak punya PR sendiri. Dua bentuknya diuji seperti ai-blocked, plus satu
    # kontrol negatif yang membuktikan `induk` cuma memadamkan issue yang membawanya.
    isu_lane_induk = [{"number": 65, "title": "z",
                       "labels": [{"name": "lane:HQ"}, {"name": "induk"}]}]
    isu_induk = [{"number": 65, "title": "z", "labels": [{"name": "induk"}]}]
    isu_induk_dan_biasa = [{"number": 65, "title": "z",
                            "labels": [{"name": "lane:HQ"}, {"name": "induk"}]},
                           {"number": 66, "title": "y", "labels": [{"name": "lane:HQ"}]}]
    pr_merah = [{"number": 78, "title": "y (Closes #55)", "body": "", "headRefName": "x",
                 "statusCheckRollup": [{"conclusion": "FAILURE"}]}]
    # PR yang MENYATAKAN #55 sebagai tanggungannya: issue itu sedang dikerjakan, jadi sinyal keempat
    # harus diam. Bentuknya klaim penutup berbahasa Inggris di badan, bukan `#55` di judul, karena
    # sejak #142 rujukan yang dihitung cuma yang menyatakan diri.
    pr_hijau = [{"number": 78, "title": "y", "body": "Closes #55", "headRefName": "x",
                 "statusCheckRollup": [{"conclusion": "SUCCESS"}]}]
    # PR yang menyebut issue lain: #55 tetap tanpa PR, jadi sinyalnya tetap muncul. Rujukan di nama
    # branch juga dihitung, karena gate_pr_link menerima rujukan di sana.
    pr_lain = [{"number": 79, "title": "lain", "body": "menutup #99", "headRefName": "bahan/lain-99",
                "statusCheckRollup": [{"conclusion": "SUCCESS"}]}]
    # Kontrol negatif wajib dari keputusan agent (u-HQ-719710 opsi 1). Tiga bentuk yang TIDAK boleh
    # memadamkan sinyal #55: sekadar menyebut `#55`, klaim penutup berbahasa Indonesia (GitHub tidak
    # memprosesnya, jadi issue-nya tetap terbuka), dan `#55` yang cuma dikutip di dalam backtick.
    pr_sebut = [{"number": 80, "title": "y (#55)", "body": "", "headRefName": "x",
                 "statusCheckRollup": [{"conclusion": "SUCCESS"}]}]
    pr_menutup_id = [{"number": 81, "title": "y", "body": "Menutup #55", "headRefName": "x",
                      "statusCheckRollup": [{"conclusion": "SUCCESS"}]}]
    pr_kutip = [{"number": 82, "title": "y", "body": "Contoh penandanya `Closes #55`.",
                 "headRefName": "x", "statusCheckRollup": [{"conclusion": "SUCCESS"}]}]
    # Bentuk deklarasi kedua: `Refs #N` menyatakan #55 ditangani tanpa diklaim ditutup.
    pr_refs = [{"number": 83, "title": "y", "body": "Refs #55", "headRefName": "x",
                "statusCheckRollup": [{"conclusion": "SUCCESS"}]}]

    kasus = [
        ("tidak ada sinyal", True, isu_berlabel, pr_hijau, False, "diam", False),
        ("satu PR merah", True, isu_berlabel, pr_merah, False, "bangunkan", True),
        ("issue tanpa label lane", True, isu_tanpa_lane, pr_hijau, False, "bangunkan", True),
        ("issue berlabel eskalasi", True, isu_eskalasi, pr_hijau, False, "diam", False),
        ("lane HQ belum terikat", False, isu_berlabel, pr_merah, False, "diam", False),
        ("gh gagal", True, isu_berlabel, pr_hijau, True, "diam", False),
        # Sinyal keempat (#142): issue berlabel lane yang belum punya PR terbuka.
        ("issue berlabel lane tanpa PR terbuka", True, isu_berlabel, [], False, "bangunkan", True),
        ("PR terbuka menyebut issue lain", True, isu_berlabel, pr_lain, False, "bangunkan", True),
        ("issue berlabel lane DAN eskalasi", True, isu_lane_eskalasi, [], False, "diam", False),
        ("issue berlabel lane DAN ai-blocked", True, isu_lane_blocked, [], False, "diam", False),
        ("issue ai-blocked tanpa label lane", True, isu_blocked, [], False, "diam", False),
        ("issue induk DAN berlabel lane", True, isu_lane_induk, [], False, "diam", False),
        ("issue induk tanpa label lane", True, isu_induk, [], False, "diam", False),
        ("induk tidak memadamkan issue lain", True, isu_induk_dan_biasa, [], False, "bangunkan", True),
        # Rujukan yang menyatakan diri memadamkan sinyal; yang cuma menyebut tidak.
        ("PR menyatakan Refs", True, isu_berlabel, pr_refs, False, "diam", False),
        ("menyebut tanpa kata kunci", True, isu_berlabel, pr_sebut, False, "bangunkan", True),
        ("menutup dengan klaim Indonesia", True, isu_berlabel, pr_menutup_id, False, "bangunkan", True),
        ("rujukan dikutip di backtick", True, isu_berlabel, pr_kutip, False, "bangunkan", True),
    ]
    for nama, terikat, issues, prs, rusak, harap_aksi, harap_notify in kasus:
        gagal += jalankan(nama, terikat, issues, prs, rusak, harap_aksi, harap_notify)

    # Kasus state: sinyal yang sama dua kali hanya membangunkan sekali.
    with tempfile.TemporaryDirectory() as tmp:
        gh = siapkan_gh(tmp, isu_berlabel, pr_merah, False)
        db = siapkan_db(tmp, True)
        log = os.path.join(tmp, "notify.log")
        oc = os.path.join(tmp, "opencrabs-palsu")
        with open(oc, "w", encoding="utf-8") as f:
            f.write("#!/bin/sh\necho \"$@\" >> %s\n" % log)
        os.chmod(oc, 0o755)
        state = os.path.join(tmp, "state.json")
        aksi1, _ = putuskan(akar, gh, db, state, "HQ", False, oc, path_usulan=os.path.join(tmp, "usulan.jsonl"))
        aksi2, pesan2 = putuskan(akar, gh, db, state, "HQ", False, oc, path_usulan=os.path.join(tmp, "usulan.jsonl"))
        aksi3, _ = putuskan(akar, gh, db, state, "HQ", True, oc, path_usulan=os.path.join(tmp, "usulan.jsonl"))
        benar = aksi1 == "bangunkan" and aksi2 == "diam" and aksi3 == "bangunkan"
        print("  %s %-44s run1=%s run2=%s paksa=%s" % (
            "LULUS " if benar else "GAGAL ", "sinyal sama tidak bangunkan dua kali", aksi1, aksi2, aksi3))
        gagal += 0 if benar else 1
        kasus.append("state")

    # Penyaring per lane (#187): lane non-HQ cuma boleh dibangunkan oleh issue berlabel lane-nya
    # sendiri, dan TIDAK oleh sinyal yang cakupannya tidak bisa dibaca dari sinyalnya (PR merah,
    # issue belum berlabel). Dua arah wajib diuji: penyaring yang cuma pernah bilang "diam" tidak
    # membuktikan ia masih bisa membangunkan lane untuk kerjaan yang memang miliknya.
    lane_asing = next(l for l in lanes["lane"] if l["id"] not in ("HQ", lane_id))
    isu_kasbank = [{"number": 173, "title": "x", "labels": [{"name": "lane:" + lane_id}]}]
    isu_lane_asing = [{"number": 174, "title": "x",
                       "labels": [{"name": "lane:" + lane_asing["id"]}]}]
    for nama, issues, prs, harap in (
            ("lane lain: issue lane lain", isu_lane_asing, [], "diam"),
            ("lane sendiri: issue sendiri", isu_kasbank, [], "bangunkan"),
            ("lane lain: issue tanpa label lane", isu_tanpa_lane, [], "diam"),
            ("lane lain: PR merah bukan miliknya", isu_berlabel, pr_merah, "diam")):
        with tempfile.TemporaryDirectory() as tmp:
            import sqlite3
            gh = siapkan_gh(tmp, issues, prs, False)
            db = os.path.join(tmp, "uji.db")
            c = sqlite3.connect(db)
            c.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, channel_chat_key TEXT, archived_at INTEGER)")
            c.execute("CREATE TABLE session_bindings (session_id TEXT PRIMARY KEY, channel TEXT, "
                      "chat_id TEXT, thread_id INTEGER, updated_at INTEGER)")
            sid = "44444444-4444-4444-4444-444444444444"
            key = cek_lane.kunci_chat(grup, topic_lane)
            c.execute("INSERT INTO sessions VALUES (?,?,NULL)", (sid, key))
            c.execute("INSERT INTO session_bindings VALUES (?,?,?,?,0)", (sid, "telegram", str(grup), topic_lane))
            c.commit()
            c.close()
            log = os.path.join(tmp, "notify.log")
            oc = os.path.join(tmp, "opencrabs-palsu")
            with open(oc, "w", encoding="utf-8") as f:
                f.write("#!/bin/sh\necho \"$@\" >> %s\n" % log)
            os.chmod(oc, 0o755)
            aksi, pesan = putuskan(akar, gh, db, os.path.join(tmp, "state.json"), lane_id, False, oc,
                                   path_usulan=os.path.join(tmp, "usulan.jsonl"))
            dipanggil = os.path.isfile(log)
            benar = aksi == harap and dipanggil == (harap == "bangunkan")
            print("  %s %-44s aksi=%-10s notify=%s" % (
                "LULUS " if benar else "GAGAL ", nama, aksi, "ya" if dipanggil else "tidak"))
            if not benar:
                print("         harap aksi=%s; %s" % (harap, pesan))
            gagal += 0 if benar else 1
            kasus.append("penyaring-lane")

    # State terpisah per lane: digest lane lain tidak boleh memadamkan sinyal lane ini. Dua lane
    # memakai SATU berkas state akan saling menimpa dan membangunkan keduanya tiap tick.
    with tempfile.TemporaryDirectory() as tmp:
        gh = siapkan_gh(tmp, isu_kasbank, [], False)
        db = os.path.join(tmp, "uji.db")
        import sqlite3
        c = sqlite3.connect(db)
        c.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, channel_chat_key TEXT, archived_at INTEGER)")
        c.execute("CREATE TABLE session_bindings (session_id TEXT PRIMARY KEY, channel TEXT, "
                  "chat_id TEXT, thread_id INTEGER, updated_at INTEGER)")
        for sid, topic in (("55555555-5555-5555-5555-555555555555", topic_lane),
                           ("66666666-6666-6666-6666-666666666666", topic_hq)):
            c.execute("INSERT INTO sessions VALUES (?,?,NULL)", (sid, cek_lane.kunci_chat(grup, topic)))
            c.execute("INSERT INTO session_bindings VALUES (?,?,?,?,0)",
                      (sid, "telegram", str(grup), topic))
        c.commit()
        c.close()
        log = os.path.join(tmp, "notify.log")
        oc = os.path.join(tmp, "opencrabs-palsu")
        with open(oc, "w", encoding="utf-8") as f:
            f.write("#!/bin/sh\necho \"$@\" >> %s\n" % log)
        os.chmod(oc, 0o755)
        state = os.path.join(tmp, "state.json")
        satu, _ = putuskan(akar, gh, db, state, lane_id, False, oc,
                           path_usulan=os.path.join(tmp, "usulan.jsonl"))
        dua, _ = putuskan(akar, gh, db, state, "HQ", False, oc,
                          path_usulan=os.path.join(tmp, "usulan.jsonl"))
        tiga, _ = putuskan(akar, gh, db, state, lane_id, False, oc,
                           path_usulan=os.path.join(tmp, "usulan.jsonl"))
        benar = satu == "bangunkan" and dua == "bangunkan" and tiga == "diam"
        print("  %s %-44s lane=%s HQ=%s ulang=%s" % (
            "LULUS " if benar else "GAGAL ", "state terpisah per lane", satu, dua, tiga))
        gagal += 0 if benar else 1
        kasus.append("state-per-lane")

    # Kasus repo: akar yang bukan repo git membuat gh menebak repo dari direktori kerja, dan
    # cron menjalankannya dari $HOME. Gate harus diam, bukan menebak.
    #
    # Ada DUA jalur yang sah, dan keduanya diuji:
    #   - pohon tanpa remote TAPI identitas memegang repo -> dipakai, gate jalan (mesin di proyek baru)
    #   - pohon tanpa remote DAN identitas tanpa repo    -> diam dengan sebab
    def pohon_tanpa_remote(tmp, **ubah_identitas):
        """Pohon tiruan: identitas + lanes.json, tapi nol remote git."""
        u.tulis_identitas(tmp, **ubah_identitas)
        os.makedirs(os.path.join(tmp, "factory"), exist_ok=True)
        with open(os.path.join(tmp, "factory", "lanes.json"), "w", encoding="utf-8") as f:
            json.dump({"lane": [{"id": "HQ", "topic": topic_hq}]}, f)
        return tmp

    with tempfile.TemporaryDirectory() as tmp:
        gh = siapkan_gh(tmp, isu_berlabel, pr_merah, False)
        db = siapkan_db(tmp, True)
        state = os.path.join(tmp, "state.json")
        pohon_tanpa_remote(tmp, repo={})
        aksi, pesan = putuskan(tmp, gh, db, state, "HQ", False, "opencrabs", True,
                               path_usulan=os.path.join(tmp, "usulan.jsonl"))
        benar = aksi == "diam" and "repo" in pesan
        print("  %s %-44s aksi=%s" % ("LULUS " if benar else "GAGAL ",
                                      "tanpa remote dan tanpa repo di identitas", aksi))
        if not benar:
            print("         %s" % pesan)
        gagal += 0 if benar else 1
        kasus.append("tanpa-repo")

    with tempfile.TemporaryDirectory() as tmp:
        gh = siapkan_gh(tmp, isu_berlabel, pr_merah, False)
        db = siapkan_db(tmp, True)
        state = os.path.join(tmp, "state.json")
        pohon_tanpa_remote(tmp, repo={"github": "contoh/kebun"})
        aksi, pesan = putuskan(tmp, gh, db, state, "HQ", False, "opencrabs", True,
                               path_usulan=os.path.join(tmp, "usulan.jsonl"))
        benar = aksi == "bangunkan"
        print("  %s %-44s aksi=%s" % ("LULUS " if benar else "GAGAL ",
                                      "tanpa remote, repo dari identitas", aksi))
        if not benar:
            print("         %s" % pesan)
        gagal += 0 if benar else 1
        kasus.append("repo-identitas")

    # Sinyal opsi: berkas usulan berisi satu opsi menunggu harus membangunkan, dan berkas yang
    # tidak ada tidak boleh. Path-nya eksplisit supaya berkas repo tidak ikut terbaca.
    with tempfile.TemporaryDirectory() as tmp:
        gh = siapkan_gh(tmp, isu_berlabel, pr_hijau, False)
        db = siapkan_db(tmp, True)
        log = os.path.join(tmp, "notify.log")
        oc = os.path.join(tmp, "opencrabs-palsu")
        with open(oc, "w", encoding="utf-8") as f:
            f.write("#!/bin/sh\necho \"$@\" >> %s\n" % log)
        os.chmod(oc, 0o755)
        state = os.path.join(tmp, "state.json")
        up = os.path.join(tmp, "usulan.jsonl")
        aksi_kosong, _ = putuskan(akar, gh, db, state, "HQ", False, oc, path_usulan=up)
        with open(up, "w", encoding="utf-8") as f:
            f.write(json.dumps({"event": "usulan", "id": "u-sync-abc123",
                                "ts": "2026-10-09T00:00:00+07:00",
                                "lane": "sync", "ringkas": "x", "opsi": ["A", "B"],
                                "status": "menunggu"}) + "\n")
        aksi_isi, _ = putuskan(akar, gh, db, state, "HQ", False, oc, path_usulan=up)
        benar = aksi_kosong == "diam" and aksi_isi == "bangunkan"
        print("  %s %-44s kosong=%s berisi=%s" % ("LULUS " if benar else "GAGAL ",
                                                  "sinyal opsi menunggu", aksi_kosong, aksi_isi))
        gagal += 0 if benar else 1
        kasus.append("opsi")

    # Penjaganya diuji di sini juga: skrip ini dijalankan cron dari pohon yang bisa terparkir, dan
    # penjaga yang cuma pernah bilang "boleh" belum membuktikan apa pun (#160).
    n_jaga, gagal_jaga = u.uji_penjaga_branch()
    kasus.extend(["penjaga-branch"] * n_jaga)
    gagal += gagal_jaga

    print("")
    print("UJI MANDIRI: %d kasus, %d gagal" % (len(kasus), gagal))
    return gagal

def putuskan(akar, gh_bin, db_path, state_path, lane_id, paksa, oc_bin, kering=False, path_usulan=None):
    """Inti gate: kembalikan (aksi, pesan). aksi: `diam` atau `bangunkan`."""
    daftar, masalah = sinyal(akar, gh_bin, path_usulan, lane_id)
    if masalah:
        return "diam", masalah
    if not daftar:
        return "diam", "tidak ada sinyal"

    # State dedup dipisah per lane SEBELUM dibaca: kalau tidak, tiap lane menimpa digest lane lain
    # dan semuanya dibangunkan tiap tick (lihat `path_state_lane`).
    state_path = path_state_lane(state_path, lane_id)

    # Teks dibuka dengan "ada kerjaan", BUKAN "ada yang menunggu keputusan": pembukaan yang lama
    # memberi tahu lane bahwa ada keputusan menunggu tanpa memberi tahu siapa yang memutuskan, dan
    # lane mengisi kekosongan itu dengan bertanya ke owner. Aturan keputusan ikut di badan pesan.
    teks = ("Pacemaker: ada kerjaan factory.\n\n" + "\n".join("- " + s for s in daftar)
            + "\n\n" + ATURAN_KEPUTUSAN)
    digest = "\n".join(daftar)
    state = baca_state(state_path)
    if state.get("digest") == digest and not paksa:
        return "diam", "sinyal sama seperti run terakhir (%s), tidak dibangunkan" % state.get("ts", "?")

    sesi, alasan = sesi_lane(db_path, akar, lane_id)
    if sesi is None:
        return "diam", "ada sinyal, tapi %s" % alasan

    if kering:
        return "bangunkan", "kering: akan notify sesi %s" % sesi[:8]

    kode, keluar, galat = jalan([oc_bin, "session", "notify", sesi, "--text", teks,
                                 "--mode", "turn-end", "--sender", "pacemaker"])
    if kode != 0:
        return "diam", "notify gagal (exit %d): %s" % (kode, (galat or keluar).strip()[:200])
    tulis_state(state_path, {"digest": digest, "ts": __import__("datetime").datetime.now(
        __import__("datetime").timezone.utc).isoformat(timespec="seconds")})
    return "bangunkan", "notify terkirim ke sesi %s: %s" % (sesi[:8], " | ".join(daftar))

def lane_sasaran(akar, pilihan):
    """Daftar lane yang dijalankan satu pemanggilan pacemaker.

    `semua` (bawaan) = fan-out: HQ plus tiap lane di `factory/lanes.json`, urutannya mengikuti
    berkas itu supaya keluarannya stabil. Satu baris crontab jadi cukup, dan lane baru yang muncul
    di lanes.json ikut terlayani tanpa ada yang menyunting crontab. Lane yang belum terikat sesi
    tetap dicetak barisnya oleh `putuskan` (alasannya terbaca), jadi lubangnya kelihatan, bukan
    hilang.
    """
    if pilihan != "semua":
        return [pilihan]
    lanes = u.baca_json(os.path.join(akar, "factory", "lanes.json"))
    return [l["id"] for l in lanes.get("lane", [])]

def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=u.akar_factory())
    p.add_argument("--db", default=cek_lane.DB_BAWAAN)
    p.add_argument("--state", default=STATE_BAWAAN)
    p.add_argument("--lane", default="semua",
                   help="lane yang dijalankan; `semua` (bawaan) = HQ plus tiap lane di lanes.json")
    p.add_argument("--gh-bin", default="gh")
    p.add_argument("--opencrabs-bin", default="opencrabs")
    p.add_argument("--kering", action="store_true")
    p.add_argument("--paksa", action="store_true")
    p.add_argument("--usulan", default=None, help="berkas usulan lain (bawaan: <akar>/factory/usulan.jsonl)")
    p.add_argument("--uji-mandiri", action="store_true")
    a = p.parse_args()

    if a.uji_mandiri:
        return 1 if uji_mandiri() else 0

    # Crontab tidak tahu pohon kanonik sedang checkout apa, jadi skrip ini menolak jalan kalau pohon
    # tempat kodenya hidup bukan `main`, atau `main`-nya ketinggalan `origin/main` (#160).
    if u.jalankan_penjaga_branch():
        return 1

    akar = os.path.abspath(os.path.expanduser(a.akar))
    usulan_path = os.path.expanduser(a.usulan) if a.usulan else None
    for lane_id in lane_sasaran(akar, a.lane):
        aksi, pesan = putuskan(
            akar, a.gh_bin, os.path.expanduser(a.db), os.path.expanduser(a.state),
            lane_id, a.paksa, a.opencrabs_bin, a.kering, path_usulan=usulan_path)
        print("PACEMAKER  [%-9s] %-10s %s" % (lane_id, aksi, pesan))
    return 0

if __name__ == "__main__":
    sys.exit(main())
