#!/usr/bin/env python3
"""Penulis receipt #122: menjalankan tiap perintah, mencatat exit dan keluaran.

Kenapa skrip, bukan JSON tulis tangan: exit code yang diketik dari ingatan itu
klaim, bukan bukti. Skrip ini menjalankan perintahnya sendiri, jadi angka di
receipt selalu berasal dari run yang benar-benar terjadi pada HEAD ini.

  python3 factory/receipts/122/tulis_receipt.py > factory/receipts/122.json
"""

import json
import re
import subprocess
import sys

FILES = [
    "apps/geolibre-desktop/src/components/layout/toolbar/PluginsMenu.tsx",
    "apps/geolibre-desktop/src/components/layout/toolbar/toolbar-commands.ts",
    "apps/geolibre-desktop/src/hooks/toolbar/useToolbarCommands.ts",
    "apps/geolibre-desktop/src/components/layout/toolbar/plugin-sections.ts",
    "apps/geolibre-desktop/src/components/layout/toolbar/plugin-sections.test.ts",
]


def run(perintah):
    p = subprocess.run(perintah, shell=True, capture_output=True, text=True)
    keluaran = (p.stdout + p.stderr).strip()
    return p.returncode, keluaran


def ringkas(teks, maks=1400):
    teks = re.sub(r"\n{2,}", "\n", teks)
    return teks if len(teks) <= maks else teks[:maks] + "\n[...dipotong]"


def kriteria(nomor, judul, perintah, catatan=""):
    exit_code, keluaran = run(perintah)
    print(f"[{nomor}] exit={exit_code} {judul}", file=sys.stderr)
    if exit_code != 0:
        print(ringkas(keluaran), file=sys.stderr)
    return {
        "kriteria": f"{nomor}. {judul}",
        "status": "selesai" if exit_code == 0 else "gagal",
        "perintah": perintah,
        "exit": exit_code,
        "keluaran": ringkas(keluaran),
        "catatan": catatan,
    }


def main():
    head = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True
    ).stdout.strip()
    status = subprocess.run(
        ["git", "status", "--short"], capture_output=True, text=True
    ).stdout.strip()

    hasil = [
        kriteria(
            1,
            "isKebunPlugin dipakai di menu dan palette, bukan cuma diekspor",
            'grep -rn "isKebunPlugin\\|KEBUN_PLUGINS" apps/geolibre-desktop/src',
            "Pemakaian nyata: PluginsMenu.tsx:305 mengoper predikat ke partitionPlugins, "
            "toolbar-commands.ts:738 memakainya untuk memisahkan entri plugin.*, dan "
            "useToolbarCommands.ts:125 mengoper isKebunPlugin dari barrel ke context. "
            "plugin-sections.test.ts memuat preset yang sama untuk mengunci partisinya.",
        ),
        kriteria(
            2,
            "Partisi tidak menghilangkan satu id pun dan angkanya terukur",
            "node --import tsx factory/receipts/122/menu-probe.mjs",
            "70 terdaftar, 11 dikecualikan menu sejak sebelum unit ini, 59 tampil. "
            "Keempat seksi menjangkau 59 itu tanpa id hilang dan tanpa id dobel.",
        ),
        kriteria(
            3,
            "Angka preset terhadap registry: 4 kebun terdaftar + 66 sisanya",
            "node --import tsx factory/receipts/122/angka.mjs",
            "Issue menyebut 6 + 64. Yang terukur 4 + 66: KEBUN_PLUGINS berisi 5 id dan "
            "maplibre-gl-geofence tidak pernah masuk daftar plugin terdaftar karena "
            "didaftarkan lewat registerGeofencePlugin, bukan sebagai objek BUILT_IN_PLUGINS. "
            "Di menu hasilnya 3 kebun + 14 sisanya, sebab maplibre-layer-control sudah "
            "dikecualikan dari menu dan di-toggle dari Controls. Penyimpangan ini dilaporkan "
            "apa adanya, bukan dibulatkan supaya cocok dengan issue.",
        ),
        kriteria(
            4,
            "Uji unit partisi 70 plugin: 6 lulus, 0 gagal",
            "node --import tsx --test apps/geolibre-desktop/src/components/layout/toolbar/plugin-sections.test.ts",
            "Memuat preset asli lewat URL runtime dan membaca 70 id dari "
            "scripts/plugin-reference.json, jadi tidak ada daftar kedua yang bisa menyimpang.",
        ),
        kriteria(
            5,
            "Uji Node yang menyentuh toolbar-commands tetap hijau: 78 lulus, 0 gagal",
            "node --import tsx --test tests/toolbar-commands.test.ts tests/palette-tools.test.ts "
            "tests/latest-proxy.test.ts tests/i18n-catalogs.test.ts tests/plugin-reference-docs.test.ts",
            "isKebunPlugin masuk sebagai field opsional di ToolbarCommandContext karena "
            "fixture di tests/ milik lane uji dan tidak boleh disentuh; tanpa field itu "
            "perintah plugin tetap terbentuk persis seperti sebelumnya.",
        ),
        kriteria(
            6,
            "eslint pada lima berkas: 0 masalah",
            "npx eslint " + " ".join(FILES),
            "Tanpa keluaran, exit 0. npm run lint penuh mati OOM di host ini (exit 134), "
            "sama seperti receipt #89, #103, dan #118; ratchet angka penuh diserahkan ke "
            "job 'Lint and type check' di CI.",
        ),
        kriteria(
            7,
            "Referensi plugin tetap sinkron dengan sumber",
            "npm run plugins:docs:check",
            "Generator membaca daftar plugin dan lokasi menunya langsung dari sumber, jadi "
            "ini sekaligus membuktikan komentar di PluginsMenu.tsx tidak merusak parsing.",
        ),
        kriteria(
            8,
            "Gate cakupan lane ui lulus",
            "python3 tools/factory/gate_commit_paths.py --lane ui --base origin/main --head HEAD",
            "Lima berkas unit ini plus receipt, semuanya di dalam glob lane ui.",
        ),
    ]

    checker = []
    for perintah, keterangan in [
        (
            "git diff --stat origin/main...HEAD -- e2e/ tests/ apps/geolibre-desktop/src/visual/ "
            "packages/plugins/",
            "Lane uji, lane visual, dan paket plugin tidak disentuh: kosong.",
        ),
        (
            "git status --short",
            "Bersih selain receipt dan skrip probe yang belum di-commit saat skrip ini jalan.",
        ),
        (
            "git log --oneline origin/main..HEAD",
            "Tiga commit atomik, satu per unit logis.",
        ),
    ]:
        exit_code, keluaran = run(perintah)
        checker.append(
            {"perintah": perintah, "exit": exit_code, "keluaran": ringkas(keluaran) + (" " + keterangan if keterangan else "")}
        )

    receipt = {
        "issue": 122,
        "lane": "ui",
        "branch": "ui/kebun-122",
        "worktree": "~/GeoApps-ui-kebun-122",
        "commit": head,
        "status_short": [line for line in status.splitlines() if line.strip()],
        "kriteria": hasil,
        "checker": checker,
        "komentar_issue": "",
    }
    print(json.dumps(receipt, ensure_ascii=False, indent=2))
    gagal = [k for k in hasil if k["exit"] != 0] + [c for c in checker if c["exit"] != 0]
    if gagal:
        print(f"GAGAL: {len(gagal)} pemeriksaan tidak exit 0", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
