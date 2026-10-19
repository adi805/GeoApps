# Panduan Kontribusi

Panduan ini untuk siapa pun yang menambah atau mengubah **mesin pabrik** di repo ini,
termasuk diri sendiri enam bulan dari sekarang. Isinya tiga hal: cara menjalankan
pemeriksanya, cara menambah gate atau skill dari awal sampai akhir, dan aturan yang membuat
perubahan bisa dipercaya.

Untuk aturan prosesnya (peran, lane, briefing, closing, eskalasi), baca
[`factory/LAW.md`](../factory/LAW.md). Untuk mencari medan identitas, baca bagian 10 di
berkas itu. Panduan ini tidak mengulang keduanya.

> Repo ini **mesinnya**, bukan produknya. Perintah membangun produk (`dotnet build`,
> `dotnet test`, `npm`) hidup di repo produk masing-masing, bukan di sini.

---

## 1. Menyiapkan lingkungan

Prasyaratnya cuma Python dan git.

| Kebutuhan | Versi | Untuk apa |
|---|---|---|
| Python | 3.9+ | Seluruh gate, generator, dan skrip bukti di `tools/factory/` |
| git | apa saja | Gate yang membaca riwayat, cakupan berkas, dan jangkar ledger |

Tidak ada dependensi pihak ketiga. Kalau sebuah gate butuh pustaka di luar stdlib, itu
perubahan desain, bukan detail implementasi: CI-nya harus ikut berubah.

Perintah yang dipakai sehari-hari:

```bash
python3 tools/factory/uji_gate_mandiri.py       # suite gabungan, jalankan sebelum commit
python3 tools/factory/sync_law.py --check       # blok hasil generate di LAW.md vs lanes.json
python3 tools/factory/gate_law_fresh.py         # versi LAW naik saat isinya berubah
python3 tools/factory/gate_ontology.py          # kosakata terkendali
python3 tools/factory/gate_plugin_lint.py       # bentuk skill
python3 tools/factory/sync_plugins.py --check   # salinan skill terpasang vs sumber
```

### Tiga mode yang sering tertukar

Gate di repo ini punya pola pemanggilan yang seragam, dan artinya berbeda:

| Mode | Arti |
|---|---|
| tanpa argumen | memeriksa pohon tempat ia dijalankan |
| `--akar <dir>` | memeriksa pohon lain |
| `--uji-mandiri` | menguji **keputusan gate-nya sendiri**, biasanya lewat pohon tiruan di `/tmp` |

`--uji-mandiri` bukan "jalankan gate-nya lagi". Ia membuktikan gate itu **bisa menolak**.
Gate yang cuma pernah bilang LULUS belum membuktikan apa pun.

---

## 2. Menambah gate

Gate adalah fungsi Python yang mengembalikan daftar alasan; daftar kosong berarti lolos.
Polanya seragam, dan menambah gate berarti mengikuti enam langkah ini.

### 2.1 Tulis gate-nya

Ambil `tools/factory/_umum.py` untuk hal yang dipakai lebih dari satu gate: pembacaan JSON,
pencocokan pola path, resolusi SHA, identitas proyek, dan penjaga branch/pohon. Jangan
menyalin potongan itu ke gate baru.

Bentuk minimum:

```python
import argparse
import os
import sys

DIR_INI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, DIR_INI)
import _umum as u  # noqa: E402

def periksa(akar):
    """Daftar alasan. Kosong = lolos."""
    alasan = []
    # ... pemeriksaannya di sini ...
    return alasan

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--akar", default=u.akar_factory())
    p.add_argument("--uji-mandiri", action="store_true")
    a = p.parse_args()
    if a.uji_mandiri:
        return uji_mandiri()
    alasan = periksa(os.path.abspath(os.path.expanduser(a.akar)))
    if alasan:
        return u.tolak("judul penolakan", alasan)
    return u.lulus("judul penerimaan")

if __name__ == "__main__":
    sys.exit(main())
```

`u.tolak()` mencetak tiap alasan dan mengembalikan 1; `u.lulus()` mencetak dan
mengembalikan 0. Pakai keduanya supaya keluaran gate seragam.

### 2.2 Pisahkan keputusan dari pemanggilnya

Kalau gate punya `main()` **dan** `uji_mandiri()`, keduanya harus memanggil fungsi keputusan
yang **sama**. Uji mandiri yang menyalin logikanya sendiri cuma membuktikan salinannya bisa
menolak, bukan gate-nya.

### 2.3 Tulis uji mandirinya, dan pastikan ada kasus negatifnya

Ini bagian yang paling sering dilewatkan. Gate dengan satu kasus positif belum membuktikan
apa pun. Tulis minimal satu kasus positif dan satu kasus negatif, dan usahakan kasus
negatifnya lebih banyak.

Kontrol negatifnya harus **spesifik**, bukan sekadar "input kosong". Contoh yang benar dari
`gate_pemicu_ci`: menyisipkan `!src/**` ke daftar izin, lalu memastikan gate-nya menolak
dengan tiga alasan sekaligus.

### 2.4 Daftarkan ke suite gabungan

Tambahkan fungsinya ke `tools/factory/uji_gate_mandiri.py`, lalu daftarkan di tabel kasus
paling bawah berkas itu. Suite gabungan dijalankan CI, dan gate yang tidak terdaftar di sana
cuma jalan kalau ada orang yang ingat menjalankannya.

### 2.5 Daftarkan ke CI

Tambahkan langkahnya di `ci/factory-gate.yml`. Satu langkah untuk pemanggilan hidup
(`--akar .`) dan, kalau ada, satu langkah untuk `--uji-mandiri`.

Gate yang memeriksa berkas di luar repo (mis. salinan skill terpasang) **tidak** boleh
dipasang sebagai pemeriksaan hidup di CI: runner tidak punya direktori itu, jadi gate-nya
merah karena alasan yang salah. Yang masuk CI adalah `--uji-mandiri`-nya.

### 2.6 Catat di LAW

Tambahkan barisnya di tabel `factory/LAW.md` bagian 8.1: nama gate, perintahnya, dan **apa
yang ditolaknya**. Kalau gate itu punya uji mandiri, tambahkan juga di daftar uji mandiri.

Gate yang tidak tercatat di LAW adalah gate yang tidak akan dijalankan siapa pun.

---

## 3. Menambah atau mengubah skill

Skill hidup di `factory/skills/<nama>/SKILL.md` sebagai **sumber**, dan dipasang ke
`~/.opencrabs/skills/<slug>-<nama>/` oleh `sync_plugins.py`.

Aturannya:

1. Frontmatter YAML wajib, memuat `name` dan `description`. `gate_plugin_lint` menolaknya
   kalau tidak ada, kalau `name` bukan `<slug>-<nama>`, atau kalau `description` lebih dari
   512 karakter.
2. Tulis `name: {{slug}}-<nama>` dengan **placeholder**, bukan nama proyek jadi. Nilainya
   diisi saat pemasangan. Sumber yang memuat nama proyek pertama akan membawa nama itu ke
   proyek kedua, dan itu terjadi tanpa satu pun error.
3. Nama proyek, repo, dan pohon di dalam badan skill juga memakai placeholder:
   `{{slug}}`, `{{proyek}}`, `{{repo}}`, `{{pohon}}`, `{{skills_dir}}`, `{{skill_factory}}`.
4. Placeholder asing **melempar**, bukan dibiarkan jadi teks. Salah ketik seperti
   `{{pohonn}}` akan muncul di uji mandiri, bukan di berkas hasil.
5. Header sumber wajib kalau skill itu hasil adopsi dari upstream: `<!-- Sumber: <jalur> @
   <sha40> | <repo> | <lisensi> | <pernyataan perubahan> -->`. SHA-nya harus sama dengan pin
   di `factory/upstream/PIN.md`.

Sesudah menambah atau mengubah skill:

```bash
python3 tools/factory/gate_plugin_lint.py       # bentuk dan sumbernya
python3 tools/factory/sync_plugins.py           # pasang salinannya
python3 tools/factory/sync_plugins.py --check   # pastikan salinan sama dengan sumber
```

`sync_plugins.py` menghapus salinan berawalan slug yang tidak punya sumbernya di repo, jadi
menghapus direktori skill di sini juga mencabut skill terpasangnya.

---

## 4. Mengubah hukum proses (`factory/LAW.md`)

`LAW.md` punya dua jenis isi, dan perlakukannya berbeda.

**Blok hasil generate.** Tabel lane dan daftar path eskalasi ditandai sepasang komentar dan
diisi dari `factory/lanes.json`. **Jangan diedit tangan.** Ubah `lanes.json`, lalu:

```bash
python3 tools/factory/sync_law.py         # bangkitkan ulang bloknya
python3 tools/factory/gate_law_fresh.py --sahkan
```

**Isi biasa.** Boleh diedit langsung, tapi setiap perubahan isi wajib menaikkan nomor versi
di kepala berkas. `gate_law_fresh.py` menolak isi yang berubah tanpa versi naik, dan
urutannya tidak bisa dibalik.

Sesudah `LAW.md` berubah, skill hukumnya harus ikut disinkronkan:

```bash
python3 tools/factory/sync_skill.py       # tulis ulang SKILL.md dari LAW.md
python3 tools/factory/sync_skill.py --check
```

`sync_skill.py` menolak menulis dari pohon yang bukan pohon kanonik proyek, karena berkas
tujuannya dibaca semua sesi proyek itu. Sinkronkan dari pohon kanonik sesudah perubahan
hukumnya di-merge.

---

## 5. Mengubah identitas proyek

Seluruh nilai yang membedakan satu proyek dari proyek lain hidup di
`factory/identitas.json`. Jangan menulis nilai itu secara literal di skrip atau dokumen:
kalau sebuah skrip butuh grup, slug, jalur pohon, atau direktori skill, bacanya lewat
`_umum.py` (`u.grup()`, `u.slug()`, `u.idn()`, `u.nama_skill()`, `u.jalur_state()`,
`u.dir_terluas()`).

Alasannya bukan kerapian. Nilai yang ditulis literal di sebelas tempat akan melenceng di
salah satunya, dan yang melenceng tidak ditolak siapa pun: tool-nya jalan, hasilnya salah
ruangan.

---

## 6. Sebelum commit

Jalankan seluruh pemeriksa yang relevan. Urutannya: yang paling murah dulu.

```bash
python3 tools/factory/uji_gate_mandiri.py     # suite gabungan
python3 tools/factory/sync_law.py --check
python3 tools/factory/gate_law_fresh.py
python3 tools/factory/gate_ontology.py
python3 tools/factory/gate_plugin_lint.py
python3 tools/factory/sync_plugins.py --check
```

Aturan commit:

- **Satu perubahan logis, satu commit.** Jangan menggabungkan perubahan yang tidak saling
  bergantung. Riwayat yang bisa di-bisect lebih berguna daripada riwayat yang rapi jumlahnya.
- **Pesan commit menyebut apa yang berubah dan kenapa.** Kalau ada gate yang menolak
  perubahan itu sebelum diperbaiki, sebut gate-nya dan apa yang ditolaknya.
- **Bukti, bukan klaim.** Kalau sebuah pemeriksa hijau, tulis perintahnya dan keluarannya.
  "Sudah dites" bukan bukti; `80 kasus, 0 gagal` adalah bukti.

---

## 7. Kalau sebuah gate merah

Urutannya begini, dan jangan dibalik:

1. **Baca alasannya sampai habis.** Gate di sini mencetak alasan per baris, bukan satu baris
   ringkas. Alasannya biasanya sudah menyebut berkas dan sebabnya.
2. **Pastikan gate-nya benar.** Gate bisa salah: pencocokan pola bisa terlalu lebar, batas
   pencarian bisa salah. Kalau gate-nya yang salah, perbaiki gate-nya **dan** tambahkan kasus
   uji yang menangkap kesalahan itu.
3. **Jangan melewati gate dengan menonaktifkannya.** Gate yang merah karena alasan yang salah
   lebih baik diperbaiki daripada dimatikan, karena gate yang dimatikan akan dianggap hijau
   oleh orang berikutnya.
4. **Kalau pemeriksaannya memang tidak berlaku di sini**, jadikan itu **LEWAT yang berisik**:
   cetak apa yang dilewati dan kenapa, lalu keluar 0. Jangan diam-diam hijau.

Contoh yang sudah dipakai: `gate_pemicu_ci` melewati pemeriksaannya di repo mesin karena
workflow produknya tidak ikut ekspor, dan ia menyebut kedua berkas yang tidak ada itu.
