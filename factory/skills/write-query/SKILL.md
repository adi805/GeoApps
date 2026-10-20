---
name: {{slug}}-write-query
description: Tulis SQL untuk basis data {{proyek}} (D1/SQLite) dengan praktik yang baik. Pakai saat menerjemahkan kebutuhan data jadi kueri, menyusun kueri bertingkat dengan CTE, mengoptimalkan kueri pada tabel besar, atau membutuhkan sintaks khusus SQLite/D1.
---

<!-- Sumber: data/skills/write-query @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Tulis Kueri SQL (D1/SQLite)

Tulis kueri SQL dari uraian kebutuhan, dioptimalkan untuk dialek yang dipakai proyek ini.

## Dialeknya: SQLite (Cloudflare D1)

{{proyek}} memakai D1, dan D1 adalah SQLite. Jadi sintaksnya SQLite, bukan PostgreSQL. Yang sering
menjebak orang yang terbiasa Postgres:

| Terbiasa Postgres | Di SQLite/D1 |
|---|---|
| `ILIKE` | `LIKE` (tidak peka huruf besar-kecil untuk ASCII) |
| `FULL OUTER JOIN` | tidak ada; pakai dua kueri + `UNION ALL` |
| `date_trunc('month', x)` | `strftime('%Y-%m', x)` |
| `x::text` | `CAST(x AS TEXT)` |
| `SERIAL` | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| `RETURNING` | didukung sejak SQLite 3.35, aman dipakai di D1 |
| JSON | `json_extract(kolom, '$.kunci')` |

Kalau dialeknya ternyata bukan SQLite, tanyakan dulu sebelum menulis.

## Alur kerja

### 1. Pahami permintaannya

Tentukan: kolom keluaran, filter, agregasi, join, urutan, dan batas.

### 2. Temukan skemanya di repo

Skema hidup di berkas `src/**/schema_*.sql` dan migrasi. Baca berkasnya, jangan mengarang nama
kolom. Kalau ragu, periksa dulu:

```
grep -rn "CREATE TABLE" src/ --include=*.sql
```

### 3. Tulis kuerinya

**Struktur**
- Pakai CTE (`WITH`) kalau ada beberapa langkah logis, satu CTE per transformasi
- Beri nama CTE yang menjelaskan isinya (`titik_per_kecamatan`, `tile_per_zoom`)

**Performa**
- Jangan pakai `SELECT *` di kueri produksi, sebut kolom yang dibutuhkan saja
- Saring sedini mungkin, dekatkan `WHERE` ke tabel dasarnya
- Pakai `EXISTS` daripada `IN` untuk subkueri berisi banyak baris
- Pilih jenis join yang benar, jangan `LEFT JOIN` kalau `INNER JOIN` yang dimaksud
- Hindari subkueri berkorelasi kalau join atau fungsi jendela bisa menggantikannya
- Waspadai join yang meledak (banyak-ke-banyak)
- Pastikan kolom yang sering difilter punya indeks

**Keterbacaan**
- Beri komentar untuk logika yang tidak jelas "kenapa"-nya
- Indentasi konsisten, satu klausa utama per baris
- Alias tabel yang bermakna, bukan `a`, `b`, `c`

### 4. Sajikan

1. Kueri lengkapnya
2. Penjelasan singkat tiap CTE atau bagian
3. Catatan performa kalau relevan
4. Saran variasi (rentang waktu lain, granularitas lain, filter tambahan)

## Tips

- Sebut nama tabelnya kalau sudah tahu, itu mempercepat
- Tentukan kalau kuerinya harus idempoten (aman dijalankan ulang) atau sekali pakai
- Untuk kueri berulang, sebut kalau harus diparameterkan untuk rentang tanggal
- Uji dengan `SELECT` dulu sebelum ada `UPDATE`/`DELETE`, dan hitung dulu berapa baris yang kena
