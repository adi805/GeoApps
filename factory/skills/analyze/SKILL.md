---
name: {{slug}}-analyze
description: Jawab pertanyaan data {{proyek}}, dari pencarian cepat sampai analisis lengkap. Pakai saat mencari satu metrik, menyelidiki apa yang menggerakkan tren atau penurunan, membandingkan segmen antar waktu, atau menyiapkan laporan data.
---

<!-- Sumber: data/skills/analyze @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Jawab Pertanyaan Data

Jawab pertanyaan data, dari pencarian cepat sampai analisis lengkap.

## Alur kerja

### 1. Pahami pertanyaannya

Tentukan tingkatannya:

- **Jawaban cepat**: satu metrik, filter sederhana
- **Analisis penuh**: eksplorasi multi-dimensi, tren, perbandingan
- **Laporan formal**: penyelidikan menyeluruh dengan metodologi, catatan, dan rekomendasi

Lalu tentukan kebutuhan datanya: tabel, metrik, dimensi, rentang waktu.

### 2. Kumpulkan datanya

Sumber data di proyek ini:

| Sumber | Cara mengambil |
|---|---|
| Skema D1 | berkas `src/**/schema_*.sql`, migrasi |
| Basis data lokal | `sqlite3` pada salinan berkas, jangan pada yang hidup |
| Ekspor | berkas CSV/Excel yang sudah ada |
| Catatan lintas lane | `factory/ledger.jsonl` (satu objek JSON per baris) |

Tulis kuerinya pakai skill `{{slug}}-write-query`. Kalau kuerinya gagal, baca pesan errornya dan
perbaiki sesuai error itu, jangan mengulang kueri yang sama.

### 3. Analisis

- Hitung metrik, agregasi, dan perbandingan yang relevan
- Cari pola, tren, pencilan, dan anomali
- Bandingkan antar dimensi (waktu, segmen, kategori)
- Untuk analisis rumit, pecah jadi sub-pertanyaan

### 4. Validasi sebelum menyajikan

- **Jumlah baris masuk akal?**
- **Ada null tak terduga yang bisa memelintir hasil?**
- **Besarnya di rentang yang wajar?** (persentase antara 0-100, jumlah tidak negatif)
- **Deret waktu tidak bolong tanpa penjelasan?**
- **Subtotal menjumlah ke total?**

Kalau ada yang mencurigakan, selidiki dan sebutkan catatannya.

### 5. Sajikan

- **Jawaban cepat**: jawab langsung dengan konteks, sertakan kuerinya
- **Analisis penuh**: mulai dari temuan kunci, dukung dengan tabel, sebut metodologi dan catatan
- **Laporan formal**: ringkasan, metodologi, temuan rinci, catatan keterbatasan, rekomendasi

## Aturan angka

**Setiap angka yang lo tulis harus dibaca dari hasil alat di giliran yang sama.** Kalau skripnya
gagal atau kuerinya error, angkanya belum ada: jangan menulis angka yang "seharusnya". Angka yang
kelihatan masuk akal justru yang paling berbahaya, karena lolos dari kecurigaan pembaca.

Kalau sebuah metrik diturunkan dari metrik lain, tulis definisinya dan pastikan kodenya menghitung
definisi itu, bukan pendekatan yang cuma kebetulan cocok di satu kasus.

## Tips

- Sebut rentang waktu, segmen, dan metriknya sespesifik mungkin
- Sebut nama tabelnya kalau sudah tahu, itu mempercepat
- Hasil selalu divalidasi sebelum disajikan: kalau ada yang aneh, gue tandai, bukan gue sembunyikan
