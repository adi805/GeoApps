#!/usr/bin/env python3
"""gate_receipt.py - tolak closing yang tidak punya bukti.

Kenapa ada: hukum proses bagian 5 menyebut lima syarat selesai, dan bagian 6 menyebut urutan
closing. Semuanya prosa, jadi yang terjadi di lapangan adalah laporan "sudah beres" tanpa satu pun
perintah yang dijalankan. Gate ini membaca berkas bukti (`factory/receipts/<issue>.json`) dan
menolak kalau buktinya kurang atau bohong:

  - `commit` wajib menunjuk commit yang benar-benar ada di repo (`git cat-file -t`),
  - setiap `kriteria` dan `checker` wajib punya `perintah` dan `exit` == 0,
  - `status_short` wajib kosong: tidak ada berkas setengah jadi yang tertinggal,
  - `komentar_issue` wajib menunjuk komentar di issue yang sama,
  - `lane` wajib lane yang terdaftar di `factory/lanes.json`.

Hijau di CI bukan pengganti daftar ini, jadi gate ini tidak membaca hasil CI sama sekali.

Bentuk berkas bukti:
  {
    "issue": 42, "lane": "android", "branch": "perbaikan/izin-lokasi",
    "worktree": "~/GeoApps-android", "commit": "abc1234", "status_short": [],
    "kriteria": [{"perintah": "...", "exit": 0}],
    "checker":  [{"perintah": "...", "exit": 0, "keluaran": "BERSIH"}],
    "komentar_issue": "https://github.com/contoh/repo/issues/42#issuecomment-1"
  }

Cara pakai:
  python3 tools/factory/gate_receipt.py --berkas factory/receipts/42.json
  python3 tools/factory/gate_receipt.py --berkas X.json --akar /path/pohon-lain
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _umum as u  # noqa: E402

WAJIB = ["issue", "lane", "branch", "worktree", "commit", "komentar_issue"]


def periksa_bukti(akar, bukti, lanes):
    alasan = []

    for kunci in WAJIB:
        nilai = bukti.get(kunci)
        if nilai is None or (isinstance(nilai, str) and not nilai.strip()):
            alasan.append("field `%s` kosong" % kunci)

    issue = bukti.get("issue")
    if isinstance(issue, int) and issue <= 0:
        alasan.append("field `issue` bukan nomor issue yang sah: %r" % issue)
    elif not isinstance(issue, int):
        if "issue" in bukti:
            alasan.append("field `issue` harus angka, bukan %s" % type(issue).__name__)

    lane = bukti.get("lane")
    if lane and u.cari_lane(lanes, lane) is None:
        alasan.append("lane `%s` tidak terdaftar di factory/lanes.json" % lane)

    commit = bukti.get("commit") or ""
    if commit and not u.ada_commit(akar, commit):
        alasan.append("commit `%s` tidak ada di repo (git cat-file -t menolak)" % commit)

    for nama in ("kriteria", "checker"):
        daftar = bukti.get(nama)
        if not isinstance(daftar, list) or not daftar:
            alasan.append("`%s` kosong: tidak ada perintah yang dijalankan" % nama)
            continue
        for i, item in enumerate(daftar, 1):
            if not isinstance(item, dict):
                alasan.append("%s ke-%d bukan objek" % (nama, i))
                continue
            if not str(item.get("perintah") or "").strip():
                alasan.append("%s ke-%d tidak menyebut perintahnya" % (nama, i))
            if item.get("exit") != 0:
                alasan.append(
                    "%s ke-%d keluar %r (wajib 0): %s"
                    % (nama, i, item.get("exit"), str(item.get("perintah"))[:60])
                )

    sisa = bukti.get("status_short")
    if not isinstance(sisa, list):
        alasan.append("`status_short` harus daftar path (kosong kalau bersih)")
    elif sisa:
        alasan.append(
            "`status_short` tidak kosong: %d berkas setengah jadi tertinggal (%s)"
            % (len(sisa), ", ".join(str(x) for x in sisa[:3]))
        )

    komentar = str(bukti.get("komentar_issue") or "")
    if komentar:
        if isinstance(issue, int) and ("/issues/%d" % issue) not in komentar:
            alasan.append("`komentar_issue` tidak menunjuk issue #%s: %s" % (issue, komentar))
        if "issuecomment" not in komentar:
            alasan.append("`komentar_issue` bukan tautan komentar: %s" % komentar)

    return alasan


def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--berkas", required=True)
    p.add_argument("--akar", default=u.akar_factory())
    a = p.parse_args()

    akar = os.path.abspath(os.path.expanduser(a.akar))
    if not os.path.exists(a.berkas):
        print("GAGAL  berkas bukti tidak ada: %s" % a.berkas)
        return 2
    try:
        bukti = u.baca_json(a.berkas)
    except ValueError as e:
        print("GAGAL  berkas bukti bukan JSON sah: %s" % e)
        return 1

    lanes = u.baca_json(os.path.join(akar, "factory", "lanes.json"))
    alasan = periksa_bukti(akar, bukti, lanes)
    if alasan:
        return u.tolak("bukti closing issue #%s kurang" % bukti.get("issue"), alasan)

    jumlah = len(bukti["kriteria"]) + len(bukti["checker"])
    return u.lulus(
        "bukti issue #%s lengkap: commit %s, %d perintah exit 0, worktree bersih"
        % (bukti["issue"], str(bukti["commit"])[:12], jumlah)
    )


if __name__ == "__main__":
    sys.exit(main())
