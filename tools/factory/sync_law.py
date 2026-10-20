#!/usr/bin/env python3
"""sync_law.py - isi blok yang dihasilkan di factory/LAW.md dari factory/lanes.json.

Kenapa ada: LAW.md dulu memuat tabel lane (id, topic, cakupan) dan daftar path eskalasi sebagai
teks yang diketik tangan, padahal keduanya sudah hidup di `factory/lanes.json`. Dua salinan dari
satu isi pasti melenceng, dan di proyek ini melencengnya benar-benar kejadian: LAW.md menulis
topic `sync` sebagai 27 sementara `lanes.json` sudah memakai 476, dan nol gate menolak karena
keduanya sama-sama "ada". Sesi yang membaca LAW.md lalu mengirim brief ke topic 27 mengirim ke
ruangan yang tidak ada.

Sekarang isinya dihasilkan dari `lanes.json`, jadi salinannya tidak bisa melenceng: kalau
`lanes.json` berubah dan LAW.md belum dibangkitkan ulang, `--check` menolaknya.

Blok ditandai sepasang komentar, dan isi di antaranya ditimpa. Teks di luar penanda tidak disentuh.

Cara pakai:
  python3 tools/factory/sync_law.py             bangkitkan ulang blok di factory/LAW.md
  python3 tools/factory/sync_law.py --check     periksa saja, keluar 1 kalau berbeda
  python3 tools/factory/sync_law.py --akar D    pakai pohon lain (dipakai uji mandiri)
  python3 tools/factory/sync_law.py --uji-mandiri
"""

import argparse
import os
import sys
import tempfile

DIR_INI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_INI)
import _umum as u  # noqa: E402

BERKAS_LAW = os.path.join("factory", "LAW.md")
BERKAS_LANES = os.path.join("factory", "lanes.json")

def penanda(nama):
    return ("<!-- MULAI: %s (dihasilkan tools/factory/sync_law.py dari factory/lanes.json, "
            "jangan diedit tangan) -->" % nama,
            "<!-- SELESAI: %s -->" % nama)

def blok_lane(lanes):
    """Tabel lane: id, topic, cakupan. Persis tiga medan yang juga dipegang lanes.json."""
    baris = ["| Lane | Topic | Cakupan |", "|---|---|---|"]
    for l in lanes.get("lane") or []:
        baris.append("| `%s` | %s | %s |" % (l.get("id"), l.get("topic"), l.get("cakupan", "")))
    return "\n".join(baris)

def blok_eskalasi(lanes, kunci, judul):
    """Daftar path tingkat eskalasi, satu per baris, dengan alasan tingkatnya di bawahnya."""
    e = lanes.get("eskalasi") or {}
    glob = e.get(kunci) or []
    alasan = e.get(kunci.replace("glob", "alasan")) or ""
    baris = ["**%s**" % judul, "", "| Path |", "|---|"]
    for g in glob:
        baris.append("| `%s` |" % g)
    if alasan:
        baris += ["", alasan]
    return "\n".join(baris)

def bangun(isi, lanes):
    """Ganti isi tiap blok berpenanda. Melempar kalau penandanya tidak lengkap atau dobel."""
    keluaran = isi
    for nama, isi_baru in (
        ("tabel lane", blok_lane(lanes)),
        ("path eskalasi owner", blok_eskalasi(lanes, "glob", "Path tingkat owner")),
        ("path eskalasi agent", blok_eskalasi(lanes, "glob_agen", "Path tingkat agent")),
    ):
        mulai, selesai = penanda(nama)
        for t in (mulai, selesai):
            n = keluaran.count(t)
            if n != 1:
                raise ValueError("penanda %r muncul %d kali, harus tepat 1" % (t, n))
        i, j = keluaran.index(mulai) + len(mulai), keluaran.index(selesai)
        if i > j:
            raise ValueError("penanda %r mendahului pembukanya" % nama)
        keluaran = keluaran[:i] + "\n" + isi_baru + "\n" + keluaran[j:]
    return keluaran

def baca(p):
    with open(p, "r", encoding="utf-8") as f:
        return f.read()

def periksa(akar):
    """(masalah, isi_sekarang, isi_harusnya). masalah kosong = sudah sama."""
    law = os.path.join(akar, BERKAS_LAW)
    lanes_path = os.path.join(akar, BERKAS_LANES)
    if not os.path.isfile(law):
        return ["%s tidak ada" % law], None, None
    if not os.path.isfile(lanes_path):
        return ["%s tidak ada" % lanes_path], None, None
    sekarang = baca(law)
    try:
        harusnya = bangun(sekarang, u.baca_json(lanes_path))
    except ValueError as e:
        return ["%s: %s" % (BERKAS_LAW, e)], sekarang, None
    if sekarang == harusnya:
        return [], sekarang, harusnya
    return ["blok hasil generate di %s berbeda dari factory/lanes.json" % BERKAS_LAW], sekarang, harusnya

def uji_mandiri():
    """Generator yang cuma pernah menghasilkan keluaran benar belum membuktikan bisa menolak."""
    gagal = 0
    kasus = []

    def jalankan(nama, siapkan, harus_gagal):
        nonlocal gagal
        with tempfile.TemporaryDirectory() as tmp:
            siapkan(tmp)
            masalah, _, _ = periksa(tmp)
            benar = bool(masalah) == harus_gagal
            print("  %s %-46s %s" % (
                "LULUS " if benar else "GAGAL ", nama,
                "ditolak" if masalah else "lulus"))
            if masalah and harus_gagal:
                print("         alasan: %s" % masalah[0][:90])
            gagal += 0 if benar else 1

    def dasar(tmp, lanes=None):
        os.makedirs(os.path.join(tmp, "factory"), exist_ok=True)
        d = lanes if lanes is not None else {
            "versi": 1,
            "lane": [{"id": "HQ", "topic": 23, "cakupan": "hukum"}],
            "eskalasi": {"glob": ["packaging/**"], "glob_agen": [".github/workflows/**"],
                         "alasan": "naik ke owner", "alasan_agen": "keputusan agent"},
        }
        with open(os.path.join(tmp, BERKAS_LANES), "w", encoding="utf-8") as f:
            u.json.dump(d, f)
        with open(os.path.join(tmp, BERKAS_LAW), "w", encoding="utf-8") as f:
            f.write("mulai\n\n" + penanda("tabel lane")[0] + "\n" + penanda("tabel lane")[1] + "\n\n"
                    + penanda("path eskalasi owner")[0] + "\n" + penanda("path eskalasi owner")[1] + "\n\n"
                    + penanda("path eskalasi agent")[0] + "\n" + penanda("path eskalasi agent")[1] + "\n")
        return tmp

    def sudah_dibangkitkan(tmp):
        dasar(tmp)
        law = os.path.join(tmp, BERKAS_LAW)
        # `baca` HARUS jalan sebelum berkasnya dibuka untuk ditulis: `open(law, "w")` memotong
        # isinya lebih dulu, jadi membaca di dalam argumen `write` menghasilkan berkas kosong.
        isi = bangun(baca(law), u.baca_json(os.path.join(tmp, BERKAS_LANES)))
        with open(law, "w", encoding="utf-8") as f:
            f.write(isi)

    def topic_berubah(tmp):
        # Kelas kegagalan yang benar-benar kejadian: topic di lanes.json berubah, LAW.md tidak.
        sudah_dibangkitkan(tmp)
        p = os.path.join(tmp, BERKAS_LANES)
        d = u.baca_json(p)
        d["lane"][0]["topic"] = 999
        with open(p, "w", encoding="utf-8") as f:
            u.json.dump(d, f)

    def glob_berubah(tmp):
        sudah_dibangkitkan(tmp)
        p = os.path.join(tmp, BERKAS_LANES)
        d = u.baca_json(p)
        d["eskalasi"]["glob"].append("certs/**")
        with open(p, "w", encoding="utf-8") as f:
            u.json.dump(d, f)

    def penanda_dobel(tmp):
        dasar(tmp)
        with open(os.path.join(tmp, BERKAS_LAW), "a", encoding="utf-8") as f:
            f.write("\n" + penanda("tabel lane")[0] + "\n" + penanda("tabel lane")[1] + "\n")

    def penanda_hilang(tmp):
        dasar(tmp)
        p = os.path.join(tmp, BERKAS_LAW)
        with open(p, "w", encoding="utf-8") as f:
            f.write("nol penanda di sini\n")

    def lanes_hilang(tmp):
        dasar(tmp)
        os.remove(os.path.join(tmp, BERKAS_LANES))

    kasus.append(("sudah dibangkitkan -> lulus", sudah_dibangkitkan, False))
    kasus.append(("topic berubah di lanes.json -> ditolak", topic_berubah, True))
    kasus.append(("glob eskalasi bertambah -> ditolak", glob_berubah, True))
    kasus.append(("penanda dobel -> ditolak", penanda_dobel, True))
    kasus.append(("penanda hilang -> ditolak", penanda_hilang, True))
    kasus.append(("lanes.json hilang -> ditolak", lanes_hilang, True))

    for nama, siapkan, harus_gagal in kasus:
        jalankan(nama, siapkan, harus_gagal)

    print("")
    print("UJI MANDIRI sync_law: %d kasus, %d gagal" % (len(kasus), gagal))
    return 1 if gagal else 0

def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=u.akar_factory())
    p.add_argument("--check", action="store_true")
    p.add_argument("--uji-mandiri", action="store_true")
    a = p.parse_args()

    if a.uji_mandiri:
        return uji_mandiri()

    akar = os.path.abspath(os.path.expanduser(a.akar))
    masalah, sekarang, harusnya = periksa(akar)
    if not masalah:
        print("LULUS  blok hasil generate di factory/LAW.md sama dengan factory/lanes.json")
        return 0
    if harusnya is None:
        return u.tolak("blok hasil generate di LAW.md tidak bisa dibangun", masalah)
    if a.check:
        return u.tolak("blok hasil generate di LAW.md basi", masalah + [
            "jalankan: python3 tools/factory/sync_law.py",
            "sesudah itu sahkan: python3 tools/factory/gate_law_fresh.py --sahkan",
        ])
    law = os.path.join(akar, BERKAS_LAW)
    with open(law, "w", encoding="utf-8") as f:
        f.write(harusnya)
    print("TULIS  blok hasil generate di factory/LAW.md diperbarui dari factory/lanes.json")
    print("       sahkan versinya: python3 tools/factory/gate_law_fresh.py --sahkan")
    return 0

if __name__ == "__main__":
    sys.exit(main())
