#!/usr/bin/env python3
"""gate_commit_paths.py - tolak lane yang menyentuh berkas di luar cakupannya.

Kenapa ada: di factory ini beberapa lane bekerja di pohon yang sama-sama hidup, dan cakupan lane
sebelumnya cuma kesepakatan lisan. Akibatnya dua lane bisa menyentuh berkas yang sama, atau lane
modul menyentuh `installer.iss` dan mengubah rilis tanpa ada yang memutuskan. Gate ini membaca
`factory/lanes.json` dan menolak:

  1. path yang tidak cocok dengan glob lane-nya (termasuk lane `vps-verify` dan `gh-ops`, yang
     daftar glob-nya kosong karena kerja mereka tidak menulis berkas di repo),
  2. path yang masuk daftar eskalasi, kecuali `--izin-eskalasi` diberikan. Daftar itu dua tingkat:
     `eskalasi.glob` milik owner (rilis dan produksi), `eskalasi.glob_agen` keputusan agent (CI),
     dan pesan penolakannya menyebut tingkatnya. Di CI izin itu datang dari label PR `eskalasi`,
     bukan dari niat baik.

Cara pakai:
  python3 tools/factory/gate_commit_paths.py --lane payroll --base origin/main --head HEAD
  python3 tools/factory/gate_commit_paths.py --lane HQ --paths daftar-berkas.txt
  python3 tools/factory/gate_commit_paths.py --hanya-eskalasi --base origin/main --head HEAD
  python3 tools/factory/gate_commit_paths.py --tanpa-label --base origin/main --head HEAD
  python3 tools/factory/gate_commit_paths.py --daftar-lane

`--hanya-eskalasi` ada karena pemeriksaan cakupan butuh tahu lane mana yang bekerja, dan lane itu
baru terbaca dari label PR `lane:<id>`. Tanpa label, yang tetap diperiksa adalah daftar eskalasi,
dan gate-nya bilang terus terang bahwa cakupan tidak diperiksa. Diam-diam melewati pemeriksaan
lebih buruk daripada tidak punya pemeriksaan.

`--tanpa-label` dipakai CI di cabang tanpa label: selain daftar eskalasi, ia MENOLAK berkas jejak
(`factory/usulan*.jsonl`, `factory/ledger.jsonl`). Berkas itu ditulis lane mana pun lewat
`usulan.py`/`ledger.py` tapi dimiliki lane `HQ`, jadi lane-nya bisa dipastikan tanpa label: PR
yang menyentuhnya wajib memasang `lane:HQ`. Terukur 2026-10-11: 73 dari 100 PR merged terakhir
menyentuh berkas jejak, dan 2 di antaranya lolos dengan cakupan tidak diperiksa (#246, #223).
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _umum as u  # noqa: E402

# Berkas jejak factory: ditulis lane mana pun lewat `usulan.py`/`ledger.py`, tapi dimiliki lane
# `HQ` (glob `factory/**`). Tanpa label, cakupan tidak bisa diperiksa, jadi kelas berkas inilah
# yang ditolak: hijau tanpa pemeriksaan lebih buruk daripada merah. `usulan.jsonl` ikut karena
# berkas lama itu masih dibaca selama ada (#217).
GLOB_JEJAK = ["factory/usulan.jsonl", "factory/usulan-*.jsonl", "factory/ledger.jsonl"]

def entri_mati(lanes, akar):
    """Entri `lanes.json` tanpa wildcard yang path-nya tidak eksis.

    Kenapa ada: `factory/lanes.json` itu jaring eskalasi, dan entri yang menunjuk path mati
    (salah ketik, berkas dipindah) tidak dilaporkan siapa pun: berkasnya jadi tidak terdeteksi
    butuh tingkat owner maupun agent, dan gate-nya hijau karena tidak memeriksa apa pun.
    Terukur 2026-10-13 (#324): `eskalasi.glob` memuat `scripts/build_rilis.sh` yang tidak ada,
    sementara skrip rilis aslinya `tools/build_rilis.sh` (45.487 byte) nol ada di glob mana pun.

    Hanya entri TANPA wildcard yang diperiksa. Glob berbasis nama (mis. `src/**/*Biaya*`) memang
    menunggu berkasnya dibuat (keputusan u-HQ-a6a807 opsi 2), jadi cek eksistensi mentah bakal
    memunculkan alarm palsu. Terukur: 10 entri tanpa wildcard, 1 mati, nol false positive.
    """
    kandidat = [("eskalasi.glob", p) for p in lanes.get("eskalasi", {}).get("glob", [])]
    kandidat += [("eskalasi.glob_agen", p) for p in lanes.get("eskalasi", {}).get("glob_agen", [])]
    for l in lanes.get("lane", []):
        kandidat += [("lane %s" % l["id"], p) for p in (l.get("glob") or [])]
    mati = []
    for asal, pola in kandidat:
        if any(c in pola for c in "*?["):
            continue
        if not os.path.exists(os.path.join(akar, pola)):
            mati.append((asal, pola))
    return mati

def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=u.akar_factory())
    p.add_argument("--lane", required=False, default=None)
    p.add_argument("--paths", default=None, help="berkas berisi satu path per baris")
    p.add_argument("--base", default=None)
    p.add_argument("--head", default=None)
    p.add_argument("--izin-eskalasi", action="store_true")
    p.add_argument("--hanya-eskalasi", action="store_true")
    p.add_argument(
        "--tanpa-label",
        action="store_true",
        help="PR tanpa label `lane:`: periksa eskalasi, DAN tolak berkas jejak",
    )
    p.add_argument("--daftar-lane", action="store_true")
    a = p.parse_args()

    akar = os.path.abspath(os.path.expanduser(a.akar))
    berkas_lane = os.path.join(akar, "factory", "lanes.json")
    if not os.path.exists(berkas_lane):
        print("GAGAL  daftar lane tidak ada: %s" % os.path.relpath(berkas_lane, akar))
        return 2
    lanes = u.baca_json(berkas_lane)

    mati = entri_mati(lanes, akar)
    if mati:
        for asal, pola in mati:
            print("GAGAL  %s: entri menunjuk path yang tidak ada: %s" % (asal, pola))
        print("       Entri mati = lubang senyap di jaring eskalasi: berkasnya tidak terdeteksi")
        print("       butuh tingkat owner maupun agent. Perbaiki path-nya atau hapus entrinya.")
        return 2

    if a.daftar_lane:
        for l in lanes["lane"]:
            print("%-11s topic %-3s %s" % (l["id"], l["topic"], l["cakupan"]))
        return 0

    if a.hanya_eskalasi or a.tanpa_label:
        lane = {"id": "tanpa-lane", "glob": [], "cakupan": "cakupan lane tidak diperiksa"}
    else:
        if not a.lane:
            print("GAGAL  --lane wajib (lihat --daftar-lane), atau pakai --hanya-eskalasi")
            return 2
        lane = u.cari_lane(lanes, a.lane)
        if lane is None:
            print("GAGAL  lane tidak dikenal: %s" % a.lane)
            return 2

    paths, galat = u.baca_paths(akar, a.paths, a.base, a.head)
    if galat:
        print("GAGAL  %s" % galat)
        return 2
    if not paths:
        return u.lulus("lane %s: tidak ada berkas yang berubah" % lane["id"])

    eskalasi = lanes.get("eskalasi", {})
    glob_owner = eskalasi.get("glob", [])
    glob_agen = eskalasi.get("glob_agen", [])
    agen_diizinkan = []
    alasan = []
    for path in paths:
        masuk_agen, pola_a = u.cocok_salah_satu(glob_agen, path)
        masuk_owner, pola_o = u.cocok_salah_satu(glob_owner, path)
        if masuk_agen or masuk_owner:
            # Path eskalasi tidak ikut diperiksa cakupan lane: izin eskalasi itu penggantinya.
            # Tanpa izin, path ini ditolak walau lane-nya kebetulan mencakupnya.
            if not a.izin_eskalasi:
                if masuk_agen:
                    alasan.append(
                        "%s: path eskalasi tingkat agent (pola %s), keputusan agent. "
                        "Di CI: tambahkan label `eskalasi` di PR, lalu catat entri ledger "
                        "`ruling` dengan oleh=agent sebelum merge." % (path, pola_a)
                    )
                else:
                    alasan.append(
                        "%s: path eskalasi tingkat owner (pola %s), wajib naik ke owner dulu. "
                        "Di CI: tambahkan label `eskalasi` di PR." % (path, pola_o)
                    )
            elif masuk_agen:
                agen_diizinkan.append(path)
            continue
        if a.tanpa_label:
            # Berkas jejak dimiliki lane `HQ`, tapi lane mana pun bisa memicunya lewat
            # `usulan.py`/`ledger.py`. Tanpa label, cakupan lane tidak bisa diperiksa; kelas
            # berkas inilah yang tetap bisa diperiksa, jadi ia ditolak, bukan dilewati.
            masuk_jejak, _pola_j = u.cocok_salah_satu(GLOB_JEJAK, path)
            if masuk_jejak:
                alasan.append(
                    "%s: berkas jejak tanpa label `lane:`. Berkas `factory/**` ada di cakupan "
                    "lane `HQ`, jadi pasang label `lane:HQ` di PR ini: label `lane:` juga yang "
                    "membuat cakupan diperiksa, bukan dilewati." % path
                )
            continue
        if a.hanya_eskalasi:
            continue
        cocok, _ = u.cocok_salah_satu(lane["glob"], path)
        if not cocok:
            alasan.append(
                "%s: di luar cakupan lane %s. Cakupan: %s" % (path, lane["id"], lane["cakupan"])
            )

    if alasan:
        return u.tolak("cakupan lane %s dilanggar: %d path" % (lane["id"], len(alasan)), alasan)
    if agen_diizinkan:
        print(
            "CATATAN  %d path eskalasi tingkat agent diizinkan: %s. "
            "Keputusan agent, wajib dicatat sebagai entri ledger `ruling` dengan oleh=agent."
            % (len(agen_diizinkan), ", ".join(agen_diizinkan))
        )
    if a.tanpa_label:
        print(
            "CATATAN  cakupan lane tidak diperiksa: tidak ada label `lane:<id>`. "
            "Berkas jejak DIPERIKSA dan ditolak kalau ada, karena lane pemiliknya pasti (HQ)."
        )
        return u.lulus("%d path, nol berkas jejak, nol path eskalasi owner" % len(paths))
    if a.hanya_eskalasi:
        print(
            "CATATAN  cakupan lane tidak diperiksa: tidak ada label `lane:<id>`. "
            "Pemeriksaan cakupan penuh menunggu label itu."
        )
        return u.lulus("%d path, tidak ada yang menyentuh path eskalasi owner" % len(paths))
    return u.lulus("lane %s: %d path, semuanya di cakupan" % (lane["id"], len(paths)))


if __name__ == "__main__":
    sys.exit(main())
