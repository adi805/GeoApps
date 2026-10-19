#!/usr/bin/env python3
"""cek_lane.py - lane mana yang sudah punya sesi terikat topic, dan mana yang belum.

Kenapa ada: `factory/lanes.json` mencatat lane dan topic-nya, tapi catatan itu cuma niat. Yang
menentukan sebuah lane benar-benar bisa dibrief adalah apakah ada SESI yang terikat ke topic itu di
`~/.opencrabs/opencrabs.db`. Tanpa sesi, brief yang dikirim tidak punya alamat, dan dispatch
berhenti tanpa satu pun error.

Dua tabel harus sepakat, dan itu bagian yang mudah melenceng:

  `sessions.channel_chat_key`  `[chat:<grup>:topic:<topic>]` - sesi mana yang lahir di topic itu
  `session_bindings`           alamat push: chat + thread yang dipakai saat mengirim

Kalau keduanya menunjuk hal berbeda, push-nya mendarat di topic lain, dan itu terjadi tanpa error
apa pun: pesan terkirim, cuma ke ruangan yang salah. Karena itu berkas ini membedakan lima verdict,
bukan dua.

Verdict per lane:

  terikat          sesi dan binding sepakat, lane siap dibrief
  belum            tidak ada sesi dan tidak ada binding: topic-nya kosong
  tanpa-binding    sesi ada tapi binding-nya tidak: push jatuh ke lookup chat-wide, bisa nyasar
  sesi-diarsip     binding menunjuk sesi yang sudah di-archive
  melenceng        binding menunjuk sesi yang chat key-nya bukan topic lane ini

Berkas ini TIDAK menulis apa pun: basis datanya dibuka mode read-only.

Cara pakai:
  python3 tools/factory/cek_lane.py                      laporan saja, selalu exit 0
  python3 tools/factory/cek_lane.py --wajib-lengkap      exit 1 kalau ada lane yang bukan `terikat`
  python3 tools/factory/cek_lane.py --json               keluaran mesin
  python3 tools/factory/cek_lane.py --db /path/db        basis data lain
  python3 tools/factory/cek_lane.py --uji-mandiri
"""

import argparse
import json
import os
import sqlite3
import sys
import tempfile

DIR_INI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_INI)
import _umum as u  # noqa: E402

DB_BAWAAN = os.path.join(os.path.expanduser("~"), ".opencrabs", "opencrabs.db")

VERDICT = ["terikat", "belum", "tanpa-binding", "sesi-diarsip", "melenceng", "tanpa-db", "tanpa-tabel"]

def kunci_chat(grup, topic):
    """Kunci sesi yang dipakai OpenCrabs untuk satu topic forum (#215)."""
    return "[chat:%s:topic:%s]" % (grup, topic)

def periksa_lane(db, grup, lane):
    """Kembalikan (verdict, sesi_id, alasan). Tidak pernah melempar untuk kasus yang wajar."""
    topic = lane.get("topic")
    if topic is None:
        return "belum", None, "lane tidak punya topic di lanes.json"

    key = kunci_chat(grup, topic)
    sesi = [r[0] for r in db.execute(
        "SELECT id FROM sessions WHERE channel_chat_key = ? AND archived_at IS NULL", (key,))]
    binding = [r[0] for r in db.execute(
        "SELECT session_id FROM session_bindings WHERE channel='telegram' AND chat_id=? AND thread_id=?",
        (str(grup), topic))]

    if not sesi and not binding:
        return "belum", None, "belum ada sesi dan belum ada binding untuk %s" % key

    if len(sesi) > 1:
        return "melenceng", sesi[0], "%d sesi hidup memakai kunci %s" % (len(sesi), key)

    if sesi and not binding:
        return "tanpa-binding", sesi[0], "sesi %s tidak punya baris session_bindings" % sesi[0][:8]

    if not sesi and binding:
        sid = binding[0]
        baris = db.execute(
            "SELECT archived_at FROM sessions WHERE id = ?", (sid,)).fetchone()
        if baris and baris[0] is not None:
            return "sesi-diarsip", sid, "sesi %s di-archive, binding-nya tertinggal" % sid[:8]
        return "melenceng", sid, "binding menunjuk sesi %s yang bukan sesi topic ini" % sid[:8]

    if sesi[0] != binding[0]:
        return "melenceng", sesi[0], (
            "sesi %s memakai kunci %s, tapi binding topic %s menunjuk sesi %s"
            % (sesi[0][:8], key, topic, binding[0][:8]))

    return "terikat", sesi[0], "sesi %s dan binding topic %s sepakat" % (sesi[0][:8], topic)

def buka_db(path):
    """Buka read-only. Kembalikan (conn, masalah)."""
    if not os.path.isfile(path):
        return None, "basis data tidak ada: %s" % path
    try:
        conn = sqlite3.connect("file:%s?mode=ro" % path, uri=True)
    except sqlite3.Error as e:
        return None, "tidak bisa membuka %s: %s" % (path, e)
    for tabel in ("sessions", "session_bindings"):
        try:
            conn.execute("SELECT 1 FROM %s LIMIT 1" % tabel)
        except sqlite3.Error:
            return None, "tabel `%s` tidak ada di %s" % (tabel, path)
    return conn, None

def periksa_semua(db, grup, lanes):
    hasil = []
    for lane in lanes["lane"]:
        verdict, sesi, alasan = periksa_lane(db, grup, lane)
        hasil.append({
            "lane": lane["id"],
            "topic": lane.get("topic"),
            "verdict": verdict,
            "sesi": sesi,
            "alasan": alasan,
        })
    return hasil

def sesi_lane(db, grup, lanes, lane_id):
    """Sesi yang terikat ke topic lane itu, atau (None, alasan).

    Dipakai `pacemaker.py` (membangunkan lane) dan `lapor.py` (mengantarkan opsi ke owner).
    Keduanya butuh alamat push yang sama persis, dan dua salinan aturan itu pasti melenceng.
    """
    lane = u.cari_lane(lanes, lane_id)
    if lane is None:
        return None, "lane `%s` tidak ada di factory/lanes.json" % lane_id
    verdict, sesi, alasan = periksa_lane(db, grup, lane)
    if verdict != "terikat":
        return None, "lane %s belum siap dibrief (%s): %s" % (lane_id, verdict, alasan)
    return sesi, None

def cetak_tabel(hasil):
    print("%-10s %-6s %-14s %-10s %s" % ("LANE", "TOPIC", "VERDICT", "SESI", "KETERANGAN"))
    for h in hasil:
        print("%-10s %-6s %-14s %-10s %s" % (
            h["lane"],
            h["topic"] if h["topic"] is not None else "-",
            h["verdict"],
            (h["sesi"] or "-")[:8],
            h["alasan"],
        ))
    terikat = [h["lane"] for h in hasil if h["verdict"] == "terikat"]
    print("")
    print("%d dari %d lane terikat: %s" % (len(terikat), len(hasil), ", ".join(terikat) or "(tidak ada)"))

def uji_mandiri():
    """Pemeriksa yang cuma punya satu verdict belum membuktikan apa pun."""
    grup = u.grup()
    gagal = 0
    kasus = []

    def bangun_db(tmp, sesi=(), binding=()):
        path = os.path.join(tmp, "uji.db")
        c = sqlite3.connect(path)
        c.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, channel_chat_key TEXT, archived_at INTEGER)")
        c.execute("CREATE TABLE session_bindings (session_id TEXT PRIMARY KEY, channel TEXT, "
                  "chat_id TEXT, thread_id INTEGER, updated_at INTEGER)")
        for sid, key, arsip in sesi:
            c.execute("INSERT INTO sessions VALUES (?,?,?)", (sid, key, arsip))
        for sid, thread in binding:
            c.execute("INSERT INTO session_bindings VALUES (?,?,?,?,0)",
                      (sid, "telegram", str(grup), thread))
        c.commit()
        c.close()
        return path

    def jalankan(nama, siapkan, verdict_harap):
        with tempfile.TemporaryDirectory() as tmp:
            path = siapkan(tmp)
            db, masalah = buka_db(path)
            if db is None:
                verdict, _, _ = ("tanpa-db", None, masalah)
            else:
                lane = {"id": "payroll", "topic": 22}
                verdict, _, _ = periksa_lane(db, grup, lane)
            benar = verdict == verdict_harap
            print("  %s %-46s harap %-14s dapat %s" % (
                "LULUS " if benar else "GAGAL ", nama, verdict_harap, verdict))
            return 0 if benar else 1

    sid = "11111111-1111-1111-1111-111111111111"
    lain = "22222222-2222-2222-2222-222222222222"
    key22 = kunci_chat(grup, 22)

    def terikat(tmp):
        return bangun_db(tmp, sesi=[(sid, key22, None)], binding=[(sid, 22)])

    def kosong(tmp):
        return bangun_db(tmp)

    def sesi_tanpa_binding(tmp):
        return bangun_db(tmp, sesi=[(sid, key22, None)])

    def binding_tanpa_sesi(tmp):
        return bangun_db(tmp, binding=[(sid, 22)])

    def sesi_diarsip(tmp):
        return bangun_db(tmp, sesi=[(sid, key22, 1790000000)], binding=[(sid, 22)])

    def binding_nyasar(tmp):
        # Sesi hidup, tapi lahir di topic 1, sementara binding-nya menunjuk topic 22.
        return bangun_db(tmp, sesi=[(lain, kunci_chat(grup, 1), None)], binding=[(lain, 22)])

    def db_hilang(tmp):
        return os.path.join(tmp, "tidak-ada.db")

    kasus = [
        ("sesi dan binding sepakat", terikat, "terikat"),
        ("topic masih kosong", kosong, "belum"),
        ("sesi ada, binding tidak", sesi_tanpa_binding, "tanpa-binding"),
        ("binding ada, sesi tidak", binding_tanpa_sesi, "melenceng"),
        ("binding menunjuk sesi yang di-archive", sesi_diarsip, "sesi-diarsip"),
        ("binding menunjuk sesi topic lain", binding_nyasar, "melenceng"),
        ("basis data tidak ada", db_hilang, "tanpa-db"),
    ]

    for nama, siapkan, harap in kasus:
        gagal += jalankan(nama, siapkan, harap)

    print("")
    print("UJI MANDIRI: %d kasus, %d gagal" % (len(kasus), gagal))
    return gagal

def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=u.akar_factory())
    p.add_argument("--db", default=DB_BAWAAN)
    p.add_argument("--json", action="store_true")
    p.add_argument("--wajib-lengkap", action="store_true")
    p.add_argument("--uji-mandiri", action="store_true")
    a = p.parse_args()

    if a.uji_mandiri:
        return 1 if uji_mandiri() else 0

    akar = os.path.abspath(os.path.expanduser(a.akar))
    lanes = u.baca_json(os.path.join(akar, "factory", "lanes.json"))
    grup = u.grup(akar)
    if not grup:
        print("GAGAL  factory/identitas.json tidak memuat `grup`", file=sys.stderr)
        return 2

    db, masalah = buka_db(os.path.expanduser(a.db))
    if db is None:
        print("GAGAL  %s" % masalah, file=sys.stderr)
        return 2

    hasil = periksa_semua(db, grup, lanes)
    if a.json:
        print(json.dumps({"grup": grup, "lane": hasil}, indent=2, ensure_ascii=False))
    else:
        cetak_tabel(hasil)

    if a.wajib_lengkap:
        kurang = [h["lane"] for h in hasil if h["verdict"] != "terikat"]
        if kurang:
            print("")
            print("GAGAL  %d lane belum siap dibrief: %s" % (len(kurang), ", ".join(kurang)))
            return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
