#!/usr/bin/env python3
"""uji_gate_mandiri.py - buktikan tiap gate factory bisa MENOLAK, bukan cuma menerima.

Kenapa ada: gate yang belum pernah menolak apa pun belum membuktikan apa pun. Uji ini menjalankan
setiap gate dengan fixture positif (harus exit 0) dan fixture negatif (harus exit != 0), di direktori
sementara. Pohon asli hanya dibaca untuk `factory/lanes.json` dan untuk `git cat-file` pada commit
yang memang ada, jadi uji ini tidak pernah menulis ke repo.

Tiap gate wajib punya sekurangnya satu kasus negatif; gate tanpa kasus negatif dihitung gagal di
sini, supaya "cuma jalur bahagia" tidak bisa lolos sebagai pemeriksaan.

Cara pakai:
  python3 tools/factory/uji_gate_mandiri.py
"""

import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile

DIR_INI = os.path.dirname(os.path.abspath(__file__))
AKAR = os.path.dirname(os.path.dirname(DIR_INI))
PY = sys.executable

sys.path.insert(0, DIR_INI)
import sync_skill  # noqa: E402
import _umum as u  # noqa: E402


def jln(argv):
    hasil = subprocess.run(
        [PY] + argv, cwd=AKAR, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )
    return hasil.returncode

def jln_teks(argv):
    hasil = subprocess.run(
        [PY] + argv, cwd=AKAR, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )
    return hasil.returncode, hasil.stdout


def tulis(path, isi):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(isi)


def head_sha():
    hasil = subprocess.run(
        ["git", "-C", AKAR, "rev-parse", "HEAD"], stdout=subprocess.PIPE, text=True
    )
    return hasil.stdout.strip()


SHA = head_sha()


def salin_lanes(tmp):
    os.makedirs(os.path.join(tmp, "factory"), exist_ok=True)
    asal = os.path.join(AKAR, "factory", "lanes.json")
    shutil.copyfile(asal, os.path.join(tmp, "factory", "lanes.json"))
    # Entri tanpa wildcard harus ADA di akar uji: `gate_commit_paths.py` menolak entri yang
    # menunjuk path mati (jaring eskalasi), jadi fixture wajib menyerupai pohon nyata. Tanpa ini
    # tiap kasus di bawah merah karena `README.md`, `packaging/paket.conf`, dst. tidak ada di tmp.
    with open(asal, encoding="utf-8") as f:
        lanes = json.load(f)
    kandidat = list(lanes.get("eskalasi", {}).get("glob", []))
    kandidat += list(lanes.get("eskalasi", {}).get("glob_agen", []))
    for l in lanes.get("lane", []):
        kandidat += list(l.get("glob") or [])
    for pola in kandidat:
        if any(c in pola for c in "*?["):
            continue
        tulis(os.path.join(tmp, pola), "")


def tulis_law(tmp, versi="1.0.0", tambahan=""):
    isi = "# Hukum contoh\n\n**Versi:** %s\n\nIsi contoh.%s\n" % (versi, tambahan)
    tulis(os.path.join(tmp, "factory", "LAW.md"), isi)
    return isi


def tulis_skill(tmp, rusak=False):
    law = os.path.join(tmp, "factory", "LAW.md")
    sync_skill.BERKAS_LAW = law
    isi = sync_skill.bangun(sync_skill.baca(law))
    if rusak:
        isi += "\nbaris tambahan yang tidak ada di sumber\n"
    tujuan = os.path.join(tmp, "keluaran", "skills", sync_skill.SLUG, "SKILL.md")
    tulis(tujuan, isi)
    return tujuan


def tulis_paths(tmp, daftar):
    p = os.path.join(tmp, "paths.txt")
    tulis(p, "\n".join(daftar) + "\n")
    return p


# ---------- gate_law_fresh ----------

def law_positif(tmp):
    tulis_law(tmp)
    kode = jln(["tools/factory/gate_law_fresh.py", "--akar", tmp, "--sahkan"])
    if kode != 0:
        return kode
    tujuan = tulis_skill(tmp)
    return jln(["tools/factory/gate_law_fresh.py", "--akar", tmp, "--sync", tujuan])


def law_versi_tidak_naik(tmp):
    tulis_law(tmp)
    jln(["tools/factory/gate_law_fresh.py", "--akar", tmp, "--sahkan"])
    tulis_law(tmp, tambahan="\nAturan baru tanpa naik versi.")
    return jln(["tools/factory/gate_law_fresh.py", "--akar", tmp, "--sahkan"])


def law_baseline_basi(tmp):
    tulis_law(tmp)
    jln(["tools/factory/gate_law_fresh.py", "--akar", tmp, "--sahkan"])
    tulis_law(tmp, versi="1.0.1")
    tujuan = tulis_skill(tmp)
    return jln(["tools/factory/gate_law_fresh.py", "--akar", tmp, "--sync", tujuan])


def law_skill_beda(tmp):
    tulis_law(tmp)
    jln(["tools/factory/gate_law_fresh.py", "--akar", tmp, "--sahkan"])
    tujuan = tulis_skill(tmp, rusak=True)
    return jln(["tools/factory/gate_law_fresh.py", "--akar", tmp, "--sync", tujuan])


def law_tanpa_baseline(tmp):
    tulis_law(tmp)
    return jln(["tools/factory/gate_law_fresh.py", "--akar", tmp, "--sync-mode", "lewati"])


# ---------- gate_commit_paths ----------

def paths_ok(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["apps/geolibre-desktop/src-tauri/android/uji/Inti.kt", "apps/geolibre-desktop/src-tauri/android/uji/IntiUji.kt"])
    return jln(["tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "android", "--paths", p])


def paths_luar_cakupan(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["apps/geolibre-desktop/src-tauri/android/uji/Inti.kt", "packages/plugins/src/plugins/geopdf/berkas-lain.ts"])
    return jln(["tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "android", "--paths", p])


def paths_hq_menyentuh_kode(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["apps/geolibre-desktop/src-tauri/android/uji/Inti.kt"])
    return jln(["tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "HQ", "--paths", p])


def paths_eskalasi_tanpa_izin(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["packaging/paket.conf"])
    return jln(["tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "HQ", "--paths", p])


def paths_eskalasi_dengan_izin(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["packaging/paket.conf"])
    return jln(
        [
            "tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "HQ",
            "--paths", p, "--izin-eskalasi",
        ]
    )


def paths_hanya_eskalasi_menolak(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["packaging/berkas.js"])
    return jln(
        ["tools/factory/gate_commit_paths.py", "--akar", tmp, "--hanya-eskalasi", "--paths", p]
    )


def paths_hanya_eskalasi_lolos(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["packages/plugins/src/plugins/geopdf/berkas-lain.ts"])
    return jln(
        ["tools/factory/gate_commit_paths.py", "--akar", tmp, "--hanya-eskalasi", "--paths", p]
    )

# Tanpa label `lane:`, cakupan lane tidak bisa diperiksa. Berkas jejak satu-satunya kelas yang
# pemiliknya bisa dipastikan (HQ, lewat glob `factory/**`), jadi ia ditolak, bukan dilewati.
# Nyata 2026-10-11: 73 dari 100 PR merged terakhir menyentuh berkas jejak.

def paths_tanpa_label_jejak(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["factory/ledger.jsonl"])
    return jln(
        ["tools/factory/gate_commit_paths.py", "--akar", tmp, "--tanpa-label", "--paths", p]
    )

def paths_tanpa_label_lolos(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["packages/plugins/src/plugins/geopdf/berkas-lain.ts"])
    return jln(
        ["tools/factory/gate_commit_paths.py", "--akar", tmp, "--tanpa-label", "--paths", p]
    )

# Lane `deps` lahir dari #77: PR Dependabot grup menyentuh manifes di seluruh workspace, dan
# sebelum lane ini ada sembilan path manifes tidak bertuan sehingga tidak ada satu pun label
# `lane:<id>` yang sah untuk PR semacam itu. Kasus di bawah mengunci dua sisi sekaligus: lane deps
# harus bisa menandatangani sebelas path manifes, dan lockfile akar harus DITOLAK untuk geo-pdf
# (glob `package-lock.json` dulu tidak sengaja memberi geo-pdf hak tanda tangan atas setiap bump
# dependensi akar).

MANIFES_WORKSPACE = [
    "package.json",
    "package-lock.json",
    "apps/geolibre-desktop/package.json",
    "apps/geolibre-mcp-app/package.json",
    "packages/map/package.json",
    "packages/ui/package.json",
    "packages/plugins/package.json",
    "workers/ai-proxy/package.json",
    "workers/collab/package.json",
    "workers/tiles/package.json",
    "workers/viewer/package.json",
]

def paths_deps_manifes_lolos(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, MANIFES_WORKSPACE)
    return jln(["tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "deps", "--paths", p])

def paths_deps_tolak_kode_produk(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["apps/geolibre-desktop/src/App.tsx"])
    return jln(["tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "deps", "--paths", p])

def paths_geopdf_tolak_lockfile_akar(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["package-lock.json"])
    return jln(["tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "geo-pdf", "--paths", p])

def paths_dua_lane_gabungan_lolos(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["package-lock.json", "packages/plugins/src/plugins/maplibre-a5.ts"])
    return jln([
        "tools/factory/gate_commit_paths.py", "--akar", tmp,
        "--lane", "deps", "--lane", "geo-pdf", "--paths", p,
    ])

def paths_dua_lane_koma_lolos(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["package-lock.json", "packages/plugins/src/plugins/maplibre-a5.ts"])
    return jln([
        "tools/factory/gate_commit_paths.py", "--akar", tmp,
        "--lane", "deps,geo-pdf", "--paths", p,
    ])

def paths_dua_lane_label_menganggur_ditolak(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["package-lock.json"])
    return jln([
        "tools/factory/gate_commit_paths.py", "--akar", tmp,
        "--lane", "deps", "--lane", "geo-pdf", "--paths", p,
    ])

def paths_dua_lane_kurang_satu_ditolak(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["package-lock.json", "packages/plugins/src/plugins/maplibre-a5.ts"])
    return jln([
        "tools/factory/gate_commit_paths.py", "--akar", tmp,
        "--lane", "deps", "--paths", p,
    ])

def _lanes_tambah_glob(tmp, pola):
    salin_lanes(tmp)
    berkas = os.path.join(tmp, "factory", "lanes.json")
    with open(berkas, encoding="utf-8") as f:
        lanes = json.load(f)
    lanes["eskalasi"]["glob"].append(pola)
    tulis(berkas, json.dumps(lanes, indent=2))

def paths_entri_mati_menolak(tmp):
    """Entri eskalasi tanpa wildcard yang menunjuk path mati harus ditolak.

    Nyata 2026-10-13 (#324): `scripts/build_rilis.sh` ada di `eskalasi.glob` padahal path itu
    tidak eksis, sementara skrip rilis aslinya `tools/build_rilis.sh` nol ada di glob mana pun.
    """
    _lanes_tambah_glob(tmp, "packaging/tidak-ada.conf")
    p = tulis_paths(tmp, ["apps/geolibre-desktop/src-tauri/android/uji/Inti.kt"])
    return jln(["tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "android", "--paths", p])

def paths_glob_wildcard_tanpa_match_lolos(tmp):
    """Kontrol negatif balik: entri BER-wildcard yang belum match tetap lolos.

    Ini yang menjaga validasi eksistensi tidak jadi alarm palsu: glob berbasis nama di
    `lanes.json` memang menunggu berkasnya dibuat (keputusan u-HQ-a6a807 opsi 2).
    """
    _lanes_tambah_glob(tmp, "src/**/*BelumAda*")
    p = tulis_paths(tmp, ["apps/geolibre-desktop/src-tauri/android/uji/Inti.kt"])
    return jln(["tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "android", "--paths", p])

# Base yang sudah maju: main bergerak setelah branch dibuat, dan kerja lane lain masuk ke main.
# `git diff base head` dua-pohon menghitung kerja lane lain itu sebagai kerja branch ini (nyata:
# 8 path dilaporkan melanggar cakupan HQ pada 2026-10-09). Yang benar adalah sejak titik pisah.

def _git(akar, *args):
    return subprocess.run(
        ["git", "-C", akar] + list(args), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    ).returncode

def repo_base_maju(tmp):
    salin_lanes(tmp)
    _git(tmp, "init", "-q", "-b", "main")
    _git(tmp, "config", "user.email", "uji@contoh.id")
    _git(tmp, "config", "user.name", "Uji")
    tulis(os.path.join(tmp, "apps/geolibre-desktop/src-tauri/android/uji/Inti.kt"), "// awal\n")
    _git(tmp, "add", "-A")
    _git(tmp, "commit", "-q", "-m", "awal")
    _git(tmp, "checkout", "-q", "-b", "kerja")
    tulis(os.path.join(tmp, "apps/geolibre-desktop/src-tauri/android/uji/IntiUji.kt"), "// uji payroll\n")
    _git(tmp, "add", "-A")
    _git(tmp, "commit", "-q", "-m", "uji payroll")
    _git(tmp, "checkout", "-q", "main")
    tulis(os.path.join(tmp, "apps/geolibre-desktop/src/components/layout/HomeScreen.tsx"), "// kerja lane lain\n")
    _git(tmp, "add", "-A")
    _git(tmp, "commit", "-q", "-m", "sync lane lain")
    _git(tmp, "checkout", "-q", "kerja")
    return tmp

def paths_base_maju_ok(tmp):
    repo_base_maju(tmp)
    return jln(
        [
            "tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "android",
            "--base", "main", "--head", "HEAD",
        ]
    )

def paths_base_maju_tetap_menolak(tmp):
    repo_base_maju(tmp)
    tulis(os.path.join(tmp, "packages/plugins/src/plugins/geopdf/berkas-lain.ts"), "// di luar cakupan payroll\n")
    _git(tmp, "add", "-A")
    _git(tmp, "commit", "-q", "-m", "luar cakupan")
    return jln(
        [
            "tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "android",
            "--base", "main", "--head", "HEAD",
        ]
    )


# ---------- gate_pr_link ----------

def pr_ok(tmp):
    tulis(os.path.join(tmp, "body.md"), "Closes #42. Ini isinya.\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", os.path.join(tmp, "body.md")])


def pr_tanpa_rujukan(tmp):
    tulis(os.path.join(tmp, "body.md"), "Perbaikan kecil, tanpa nomor.\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", os.path.join(tmp, "body.md")])


def pr_commit_tanpa_rujukan(tmp):
    body = os.path.join(tmp, "body.md")
    commits = os.path.join(tmp, "commits.txt")
    tulis(body, "Closes #42.\n")
    tulis(commits, "perbaikan slip: potongan ganda (#42)\nperbaikan lain tanpa nomor\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", body, "--commits", commits])


def pr_rujukan_penuh(tmp):
    body = os.path.join(tmp, "body.md")
    commits = os.path.join(tmp, "commits.txt")
    tulis(body, "Closes #42. Lihat contoh/repo#42 untuk konteksnya.\n")
    tulis(commits, "tambah uji payroll (#42)\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", body, "--commits", commits, "--issue", "42"])


def pr_issue_beda(tmp):
    body = os.path.join(tmp, "body.md")
    tulis(body, "Closes #43.\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", body, "--issue", "42"])


def pr_merge_sintetis(tmp):
    # Commit merge buatan GitHub ("Merge <sha> into <sha>") tidak punya penulis manusia, jadi
    # tidak diperiksa. Tanpa ini gate merah di setiap PR, dan gate yang selalu merah tidak
    # membuktikan apa pun.
    body = os.path.join(tmp, "body.md")
    commits = os.path.join(tmp, "commits.txt")
    tulis(body, "Closes #42.\n")
    tulis(
        commits,
        "Merge 1f97368ef2892ef53967fd3bb49a48a0a19bb8e5 into aa4a5e14e1663cef5853fc05136e\n"
        "perbaikan slip: potongan ganda (#42)\n",
    )
    return jln(["tools/factory/gate_pr_link.py", "--body", body, "--commits", commits])


def pr_nomor_tanpa_kata_kunci(tmp):
    # Rujukan memuat `#42`, tapi tanpa kata kunci penutup: GitHub tidak menutup apa pun, dan
    # gate ini yang dulu hijau pada bentuk seperti ini (3 PR, 15 issue tertinggal).
    tulis(os.path.join(tmp, "body.md"), "Perbaikan gate (#42) sudah masuk.\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", os.path.join(tmp, "body.md"), "--issue", "42"])


def pr_kata_kunci_indonesia(tmp):
    tulis(os.path.join(tmp, "body.md"), "Menutup #42.\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", os.path.join(tmp, "body.md"), "--issue", "42"])


def pr_kata_kunci_fixes(tmp):
    tulis(os.path.join(tmp, "body.md"), "Fixes #42.\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", os.path.join(tmp, "body.md"), "--issue", "42"])


def pr_kata_kunci_resolves_titik_dua(tmp):
    tulis(os.path.join(tmp, "body.md"), "Resolves: #42\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", os.path.join(tmp, "body.md"), "--issue", "42"])


def pr_tutup_buku_bukan_klaim(tmp):
    # "tutup buku" itu istilah sah di modul kas dan bank. Badan PR yang memakainya bersama rujukan
    # issue tidak boleh dianggap sebagai klaim penutup; gate yang menuduh prosa yang benar akan
    # dimatikan orang, dan aturannya ikut hilang bersamanya.
    tulis(os.path.join(tmp, "body.md"), "Closes #42. Ini menutup buku Agustus (#42) juga.\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", os.path.join(tmp, "body.md"), "--issue", "42"])


def pr_kutipan_bukan_klaim(tmp):
    # Badan PR yang mengutip bentuk terlarang itu dokumentasi. Versi pertama gate ini menolak
    # badan PR #99 karena alasan itu, dan gate yang menuduh dokumentasinya sendiri berhenti
    # dipercaya. Yang diperiksa: kutipan di dalam backtick dilewati, dan kata kuncinya tetap sah.
    tulis(
        os.path.join(tmp, "body.md"),
        "Gate ini menolak bentuk lama seperti `Menutup #75` dan menuntut Closes #42.\n",
    )
    return jln(["tools/factory/gate_pr_link.py", "--body", os.path.join(tmp, "body.md"), "--issue", "42"])

def pr_penanda_tanpa_issue(tmp):
    # PR jejak (ledger, usulan, receipt) tidak menutup issue apa pun, jadi ia tidak punya kata kunci
    # penutup yang sah untuk ditulis. Sebelum jalur ini ada, gate menolaknya tanpa jalan keluar dan
    # jalur catat jejak jadi mustahil (#120). Penandanya eksplisit, jadi tidak ada kegagalan senyap.
    tulis(
        os.path.join(tmp, "body.md"),
        "Mencatat usulan ke factory/usulan.jsonl.\n"
        "Tanpa issue: tidak ada unit kerja yang ditutup oleh PR ini.\n",
    )
    return jln(["tools/factory/gate_pr_link.py", "--body", os.path.join(tmp, "body.md")])

def pr_penanda_tanpa_issue_bebas_commit(tmp):
    # Dependabot tidak pernah menulis nomor issue di judul commitnya, dan menyunting judul commit
    # orang lain bukan pilihan yang wajar. `Tanpa issue:` adalah pernyataan eksplisit bahwa unit
    # kerja ini tidak bertanggungan pada issue, jadi pemeriksaan per-commit tidak boleh
    # memaksakan yang sudah dinyatakan tidak ada (#u-HQ-deca89).
    body = os.path.join(tmp, "body.md")
    commits = os.path.join(tmp, "commits.txt")
    tulis(body, "Bump lodash dari 4.17.20 ke 4.17.21.\nTanpa issue: pembaruan dependensi otomatis.\n")
    tulis(commits, "Bump lodash from 4.17.20 to 4.17.21\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", body, "--commits", commits])

def pr_penanda_refs_tetap_cek_commit(tmp):
    # Batas jalur di atas: `Refs #42` MENGAKU ada unit kerja yang dirujuk, jadi tiap commit tetap
    # wajib menyebut nomornya. Kalau penanda ini ikut membebaskan judul commit, rujukan jadi cara
    # lolos tanpa jejak, dan gate kehilangan satu-satunya pemeriksaan per-commit yang tersisa.
    body = os.path.join(tmp, "body.md")
    commits = os.path.join(tmp, "commits.txt")
    tulis(body, "Sebagian kerja. Refs #42\n")
    tulis(commits, "perbaikan tanpa nomor\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", body, "--commits", commits])

def pr_penanda_refs(tmp):
    # Rujukan non-penutup: PR menyebut issue tanpa menutupnya. `Refs` secara bahasa berarti menyebut,
    # jadi ini pernyataan yang eksplisit, bukan kegagalan senyap yang jadi alasan gate ini ada.
    tulis(os.path.join(tmp, "body.md"), "Sebagian kerja, belum menutup. Refs #42\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", os.path.join(tmp, "body.md"), "--issue", "42"])

def pr_penanda_tanpa_alasan(tmp):
    # Penanda tanpa alasan cuma pintu belakang: ia meloloskan PR apa pun tanpa satu kata pun tentang
    # kenapa tidak ada issue. Gate yang menerimanya berhenti membuktikan apa pun.
    tulis(os.path.join(tmp, "body.md"), "Perbaikan kecil.\nTanpa issue:\n")
    return jln(["tools/factory/gate_pr_link.py", "--body", os.path.join(tmp, "body.md")])

def pr_penanda_dalam_backtick(tmp):
    # Badan PR yang MENGUTIP penandanya sedang mendokumentasikan, bukan memakainya. Sama seperti
    # kutipan bentuk terlarang: yang diperiksa teks apa adanya di luar potongan kode.
    tulis(
        os.path.join(tmp, "body.md"),
        "Gate ini menerima `Tanpa issue: <alasan>` untuk PR jejak, tapi badan ini tidak memakainya.\n",
    )
    return jln(["tools/factory/gate_pr_link.py", "--body", os.path.join(tmp, "body.md")])


def pr_pesan_backtick_menjelaskan(tmp):
    # Perilaku menolak penanda yang dikutip sudah diuji di pr_penanda_dalam_backtick. Yang diuji di
    # sini PESANNYA, karena pesan lama menyuruh penulis menulis `Refs #<nomor>` kepada penulis yang
    # SUDAH menulisnya, jadi ia mengulang bentuk yang sama (#271, nyata di PR #270: badan memuat
    # `Refs #255` di dalam backtick dan gate merah tanpa menyebut backtick sama sekali).
    #
    # Harness ini membandingkan exit code, bukan isi keluaran, jadi kasus ini mengembalikan 0 hanya
    # kalau dua hal sekaligus benar: gate MENOLAK, dan pesannya menyebut backtick. Harap_lulus=True
    # karena subjeknya "pesan sudah benar", bukan "gate menerima".
    tulis(os.path.join(tmp, "body.md"), "Bagian lane sync dari #255. `Refs #255`, bukan `Closes`.\n")
    kode, keluaran = jln_teks(["tools/factory/gate_pr_link.py", "--body", os.path.join(tmp, "body.md")])
    if kode == 0:
        return 1
    return 0 if "backtick" in keluaran else 1

# ---------- gate_receipt ----------

def bukti_dasar():
    return {
        "issue": 42,
        "lane": "android",
        "branch": "perbaikan/slip-pajak",
        "worktree": "~/GeoApps-android",
        "commit": SHA,
        "status_short": [],
        "kriteria": [{"perintah": "python3 tools/factory/sync_law.py --check", "exit": 0}],
        "checker": [{"perintah": "python3 tools/factory/gate_law_fresh.py", "exit": 0, "keluaran": "LULUS"}],
        "komentar_issue": "https://github.com/contoh/repo/issues/42#issuecomment-123456",
    }


def bukti_jalan(tmp, ubah):
    b = bukti_dasar()
    ubah(b)
    p = os.path.join(tmp, "bukti.json")
    tulis(p, json.dumps(b, indent=2))
    return jln(["tools/factory/gate_receipt.py", "--berkas", p, "--akar", AKAR])


def bukti_ok(tmp):
    return bukti_jalan(tmp, lambda b: None)


def bukti_checker_gagal(tmp):
    def ubah(b):
        b["checker"][0]["exit"] = 1
    return bukti_jalan(tmp, ubah)


def bukti_worktree_kotor(tmp):
    def ubah(b):
        b["status_short"] = ["apps/geolibre-desktop/src-tauri/android/uji/Inti.kt"]
    return bukti_jalan(tmp, ubah)


def bukti_commit_ngarang(tmp):
    def ubah(b):
        b["commit"] = "deadbee"
    return bukti_jalan(tmp, ubah)


def bukti_tanpa_komentar(tmp):
    def ubah(b):
        b["komentar_issue"] = "https://github.com/contoh/repo/issues/42"
    return bukti_jalan(tmp, ubah)


def bukti_kriteria_kosong(tmp):
    def ubah(b):
        b["kriteria"] = []
    return bukti_jalan(tmp, ubah)


def bukti_lane_ngarang(tmp):
    def ubah(b):
        b["lane"] = "lane-yang-tidak-ada"
    return bukti_jalan(tmp, ubah)


# ---------- gate_ledger ----------

def entri(ts, penulis="HQ", lane="android", issue=42, event="dispatch", **sisa):
    e = {"ts": ts, "penulis": penulis, "lane": lane, "issue": issue, "event": event,
         "catatan": "catatan uji"}
    e.update(sisa)
    return e


def ledger_jalan(tmp, daftar_baris, berkas=None):
    p = berkas or os.path.join(tmp, "ledger.jsonl")
    tulis(p, "\n".join(daftar_baris) + "\n")
    return jln(["tools/factory/gate_ledger.py", "--akar", AKAR, "--berkas", p])


def ledger_ok(tmp):
    return ledger_jalan(
        tmp,
        [
            json.dumps(entri("2026-10-09T19:00:00+07:00", event="buka", commit=SHA)),
            json.dumps(entri("2026-10-09T19:05:00+07:00", lane="geo-pdf", event="dispatch")),
        ],
    )


def ledger_dua_penulis(tmp):
    return ledger_jalan(tmp, [json.dumps(entri("2026-10-09T19:00:00+07:00", penulis="geo-pdf"))])


def ledger_ts_mundur(tmp):
    return ledger_jalan(
        tmp,
        [
            json.dumps(entri("2026-10-09T19:10:00+07:00", event="buka")),
            json.dumps(entri("2026-10-09T19:00:00+07:00", event="dispatch")),
        ],
    )


def ledger_dobel(tmp):
    return ledger_jalan(
        tmp,
        [
            json.dumps(entri("2026-10-09T19:00:00+07:00", event="buka")),
            json.dumps(entri("2026-10-09T19:05:00+07:00", event="buka")),
        ],
    )


def ledger_bukan_json(tmp):
    return ledger_jalan(tmp, ["ini bukan json"])


def ledger_commit_ngarang(tmp):
    return ledger_jalan(
        tmp, [json.dumps(entri("2026-10-09T19:00:00+07:00", event="buka", commit="deadbee"))]
    )


def ledger_tanpa_zona(tmp):
    return ledger_jalan(tmp, [json.dumps(entri("2026-10-09T19:00:00", event="buka"))])


def ledger_berkas_hilang(tmp):
    return jln(
        [
            "tools/factory/gate_ledger.py", "--akar", AKAR,
            "--berkas", os.path.join(tmp, "tidak-ada.jsonl"),
        ]
    )


# ---------- gate_plugin_lint ----------

def plugin_pohon(tmp, rusak=None, abaikan=None, nama_dir="uji"):
    import gate_plugin_lint as lint

    # Identitas ikut ditulis: lint menilai `name:` setelah placeholder diganti, dan
    # penggantinya membaca factory/identitas.json.
    u.tulis_identitas(tmp)
    lint.tulis(os.path.join(tmp, lint.BERKAS_PIN), lint.teks_pin())
    lint.tulis(
        os.path.join(tmp, lint.DIR_SKILLS, nama_dir, lint.BERKAS_SKILL),
        lint.teks_skill(nama=u.nama_skill(nama_dir), rusak=rusak),
    )
    if abaikan:
        lint.tulis(os.path.join(tmp, ".gitignore"), abaikan + "\n")
        subprocess.run(["git", "init", "-q"], cwd=tmp, stdout=subprocess.DEVNULL)
        subprocess.run(["git", "-C", tmp, "add", "-A"], stdout=subprocess.DEVNULL)

def plugin_ok(tmp):
    plugin_pohon(tmp)
    return jln(["tools/factory/gate_plugin_lint.py", "--akar", tmp])

def plugin_tanpa_frontmatter(tmp):
    plugin_pohon(tmp, rusak="tanpa_frontmatter")
    return jln(["tools/factory/gate_plugin_lint.py", "--akar", tmp])

def plugin_sisa_connectors(tmp):
    plugin_pohon(tmp, rusak="connectors")
    return jln(["tools/factory/gate_plugin_lint.py", "--akar", tmp])

def plugin_sha_beda(tmp):
    plugin_pohon(tmp, rusak="sha_beda")
    return jln(["tools/factory/gate_plugin_lint.py", "--akar", tmp])

def plugin_abaikan_git(tmp):
    # Direktori bernama `debug` ditelan pola .gitignore `[Dd]ebug/`: berkasnya ada di disk, git
    # tidak pernah melihatnya. Ini bug nyata di pohon ini, bukan hipotesis.
    plugin_pohon(tmp, abaikan="[Dd]ebug/", nama_dir="debug")
    return jln(["tools/factory/gate_plugin_lint.py", "--akar", tmp])

# ---------- gate_ontology ----------

ONT_UJI = """# Ontologi uji

| istilah | dipakai | dilarang |
|---|---|---|
| karyawan | SDM | pegawai |
"""

def ont_pohon(tmp, dokumen="# Dokumen\n\nSemua karyawan terdaftar.\n"):
    tulis(os.path.join(tmp, "ONTOLOGY.md"), ONT_UJI)
    tulis(os.path.join(tmp, "docs", "panduan.md"), dokumen)
    return tmp

def ont_ok(tmp):
    ont_pohon(tmp)
    return jln(["tools/factory/gate_ontology.py", "--akar", tmp])

def ont_pelanggar(tmp):
    ont_pohon(tmp, dokumen="# Dokumen\n\nData pegawai tetap ada di sini.\n")
    return jln(["tools/factory/gate_ontology.py", "--akar", tmp])

def ont_tanpa_tabel(tmp):
    tulis(os.path.join(tmp, "ONTOLOGY.md"), "# Ontologi\n\ntidak ada tabelnya\n")
    tulis(os.path.join(tmp, "docs", "panduan.md"), "# Dokumen\n")
    return jln(["tools/factory/gate_ontology.py", "--akar", tmp])

def ont_nol_berkas(tmp):
    # ONTOLOGY.md ada, tapi tidak ada satu pun berkas di cakupan. Gate yang menyisir nol objek
    # lalu keluar 0 menghasilkan laporan kosong yang terbaca seperti hijau.
    tulis(os.path.join(tmp, "ONTOLOGY.md"), ONT_UJI)
    return jln(["tools/factory/gate_ontology.py", "--akar", tmp])

# ---------- gate_kanal ----------

GRUP_UJI = u.grup()
KANAL_UJI = u.kanal_owner()

def kanal_pohon(tmp, kanal=KANAL_UJI, jumlah_sesi=1, grup=GRUP_UJI, arsip=False):
    """identitas.json + lanes.json + basis data sesi tiruan di tmp.

    Kanal owner dibaca gate_kanal dari identitas, jadi pohon tiruan ini WAJIB memuat
    identitas juga: tanpa itu semua kasus positifnya ditolak karena kanal kosong, dan
    ujinya jadi hijau-palsu di sisi negatif saja.
    """
    u.tulis_identitas(tmp, grup=grup, owner={"kanal": kanal or ""})
    d = {"versi": 1, "lane": [{"id": "HQ", "topic": 23}]}
    tulis(os.path.join(tmp, "factory", "lanes.json"), json.dumps(d))
    path = os.path.join(tmp, "uji.db")
    c = sqlite3.connect(path)
    c.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, channel_chat_key TEXT, archived_at INTEGER)")
    c.execute("CREATE TABLE session_bindings (session_id TEXT PRIMARY KEY, channel TEXT, "
              "chat_id TEXT, thread_id INTEGER, updated_at INTEGER)")
    if kanal:
        for n in range(jumlah_sesi):
            sid = "%08d-5555-5555-5555-555555555555" % (n + 1)
            c.execute("INSERT INTO sessions VALUES (?,?,?)", (sid, kanal, 1 if arsip else None))
    c.commit()
    c.close()
    return path

def kanal_jalan(tmp, **kw):
    db = kanal_pohon(tmp, **kw)
    return jln(["tools/factory/gate_kanal.py", "--akar", tmp, "--db", db, "--wajib-db"])

def kanal_ok(tmp):
    return kanal_jalan(tmp)

def kanal_kosong(tmp):
    return kanal_jalan(tmp, kanal="")

def kanal_bukan_kunci(tmp):
    return kanal_jalan(tmp, kanal="[chat]")

def kanal_grup_lain(tmp):
    # Dihitung dari grup yang sedang dipakai, bukan literal: literal bisa kebetulan sama dengan
    # grup proyek yang identitasnya memakai angka itu, dan kasus negatifnya lalu lolos.
    return kanal_jalan(tmp, kanal="[chat:%d:topic:262]" % (int(GRUP_UJI) - 1))

def kanal_topic_lane(tmp):
    # Kelas kegagalan yang benar-benar kejadian sebelum #178: cadangan `lapor.py` adalah lane HQ,
    # jadi digest opsi mendarat di ruangan yang dibaca owner dan terbaca seperti lane menanyakan
    # keputusan langsung ke owner.
    return kanal_jalan(tmp, kanal="[chat:%d:topic:23]" % GRUP_UJI)

def kanal_nol_sesi(tmp):
    return kanal_jalan(tmp, jumlah_sesi=0)

def kanal_dua_sesi(tmp):
    return kanal_jalan(tmp, jumlah_sesi=2)

def kanal_sesi_arsip(tmp):
    return kanal_jalan(tmp, arsip=True)

def kanal_tanpa_db(tmp):
    # Runner CI tidak punya basis data: gate boleh LULUS lewat pintu `LEWAT`, tapi yang dilewati
    # wajib disebut jumlahnya. Karena itu kasus `--wajib-db` di bawah ada: tanpa DB, alamatnya
    # TIDAK bisa dibuktikan, dan gate yang mengaku hijau tanpa memeriksa apa pun itu gate palsu.
    kanal_pohon(tmp)
    return jln(["tools/factory/gate_kanal.py", "--akar", tmp,
                "--db", os.path.join(tmp, "tidak-ada.db")])

def kanal_wajib_db_tanpa_db(tmp):
    kanal_pohon(tmp)
    return jln(["tools/factory/gate_kanal.py", "--akar", tmp,
                "--db", os.path.join(tmp, "tidak-ada.db"), "--wajib-db"])

# ---------- gate_pemicu_ci ----------

# Gate ini memeriksa SATU berkas, `.github/workflows/factory-gate.yml`. Versi sebelumnya juga
# memeriksa `uji-windows.yml` (workflow produk yang tidak ada di pohon ini) beserta mesin pencocok
# path-nya; bagian itu dibuang. Yang diuji di sini: penyaring path ditolak, `labeled` wajib ada di
# `types:`, job tidak boleh menyaring `github.event.action`, dan grup concurrency memuat action.
_IF_GATE = (
    "    if: github.event_name != 'pull_request' || "
    "github.event.pull_request.head.repo.full_name == github.repository\n"
)
_TYPES_GATE = "    types: [opened, synchronize, reopened, labeled]\n"
_GRUP_GATE = "concurrency:\n  group: factory-gate-${{ github.ref }}-${{ github.event.action }}\n"

def _tulis_gate_wf(tmp, types_baris=_TYPES_GATE, daftar_if=None, grup=_GRUP_GATE,
                   penyaring_baris=""):
    # Bentuk minimum factory-gate.yml yang SEHAT: `labeled` ada di types:, tiap job TIDAK menyaring
    # `github.event.action` (gate membaca dua label, `lane:` dan `eskalasi`, jadi filter satu label
    # melewati yang lain), dan grup concurrency memuat action supaya event tidak saling membatalkan.
    if daftar_if is None:
        daftar_if = [_IF_GATE, _IF_GATE]
    isi = (
        "name: factory-gate\non:\n  pull_request:\n    branches: [main]\n"
        + types_baris
        + penyaring_baris
        + "  push:\n    branches: [main]\n"
        + grup
        + "jobs:\n"
    )
    for n, b in enumerate(daftar_if):
        isi += "  j%d:\n    runs-on: ubuntu-latest\n" % n + b + "    steps:\n      - run: echo x\n"
    tulis(os.path.join(tmp, ".github", "workflows", "factory-gate.yml"), isi)
    return tmp

def pemicu_ok(tmp):
    _tulis_gate_wf(tmp)
    return jln(["tools/factory/gate_pemicu_ci.py", "--akar", tmp])

def pemicu_penyaring_path(tmp):
    # `paths:` membuat PR yang tidak menyentuh path itu melewati SELURUH gate. Itu justru kelas
    # kesalahan yang gate ini jaga: gate cakupan lane harus memeriksa tiap PR.
    _tulis_gate_wf(tmp, penyaring_baris="    paths:\n      - 'factory/**'\n")
    return jln(["tools/factory/gate_pemicu_ci.py", "--akar", tmp])

def pemicu_paths_ignore(tmp):
    _tulis_gate_wf(tmp, penyaring_baris="    paths-ignore:\n      - 'docs/**'\n")
    return jln(["tools/factory/gate_pemicu_ci.py", "--akar", tmp])

def pemicu_label_tanpa_types(tmp):
    # Tanpa `types:` GitHub cuma menjalankan opened/synchronize/reopened, jadi memasang label
    # `lane:` sesudah PR terbuka tidak memeriksa ulang cakupan (#225).
    _tulis_gate_wf(tmp, types_baris="")
    return jln(["tools/factory/gate_pemicu_ci.py", "--akar", tmp])

def pemicu_label_filter_action(tmp):
    # Kelas gagal nyata PR #227: job menyaring `github.event.action` ke SATU label, sehingga run
    # untuk label lain (di sini `eskalasi`) lahir lalu di-SKIP, dan gate yang memeriksa tidak jalan.
    _tulis_gate_wf(tmp, daftar_if=[
        _IF_GATE,
        "    if: >-\n"
        "      (github.event_name != 'pull_request')\n"
        "      && (github.event.action != 'labeled' || startsWith(github.event.label.name, 'lane:'))\n",
    ])
    return jln(["tools/factory/gate_pemicu_ci.py", "--akar", tmp])

def pemicu_label_grup_tanpa_action(tmp):
    # Tanpa action di grup, event `opened` dan `labeled` untuk PR yang sama saling membatalkan.
    _tulis_gate_wf(tmp, grup="concurrency:\n  group: factory-gate-${{ github.ref }}\n")
    return jln(["tools/factory/gate_pemicu_ci.py", "--akar", tmp])

def paths_agen_dengan_izin(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, [".github/workflows/factory-gate.yml"])
    kode, teks = jln_teks(
        [
            "tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "HQ",
            "--paths", p, "--izin-eskalasi",
        ]
    )
    # Kasus ini sekaligus menagih pesannya. Di bawah kode lama (`glob_agen` tidak dibaca) path
    # ini jatuh ke pemeriksaan cakupan lane dan ditolak, jadi LULUS di sini hanya bisa terjadi
    # kalau tingkat agent benar-benar terbaca dan dilaporkan.
    if "tingkat agent" not in teks:
        return 1
    return kode

def paths_agen_tanpa_izin(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, [".github/workflows/factory-gate.yml"])
    kode, teks = jln_teks(
        ["tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "HQ", "--paths", p]
    )
    # Pesannya wajib menyebut tingkat agent. Kalau tidak, kembalikan 0 supaya kasus negatif ini
    # terbaca BEDA, bukan lulus palsu karena exit-nya memang non-nol.
    if "keputusan agent" not in teks:
        return 0
    return kode

def paths_owner_pesan(tmp):
    salin_lanes(tmp)
    p = tulis_paths(tmp, ["packaging/paket.conf"])
    kode, teks = jln_teks(
        ["tools/factory/gate_commit_paths.py", "--akar", tmp, "--lane", "HQ", "--paths", p]
    )
    if "tingkat owner" not in teks:
        return 0
    return kode

KASUS = [
    ("gate_law_fresh", "positif: LAW disahkan + SKILL sinkron", True, law_positif),
    ("gate_law_fresh", "negatif: isi berubah tanpa naik versi", False, law_versi_tidak_naik),
    ("gate_law_fresh", "negatif: baseline belum disahkan ulang", False, law_baseline_basi),
    ("gate_law_fresh", "negatif: SKILL beda dari sumber", False, law_skill_beda),
    ("gate_law_fresh", "negatif: baseline belum ada", False, law_tanpa_baseline),
    ("gate_commit_paths", "positif: berkas di cakupan lane", True, paths_ok),
    ("gate_commit_paths", "negatif: berkas di luar cakupan lane", False, paths_luar_cakupan),
    ("gate_commit_paths", "negatif: HQ menyentuh kode modul", False, paths_hq_menyentuh_kode),
    ("gate_commit_paths", "negatif: path eskalasi tanpa izin", False, paths_eskalasi_tanpa_izin),
    ("gate_commit_paths", "positif: path eskalasi dengan izin", True, paths_eskalasi_dengan_izin),
    ("gate_commit_paths", "negatif: hanya-eskalasi tetap menolak", False, paths_hanya_eskalasi_menolak),
    ("gate_commit_paths", "positif: hanya-eskalasi lolos cakupan bebas", True, paths_hanya_eskalasi_lolos),
    ("gate_commit_paths", "negatif: tanpa label, berkas jejak ditolak", False, paths_tanpa_label_jejak),
    ("gate_commit_paths", "positif: tanpa label, non-jejak tetap lolos", True, paths_tanpa_label_lolos),
    ("gate_commit_paths", "positif: lane deps tanda tangan 11 manifes", True, paths_deps_manifes_lolos),
    ("gate_commit_paths", "negatif: lane deps menyentuh kode produk", False, paths_deps_tolak_kode_produk),
    ("gate_commit_paths", "negatif: geo-pdf ditolak untuk lockfile akar", False, paths_geopdf_tolak_lockfile_akar),
    ("gate_commit_paths", "positif: dua label lane menutup dua cakupan", True, paths_dua_lane_gabungan_lolos),
    ("gate_commit_paths", "positif: dua label lane bentuk koma", True, paths_dua_lane_koma_lolos),
    ("gate_commit_paths", "negatif: label lane menganggur ditolak", False, paths_dua_lane_label_menganggur_ditolak),
    ("gate_commit_paths", "negatif: dua cakupan dengan satu label ditolak", False, paths_dua_lane_kurang_satu_ditolak),
    ("gate_commit_paths", "negatif: entri lanes.json menunjuk path mati", False, paths_entri_mati_menolak),
    ("gate_commit_paths", "positif: glob wildcard tanpa match tetap lolos", True, paths_glob_wildcard_tanpa_match_lolos),
    ("gate_commit_paths", "positif: base sudah maju, kerja lane lain tidak dihitung", True, paths_base_maju_ok),
    ("gate_commit_paths", "negatif: base sudah maju, pelanggaran sendiri tetap ditolak", False, paths_base_maju_tetap_menolak),
    ("gate_pr_link", "positif: PR menutup issue", True, pr_ok),
    ("gate_pr_link", "negatif: PR tanpa nomor issue", False, pr_tanpa_rujukan),
    ("gate_pr_link", "negatif: ada commit tanpa nomor issue", False, pr_commit_tanpa_rujukan),
    ("gate_pr_link", "positif: rujukan penuh + nomor sama", True, pr_rujukan_penuh),
    ("gate_pr_link", "negatif: rujukan ke nomor lain", False, pr_issue_beda),
    ("gate_pr_link", "positif: commit merge sintetis dilewati", True, pr_merge_sintetis),
    ("gate_pr_link", "negatif: nomor disebut tanpa kata kunci penutup", False, pr_nomor_tanpa_kata_kunci),
    ("gate_pr_link", "negatif: klaim penutup berbahasa Indonesia", False, pr_kata_kunci_indonesia),
    ("gate_pr_link", "positif: kata kunci Fixes diterima", True, pr_kata_kunci_fixes),
    ("gate_pr_link", "positif: kata kunci Resolves bertitik dua diterima", True, pr_kata_kunci_resolves_titik_dua),
    ("gate_pr_link", "positif: sebutan tutup buku bukan klaim penutup", True, pr_tutup_buku_bukan_klaim),
    ("gate_pr_link", "positif: kutipan di dalam backtick bukan klaim", True, pr_kutipan_bukan_klaim),
    ("gate_pr_link", "positif: PR jejak berpenanda `Tanpa issue:`", True, pr_penanda_tanpa_issue),
    ("gate_pr_link", "positif: `Tanpa issue:` membebaskan judul commit tanpa nomor", True, pr_penanda_tanpa_issue_bebas_commit),
    ("gate_pr_link", "negatif: `Refs #N` tetap mewajibkan nomor di judul commit", False, pr_penanda_refs_tetap_cek_commit),
    ("gate_pr_link", "positif: rujukan non-penutup `Refs #42`", True, pr_penanda_refs),
    ("gate_pr_link", "negatif: penanda `Tanpa issue:` tanpa alasan", False, pr_penanda_tanpa_alasan),
    ("gate_pr_link", "negatif: penanda cuma dikutip di dalam backtick", False, pr_penanda_dalam_backtick),
    ("gate_pr_link", "positif: pesan tolak backtick menjelaskan backtick", True, pr_pesan_backtick_menjelaskan),
    ("gate_receipt", "positif: bukti lengkap", True, bukti_ok),
    ("gate_receipt", "negatif: checker keluar 1", False, bukti_checker_gagal),
    ("gate_receipt", "negatif: worktree masih kotor", False, bukti_worktree_kotor),
    ("gate_receipt", "negatif: commit tidak ada di repo", False, bukti_commit_ngarang),
    ("gate_receipt", "negatif: komentar issue bukan tautan komentar", False, bukti_tanpa_komentar),
    ("gate_receipt", "negatif: kriteria selesai kosong", False, bukti_kriteria_kosong),
    ("gate_receipt", "negatif: lane tidak terdaftar", False, bukti_lane_ngarang),
    ("gate_ledger", "positif: dua entri, penulis tunggal", True, ledger_ok),
    ("gate_ledger", "negatif: penulis bukan HQ", False, ledger_dua_penulis),
    ("gate_ledger", "negatif: ts mundur", False, ledger_ts_mundur),
    ("gate_ledger", "negatif: (issue, event) dobel", False, ledger_dobel),
    ("gate_ledger", "negatif: baris bukan JSON", False, ledger_bukan_json),
    ("gate_ledger", "negatif: commit tidak ada di repo", False, ledger_commit_ngarang),
    ("gate_ledger", "negatif: ts tanpa zona waktu", False, ledger_tanpa_zona),
    ("gate_ledger", "negatif: berkas ledger hilang", False, ledger_berkas_hilang),
    ("gate_plugin_lint", "positif: skill lengkap dan ter-track", True, plugin_ok),
    ("gate_plugin_lint", "negatif: frontmatter hilang", False, plugin_tanpa_frontmatter),
    ("gate_plugin_lint", "negatif: sisa rujukan CONNECTORS.md", False, plugin_sisa_connectors),
    ("gate_plugin_lint", "negatif: SHA sumber beda dari PIN", False, plugin_sha_beda),
    ("gate_plugin_lint", "negatif: berkas ditelan .gitignore", False, plugin_abaikan_git),
    ("gate_ontology", "positif: prosa bersih", True, ont_ok),
    ("gate_ontology", "negatif: sinonim terlarang di prosa", False, ont_pelanggar),
    ("gate_ontology", "negatif: ONTOLOGY.md tanpa tabel dilarang", False, ont_tanpa_tabel),
    ("gate_ontology", "negatif: nol berkas diperiksa", False, ont_nol_berkas),
    ("gate_kanal", "positif: kanal sah + satu sesi hidup", True, kanal_ok),
    ("gate_kanal", "negatif: kanal kosong", False, kanal_kosong),
    ("gate_kanal", "negatif: kanal bukan kunci sesi", False, kanal_bukan_kunci),
    ("gate_kanal", "negatif: kanal menunjuk grup lain", False, kanal_grup_lain),
    ("gate_kanal", "negatif: kanal menunjuk topic lane", False, kanal_topic_lane),
    ("gate_kanal", "negatif: kanal nol sesi hidup", False, kanal_nol_sesi),
    ("gate_kanal", "negatif: kanal dua sesi hidup", False, kanal_dua_sesi),
    ("gate_kanal", "negatif: kanal sesi terarsip", False, kanal_sesi_arsip),
    ("gate_kanal", "positif: tanpa db, lewat dan jumlahnya disebut", True, kanal_tanpa_db),
    ("gate_kanal", "negatif: --wajib-db tanpa db", False, kanal_wajib_db_tanpa_db),
    ("gate_pemicu_ci", "positif: pemicu gate sehat", True, pemicu_ok),
    ("gate_pemicu_ci", "negatif: penyaring `paths:` memasang filter", False, pemicu_penyaring_path),
    ("gate_pemicu_ci", "negatif: penyaring `paths-ignore:`", False, pemicu_paths_ignore),
    ("gate_pemicu_ci", "negatif: `labeled` tidak ada di types:", False, pemicu_label_tanpa_types),
    ("gate_pemicu_ci", "negatif: job menyaring action ke satu label", False, pemicu_label_filter_action),
    ("gate_pemicu_ci", "negatif: grup concurrency tanpa action", False, pemicu_label_grup_tanpa_action),
    ("gate_commit_paths", "positif: eskalasi agent + izin, pesan sebut tingkat", True, paths_agen_dengan_izin),
    ("gate_commit_paths", "negatif: eskalasi agent tanpa izin, pesan sebut agent", False, paths_agen_tanpa_izin),
    ("gate_commit_paths", "negatif: eskalasi owner, pesan sebut tingkat owner", False, paths_owner_pesan),
]


def main():
    print("AKAR  : %s" % AKAR)
    print("HEAD  : %s" % SHA[:12])
    print("")

    gagal = 0
    hitung = {}
    terakhir_gate = None
    print("%-19s %-46s %-6s %-5s %s" % ("GATE", "KASUS", "HARAP", "EXIT", "STATUS"))
    for gate, nama, harap_lulus, fungsi in KASUS:
        if gate != terakhir_gate:
            print("-" * 88)
            terakhir_gate = gate
        with tempfile.TemporaryDirectory() as tmp:
            kode = fungsi(tmp)
        dapat_lulus = kode == 0
        benar = dapat_lulus == harap_lulus
        if not benar:
            gagal += 1
        h = hitung.setdefault(gate, {"kasus": 0, "negatif": 0})
        h["kasus"] += 1
        if not harap_lulus:
            h["negatif"] += 1
        print(
            "%-19s %-46s %-6s %-5s %s"
            % (gate, nama, "LULUS" if harap_lulus else "TOLAK", kode, "OK" if benar else "BEDA")
        )

    print("")
    for gate, h in hitung.items():
        if h["negatif"] == 0:
            print("GAGAL  %s tidak punya kasus negatif: gate itu belum membuktikan bisa menolak" % gate)
            gagal += 1

    print("UJI MANDIRI: %d kasus, %d gagal" % (len(KASUS), gagal))
    return 1 if gagal else 0


if __name__ == "__main__":
    sys.exit(main())
