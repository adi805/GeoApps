#!/usr/bin/env python3
"""gate_pr_link.py - tolak unit kerja yang tidak punya nomor issue, dan klaim penutup yang tidak
diproses GitHub.

Kenapa ada: hukum proses bagian 1 bilang kerjaan tanpa nomor issue itu tidak ada dan tidak akan
pernah ditutup, dan bagian 6 bilang nomor issue ditulis di judul commit dan di laporan closing.
Sebelum gate ini, aturan itu cuma prosa: PR bisa dibuka tanpa menyebut issue mana pun, dan tidak
ada yang menolak. Gate ini menuntut rujukan `#NNN` di judul atau badan PR, dan di setiap judul
commit kalau daftar commit diberikan.

Sejak 2026-10-10 gate ini juga menuntut kata kunci penutup berbahasa Inggris di badan PR
(`Closes #42`, `Fixes #42`, `Resolves #42`, dengan atau tanpa titik dua). Rujukan `#42` saja tidak
menutup apa pun, karena GitHub cuma memproses tiga kata itu.

Kenapa ditambahkan: badan PR di repo ini menulis klaim penutupnya dalam bahasa Indonesia
("Menutup #75"), jadi tidak ada satu pun issue yang tertutup otomatis. Tiga PR yang sudah di-merge
(#94, #78, #70) meninggalkan 15 issue terbuka padahal kerjaannya sudah masuk main, dan gate ini
hijau di ketiganya: ia memeriksa keterkaitan, bukan kata kunci yang benar-benar memicu penutupan.
Gate yang hijau tepat pada kasus yang rusak lebih buruk daripada tidak punya gate, karena ia
membeli kepercayaan yang tidak dibayar. Klaim penutup berbahasa Indonesia ditolak, bukan diabaikan,
supaya penulisnya tidak menyangka issue-nya sudah tertutup.

Potongan kode dilewati sebelum klaim bahasa Indonesia dicocokkan, karena badan PR yang
MENGUTIP bentuk yang dilarang itu dokumentasi, bukan klaim. Terbukti pada badan PR #99,
yang mengutip `Menutup #75` sebagai contoh dan ditolak oleh versi pertama gate ini.

Sejak 2026-10-10 ada jalur untuk PR yang memang TIDAK menutup apa pun, yaitu PR jejak
(`factory/ledger.jsonl`, `factory/usulan.jsonl`, `factory/receipts/*.json`): badannya boleh memuat
baris `Tanpa issue: <alasan>` atau rujukan non-penutup `Refs #N`. Sebelum jalur itu ada, PR jejak
mustahil dibuat: ia tidak menutup issue apa pun, jadi tidak punya kata kunci penutup yang sah untuk
ditulis, dan gate menolaknya tanpa jalan keluar (#120). Jalur ini tidak melemahkan gate-nya, karena
yang dilarang di sini kegagalan SENYAP: `Refs #42` dan `Tanpa issue: ...` menyatakan sendiri bahwa
PR-nya tidak menutup, sementara `Menutup #42` mengklaim menutup padahal GitHub tidak memprosesnya.
Alasan di belakang `Tanpa issue:` wajib tidak kosong; penanda tanpa alasan cuma pintu belakang.

Cara pakai:
  python3 tools/factory/gate_pr_link.py --judul judul.txt --body body.md
  python3 tools/factory/gate_pr_link.py --body body.md --commits commits.txt --issue 42
  git log --format=%s --no-merges origin/main..HEAD > commits.txt   # bentuk berkasnya

`--issue 42` mempersempit: kalau diberikan, rujukan ke nomor lain tidak dihitung.

Commit merge dilewati. GitHub membuat commit merge sintetis (`Merge <sha> into <sha>`) untuk tiap
PR, dan tidak ada manusia yang menulis judulnya; memeriksanya membuat gate ini merah di setiap PR,
dan gate yang selalu merah tidak dipercaya lagi. Judul merge bawaan git (`Merge branch 'x'`,
`Merge pull request #12 from ...`) juga dilewati.
"""

import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _umum as u  # noqa: E402

# `#42`, `(#42)`, `<pemilik>/<repo>#42`, dan `issues/42` semuanya dihitung sebagai rujukan issue.
POLA_RUJUKAN = re.compile(r"(?:#(\d{1,6})\b|/issues/(\d{1,6})\b)")

# Satu-satunya kata kunci yang diproses GitHub saat PR di-merge: close, fix, resolve dan varian
# bentuk lampaunya. Sengaja sempit. Kata lain yang juga berarti "selesai" tidak diproses GitHub,
# jadi menerimanya di sini cuma memindahkan kegagalannya ke tempat yang lebih sunyi.
POLA_TUTUP = re.compile(
    r"\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)[ \t]*:?[ \t]*#(\d{1,6})\b", re.IGNORECASE
)

# Klaim penutup berbahasa Indonesia. Polanya sengaja rapat: kata kerja, lalu opsional kata "issue",
# lalu langsung nomornya. Longgar berarti "menutup buku Agustus (#42)" ikut tertangkap, dan tutup
# buku itu istilah sah di modul kas dan bank; gate yang menuduh prosa yang benar akan dimatikan
# orang, dan aturannya ikut hilang bersamanya.
POLA_TUTUP_ID = re.compile(
    r"\b(?:menutup|menutupi|menyelesaikan|mengakhiri)\b"
    r"(?:[ \t]+(?:issue|isu)\b)?[ \t]*:?[ \t]*#(\d{1,6})\b",
    re.IGNORECASE,
)

# Penanda non-penutup, jalur sah untuk PR yang memang tidak menutup apa pun (#120). Dua bentuk, dan
# keduanya harus menyatakan diri: baris `Tanpa issue: <alasan>` (alasannya wajib tidak kosong, kalau
# kosong penandanya cuma pintu belakang), atau rujukan `Refs #N` yang secara bahasa berarti menyebut
# tanpa menutup. Sengaja tidak diikat ke awal baris: penanda yang ditulis menyambung kalimat tetap
# penanda, dan menolaknya cuma memindahkan kerja ke penulis tanpa menambah keamanan. Yang dijaga
# bukan posisinya, tapi bahwa alasannya ada.
POLA_TANPA_ISSUE = re.compile(
    r"\btanpa[ \t]+issue[ \t]*:[ \t]*(\S.*)$", re.IGNORECASE | re.MULTILINE
)
POLA_REFS = re.compile(r"\brefs\b[ \t]*:?[ \t]*#(\d{1,6})\b", re.IGNORECASE)

# Judul merge buatan mesin, bukan manusia: satu bentuk dari GitHub (commit merge sintetis yang
# dibuat untuk tiap PR), tiga sisanya dari git. Sengaja sempit, supaya commit yang kebetulan
# berjudul "Merge ..." tapi bukan salah satu bentuk ini tetap diperiksa.
POLA_MERGE = re.compile(
    r"^Merge (?:[0-9a-f]{7,40} into [0-9a-f]{7,40}"
    r"|branch |remote-tracking branch |pull request )"
)


def baca(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def nomor_ditemukan(teks):
    keluar = set()
    for cocok in POLA_RUJUKAN.finditer(teks):
        keluar.add(int(cocok.group(1) or cocok.group(2)))
    return keluar


# Potongan kode dilewati sebelum klaim bahasa Indonesia dicocokkan. Badan PR yang MENGUTIP
# bentuk yang dilarang itu dokumentasi, bukan klaim, dan gate yang menuduh dokumentasinya
# sendiri akan dimatikan orang. Pola yang sama sudah dipakai gate_ontology. Rujukan yang
# ditulis di dalam backtick tetap tidak menutup apa pun, jadi melewatinya di sini tidak
# membuka jalan pintas: syarat kata kunci berbahasa Inggris diperiksa pada teks apa adanya.
POLA_KODE_PAGAR = re.compile(r"```.*?```", re.DOTALL)
POLA_KODE_SEBARIS = re.compile(r"`[^`\n]*`")


def tanpa_kode(teks):
    teks = POLA_KODE_PAGAR.sub(" ", teks)
    return POLA_KODE_SEBARIS.sub(" ", teks)

# Nalar tunggal untuk pertanyaan "issue nomor berapa yang dinyatakan PR ini sebagai tanggungannya?".
# Dipakai gate ini sendiri DAN `pacemaker.py` (sinyal 3). Sampai 2026-10-10 pacemaker memakai pola
# `#N` apa adanya, jadi PR yang sekadar MENYEBUT `#55` sudah cukup memadamkan sinyal issue #55 tanpa
# mengerjakannya, dan dua alat itu menjawab pertanyaan yang sama dengan nalar berbeda (keputusan
# agent, u-HQ-719710 opsi 1: yang menang nalar yang sudah dipakai gate, jangan bikin nalar ketiga).
#
# Dua bentuk yang dihitung, keduanya menyatakan diri: klaim penutup berbahasa Inggris
# (`Closes`/`Fixes`/`Resolves #N`) dan rujukan non-penutup (`Refs #N`). Klaim berbahasa Indonesia
# ("Menutup #N") sengaja TIDAK dihitung: gate ini menolaknya justru karena GitHub tidak memproses
# kata itu, jadi issue-nya tetap terbuka setelah PR-nya di-merge dan sinyalnya harus tetap menyala.
# Kutipan di dalam backtick dilewati untuk KEDUANYA, sesuai maksud yang sudah diuji di
# `uji_gate_mandiri.py`: badan PR yang mengutip penandanya sedang mendokumentasikan, bukan memakainya.
def nomor_penutup(teks):
    """Nomor yang DIKLAIM ditutup teks ini (klaim penutup berbahasa Inggris)."""
    return {int(n) for n in POLA_TUTUP.findall(tanpa_kode(teks or ""))}

def nomor_refs(teks):
    """Nomor yang disebut sebagai rujukan non-penutup oleh teks ini (`Refs #N`)."""
    return {int(n) for n in POLA_REFS.findall(tanpa_kode(teks or ""))}

def nomor_deklarasi(teks):
    """Nomor issue yang dinyatakan teks ini sebagai tanggungannya, bukan sekadar disebut."""
    return nomor_penutup(teks) | nomor_refs(teks)


def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("--body", required=True, help="berkas berisi badan PR")
    p.add_argument("--judul", default=None)
    p.add_argument("--commits", default=None, help="berkas, satu judul commit per baris")
    p.add_argument("--issue", type=int, default=None)
    a = p.parse_args()

    if not os.path.exists(a.body):
        print("GAGAL  badan PR tidak ada: %s" % a.body)
        return 2

    teks_pr = baca(a.body)
    if a.judul:
        if not os.path.exists(a.judul):
            print("GAGAL  judul PR tidak ada: %s" % a.judul)
            return 2
        teks_pr = baca(a.judul) + "\n" + teks_pr

    alasan = []

    klaim_id = sorted({int(n) for n in POLA_TUTUP_ID.findall(tanpa_kode(teks_pr))})
    if klaim_id:
        alasan.append(
            "klaim penutup berbahasa Indonesia tidak diproses GitHub: %s. "
            "Tulis `Closes #<nomor>` (Inggris), karena GitHub cuma memproses "
            "close/fix/resolve dan variannya."
            % ", ".join("Menutup #%d" % n for n in klaim_id)
        )

    nomor_tutup = nomor_penutup(teks_pr)
    if a.issue is not None:
        nomor_tutup = {n for n in nomor_tutup if n == a.issue}

    # Penanda non-penutup (#120). Penanda berlaku juga saat `--issue` diberikan: `Refs #42` bersama
    # `--issue 42` berarti "PR ini menyebut #42 tanpa menutupnya", dan itu pernyataan yang
    # eksplisit, bukan kegagalan senyap yang jadi alasan gate ini ada.
    teks_penanda = tanpa_kode(teks_pr)
    penanda = []
    tanpa_issue = bool(POLA_TANPA_ISSUE.search(teks_penanda))
    if tanpa_issue:
        penanda.append("`Tanpa issue:`")
    nomor_rujukan = sorted(nomor_refs(teks_pr))
    if nomor_rujukan:
        penanda.append("rujukan non-penutup %s" % ", ".join("#%d" % n for n in nomor_rujukan))

    if not nomor_tutup and not penanda:
        # Penanda yang ADA tapi seluruhnya di dalam potongan kode dihitung dokumentasi, jadi PR-nya
        # ditolak tanpa penjelasan yang cocok: pesan di bawah menyuruh menulis `Refs #<nomor>`
        # kepada penulis yang SUDAH menulisnya, dan saran itu sendiri mencetak penandanya di dalam
        # backtick, jadi ia mengajarkan bentuk yang justru ditolak. Nyata di PR #270: badan memuat
        # `Refs #255` di dalam backtick, gate merah 17 detik tanpa menyebut backtick sama sekali (#271).
        tutup_mentah = sorted({int(n) for n in POLA_TUTUP.findall(teks_pr)})
        refs_mentah = sorted({int(n) for n in POLA_REFS.findall(teks_pr)})
        if tutup_mentah or refs_mentah:
            bentuk = []
            if tutup_mentah:
                bentuk.append("kata kunci penutup %s" % ", ".join("#%d" % n for n in tutup_mentah))
            if refs_mentah:
                bentuk.append("rujukan `Refs` %s" % ", ".join("#%d" % n for n in refs_mentah))
            alasan.append(
                "penanda ada di badan PR, tapi seluruhnya di dalam potongan kode (%s). Gate "
                "menghitung kutipan backtick sebagai DOKUMENTASI, bukan klaim, jadi penanda itu "
                "tidak berlaku. Tulis ulang penandanya DI LUAR backtick." % "; ".join(bentuk)
            )
        if a.issue is not None:
            alasan.append(
                "judul/badan PR tidak menutup issue #%d dengan kata kunci berbahasa Inggris. "
                "Tulis `Closes #%d`. Kalau PR-nya memang tidak menutup apa pun, tulis "
                "`Tanpa issue: <alasan>` atau `Refs #%d`." % (a.issue, a.issue, a.issue)
            )
        else:
            alasan.append(
                "judul/badan PR tidak memuat kata kunci penutup berbahasa Inggris. "
                "Tulis `Closes #<nomor>` (atau `Fixes`/`Resolves`). Rujukan `#<nomor>` saja "
                "tidak menutup apa pun, karena GitHub cuma memproses kata kunci itu. "
                "Kalau PR-nya memang tidak menutup apa pun (PR jejak), tulis "
                "`Tanpa issue: <alasan>` atau `Refs #<nomor>`."
            )

    jumlah_commit = 0
    if a.commits:
        if not os.path.exists(a.commits):
            print("GAGAL  daftar commit tidak ada: %s" % a.commits)
            return 2
        for i, baris in enumerate(baca(a.commits).splitlines(), 1):
            judul = baris.strip()
            if not judul:
                continue
            if POLA_MERGE.match(judul):
                continue
            jumlah_commit += 1
            # `Tanpa issue:` adalah pernyataan eksplisit bahwa unit kerja ini tidak bertanggungan
            # pada issue mana pun. Mewajibkan tiap judul commit menyebut nomor issue di bawah
            # pernyataan itu membuat penanda yang sah jadi mustahil dipakai: bot (Dependabot) tidak
            # pernah menulis nomor issue di judulnya, jadi satu-satunya jalan keluarnya adalah
            # menyunting judul commit orang lain. Badan PR tetap wajib menyebut alasannya.
            if tanpa_issue:
                continue
            nomor = nomor_ditemukan(judul)
            if a.issue is not None:
                nomor = {n for n in nomor if n == a.issue}
            if not nomor:
                alasan.append("commit ke-%d tidak menyebut issue: %s" % (i, judul[:80]))

    if alasan:
        return u.tolak("unit kerja tidak tertaut ke issue", alasan)

    if nomor_tutup:
        ringkas = "menutup issue %s" % ", ".join("#%d" % n for n in sorted(nomor_tutup))
    else:
        ringkas = "tidak menutup issue (penanda non-penutup: %s)" % ", ".join(penanda)
    if jumlah_commit:
        ringkas += ", %d commit semuanya menyebut issue" % jumlah_commit
    return u.lulus(ringkas)


if __name__ == "__main__":
    sys.exit(main())