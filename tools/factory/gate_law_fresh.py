#!/usr/bin/env python3
"""gate_law_fresh.py - tolak hukum proses yang basi.

Kenapa ada: `factory/LAW.md` bisa diubah tanpa nomor versinya naik. Tanpa gate ini perubahan itu
lolos tanpa jejak, dan pembaca tidak punya cara tahu aturan mana berlaku sejak kapan. Gate ini
menyimpan sidik isi + versi terakhir yang **disahkan** di `factory/law_baseline.json`, lalu menolak
dua hal:

  1. Isi `LAW.md` berbeda dari baseline. Artinya ada perubahan yang belum disahkan: jalankan
     `--sahkan` sesudah menaikkan versi. `--sahkan` sendiri menolak kalau isi berubah tapi versi
     tidak naik, jadi menaikkan versi tidak bisa dilewati.
  2. `SKILL.md` hasil generate tidak lagi sama dengan `LAW.md`. Pemeriksa ini meminjam
     `sync_skill.periksa()`, tidak menyalin logikanya.

Soal `--sync-mode lewati`: berkas yang dibaca agent ada di `~/.opencrabs/skills/`, di luar repo, jadi
runner CI tidak punya salinan itu dan tidak bisa memeriksanya. Di CI, baseline yang diperiksa dan
gate-nya bilang terus terang bahwa sinkronisasi tidak diperiksa di situ; pemeriksaan sinkronisasi
berjalan di mesin tempat skill itu hidup. Melewati pemeriksaan tanpa mengatakannya lebih buruk
daripada tidak memeriksa.

Cara pakai:
  python3 tools/factory/gate_law_fresh.py                     periksa (keluar 1 kalau ditolak)
  python3 tools/factory/gate_law_fresh.py --sahkan             sahkan LAW.md sekarang ke baseline
  python3 tools/factory/gate_law_fresh.py --akar DIR           pakai pohon lain (dipakai uji mandiri)
  python3 tools/factory/gate_law_fresh.py --sync PATH          pakai SKILL.md lain
  python3 tools/factory/gate_law_fresh.py --sync-mode lewati   periksa baseline saja
"""

import argparse
import hashlib
import json
import os
import re
import sys

DIR_INI = os.path.dirname(os.path.abspath(__file__))
AKAR_BAWAAN = os.path.dirname(os.path.dirname(DIR_INI))

sys.path.insert(0, DIR_INI)
import sync_skill  # noqa: E402  (harus sesudah sys.path diatur)

POLA_VERSI = re.compile(r"^\*\*Versi:\*\*\s*(\d+)\.(\d+)\.(\d+)\s*$", re.MULTILINE)


def baca(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def sidik(isi):
    return hashlib.sha256(isi.encode("utf-8")).hexdigest()


def versi_dari(isi):
    cocok = POLA_VERSI.search(isi)
    if not cocok:
        return None
    return ".".join(cocok.groups())


def versi_lebih_baru(baru, lama):
    return tuple(int(x) for x in baru.split(".")) > tuple(int(x) for x in lama.split("."))


def path_baseline(akar):
    return os.path.join(akar, "factory", "law_baseline.json")


def path_law(akar):
    return os.path.join(akar, "factory", "LAW.md")


def periksa(akar, sync_path, sync_mode="wajib"):
    """Kembalikan (lulus, daftar_alasan)."""
    alasan = []
    law = path_law(akar)
    if not os.path.exists(law):
        return False, ["sumber tidak ada: %s" % os.path.relpath(law, akar)]

    isi = baca(law)
    versi = versi_dari(isi)
    if versi is None:
        return False, ["tidak ada baris `**Versi:** x.y.z` di factory/LAW.md"]

    base_path = path_baseline(akar)
    if not os.path.exists(base_path):
        return False, [
            "baseline belum ada: %s" % os.path.relpath(base_path, akar),
            "jalankan: python3 tools/factory/gate_law_fresh.py --sahkan",
        ]

    base = json.loads(baca(base_path))
    if base.get("sha256") != sidik(isi):
        alasan.append(
            "isi LAW.md berbeda dari baseline yang disahkan (versi baseline %s, versi sekarang %s): "
            "jalankan --sahkan sesudah menaikkan versi" % (base.get("versi"), versi)
        )

    if sync_mode == "wajib":
        # Salinan yang dibaca agent wajib sama dengan sumbernya.
        sync_skill.BERKAS_LAW = law
        tujuan = sync_path or os.path.join(
            os.path.expanduser("~"), ".opencrabs", "skills", sync_skill.SLUG, "SKILL.md"
        )
        cocok, pesan = sync_skill.periksa(tujuan)
        if not cocok:
            alasan.append("SKILL.md tidak sinkron: %s" % pesan)

    return (len(alasan) == 0), alasan


def sahkan(akar):
    """Tulis baseline dari LAW.md sekarang, dan tolak kalau versi tidak naik."""
    law = path_law(akar)
    if not os.path.exists(law):
        print("GAGAL  sumber tidak ada: %s" % law)
        return 2
    isi = baca(law)
    versi = versi_dari(isi)
    if versi is None:
        print("GAGAL  tidak ada baris `**Versi:** x.y.z` di factory/LAW.md")
        return 1

    base_path = path_baseline(akar)
    if os.path.exists(base_path):
        base = json.loads(baca(base_path))
        lama = base.get("versi")
        berubah = base.get("sha256") != sidik(isi)
        if berubah and not versi_lebih_baru(versi, lama):
            print(
                "GAGAL  isi LAW.md berubah tapi versi masih %s (baseline %s). "
                "Naikkan `**Versi:**` dulu." % (versi, lama)
            )
            return 1

    isi_base = json.dumps(
        {
            "versi": versi,
            "sha256": sidik(isi),
            "catatan": "disahkan tools/factory/gate_law_fresh.py --sahkan",
        },
        indent=2,
        ensure_ascii=False,
    ) + "\n"
    with open(base_path, "w", encoding="utf-8") as f:
        f.write(isi_base)
    print("SAHKAN  factory/LAW.md versi %s, sha256 %s" % (versi, sidik(isi)[:12]))
    return 0


def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=AKAR_BAWAAN)
    p.add_argument("--sync", default=None)
    p.add_argument("--sync-mode", choices=["wajib", "lewati"], default="wajib")
    p.add_argument("--sahkan", action="store_true")
    a = p.parse_args()

    akar = os.path.abspath(os.path.expanduser(a.akar))
    if a.sahkan:
        return sahkan(akar)

    lulus, alasan = periksa(akar, a.sync, a.sync_mode)
    if lulus:
        if a.sync_mode == "lewati":
            print("CATATAN  sinkronisasi SKILL.md tidak diperiksa di sini (berkasnya di luar repo)")
        print("LULUS  factory/LAW.md masih sama dengan baseline yang disahkan")
        return 0
    print("GAGAL  hukum proses basi:")
    for s in alasan:
        print("       - %s" % s)
    return 1


if __name__ == "__main__":
    sys.exit(main())
