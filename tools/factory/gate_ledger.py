#!/usr/bin/env python3
"""gate_ledger.py - pintu pemeriksa ledger, memakai skema milik tools/factory/ledger.py.

Kenapa ada: aturan ledger (penulis tunggal, `ts` tidak mundur, entri tidak dobel, commit wajib ada)
hidup di `ledger.py`, satu-satunya penulis berkas itu. Berkas ini tidak menyalin skema tersebut, ia
memanggilnya. Dua salinan skema pasti melenceng, dan yang melenceng selalu yang lebih longgar.

Cara pakai:
  python3 tools/factory/gate_ledger.py
  python3 tools/factory/gate_ledger.py --berkas factory/ledger.jsonl --akar /path/pohon
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _umum as u  # noqa: E402
import ledger  # noqa: E402


def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--akar", default=u.akar_factory())
    p.add_argument("--berkas", default=None)
    a = p.parse_args()

    akar = os.path.abspath(os.path.expanduser(a.akar))
    berkas = a.berkas or ledger.path_bawaan(akar)
    lanes = u.baca_json(os.path.join(akar, "factory", "lanes.json"))

    # Repo mesin yang baru disalin belum punya ledger: itu catatan kerja satu proyek, bukan bagian
    # mesinnya. Yang penting: ketiadaannya DISEBUT, tidak diam-diam hijau. Begitu ledger pertama
    # ditulis, pemeriksaannya penuh lagi.
    if not os.path.isfile(berkas) and not a.berkas:
        print("LEWAT  ledger belum ada: %s" % berkas)
        print("       Ledger adalah catatan kerja satu proyek, bukan bagian mesin. Isinya akan "
              "diperiksa begitu entri pertama ditulis.")
        return 0

    alasan = ledger.periksa(akar, berkas, lanes)
    if alasan:
        return u.tolak("ledger ditolak", alasan)
    return u.lulus(
        "ledger %d entri, penulis tunggal `%s`"
        % (ledger.jumlah_entri(berkas), lanes.get("penulis_ledger"))
    )


if __name__ == "__main__":
    sys.exit(main())
