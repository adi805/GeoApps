#!/usr/bin/env python3
"""lapor.py - antarkan opsi pekerjaan lane ke sesi agent, tanpa satu pun token LLM.

Kenapa ada: `usulan.py` mencatat opsi pekerjaan, dan `pacemaker.py` membangunkan sesi lane kalau
ada sinyal kerja. Yang belum ada jalurnya: opsi yang menunggu keputusan tidak pernah sampai ke
agent, jadi agent harus mengejar sendiri dan keputusan menumpuk di kepala lane.

Berkas ini membaca `factory/usulan.jsonl`, menyusun digest opsi yang masih `menunggu`, dan
mengirimnya ke sesi agent. Sesi agent diambil dari `owner.kanal` di `factory/lanes.json`. Opsi yang
sudah dikirim ditandai lewat `usulan.tandai_dilaporkan`, jadi tidak terkirim dua kali.

Kalau sesi agent tidak ada, berkas ini DIAM dan opsinya tetap `menunggu`. Dulu lane `HQ` dipakai
sebagai cadangan, tapi topic lane itu justru ruangan yang dibaca owner: begitu sesi agent tidak ada,
digest mendarat di situ, dan dari kursi owner kelihatan persis seperti lane menanyakan keputusan
langsung ke owner. Diam yang tercatat lebih baik daripada terkirim ke ruangan yang salah.

Yang dibayar hanya saat ada opsi baru: notify masuk ke sesi owner yang sudah ada, dan gate-nya
Python murni tanpa LLM.

Cara pakai:
  python3 tools/factory/lapor.py --kering        putuskan saja, jangan kirim
  python3 tools/factory/lapor.py                 kirim kalau ada opsi menunggu
  python3 tools/factory/lapor.py --paksa         kirim ulang opsi yang sudah dilaporkan
  python3 tools/factory/lapor.py --uji-mandiri
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
import usulan  # noqa: E402

def jalan(cmd):
    """Jalankan perintah, kembalikan (exit_code, stdout, stderr). Tidak pernah melempar."""
    try:
        h = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError) as e:
        return 127, "", str(e)
    return h.returncode, h.stdout, h.stderr

def opsi_menunggu(akar, paksa):
    """Opsi yang perlu dikirim: berstatus `menunggu`, atau semua yang belum diputuskan kalau paksa."""
    rec = usulan.daftar(akar, None)
    if paksa:
        return [r for r in rec if r.get("status") in ("menunggu", "dilaporkan")]
    return [r for r in rec if r.get("status") == "menunggu"]

def teks_digest(rec):
    """Digest yang alamatnya agent, bukan owner.

    Agent yang memutuskan: menyelesaikannya sendiri, atau meminta approval owner kalau keputusannya
    memang milik owner. Karena itu teksnya menyebut dua jalur itu, bukan menyuruh owner memutuskan.
    """
    baris = ["%d opsi pekerjaan menunggu keputusan agent." % len(rec), ""]
    for r in rec:
        baris.append("%s [%s] %s" % (r["id"], r.get("lane", "?"), r.get("ringkas", "")))
        for n, o in enumerate(r.get("opsi") or [], 1):
            tanda = "  <- rekomendasi" if r.get("rekomendasi") == n else ""
            baris.append("   %d. %s%s" % (n, o, tanda))
        if r.get("dampak_tunda"):
            baris.append("   dampak tunda: %s" % r["dampak_tunda"])
        if r.get("issue"):
            baris.append("   issue: #%s" % r["issue"])
        baris.append("")
    baris.append("Putuskan sendiri: python3 tools/factory/usulan.py putuskan <id> --pilihan <n> --oleh agent")
    baris.append("Minta approval owner hanya kalau keputusannya memang milik owner.")
    return "\n".join(baris)

def sesi_owner(db_path, akar):
    """Sesi agent dari `owner.kanal`, atau (None, alasan).

    Jalur ini satu-satunya. Lane `HQ` dulu dipakai sebagai cadangan, dan itu keliru: topic lane
    adalah ruangan yang dibaca owner, jadi begitu sesi agent tidak ada, digest mendarat di ruangan
    yang justru bikin lane kelihatan menanyakan keputusan langsung ke owner. Kalau kanalnya tidak
    diisi, atau tidak punya TEPAT satu sesi hidup, fungsi ini menyerahkan alasan dan pemanggilnya
    diam. Opsinya tetap `menunggu`, jadi tidak ada yang hilang, cuma tertunda.
    """
    db, masalah = cek_lane.buka_db(db_path)
    if db is None:
        return None, masalah
    kanal = u.kanal_owner(akar)
    if not kanal:
        return None, "owner.kanal tidak diisi di factory/identitas.json"
    baris = [r[0] for r in db.execute(
        "SELECT id FROM sessions WHERE channel_chat_key = ? AND archived_at IS NULL", (kanal,))]
    if len(baris) == 1:
        return baris[0], None
    if not baris:
        return None, "tidak ada sesi hidup di kanal agent %s" % kanal
    return None, "kanal agent %s punya %d sesi hidup, harus tepat satu" % (kanal, len(baris))

def putuskan(akar, db_path, oc_bin, kering=False, paksa=False):
    """Inti gate: kembalikan (aksi, pesan). aksi: `diam` atau `laporkan`."""
    rec = opsi_menunggu(akar, paksa)
    if not rec:
        return "diam", "tidak ada opsi menunggu keputusan"

    sesi, alasan = sesi_owner(db_path, akar)
    if sesi is None:
        return "diam", "ada %d opsi, tapi %s" % (len(rec), alasan)

    if kering:
        return "laporkan", "kering: akan kirim %d opsi ke sesi %s" % (len(rec), sesi[:8])

    teks = teks_digest(rec)
    kode, keluar, galat = jalan([oc_bin, "session", "notify", sesi, "--text", teks,
                                 "--mode", "turn-end", "--sender", "lapor"])
    if kode != 0:
        return "diam", "notify gagal (exit %d): %s" % (kode, (galat or keluar).strip()[:200])
    usulan.tandai_dilaporkan(akar, [r["id"] for r in rec if r.get("status") == "menunggu"])
    return "laporkan", "digest %d opsi terkirim ke sesi %s" % (len(rec), sesi[:8])

def uji_mandiri():
    """Gate yang cuma pernah bilang `laporkan` belum membuktikan ia bisa diam, dan sebaliknya."""
    grup = u.grup()
    gagal = 0
    kasus = []

    def siapkan_akar(tmp, lanes=("HQ", "sync"), owner_kanal=None):
        topik = {"HQ": 23, "sync": 476}
        u.tulis_identitas(tmp, grup=grup, owner={"kanal": owner_kanal or ""})
        d = {"versi": 1, "lane": [{"id": i, "topic": topik[i]} for i in lanes]}
        os.makedirs(os.path.join(tmp, "factory"), exist_ok=True)
        with open(os.path.join(tmp, "factory", "lanes.json"), "w", encoding="utf-8") as f:
            json.dump(d, f)
        return tmp

    KANAL = "[chat:%d]" % grup

    def siapkan_db(tmp, kanal=None, jumlah_sesi=1):
        path = os.path.join(tmp, "uji.db")
        c = sqlite3.connect(path)
        c.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, channel_chat_key TEXT, archived_at INTEGER)")
        c.execute("CREATE TABLE session_bindings (session_id TEXT PRIMARY KEY, channel TEXT, "
                  "chat_id TEXT, thread_id INTEGER, updated_at INTEGER)")
        if kanal:
            for n in range(jumlah_sesi):
                sid = "%08d-5555-5555-5555-555555555555" % (n + 1)
                c.execute("INSERT INTO sessions VALUES (?,?,NULL)", (sid, kanal))
                c.execute("INSERT INTO session_bindings VALUES (?,?,?,?,0)",
                          (sid, "telegram", str(grup), 0))
        c.commit()
        c.close()
        return path

    def siapkan_oc(tmp):
        log = os.path.join(tmp, "notify.log")
        oc = os.path.join(tmp, "opencrabs-palsu")
        with open(oc, "w", encoding="utf-8") as f:
            f.write("#!/bin/sh\necho \"$@\" >> %s\n" % log)
        os.chmod(oc, 0o755)
        return oc, log

    def jalankan(nama, isi_usulan, kanal_owner, jumlah_sesi, harap_aksi, harap_notify,
                 kering=False, paksa=False):
        nonlocal gagal
        with tempfile.TemporaryDirectory() as tmp:
            akar = siapkan_akar(tmp, owner_kanal=kanal_owner)
            db = siapkan_db(tmp, kanal_owner, jumlah_sesi)
            oc, log = siapkan_oc(tmp)
            for s in isi_usulan:
                usulan.catat(akar, s["lane"], s["ringkas"], s["opsi"],
                             s.get("rekomendasi"), "", None)
            aksi, pesan = putuskan(akar, db, oc, kering=kering, paksa=paksa)
            dipanggil = os.path.isfile(log)
            benar = aksi == harap_aksi and dipanggil == harap_notify
            print("  %s %-46s aksi=%-10s notify=%s" % (
                "LULUS " if benar else "GAGAL ", nama, aksi, "ya" if dipanggil else "tidak"))
            if not benar:
                print("         harap aksi=%s notify=%s; %s" % (harap_aksi, harap_notify, pesan))
            gagal += 0 if benar else 1
            kasus.append(nama)
            return akar, oc, db

    satu = [{"lane": "sync", "ringkas": "pisah tabel sync", "opsi": ["pisah", "biarkan"], "rekomendasi": 1}]
    jalankan("tidak ada opsi", [], KANAL, 1, "diam", False)
    jalankan("kanal agent ada, satu sesi", satu, KANAL, 1, "laporkan", True)
    jalankan("kanal agent kosong", satu, None, 1, "diam", False)
    jalankan("kanal agent nol sesi", satu, KANAL, 0, "diam", False)
    jalankan("kanal agent dua sesi", satu, KANAL, 2, "diam", False)
    jalankan("kering tidak mengirim", satu, KANAL, 1, "laporkan", False, kering=True)

    # Sinyal yang sama tidak boleh terkirim dua kali, tapi --paksa boleh mengulang.
    with tempfile.TemporaryDirectory() as tmp:
        akar = siapkan_akar(tmp, owner_kanal=KANAL)
        db = siapkan_db(tmp, KANAL)
        oc, log = siapkan_oc(tmp)
        usulan.catat(akar, "sync", "pisang", ["A", "B"], 1, "", None)
        aksi1, _ = putuskan(akar, db, oc)
        aksi2, pesan2 = putuskan(akar, db, oc)
        aksi3, _ = putuskan(akar, db, oc, paksa=True)
        benar = aksi1 == "laporkan" and aksi2 == "diam" and aksi3 == "laporkan"
        print("  %s %-46s run1=%s run2=%s paksa=%s" % (
            "LULUS " if benar else "GAGAL ", "opsi sama tidak lapor dua kali", aksi1, aksi2, aksi3))
        if not benar:
            print("         %s" % pesan2)
        gagal += 0 if benar else 1
        kasus.append("idempoten")

    # Opsi yang sudah diputuskan tidak boleh ikut terkirim.
    with tempfile.TemporaryDirectory() as tmp:
        akar = siapkan_akar(tmp, owner_kanal=KANAL)
        db = siapkan_db(tmp, KANAL)
        oc, log = siapkan_oc(tmp)
        usulan.catat(akar, "sync", "sudah diputus", ["A", "B"], None, "", None)
        # Id-nya dibaca dari usulan yang barusan dicatat, bukan ditulis tangan: sejak #121 id memuat
        # lane dan akar acak, jadi tidak ada lagi bentuk `u-0001` yang bisa ditebak.
        usulan.putuskan(akar, usulan.daftar(akar, "menunggu")[0]["id"], 1, "owner")
        aksi, pesan = putuskan(akar, db, oc)
        benar = aksi == "diam" and not os.path.isfile(log)
        print("  %s %-46s aksi=%s" % ("LULUS " if benar else "GAGAL ", "opsi terputus tidak dikirim", aksi))
        gagal += 0 if benar else 1
        kasus.append("terputus")

    # Laporan ke sesi agent tidak boleh datang dari pohon yang terparkir (#160).
    n_jaga, gagal_jaga = u.uji_penjaga_branch()
    kasus.extend(["penjaga-branch"] * n_jaga)
    gagal += gagal_jaga

    print("")
    print("UJI MANDIRI: %d kasus, %d gagal" % (len(kasus), gagal))
    return gagal

def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=u.akar_factory())
    p.add_argument("--db", default=cek_lane.DB_BAWAAN)
    p.add_argument("--opencrabs-bin", default="opencrabs")
    p.add_argument("--kering", action="store_true")
    p.add_argument("--paksa", action="store_true")
    p.add_argument("--uji-mandiri", action="store_true")
    a = p.parse_args()

    if a.uji_mandiri:
        return 1 if uji_mandiri() else 0

    # Laporan ke sesi agent tidak boleh dikirim oleh kode basi (#160).
    if u.jalankan_penjaga_branch():
        return 1

    akar = os.path.abspath(os.path.expanduser(a.akar))
    aksi, pesan = putuskan(akar, os.path.expanduser(a.db), a.opencrabs_bin,
                           kering=a.kering, paksa=a.paksa)
    print("LAPOR  %-10s %s" % (aksi, pesan))
    return 0

if __name__ == "__main__":
    sys.exit(main())
