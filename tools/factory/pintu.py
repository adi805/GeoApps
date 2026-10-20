#!/usr/bin/env python3
"""pintu.py - cek mekanis: lane dilarang menanyakan keputusan langsung ke owner.

Kenapa ada: `factory/LAW.md` 8.5 mewajibkan lane melaporkan opsi kerja lewat `usulan.py`, dan
melarang lane menanyakan keputusan langsung ke owner. Hukumnya sendiri mengakui kelemahannya:
"kalau satu aturan di sini tidak punya pemeriksa mesin, aturan itu ditandai `[prosa]`, dan yang
bertanda itu boleh dilanggar tanpa ada yang menolak." Itu yang terjadi pada 2026-10-10 05:02 WIB,
lane `HQ` mengirim 4 pilihan ke owner di topic 23 dan keputusannya nyangkut di meja owner.

Alat ini membuat aturan itu bisa DITOLAK. Satu-satunya cara sebuah lane "bertanya ke owner" di
OpenCrabs adalah memanggil tool `suggest_options`: tombol pilihan selalu lahir dari situ. Jadi
pemeriksanya sederhana dan keras: ada tidak panggilan `suggest_options` di tabel `tool_executions`
yang berasal dari SESI LANE di dalam jendela waktu tertentu.

Sesi lane diambil dari `factory/lanes.json` + `~/.opencrabs/opencrabs.db` lewat jalur yang sama
dengan `pacemaker.py` dan `lapor.py` (`cek_lane.sesi_lane`), supaya tidak ada dua salinan aturan
alamat sesi.

Basis data dibuka read-only. Alat ini tidak menulis berkas dan tidak mengirim pesan.

Verdict (satu per baris mesin):
  bersih        nol pelanggaran di jendela itu
  melanggar     ada lane yang memanggil `suggest_options` ke owner
  tanpa-db      basis data tidak ada
  tanpa-tabel   tabel `tool_executions` tidak ada di basis data itu

Cara pakai:
  python3 tools/factory/pintu.py                       laporan saja, selalu exit 0
  python3 tools/factory/pintu.py --wajib-bersih        exit 1 kalau ada pelanggaran
  python3 tools/factory/pintu.py --sejak 20            jendela 20 menit terakhir (bawaan 60)
  python3 tools/factory/pintu.py --json                keluaran mesin
  python3 tools/factory/pintu.py --db /path/db         basis data lain
  python3 tools/factory/pintu.py --uji-mandiri
"""

import argparse
import json
import os
import sqlite3
import sys
import tempfile
import time

DIR_INI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_INI)
import _umum as u  # noqa: E402
import cek_lane  # noqa: E402

DB_BAWAAN = os.path.join(os.path.expanduser("~"), ".opencrabs", "opencrabs.db")
AKAR_BAWAAN = os.path.abspath(os.path.join(DIR_INI, "..", ".."))
SEJAK_BAWAAN = 60
TOOL_TERLARANG = "suggest_options"


def sesi_lane_semua(db, grup, lanes):
    """[(lane_id, sesi_id)] untuk tiap lane yang sesinya terikat. Lane yang belum siap dilewati.

    Lane yang belum punya sesi hidup tidak bisa melanggar apa pun, jadi dia dilewati tanpa
    membuat alat ini berbunyi. Yang dicari cuma lane yang benar-benar punya alamat.
    """
    keluar = []
    for lane in lanes.get("lane") or []:
        sesi, _ = cek_lane.sesi_lane(db, grup, lanes, lane["id"])
        if sesi:
            keluar.append((lane["id"], sesi))
    return keluar


def periksa_tabel(db):
    """Kembalikan alasan kalau `tool_executions` tidak ada, atau None."""
    baris = db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='tool_executions'").fetchone()
    if not baris:
        return "tabel `tool_executions` tidak ada"
    return None


def pelanggaran(db, sesi_map, sejak_ts):
    """Panggilan `suggest_options` dari sesi lane sesudah `sejak_ts`."""
    if not sesi_map:
        return []
    peta = {s: l for l, s in sesi_map}
    tanda = ",".join("?" for _ in peta)
    sql = ("SELECT session_id, created_at FROM tool_executions "
           "WHERE tool_name = ? AND created_at >= ? AND session_id IN (%s) "
           "ORDER BY created_at" % tanda)
    arg = [TOOL_TERLARANG, sejak_ts] + list(peta.keys())
    return [{"lane": peta.get(sid, "?"), "sesi": sid, "ts": ts} for sid, ts in db.execute(sql, arg)]


def jalankan(db_path, akar, sejak_menit, sekarang=None):
    """Kembalikan (verdict, daftar_pelanggaran, alasan)."""
    lanes_path = os.path.join(akar, "factory", "lanes.json")
    if not os.path.isfile(lanes_path):
        return "tanpa-db", [], "factory/lanes.json tidak ada di %s" % akar
    lanes = u.baca_json(lanes_path)

    db, masalah = cek_lane.buka_db(db_path)
    if db is None:
        return "tanpa-db", [], masalah

    masalah_tabel = periksa_tabel(db)
    if masalah_tabel:
        return "tanpa-tabel", [], masalah_tabel

    sesi_map = sesi_lane_semua(db, u.grup(akar), lanes)
    kini = int(sekarang if sekarang is not None else time.time())
    langgar = pelanggaran(db, sesi_map, kini - sejak_menit * 60)
    if langgar:
        return "melanggar", langgar, "%d panggilan %s dari sesi lane" % (len(langgar), TOOL_TERLARANG)
    return "bersih", [], "%d lane diperiksa, nol panggilan %s" % (len(sesi_map), TOOL_TERLARANG)


def cetak(verdict, langgar, alasan, sejak_menit):
    print("PINTU  %-12s jendela %d menit: %s" % (verdict, sejak_menit, alasan))
    for p in langgar:
        print("   lane %-10s sesi %s  %s" % (
            p["lane"], p["sesi"][:8],
            time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(p["ts"]))))
    if langgar:
        print("   lane wajib melapor lewat `usulan.py`; agent yang mengantarkan ke owner.")


def teks_lapor(langgar):
    """Pesan yang dikirim ke sesi agent kalau ada lane yang menembus pintu keputusan."""
    baris = ["%d panggilan `suggest_options` dari sesi LANE - lane menanyakan keputusan langsung"
             " ke owner, bukan lewat `usulan.py`." % len(langgar), ""]
    for p in langgar:
        baris.append("- lane %s, sesi %s, %s" % (
            p["lane"], p["sesi"][:8],
            time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(p["ts"]))))
    baris.append("")
    baris.append("Aturan: lane melapor lewat `usulan.py`; agent yang mengantarkan ke owner.")
    baris.append("Sumber: factory/LAW.md 8.5. Pemeriksa: tools/factory/pintu.py.")
    return "\n".join(baris)


def lapor_agent(db_path, akar, langgar, oc_bin):
    """Kirim pelanggaran ke sesi agent. Kembalikan (aksi, pesan)."""
    import lapor  # impor lokal: lapor.py tidak boleh mengimpor pintu.py (menghindari lingkar)
    sesi, alasan = lapor.sesi_owner(db_path, akar)
    if sesi is None:
        return "diam", "ada %d pelanggaran, tapi %s" % (len(langgar), alasan)
    kode, keluar, galat = lapor.jalan([oc_bin, "session", "notify", sesi,
                                       "--text", teks_lapor(langgar),
                                       "--mode", "turn-end", "--sender", "pintu"])
    if kode != 0:
        return "diam", "notify gagal (exit %d): %s" % (kode, (galat or keluar).strip()[:200])
    return "lapor", "%d pelanggaran terkirim ke sesi %s" % (len(langgar), sesi[:8])


def uji_mandiri():
    """Cek yang cuma pernah bilang `bersih` belum membuktikan ia bisa menolak."""
    grup = u.grup()
    sid = "11111111-1111-1111-1111-111111111111"
    lain = "22222222-2222-2222-2222-222222222222"
    kini = 1800000000

    def bangun(tmp, baris_tool=(), ada_tabel=True, sesi=(), binding=()):
        path = os.path.join(tmp, "uji.db")
        c = sqlite3.connect(path)
        c.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, channel_chat_key TEXT, archived_at INTEGER)")
        c.execute("CREATE TABLE session_bindings (session_id TEXT PRIMARY KEY, channel TEXT, "
                  "chat_id TEXT, thread_id INTEGER, updated_at INTEGER)")
        if ada_tabel:
            c.execute("CREATE TABLE tool_executions (id TEXT PRIMARY KEY, message_id TEXT, "
                      "session_id TEXT NOT NULL DEFAULT '', tool_name TEXT NOT NULL, created_at INTEGER)")
        for s, key in sesi:
            c.execute("INSERT INTO sessions VALUES (?,?,NULL)", (s, key))
        for s, thread in binding:
            c.execute("INSERT INTO session_bindings VALUES (?,?,?,?,0)", (s, "telegram", str(grup), thread))
        for n, (s, tool, ts) in enumerate(baris_tool):
            c.execute("INSERT INTO tool_executions VALUES (?,?,?,?,?)", ("t%d" % n, "m", s, tool, ts))
        c.commit()
        c.close()
        return path

    def akar_palsu(base, owner_kanal=None):
        os.makedirs(os.path.join(base, "factory"), exist_ok=True)
        u.tulis_identitas(base, grup=grup, owner={"kanal": owner_kanal or ""})
        d = {"lane": [{"id": "payroll", "topic": 22}]}
        with open(os.path.join(base, "factory", "lanes.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        return base

    def terikat(tmp):
        return bangun(tmp, sesi=[(sid, cek_lane.kunci_chat(grup, 22))], binding=[(sid, 22)])

    kasus = [
        ("lane pakai suggest_options di jendela", "melanggar",
         lambda t: (akar_palsu(t), bangun(t, baris_tool=[(sid, TOOL_TERLARANG, kini - 300)],
                                         sesi=[(sid, cek_lane.kunci_chat(grup, 22))], binding=[(sid, 22)]))),
        ("sesi BUKAN lane pakai suggest_options", "bersih",
         lambda t: (akar_palsu(t), bangun(t, baris_tool=[(lain, TOOL_TERLARANG, kini - 300)],
                                         sesi=[(sid, cek_lane.kunci_chat(grup, 22))], binding=[(sid, 22)]))),
        ("lane pakai suggest_options di luar jendela", "bersih",
         lambda t: (akar_palsu(t), bangun(t, baris_tool=[(sid, TOOL_TERLARANG, kini - 7200)],
                                         sesi=[(sid, cek_lane.kunci_chat(grup, 22))], binding=[(sid, 22)]))),
        ("lane pakai tool lain", "bersih",
         lambda t: (akar_palsu(t), bangun(t, baris_tool=[(sid, "usulan", kini - 300)],
                                         sesi=[(sid, cek_lane.kunci_chat(grup, 22))], binding=[(sid, 22)]))),
        ("lane belum punya sesi", "bersih",
         lambda t: (akar_palsu(t), bangun(t, baris_tool=[(sid, TOOL_TERLARANG, kini - 300)]))),
        ("tabel tool_executions tidak ada", "tanpa-tabel",
         lambda t: (akar_palsu(t), bangun(t, ada_tabel=False,
                                         sesi=[(sid, cek_lane.kunci_chat(grup, 22))], binding=[(sid, 22)]))),
        ("basis data hilang", "tanpa-db",
         lambda t: (akar_palsu(t), os.path.join(t, "tidak-ada.db"))),
    ]

    gagal = 0
    for nama, harap, siapkan in kasus:
        with tempfile.TemporaryDirectory() as t:
            akar, db = siapkan(t)
            verdict, _, _ = jalankan(db, akar, 60, sekarang=kini)
        benar = verdict == harap
        gagal += 0 if benar else 1
        print("  %s %-44s harap %-12s dapat %s" % (
            "LULUS " if benar else "GAGAL ", nama, harap, verdict))
    # Jalur lapor ke sesi agent: kanal agent ada = kirim, kanal agent kosong = diam.
    def uji_lapor(tmp, owner_kanal, sesi, nama, harap, catat):
        akar = akar_palsu(tmp, owner_kanal=owner_kanal)
        db = bangun(tmp, sesi=sesi)
        log = os.path.join(tmp, "notify.log")
        oc = os.path.join(tmp, "opencrabs-palsu")
        with open(oc, "w", encoding="utf-8") as f:
            f.write("#!/bin/sh\necho \"$@\" >> %s\n" % log)
        os.chmod(oc, 0o755)
        aksi, _ = lapor_agent(db, akar, [{"lane": "payroll", "sesi": sid, "ts": kini}], oc)
        dipanggil = os.path.isfile(log)
        benar = aksi == harap and dipanggil == catat
        print("  %s %-44s harap %-12s dapat %s" % (
            "LULUS " if benar else "GAGAL ", nama, harap, aksi))
        return 0 if benar else 1

    for nama, owner_kanal, sesi, harap, catat in [
        ("lapor_agent kanal agent ada", "[chat:%d]" % grup, [(sid, "[chat:%d]" % grup)], "lapor", True),
        ("lapor_agent kanal agent kosong", None, [(sid, "[chat:%d]" % grup)], "diam", False),
    ]:
        with tempfile.TemporaryDirectory() as t:
            gagal += uji_lapor(t, owner_kanal, sesi, nama, harap, catat)

    # Penjaga branch diuji di sini juga (#160).
    n_jaga, gagal_jaga = u.uji_penjaga_branch()
    gagal += gagal_jaga

    print("  %d kasus, %d gagal" % (len(kasus) + 2 + n_jaga, gagal))
    return 1 if gagal else 0


def main():
    p = argparse.ArgumentParser(description="Lane dilarang menanyakan keputusan langsung ke owner.")
    p.add_argument("--akar", default=AKAR_BAWAAN, help="akar repo (bawaan: dua tingkat di atas tools/factory)")
    p.add_argument("--db", default=DB_BAWAAN)
    p.add_argument("--sejak", type=int, default=SEJAK_BAWAAN, help="jendela menit (bawaan 60)")
    p.add_argument("--wajib-bersih", action="store_true", help="exit 1 kalau ada pelanggaran")
    p.add_argument("--lapor", action="store_true", help="kirim pelanggaran ke sesi agent")
    p.add_argument("--oc-bin", default="opencrabs")
    p.add_argument("--json", action="store_true")
    p.add_argument("--uji-mandiri", action="store_true")
    a = p.parse_args()

    if a.uji_mandiri:
        return uji_mandiri()

    # Pemeriksa pelanggaran "lane menanyakan keputusan ke owner" juga tidak boleh jalan dari kode
    # basi: putusannya dipakai untuk menuduh lane lain (#160).
    if u.jalankan_penjaga_branch():
        return 1

    verdict, langgar, alasan = jalankan(a.db, a.akar, a.sejak)
    if a.json:
        print(json.dumps({"verdict": verdict, "pelanggaran": langgar, "alasan": alasan}, ensure_ascii=False))
    else:
        cetak(verdict, langgar, alasan, a.sejak)
    if a.lapor and verdict == "melanggar":
        aksi, pesan = lapor_agent(a.db, a.akar, langgar, a.oc_bin)
        print("LAPOR  %-8s %s" % (aksi, pesan))
    if a.wajib_bersih and verdict == "melanggar":
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())