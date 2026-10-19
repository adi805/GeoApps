#!/usr/bin/env python3
"""ledger.py - satu-satunya penulis factory/ledger.jsonl.

Kenapa ada: ledger factory mencatat peristiwa lintas lane (unit kerja di-dispatch, PR dibuka, unit
ditutup, eskalasi naik, ruling owner). Kalau setiap lane menulis berkas itu sendiri dengan cara
sendiri, yang tersisa adalah beberapa catatan yang saling menimpa dan tidak ada satu tempat yang
bisa dipercaya. Berkas ini membuat jalur tulisnya satu:

  - penulisnya dikunci: `penulis` wajib sama dengan `penulis_ledger` di `factory/lanes.json`, dan
    lane-nya dibaca dari `$PMS_TSJ_LANE` kalau `--penulis` tidak diberikan. Lane lain ditolak.
  - tulisannya serial: berkas dikunci `flock(LOCK_EX)` selama baca-validasi-tulis, jadi dua lane
    yang menulis bersamaan tidak bisa saling menimpa.
  - append-only: entri baru divalidasi bersama seluruh isi lama SEBELUM ditulis. Kalau entri baru
    membuat `ts` mundur, mengulang pasangan (issue, event), atau menyebut commit yang tidak ada,
    tulisannya ditolak dan berkasnya tidak berubah.
  - skemanya satu: `periksa()` di berkas ini dipakai `gate_ledger.py` lewat `verify`, bukan disalin.

Perintah:
  python3 tools/factory/ledger.py append --lane payroll --issue 42 --event dispatch --catatan "..."
  python3 tools/factory/ledger.py verify
  python3 tools/factory/ledger.py tail --n 5
  python3 tools/factory/ledger.py reanchor --peta peta.json [--kering]
  python3 tools/factory/ledger.py --uji-mandiri

`reanchor` ada karena jangkar `commit` menunjuk SHA, dan SHA berubah begitu judul commit
ditulis ulang. Tanpa jalur itu, satu-satunya cara membetulkan jangkar adalah mengedit berkasnya
langsung, dan itu justru yang dilarang aturan penulis tunggal. Petanya berbentuk
`{"<sha lama>": "<sha baru>"}`; perintah ini menolak kalau ada kunci yang tidak dipakai satu
entri pun (tanda peta salah ketik), menolak kalau nilainya bukan commit yang ada, lalu
memvalidasi seluruh isi berkas sebelum menulis.

`issue` wajib untuk event yang menyangkut unit kerja (buka, dispatch, buka-pr, tutup, naik), dan
boleh kosong untuk `ruling` serta `catatan`: keputusan owner dan catatan proses tidak selalu punya
nomor issue.

**Satu pasangan (issue, event) boleh terulang, tapi harus disengaja.** Penjaga di atas menolak
entri kedua untuk pasangan yang sama, karena pengulangan biasanya kecelakaan. Padahal beberapa
event memang bisa terjadi berkali-kali pada satu issue: owner bisa memutuskan dua kali (`ruling`),
dan sebuah issue bisa naik dua kali (`naik`). Sebelum ada jalurnya, entri kedua terpaksa dilabeli
`catatan`, dan pertanyaan seperti "keputusan owner apa saja untuk #84" jadi tidak bisa dijawab dari
medan `event`. Karena itu ada `--ulang "<alasan>"`: entri kedua ditulis apa adanya, medannya
mengaku, dan `--ulang` yang pasangannya belum pernah tercatat ditolak karena berarti tidak ada yang
diulang (kejadian 2026-10-10: #84 sudah punya `ruling` soal LUK sebagai laporan, lalu owner
memutuskan lagi soal tambal atau tidak, #165).
"""

import argparse
import datetime
import fcntl
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _umum as u  # noqa: E402

EVENT = ["buka", "dispatch", "buka-pr", "tutup", "naik", "ruling", "catatan"]
PERLU_ISSUE = {"buka", "dispatch", "buka-pr", "tutup", "naik"}
WAJIB = ["ts", "penulis", "lane", "event", "catatan"]
ENV_LANE = "PMS_TSJ_LANE"


def path_bawaan(akar):
    return os.path.join(akar, "factory", "ledger.jsonl")


def sekarang():
    try:
        from zoneinfo import ZoneInfo

        return datetime.datetime.now(ZoneInfo("Asia/Jakarta")).isoformat(timespec="seconds")
    except Exception:
        return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def periksa_teks(akar, teks, lanes):
    """Validasi seluruh isi ledger. Kembalikan daftar alasan (kosong = sah)."""
    penulis_tunggal = lanes.get("penulis_ledger")
    alasan = []
    sebelumnya = None
    pasangan = set()

    for nomor, baris in enumerate(teks.splitlines(), 1):
        baris = baris.strip()
        if not baris:
            continue
        try:
            entri = u.baca_json_teks(baris)
        except ValueError as e:
            alasan.append("baris %d bukan JSON sah: %s" % (nomor, e))
            continue
        if not isinstance(entri, dict):
            alasan.append("baris %d bukan objek JSON" % nomor)
            continue

        for kunci in WAJIB:
            nilai = entri.get(kunci)
            if nilai is None or (isinstance(nilai, str) and not nilai.strip()):
                alasan.append("baris %d: field `%s` kosong" % (nomor, kunci))

        penulis = entri.get("penulis")
        if penulis and penulis != penulis_tunggal:
            alasan.append(
                "baris %d: penulis `%s` ditolak, hanya `%s` yang boleh menulis ledger"
                % (nomor, penulis, penulis_tunggal)
            )

        lane = entri.get("lane")
        if lane and u.cari_lane(lanes, lane) is None:
            alasan.append("baris %d: lane `%s` tidak terdaftar" % (nomor, lane))

        event = entri.get("event")
        if event and event not in EVENT:
            alasan.append(
                "baris %d: event `%s` tidak dikenal (yang sah: %s)"
                % (nomor, event, ", ".join(EVENT))
            )

        issue = entri.get("issue")
        if event in PERLU_ISSUE and not isinstance(issue, int):
            alasan.append("baris %d: event `%s` wajib menyebut nomor issue" % (nomor, event))
        elif issue is not None and not isinstance(issue, int):
            alasan.append("baris %d: `issue` harus angka atau kosong" % nomor)

        if isinstance(issue, int) and event:
            kunci_pasangan = (issue, event)
            ulang = entri.get("ulang")
            if ulang is not None and (not isinstance(ulang, str) or not ulang.strip()):
                alasan.append(
                    "baris %d: `ulang` harus teks yang menjelaskan kenapa pasangan ini dicatat dua "
                    "kali" % nomor
                )
            if kunci_pasangan in pasangan and not (isinstance(ulang, str) and ulang.strip()):
                alasan.append(
                    "baris %d: pasangan (issue #%s, event %s) sudah tercatat sebelumnya; kalau "
                    "pengulangannya disengaja, tulis alasannya lewat --ulang" % (nomor, issue, event)
                )
            pasangan.add(kunci_pasangan)

        ts = entri.get("ts")
        if ts:
            try:
                waktu = datetime.datetime.fromisoformat(str(ts))
            except ValueError:
                alasan.append("baris %d: `ts` bukan waktu ISO 8601: %s" % (nomor, ts))
                waktu = None
            if waktu is not None:
                if waktu.tzinfo is None:
                    alasan.append("baris %d: `ts` tanpa zona waktu: %s" % (nomor, ts))
                elif sebelumnya is not None and waktu < sebelumnya:
                    alasan.append(
                        "baris %d: `ts` mundur (%s sesudah %s); ledger itu append-only"
                        % (nomor, ts, sebelumnya.isoformat())
                    )
                else:
                    sebelumnya = waktu

        commit = entri.get("commit")
        if commit and not u.ada_commit(akar, str(commit)):
            alasan.append("baris %d: commit `%s` tidak ada di repo" % (nomor, commit))

    return alasan


def reanchor(akar, path, lanes, peta, kering=False):
    """Titik-ulang jangkar `commit`. Hanya field itu yang disentuh; `ts` dan urutan tetap.

    Kembalikan (daftar_alasan, jumlah_entri_berubah). Daftar alasan tidak kosong = berkas tidak
    ditulis. Dijalankan di dalam kunci berkas yang sama dengan append, supaya dua penulis tidak
    bisa saling menimpa.
    """
    if not os.path.exists(path):
        return ["berkas ledger tidak ada: %s" % path], 0

    peta_penuh = {}
    for lama, baru in peta.items():
        lp = u.sha_penuh(akar, lama)
        if lp is None:
            return ["kunci `%s` bukan commit yang ada di repo" % lama], 0
        bp = u.sha_penuh(akar, baru)
        if bp is None:
            return ["nilai `%s` bukan commit yang ada di repo" % baru], 0
        pendek = u.sha_pendek(akar, bp)
        if pendek is None:
            return ["nilai `%s` tidak bisa dibentuk pendek" % baru], 0
        peta_penuh[lp] = pendek

    with open(path, "a+", encoding="utf-8") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            f.seek(0)
            lama_teks = f.read()
            keluar = []
            terpakai = set()
            jumlah = 0
            for nomor, baris in enumerate(lama_teks.splitlines(), 1):
                if not baris.strip():
                    continue
                try:
                    entri = u.baca_json_teks(baris)
                except ValueError as e:
                    return ["baris %d bukan JSON sah: %s" % (nomor, e)], 0
                commit = entri.get("commit")
                if commit:
                    cp = u.sha_penuh(akar, commit)
                    if cp in peta_penuh:
                        entri["commit"] = peta_penuh[cp]
                        terpakai.add(cp)
                        jumlah += 1
                keluar.append(json.dumps(entri, ensure_ascii=False))
            nganggur = set(peta_penuh) - terpakai
            if nganggur:
                return [
                    "jangkar %s tidak dipakai satu entri pun di ledger"
                    % ", ".join(sorted(x[:7] for x in nganggur))
                ], 0
            if jumlah == 0:
                return ["tidak ada entri yang berubah"], 0
            teks = "\n".join(keluar) + "\n"
            alasan = periksa_teks(akar, teks, lanes)
            if alasan:
                return alasan, 0
            if kering:
                return [], jumlah
            f.seek(0)
            f.truncate()
            f.write(teks)
            f.flush()
            os.fsync(f.fileno())
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    return [], jumlah


def baca_isi(path):
    if not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def periksa(akar, path, lanes):
    if not os.path.exists(path):
        return ["berkas ledger tidak ada: %s" % path]
    return periksa_teks(akar, baca_isi(path), lanes)


def jumlah_entri(path):
    return sum(1 for b in baca_isi(path).splitlines() if b.strip())


def append(akar, path, lanes, entri):
    """Validasi lalu tulis, di dalam satu kunci berkas."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    baris = json.dumps(entri, ensure_ascii=False)
    with open(path, "a+", encoding="utf-8") as f:
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        try:
            f.seek(0)
            lama = f.read()
            alasan = periksa_teks(akar, lama + baris + "\n", lanes)
            if alasan:
                return alasan
            f.seek(0, os.SEEK_END)
            f.write(baris + "\n")
            f.flush()
            os.fsync(f.fileno())
        finally:
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    return []


def rakit_entri(a):
    penulis = a.penulis or os.environ.get(ENV_LANE) or ""
    entri = {
        "ts": a.ts or sekarang(),
        "penulis": penulis,
        "lane": a.lane,
        "issue": a.issue,
        "event": a.event,
        "catatan": a.catatan,
        "commit": a.commit,
    }
    # `ulang` cuma ditulis kalau diminta, supaya entri biasa tidak berubah bentuknya hanya karena
    # ada jalur baru ini.
    if a.ulang:
        entri["ulang"] = a.ulang.strip()
    return entri

def pasangan_sudah_ada(path, issue, event):
    """True kalau (issue, event) sudah ada di berkas. Dipakai penjaga `--ulang`.

    Berkas yang tidak bisa dibaca atau tidak bisa diurai mengembalikan True: pemeriksaan isi adalah
    tugas `append`, dan penjaga ini tidak boleh menutupi galat yang lebih jelas dengan galatnya
    sendiri.
    """
    try:
        with open(path, encoding="utf-8") as f:
            for baris in f:
                baris = baris.strip()
                if not baris:
                    continue
                entri = u.baca_json_teks(baris)
                if entri.get("issue") == issue and entri.get("event") == event:
                    return True
    except (OSError, ValueError):
        return True
    return False


def jalankan_append(a, akar, lanes):
    if not a.penulis and not os.environ.get(ENV_LANE):
        print(
            "GAGAL  tidak tahu lane mana yang menulis: set %s atau pakai --penulis" % ENV_LANE
        )
        return 1
    if not a.lane:
        print("GAGAL  --lane wajib: lane mana yang dicatat peristiwanya")
        return 1
    entri = rakit_entri(a)
    if entri["penulis"] != lanes.get("penulis_ledger"):
        print(
            "GAGAL  penulis `%s` ditolak: hanya `%s` yang boleh menulis ledger"
            % (entri["penulis"], lanes.get("penulis_ledger"))
        )
        return 1
    # `--ulang` itu tindakan yang disengaja, jadi keberadaannya diperiksa: kalau pasangannya belum
    # pernah tercatat, tidak ada yang diulang, dan pemanggilnya hampir pasti salah.
    if entri.get("ulang") and not pasangan_sudah_ada(a.berkas, entri["issue"], entri["event"]):
        print(
            "GAGAL  --ulang diberikan, tapi pasangan (issue #%s, event %s) belum pernah tercatat: "
            "tidak ada yang diulang" % (entri["issue"], entri["event"])
        )
        return 1
    alasan = append(akar, a.berkas, lanes, entri)
    if alasan:
        return u.tolak("entri ditolak, berkas tidak berubah", alasan)
    return u.lulus(
        "entri ke-%d: %s lane %s%s" % (
            jumlah_entri(a.berkas),
            entri["event"],
            entri["lane"],
            "" if entri["issue"] is None else " issue #%s" % entri["issue"],
        )
    )


def uji_mandiri():
    import tempfile

    akar_asli = u.akar_factory()
    gagal = 0
    kasus = []

    def satu(nama, harap, siapkan):
        nonlocal gagal
        with tempfile.TemporaryDirectory() as tmp:
            berkas = os.path.join(tmp, "ledger.jsonl")
            dapat = siapkan(berkas, tmp)
        benar = (dapat == 0) == harap
        if not benar:
            gagal += 1
        print(
            "  %s %-52s %s"
            % ("LULUS " if benar else "GAGAL ", nama, "harus exit 0" if harap else "harus ditolak")
        )

    def dasar(lane="payroll", event="dispatch", issue=42, **sisa):
        e = {"ts": sekarang(), "penulis": "HQ", "lane": lane, "issue": issue,
             "event": event, "catatan": "uji", "commit": None}
        e.update(sisa)
        return e

    def tulis_valid(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        return 0 if not append(akar_asli, berkas, lanes, dasar()) else 1

    def tolak_penulis_lain(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        return 0 if not append(akar_asli, berkas, lanes, dasar(penulis="payroll")) else 1

    def ditolak(alasan):
        """1 = ditolak (ada alasan), 0 = diterima. Sejajar dengan exit code CLI."""
        return 1 if alasan else 0

    def tolak_dobel(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        if append(akar_asli, berkas, lanes, dasar()):
            return 1
        return ditolak(append(akar_asli, berkas, lanes, dasar()))

    # Pengulangan yang disengaja (#165). Penjaga pasangan (issue, event) tetap ada, tapi sekarang
    # punya jalan keluar yang menyatakan dirinya sendiri lewat medan `ulang`. Dua kasus di bawah
    # memisahkan "penjaga masih menolak" dari "jalur barunya bekerja": tanpa yang kedua, penolakan
    # yang benar akan terlihat sama dengan fitur yang tidak jalan.
    def terima_ulang(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        if append(akar_asli, berkas, lanes, dasar()):
            return 1
        return 0 if not append(akar_asli, berkas, lanes,
                               dasar(ulang="owner memutuskan lagi soal issue yang sama")) else 1

    def tolak_ulang_tanpa_alasan(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        if append(akar_asli, berkas, lanes, dasar()):
            return 1
        return ditolak(append(akar_asli, berkas, lanes, dasar(ulang="   ")))

    def _ns(berkas, **sisa):
        d = {"ts": sekarang(), "penulis": "HQ", "lane": "payroll", "issue": 42,
             "event": "ruling", "catatan": "uji", "commit": None, "ulang": None, "berkas": berkas}
        d.update(sisa)
        return argparse.Namespace(**d)

    def tolak_ulang_tanpa_pasangan(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        # Belum ada entri apa pun, jadi --ulang tidak punya pasangan untuk diulang: harus ditolak,
        # dan penolakannya harus terjadi SEBELUM menulis.
        kode = jalankan_append(_ns(berkas, ulang="mengulang sesuatu yang belum ada"), akar_asli, lanes)
        if kode == 0:
            return 1
        return 0 if not os.path.exists(berkas) or baca_isi(berkas) == "" else 1

    def jalankan_ulang_tersambung(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        if jalankan_append(_ns(berkas), akar_asli, lanes) != 0:
            return 1
        if jalankan_append(_ns(berkas, ulang="putusan kedua untuk issue yang sama"),
                           akar_asli, lanes) != 0:
            return 1
        # Dua baris, dan baris kedua mengaku sebagai pengulangan.
        isi = [json.loads(b) for b in baca_isi(berkas).splitlines() if b.strip()]
        if len(isi) != 2:
            return 1
        return 0 if isi[1].get("ulang") else 1

    def tolak_ts_mundur(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        if append(akar_asli, berkas, lanes, dasar(ts="2026-10-09T19:00:00+07:00")):
            return 1
        return ditolak(append(akar_asli, berkas, lanes, dasar(
            ts="2026-10-09T18:00:00+07:00", event="buka")))

    def tolak_commit_ngarang(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        return ditolak(append(akar_asli, berkas, lanes, dasar(commit="deadbee")))

    def tolak_issue_hilang(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        return ditolak(append(akar_asli, berkas, lanes, dasar(issue=None)))

    def terima_ruling_tanpa_issue(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        return 0 if not append(akar_asli, berkas, lanes,
                               dasar(lane="HQ", event="ruling", issue=None)) else 1

    def verify_valid(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        append(akar_asli, berkas, lanes, dasar())
        return 0 if not periksa(akar_asli, berkas, lanes) else 1

    def verify_rusak(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        append(akar_asli, berkas, lanes, dasar())
        with open(berkas, "a", encoding="utf-8") as f:
            f.write("ini bukan json\n")
        return ditolak(periksa(akar_asli, berkas, lanes))

    def verify_hilang(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        return ditolak(periksa(akar_asli, berkas, lanes))

    def urutan_append(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        for event in ("buka", "dispatch", "tutup"):
            if append(akar_asli, berkas, lanes, dasar(event=event)):
                return 1
        return 0 if jumlah_entri(berkas) == 3 else 1

    def reanchor_pindah(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        lama = u.sha_pendek(akar_asli, "HEAD")
        baru = u.sha_pendek(akar_asli, "HEAD~1")
        if append(akar_asli, berkas, lanes, dasar(commit=lama)):
            return 1
        alasan, jumlah = reanchor(akar_asli, berkas, lanes, {lama: baru}, False)
        if alasan or jumlah != 1:
            return 1
        return 0 if ('"commit": "%s"' % baru) in baca_isi(berkas) else 1

    def reanchor_kunci_nganggur(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        if append(akar_asli, berkas, lanes, dasar(commit=u.sha_pendek(akar_asli, "HEAD"))):
            return 1
        peta = {u.sha_pendek(akar_asli, "HEAD~2"): u.sha_pendek(akar_asli, "HEAD~1")}
        alasan, jumlah = reanchor(akar_asli, berkas, lanes, peta, False)
        return ditolak(alasan)

    def reanchor_nilai_bukan_commit(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        if append(akar_asli, berkas, lanes, dasar(commit=u.sha_pendek(akar_asli, "HEAD"))):
            return 1
        peta = {u.sha_pendek(akar_asli, "HEAD"): "deadbee"}
        alasan, jumlah = reanchor(akar_asli, berkas, lanes, peta, False)
        return ditolak(alasan)

    def reanchor_kering(berkas, tmp):
        lanes = u.baca_json(os.path.join(akar_asli, "factory", "lanes.json"))
        lama = u.sha_pendek(akar_asli, "HEAD")
        if append(akar_asli, berkas, lanes, dasar(commit=lama)):
            return 1
        sebelum = baca_isi(berkas)
        alasan, jumlah = reanchor(
            akar_asli, berkas, lanes, {lama: u.sha_pendek(akar_asli, "HEAD~1")}, True)
        if alasan or jumlah != 1:
            return 1
        return 0 if baca_isi(berkas) == sebelum else 1

    kasus = [
        ("append entri valid", True, tulis_valid),
        ("append penulis lane lain", False, tolak_penulis_lain),
        ("append pasangan (issue, event) dobel", False, tolak_dobel),
        ("append pasangan sama dengan --ulang", True, terima_ulang),
        ("append --ulang dengan alasan kosong", False, tolak_ulang_tanpa_alasan),
        ("--ulang tanpa pasangan sebelumnya ditolak", False, tolak_ulang_tanpa_pasangan),
        ("jalankan_append --ulang tersambung", True, jalankan_ulang_tersambung),
        ("append ts mundur", False, tolak_ts_mundur),
        ("append commit tidak ada", False, tolak_commit_ngarang),
        ("append event kerja tanpa issue", False, tolak_issue_hilang),
        ("append ruling tanpa issue", True, terima_ruling_tanpa_issue),
        ("verify berkas valid", True, verify_valid),
        ("verify berkas rusak", False, verify_rusak),
        ("verify berkas hilang", False, verify_hilang),
        ("tiga append = tiga baris", True, urutan_append),
        ("reanchor memindahkan jangkar", True, reanchor_pindah),
        ("reanchor kunci tidak dipakai entri", False, reanchor_kunci_nganggur),
        ("reanchor nilai bukan commit", False, reanchor_nilai_bukan_commit),
        ("reanchor kering tidak menulis berkas", True, reanchor_kering),
    ]
    for nama, harap, siapkan in kasus:
        satu(nama, harap, siapkan)

    print("")
    print("UJI MANDIRI ledger: %d kasus, %d gagal" % (len(kasus), gagal))
    return gagal


def main():
    p = argparse.ArgumentParser(add_help=True)
    p.add_argument("perintah", nargs="?", choices=["append", "verify", "tail", "reanchor"])
    p.add_argument("--akar", default=u.akar_factory())
    p.add_argument("--berkas", default=None)
    p.add_argument("--penulis", default=None)
    p.add_argument("--lane", default=None)
    p.add_argument("--issue", type=int, default=None)
    p.add_argument("--event", default=None)
    p.add_argument("--catatan", default=None)
    p.add_argument("--commit", default=None)
    p.add_argument("--ulang", default=None,
                   help="tulis entri kedua untuk pasangan (issue, event) yang sama; wajib memuat "
                        "alasan kenapa pengulangannya disengaja")
    p.add_argument("--ts", default=None)
    p.add_argument("--n", type=int, default=10)
    p.add_argument("--peta", default=None, help="reanchor: berkas JSON {sha lama: sha baru}")
    p.add_argument("--kering", action="store_true", help="reanchor: jangan tulis, cuma rencananya")
    p.add_argument("--uji-mandiri", action="store_true")
    a = p.parse_args()

    if a.uji_mandiri:
        return 1 if uji_mandiri() else 0

    akar = os.path.abspath(os.path.expanduser(a.akar))
    a.berkas = a.berkas or path_bawaan(akar)
    berkas_lane = os.path.join(akar, "factory", "lanes.json")
    if not os.path.exists(berkas_lane):
        print("GAGAL  daftar lane tidak ada: %s" % berkas_lane)
        return 2
    lanes = u.baca_json(berkas_lane)

    if a.perintah == "append":
        if not a.event:
            print("GAGAL  --event wajib (yang sah: %s)" % ", ".join(EVENT))
            return 2
        if not a.catatan:
            print("GAGAL  --catatan wajib: satu baris kenapa peristiwa ini dicatat")
            return 2
        return jalankan_append(a, akar, lanes)

    if a.perintah == "reanchor":
        penulis = a.penulis or os.environ.get(ENV_LANE) or ""
        if penulis != lanes.get("penulis_ledger"):
            print(
                "GAGAL  penulis `%s` ditolak: hanya `%s` yang boleh menulis ledger"
                % (penulis, lanes.get("penulis_ledger"))
            )
            return 1
        if not a.peta:
            print('GAGAL  --peta wajib: berkas JSON berisi {"<sha lama>": "<sha baru>"}')
            return 2
        if not os.path.exists(a.peta):
            print("GAGAL  berkas peta tidak ada: %s" % a.peta)
            return 2
        try:
            peta = u.baca_json(a.peta)
        except ValueError as e:
            print("GAGAL  berkas peta bukan JSON sah: %s" % e)
            return 2
        if not isinstance(peta, dict) or not peta:
            print('GAGAL  peta harus objek JSON yang tidak kosong: {"<sha lama>": "<sha baru>"}')
            return 2
        alasan, jumlah = reanchor(akar, a.berkas, lanes, peta, a.kering)
        if alasan:
            return u.tolak("anchor ulang ditolak, berkas tidak berubah", alasan)
        if a.kering:
            return u.lulus("kering: %d entri akan di-anchor ulang, berkas tidak ditulis" % jumlah)
        return u.lulus(
            "anchor ulang %d entri, ledger %d entri, penulis `%s`"
            % (jumlah, jumlah_entri(a.berkas), lanes.get("penulis_ledger"))
        )

    if a.perintah == "verify":
        alasan = periksa(akar, a.berkas, lanes)
        if alasan:
            return u.tolak("ledger ditolak", alasan)
        return u.lulus(
            "ledger %d entri, penulis tunggal `%s`" % (jumlah_entri(a.berkas), lanes.get("penulis_ledger"))
        )

    if a.perintah == "tail":
        baris = [b for b in baca_isi(a.berkas).splitlines() if b.strip()]
        for b in baris[-a.n:]:
            print(b)
        return 0

    p.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
