#!/usr/bin/env python3
"""Penjaga dormansi lane: lane yang tidak terikat topic tidak bisa dibrief siapa pun.

Kenapa ada: lane `sync` dua kali dorman tanpa satu pun alarm menyala. #151 menutup satu cacat
(topic 27 tidak pernah ada, dibetulkan jadi 476), lalu #221 menemukan topic 476 juga nol pesan
masuk. Dormansi itu senyap di tiga tempat sekaligus, jadi nol yang menyala:

  `pacemaker.py`   sengaja diam untuk lane tak terikat (LAW 8.4 baris 399-400)
  `pintu.py`       melaporkannya `bersih` ("lane belum punya sesi", baris 203)
  `cek_lane.py`    `--wajib-lengkap` sudah benar, tapi nol pemanggil

Alat ini pemanggilnya. Dijalankan dari cron host, bukan CI: berkas ini membaca
`~/.opencrabs/opencrabs.db` yang cuma ada di host.

Sesi lane lahir dari pesan MASUK ke topic-nya (LAW bagian 2 baris 51-54), jadi agent tidak bisa
membuatnya sendiri. Karena itu alarm ini alamatnya sesi agent: agent yang memutuskan lanjutnya,
dan pesan masuk ke topic lane itu aksi owner.

Pemakaian:
  python3 tools/factory/jaga_lane.py                  periksa; notify kalau ada lane dorman
  python3 tools/factory/jaga_lane.py --kering         cetak saja, nol notify
  python3 tools/factory/jaga_lane.py --paksa          abaikan state dedup, kirim ulang
  python3 tools/factory/jaga_lane.py --json           keluaran mesin
  python3 tools/factory/jaga_lane.py --uji-mandiri

Sinyal yang sama tidak dikirim dua kali (#228): state dedup hidup di
`~/.opencrabs/state/geoapps-jaga-lane.json`, sama seperti `pacemaker.py`. Tanpa itu alarm ini
membangunkan sesi agent tiap jam selama lane masih dorman, dan kondisi dorman cuma bisa
dibereskan owner, jadi pengulangannya murni kebisingan.
"""

import argparse
import json
import os
import sqlite3
import subprocess
import sys
import tempfile

DIR_INI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_INI)
import _umum as u  # noqa: E402
import cek_lane  # noqa: E402
import lapor  # noqa: E402

def dorman(hasil):
    """Lane yang belum siap dibrief: verdict apa pun selain `terikat`."""
    return [h for h in hasil if h["verdict"] != "terikat"]

def teks_alarm(hasil_dorman, jumlah_lane):
    """Teks notify. Menyebut lane + verdict + alasan, supaya agent tidak perlu membuka DB lagi."""
    baris = ["%d dari %d lane belum terikat, jadi tidak bisa dibrief:" % (
        len(hasil_dorman), jumlah_lane)]
    for h in hasil_dorman:
        baris.append("- %s (topic %s): %s. %s" % (
            h["lane"], h["topic"] if h["topic"] is not None else "-", h["verdict"], h["alasan"]))
    baris.append("")
    baris.append("Sesi lane lahir dari pesan MASUK ke topic-nya, bukan dari topic yang ada "
                 "(LAW bagian 2 baris 51-54). Jadi ini aksi owner, bukan agent.")
    return "\n".join(baris)

STATE_BAWAAN = u.jalur_state("jaga-lane")

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

def hapus_state(path):
    """Kosongkan state saat semua lane terikat.

    Tanpa ini, lane yang pernah dorman lalu terikat lalu dorman lagi akan dibungkam
    selamanya oleh digest lama, karena himpunannya persis sama.
    """
    try:
        os.remove(path)
    except OSError:
        pass

def digest_alarm(sesi, kurang):
    """Sidik sinyal: sesi tujuan plus himpunan (lane, verdict) yang dorman."""
    return "%s\n%s" % (sesi, "\n".join(sorted(
        "%s|%s" % (h["lane"], h["verdict"]) for h in kurang)))

def jalankan(db_path, akar, oc_bin, kering=False, paksa=False, state_path=None):
    """Inti gate: kembalikan (aksi, pesan). aksi: `diam`, `alarm`, atau `tanpa-db`.

    Sinyal yang sama tidak dikirim dua kali (#228). Aturan itu sudah berlaku di
    `pacemaker.py` dan `lapor.py`; tanpa itu alarm ini membangunkan sesi agent 24x sehari
    untuk kondisi yang cuma bisa dibereskan owner. `--paksa` mengabaikan state.
    """
    if state_path is None:
        state_path = STATE_BAWAAN
    # Keputusan "ada lane dorman" datang dari `cek_lane.py --wajib-lengkap` sendiri, bukan
    # salinan nalarnya di sini: satu jalur, dan kalau verdict `cek_lane` berubah alat ini ikut.
    kode, keluar, galat = lapor.jalan([
        sys.executable, os.path.join(DIR_INI, "cek_lane.py"),
        "--akar", akar, "--db", db_path, "--wajib-lengkap"])
    if kode == 0:
        hapus_state(state_path)
        return "diam", "semua lane terikat"
    if kode != 1:
        pesan = (galat or keluar).strip().splitlines()
        return "tanpa-db", pesan[-1] if pesan else "cek_lane exit %d" % kode

    lanes = u.baca_json(os.path.join(akar, "factory", "lanes.json"))
    grup = u.grup(akar)
    if not grup:
        return "tanpa-db", "factory/identitas.json tidak memuat `grup`"

    db, masalah = cek_lane.buka_db(db_path)
    if db is None:
        return "tanpa-db", masalah

    hasil = cek_lane.periksa_semua(db, grup, lanes)
    kurang = dorman(hasil)
    if not kurang:
        hapus_state(state_path)
        return "diam", "%d dari %d lane terikat" % (len(hasil), len(hasil))

    sesi, alasan = lapor.sesi_owner(db_path, akar)
    if sesi is None:
        return "diam", "ada %d lane dorman (%s), tapi %s" % (
            len(kurang), ", ".join(h["lane"] for h in kurang), alasan)

    sidik = digest_alarm(sesi, kurang)
    state = baca_state(state_path)
    if not paksa and state.get("digest") == sidik:
        return "diam", "sinyal sama seperti run terakhir (%s), tidak dibangunkan" % (
            state.get("ts", "?"))

    if kering:
        return "alarm", "kering: akan kirim %d lane dorman ke sesi %s" % (len(kurang), sesi[:8])

    teks = teks_alarm(kurang, len(hasil))
    kode, keluar, galat = lapor.jalan([oc_bin, "session", "notify", sesi, "--text", teks,
                                       "--mode", "turn-end", "--sender", "jaga-lane"])
    if kode != 0:
        return "diam", "notify gagal (exit %d): %s" % (kode, (galat or keluar).strip()[:200])
    # State ditulis SESUDAH notify berhasil: notify yang gagal harus dicoba lagi run berikutnya.
    tulis_state(state_path, {"digest": sidik, "ts": __import__("datetime").datetime.now(
        __import__("datetime").timezone.utc).isoformat(timespec="seconds")})
    return "alarm", "alarm %d lane dorman (%s) terkirim ke sesi %s" % (
        len(kurang), ", ".join(h["lane"] for h in kurang), sesi[:8])

def uji_mandiri():
    """Alarm yang cuma pernah menyala belum membuktikan ia bisa diam, dan sebaliknya."""
    grup = u.grup()
    gagal = 0
    kasus = []

    def siapkan_akar(tmp, lanes=("HQ", "sync"), owner_kanal=True):
        topik = {"HQ": 23, "sync": 476}
        u.tulis_identitas(tmp, grup=grup,
                          owner={"kanal": "[chat:%d]" % grup if owner_kanal else ""})
        d = {"versi": 1, "lane": [{"id": i, "topic": topik[i]} for i in lanes]}
        os.makedirs(os.path.join(tmp, "factory"), exist_ok=True)
        with open(os.path.join(tmp, "factory", "lanes.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        return tmp

    def siapkan_db(tmp, terikat=(), sesi_agent=True):
        path = os.path.join(tmp, "uji.db")
        c = sqlite3.connect(path)
        c.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, channel_chat_key TEXT, archived_at INTEGER)")
        c.execute("CREATE TABLE session_bindings (session_id TEXT PRIMARY KEY, channel TEXT, "
                  "chat_id TEXT, thread_id INTEGER, updated_at INTEGER)")
        for n, topic in enumerate(terikat):
            sid = "%08d-1111-1111-1111-111111111111" % (n + 1)
            c.execute("INSERT INTO sessions VALUES (?,?,NULL)",
                      (sid, cek_lane.kunci_chat(grup, topic)))
            c.execute("INSERT INTO session_bindings VALUES (?,?,?,?,0)",
                      (sid, "telegram", str(grup), topic))
        if sesi_agent:
            c.execute("INSERT INTO sessions VALUES (?,?,NULL)",
                      ("99999999-1111-1111-1111-111111111111", "[chat:%d]" % grup))
        c.commit()
        c.close()
        return path

    def siapkan_oc(tmp):
        log = os.path.join(tmp, "notify.log")
        oc = os.path.join(tmp, "opencrabs-palsu")
        with open(oc, "w", encoding="utf-8") as f:
            f.write("#!/bin/sh\nprintf '%s\\n' \"$@\" >> \"%s\"\n" % (log, log))
        os.chmod(oc, 0o755)
        return oc, log

    def jalankan_kasus(nama, terikat, harap_aksi, harap_notify, owner_kanal=True, kering=False):
        with tempfile.TemporaryDirectory() as tmp:
            akar = siapkan_akar(tmp, owner_kanal=owner_kanal)
            db = siapkan_db(tmp, terikat=terikat)
            oc, log = siapkan_oc(tmp)
            # State dedup selalu diarahkan ke tmp: uji tidak boleh menyentuh state hidup.
            aksi, pesan = jalankan(db, akar, oc, kering=kering,
                                   state_path=os.path.join(tmp, "state.json"))
            dipanggil = os.path.exists(log)
            benar = aksi == harap_aksi and dipanggil == harap_notify
            print("  %s %-46s aksi=%-8s notify=%s" % (
                "LULUS " if benar else "GAGAL ", nama, aksi, dipanggil))
            if not benar:
                print("         harap aksi=%s notify=%s; %s" % (harap_aksi, harap_notify, pesan))
            return 0 if benar else 1

    kasus = [
        ("semua lane terikat -> diam", [23, 476], "diam", False),
        ("satu lane dorman -> alarm", [23], "alarm", True),
        ("nol lane terikat -> alarm", [], "alarm", True),
        ("dorman tapi nol sesi agent -> diam", [23], "diam", False),
        ("kering: nol notify walau dorman", [23], "alarm", False),
    ]

    for nama, terikat, harap_aksi, harap_notify in kasus:
        kering = nama.startswith("kering")
        owner = not nama.startswith("dorman tapi")
        gagal += jalankan_kasus(nama, terikat, harap_aksi, harap_notify,
                                owner_kanal=owner, kering=kering)

    # Dedup (#228): sinyal sama tidak membangunkan sesi dua kali, dan --paksa mengulang.
    def kasus_dedup():
        hasil = []
        with tempfile.TemporaryDirectory() as tmp:
            akar = siapkan_akar(tmp)
            db = siapkan_db(tmp, terikat=[23])
            oc, _ = siapkan_oc(tmp)
            st = os.path.join(tmp, "state.json")

            def sekali(paksa=False):
                return jalankan(db, akar, oc, paksa=paksa, state_path=st)[0]

            hasil.append(("dedup: run1 sinyal baru -> alarm", sekali(), "alarm"))
            hasil.append(("dedup: run2 sinyal sama -> diam", sekali(), "diam"))
            hasil.append(("dedup: run3 --paksa -> alarm", sekali(paksa=True), "alarm"))
            hasil.append(("dedup: run4 sesudah paksa -> diam", sekali(), "diam"))
        return hasil

    # Siklus dorman -> terikat -> dorman lagi harus menyala lagi, bukan dibungkam digest lama.
    def kasus_siklus():
        hasil = []
        with tempfile.TemporaryDirectory() as tmp:
            akar = siapkan_akar(tmp)
            oc, _ = siapkan_oc(tmp)
            st = os.path.join(tmp, "state.json")
            d1 = os.path.join(tmp, "dorman")
            d2 = os.path.join(tmp, "terikat")
            os.makedirs(d1)
            os.makedirs(d2)
            db_dorman = siapkan_db(d1, terikat=[23])
            db_terikat = siapkan_db(d2, terikat=[23, 476])
            hasil.append(("siklus: dorman -> alarm",
                          jalankan(db_dorman, akar, oc, state_path=st)[0], "alarm"))
            hasil.append(("siklus: semua terikat -> diam",
                          jalankan(db_terikat, akar, oc, state_path=st)[0], "diam"))
            hasil.append(("siklus: dorman lagi -> alarm",
                          jalankan(db_dorman, akar, oc, state_path=st)[0], "alarm"))
        return hasil

    tambahan = kasus_dedup() + kasus_siklus()
    for nama, dapat, harap in tambahan:
        benar = dapat == harap
        print("  %s %-46s aksi=%-8s" % ("LULUS " if benar else "GAGAL ", nama, dapat))
        gagal += 0 if benar else 1

    with tempfile.TemporaryDirectory() as tmp:
        akar = siapkan_akar(tmp)
        oc, _ = siapkan_oc(tmp)
        aksi, _ = jalankan(os.path.join(tmp, "tidak-ada.db"), akar, oc,
                           state_path=os.path.join(tmp, "state.json"))
        benar = aksi == "tanpa-db"
        print("  %s %-46s aksi=%s" % ("LULUS " if benar else "GAGAL ", "basis data tidak ada", aksi))
        gagal += 0 if benar else 1

    with tempfile.TemporaryDirectory() as tmp:
        akar = siapkan_akar(tmp)
        # Identitas proyek tanpa `grup`: tanpa itu papan ini tidak punya alamat, jadi alarm
        # harus menyerah dengan sebab, bukan diam mengira semuanya terikat.
        u.tulis_identitas(akar, grup=None)
        db = siapkan_db(tmp, terikat=[23])
        oc, _ = siapkan_oc(tmp)
        aksi, _ = jalankan(db, akar, oc, state_path=os.path.join(tmp, "state.json"))
        benar = aksi == "tanpa-db"
        print("  %s %-46s aksi=%s" % ("LULUS " if benar else "GAGAL ", "identitas nol `grup`", aksi))
        gagal += 0 if benar else 1

    print("")
    print("UJI MANDIRI: %d kasus, %d gagal" % (len(kasus) + 2 + len(tambahan), gagal))
    return gagal

def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=u.akar_factory())
    p.add_argument("--db", default=cek_lane.DB_BAWAAN)
    p.add_argument("--oc-bin", default="opencrabs")
    p.add_argument("--kering", action="store_true")
    p.add_argument("--paksa", action="store_true")
    p.add_argument("--json", action="store_true")
    p.add_argument("--uji-mandiri", action="store_true")
    a = p.parse_args()

    if a.uji_mandiri:
        return 1 if uji_mandiri() else 0

    aksi, pesan = jalankan(os.path.expanduser(a.db), os.path.abspath(os.path.expanduser(a.akar)),
                           a.oc_bin, kering=a.kering, paksa=a.paksa)
    if a.json:
        print(json.dumps({"aksi": aksi, "pesan": pesan}, ensure_ascii=False))
    else:
        print("%-8s %s" % (aksi.upper(), pesan))
    return 2 if aksi == "tanpa-db" else 0

if __name__ == "__main__":
    sys.exit(main())
