#!/usr/bin/env python3
"""gate_kanal.py - tolak alamat laporan agent yang salah.

Kenapa ada: `factory/lanes.json` menyimpan `owner.kanal`, dan itu satu-satunya alamat yang dipakai
`lapor.py` (digest opsi), `pintu.py` (peringatan pelanggaran), `pacemaker.py`, dan `skor.py` untuk
membangunkan agent. Nol langkah CI yang memeriksanya, jadi dua kelas kegagalan yang SUDAH kejadian
lolos tanpa satu pun penolakan:

  1. Digest mendarat di ruangan lane. Sebelum #178, cadangan `lapor.py` adalah lane `HQ`, jadi
     begitu sesi agent tidak ada, digest opsi masuk ke topic lane - ruangan yang justru dibaca
     owner. Dari kursi owner itu terbaca persis seperti lane menanyakan keputusan langsung ke
     owner.
  2. Kanal salah alamat. Kunci sesi berbentuk `[chat:<grup>]` atau `[chat:<grup>:topic:<N>]`, dan
     salah grup atau salah topic berarti pesan terkirim TANPA error ke ruangan yang salah.
     `lapor.py` diam saja (opsinya tetap `menunggu`, tidak ada yang hilang, cuma tertunda).

Dua-duanya senyap: pesan terkirim, exit 0, nol jejak kegagalan. Gate ini yang membuatnya berisik.

Pemeriksaan sesinya memakai `lapor.sesi_owner()`, bukan salinan logikanya, supaya yang diperiksa
gate persis yang akan dijalankan `lapor.py`. Dua salinan aturan alamat pasti melenceng.

Batas yang disengaja: runner CI tidak punya `~/.opencrabs/opencrabs.db`, jadi pemeriksaan sesi
dilewati DI SANA dengan baris `LEWAT` yang menyebut berapa pemeriksaan yang tidak dijalankan -
gate yang memeriksa nol objek lalu keluar 0 menghasilkan laporan kosong yang terbaca seperti hijau
(LAW 8.1). Pemeriksaan sesinya dibuktikan di CI lewat `--uji-mandiri`, dan dijalankan hidup oleh
agent lokal dengan `--wajib-db`.

Cara pakai:
  python3 tools/factory/gate_kanal.py                     laporan + exit 0/1
  python3 tools/factory/gate_kanal.py --wajib-db          DB wajib ada; hilang = tolak
  python3 tools/factory/gate_kanal.py --db /path/oc.db    basis data lain
  python3 tools/factory/gate_kanal.py --uji-mandiri
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import tempfile

DIR_INI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_INI)
import _umum as u  # noqa: E402
import cek_lane  # noqa: E402
import lapor  # noqa: E402

# Kunci sesi OpenCrabs untuk chat dan topic forum. Grup bisa negatif (`-100...`), jadi angkanya
# ditulis `-?\d+`; topic selalu positif.
BENTUK = re.compile(r"^\[chat:(-?\d+)(?::topic:(\d+))?\]$")


def periksa_bentuk(lanes, kanal, grup):
    """Alasan (daftar) kenapa bentuk kanal ditolak. Kosong = lolos. Tidak menyentuh basis data."""
    alasan = []
    if not isinstance(kanal, str) or not kanal.strip():
        return ["`owner.kanal` kosong di factory/identitas.json: laporan agent tidak punya alamat"]

    cocok = BENTUK.match(kanal.strip())
    if not cocok:
        return [
            "`owner.kanal` bukan kunci sesi yang sah: %r (bentuknya `[chat:<grup>]` atau "
            "`[chat:<grup>:topic:<N>]`)" % kanal
        ]

    grup_kanal, topic = cocok.group(1), cocok.group(2)
    grup_papan = str(grup)
    if grup_kanal != grup_papan:
        alasan.append(
            "`owner.kanal` menunjuk grup %s, bukan grup papan ini %s: laporan agent mendarat di "
            "ruangan orang lain" % (grup_kanal, grup_papan)
        )

    # Kelas kegagalan 1: alamat yang dibaca owner, bukan alamat agent.
    if topic is not None:
        for lane in lanes.get("lane") or []:
            if str(lane.get("topic")) == topic:
                alasan.append(
                    "`owner.kanal` menunjuk topic %s, yaitu topic lane `%s`. Digest di situ "
                    "mendarat di ruangan yang dibaca owner, jadi lane terbaca seperti menanyakan "
                    "keputusan langsung ke owner (#179)." % (topic, lane.get("id"))
                )

    return alasan


def periksa_sesi(db_path, akar):
    """(sesi, alasan) dari `lapor.sesi_owner`. `sesi` None berarti alasan berisi kenapa."""
    sesi, alasan = lapor.sesi_owner(db_path, akar)
    if sesi is None:
        return None, [alasan or "kanal agent tidak punya sesi hidup"]
    return sesi, []


def periksa(akar, db_path):
    """(alasan, sesi, db_hilang). SATU jalur, dipakai `main()` DAN `uji_mandiri()`.

    Dipisah begini supaya uji mandiri menguji keputusan yang sama dengan yang dijalankan di
    produksi. Uji yang menyalin logikanya sendiri membuktikan salinannya bisa menolak, bukan
    gate-nya.
    """
    berkas = u.jalur_identitas(akar)
    if not os.path.isfile(berkas):
        return ["factory/identitas.json tidak ada di %s" % akar], None, False
    lanes = u.baca_json(os.path.join(akar, "factory", "lanes.json"))
    kanal = u.kanal_owner(akar)

    alasan = periksa_bentuk(lanes, kanal, u.grup(akar))
    if alasan:
        return alasan, None, False

    db_hilang = not os.path.isfile(db_path)
    if db_hilang:
        # Runner CI tidak punya basis data. Yang penting: yang dilewati DISEBUT jumlahnya.
        return [], None, True

    sesi, alasan = periksa_sesi(db_path, akar)
    return alasan, sesi, False


def uji_mandiri():
    """Gate yang cuma pernah bilang LULUS belum membuktikan bisa menolak."""
    gagal = 0
    kasus = []
    grup = u.grup()
    KANAL = u.kanal_owner()

    def siapkan_akar(tmp, kanal=KANAL, lane_topic=23, grup_lanes=grup):
        u.tulis_identitas(tmp, grup=grup_lanes, owner={"kanal": kanal})
        d = {"versi": 1, "lane": [{"id": "HQ", "topic": lane_topic}]}
        os.makedirs(os.path.join(tmp, "factory"), exist_ok=True)
        with open(os.path.join(tmp, "factory", "lanes.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        return tmp

    def siapkan_db(tmp, kanal=KANAL, jumlah=1, arsip=False):
        path = os.path.join(tmp, "uji.db")
        c = sqlite3.connect(path)
        c.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, channel_chat_key TEXT, archived_at INTEGER)")
        c.execute("CREATE TABLE session_bindings (session_id TEXT PRIMARY KEY, channel TEXT, "
                  "chat_id TEXT, thread_id INTEGER, updated_at INTEGER)")
        if kanal:
            for n in range(jumlah):
                sid = "%08d-5555-5555-5555-555555555555" % (n + 1)
                c.execute("INSERT INTO sessions VALUES (?,?,?)", (sid, kanal, 1 if arsip else None))
        c.commit()
        c.close()
        return path

    def jalankan(nama, harap_lulus, kanal=KANAL, jumlah=1, arsip=False, ada_db=True,
                 lane_topic=23, grup_lanes=grup):
        nonlocal gagal
        with tempfile.TemporaryDirectory() as tmp:
            akar = siapkan_akar(tmp, kanal=kanal, lane_topic=lane_topic, grup_lanes=grup_lanes)
            db = siapkan_db(tmp, kanal, jumlah, arsip) if ada_db else os.path.join(tmp, "tidak-ada.db")
            alasan, sesi, db_hilang = periksa(akar, db)
            # `db_hilang` di uji ini SELALU dihitung tolak: uji mandiri menuntut jalur hidup
            # membuktikan sesinya, bukan lewat pintu `LEWAT` yang disediakan untuk runner CI.
            lulus = not alasan and not db_hilang
            benar = lulus == harap_lulus
            print("  %s %-46s %s" % (
                "LULUS " if benar else "GAGAL ",
                nama,
                "diterima" if lulus else "ditolak: %s" % (
                    alasan[0] if alasan else "basis data tidak ada (LEWAT)")[:70],
            ))
            gagal += 0 if benar else 1
            kasus.append(nama)

    jalankan("kanal agent sah, satu sesi hidup", True)
    jalankan("kanal tanpa topic (chat-wide) sah", True, kanal="[chat:%d]" % grup)
    jalankan("kanal kosong ditolak", False, kanal="")
    jalankan("kanal bukan kunci sesi ditolak", False, kanal="[chat]")
    # Grup lain dihitung dari grup yang sedang dipakai: nilai literal bisa kebetulan SAMA dengan
    # grup proyek yang identitasnya memakai angka itu, dan kasus negatifnya lalu lolos.
    jalankan("kanal grup lain ditolak", False, kanal="[chat:%d:topic:262]" % (int(grup) - 1))
    jalankan("kanal menunjuk topic lane ditolak", False, kanal="[chat:%d:topic:23]" % grup)
    jalankan("kanal nol sesi hidup ditolak", False, jumlah=0)
    jalankan("kanal dua sesi hidup ditolak", False, jumlah=2)
    jalankan("kanal sesi terarsip ditolak", False, arsip=True)
    jalankan("basis data tidak ada ditolak", False, ada_db=False)

    print("")
    print("UJI MANDIRI gate_kanal: %d kasus, %d gagal" % (len(kasus), gagal))
    return 1 if gagal else 0


def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=u.akar_factory())
    p.add_argument("--db", default=cek_lane.DB_BAWAAN)
    p.add_argument("--wajib-db", action="store_true")
    p.add_argument("--uji-mandiri", action="store_true")
    a = p.parse_args()

    if a.uji_mandiri:
        return uji_mandiri()

    akar = os.path.abspath(os.path.expanduser(a.akar))
    db_path = os.path.abspath(os.path.expanduser(a.db))
    alasan, sesi, db_hilang = periksa(akar, db_path)

    if alasan:
        return u.tolak("alamat laporan agent tidak sah", alasan)

    if db_hilang:
        # Runner CI tidak punya basis data. Yang penting: yang dilewati DISEBUT jumlahnya, tidak
        # diam-diam hijau.
        print("LEWAT  pemeriksaan sesi tidak dijalankan: basis data tidak ada (%s)" % db_path)
        if a.wajib_db:
            return u.tolak(
                "alamat laporan agent tidak bisa dibuktikan",
                ["--wajib-db diminta tapi basis data tidak ada: %s" % db_path],
            )
        return u.lulus(
            "kanal agent: bentuk, grup, dan tabrakan topic lolos; 2 pemeriksaan sesi DILEWATI "
            "(tanpa --wajib-db)"
        )

    return u.lulus("kanal agent: 5 pemeriksaan lolos, digest mendarat di sesi %s" % sesi[:8])


if __name__ == "__main__":
    sys.exit(main())
