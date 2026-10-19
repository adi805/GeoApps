---
name: {{slug}}-explore-data
description: Profilkan dan jelajahi sebuah dataset {{proyek}} untuk memahami bentuk, mutu, dan polanya. Pakai saat menemui tabel atau berkas baru, memeriksa tingkat null dan sebaran kolom, menemukan masalah mutu data seperti duplikat atau nilai mencurigakan, atau menentukan dimensi dan metrik mana yang layak dianalisis.
---

<!-- Sumber: data/skills/explore-data @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Profilkan dan Jelajahi Dataset

Buat profil data yang menyeluruh untuk sebuah tabel atau berkas, sebelum masuk ke analisis.

## 1. Akses datanya

| Sumber | Cara |
|---|---|
| Skema D1 | baca `src/**/schema_*.sql` dan migrasinya |
| Basis data lokal | salin berkasnya dulu, lalu buka salinannya (jangan yang hidup) |
| Berkas (CSV, Excel) | baca langsung |

Kalau tidak ada sumbernya, minta tabelnya atau berkasnya dulu.

## 2. Pahami strukturnya

- Berapa baris dan kolomnya?
- Apa grain-nya (satu baris mewakili apa)?
- Apa kunci utamanya, dan apakah unik?
- Kapan terakhir diperbarui, dan sejauh mana datanya ke belakang?

Klasifikasikan tiap kolom: **identifier**, **dimensi** (kategorikal), **metrik** (numerik),
**temporal**, **teks**, **boolean**, atau **struktural** (JSON).

## 3. Profilkan

**Tingkat tabel**
- Jumlah baris, jumlah kolom, perkiraan ukuran
- Rentang tanggal (min/maks kolom tanggal)

**Semua kolom**
- Jumlah dan tingkat null
- Jumlah nilai berbeda dan rasio kardinalitas
- Nilai paling sering (5-10 teratas)

**Kolom numerik**
- min, maks, rata-rata, median
- simpangan baku, persentil p1/p5/p25/p75/p95/p99
- jumlah nol dan jumlah negatif (kalau negatif tidak diharapkan)

**Kolom teks/dimensi**
- panjang min/maks/rata-rata
- jumlah string kosong, spasi di ujung
- konsistensi huruf besar-kecil
- apakah nilainya mengikuti pola tertentu

**Kolom tanggal**
- min/maks, jumlah null, tanggal di masa depan (kalau tak diharapkan)
- sebaran per bulan/minggu, celah di deret waktu

Sajikan profilnya sebagai tabel ringkas, dikelompokkan menurut jenis kolom.

## 4. Temukan masalah mutu data

- **Null tinggi**: di atas 5% peringatan, di atas 20% alarm
- **Kardinalitas mencurigakan**: kolom yang seharusnya unik tapi cuma punya segelintir nilai berbeda, atau sebaliknya
- **Nilai mencurigakan**: jumlah negatif yang seharusnya positif, tanggal masa depan di data historis, nilai pengganti seperti "N/A", "TBD", "test", "999999"
- **Duplikat**: periksa apakah kunci alaminya punya duplikat
- **Kemiringan sebaran**: sebaran numerik yang sangat miring bisa menyesatkan rata-rata
- **Masalah pengkodean**: huruf besar-kecil campur, spasi di ujung, format tidak konsisten

## 5. Temukan hubungan dan pola

- **Kandidat kunci asing**: kolom ID yang mungkin menunjuk ke tabel lain
- **Hierarki**: kolom yang membentuk jalur drill-down (mis. perusahaan > gudang > barang)
- **Korelasi**: kolom numerik yang bergerak bersama
- **Kolom turunan**: kolom yang tampak dihitung dari kolom lain

## 6. Sarankan dimensi, metrik, dan lanjutan

- Kolom dimensi terbaik untuk memotong data (kategorikal, 3-50 nilai)
- Kolom metrik kunci untuk pengukuran
- Kolom waktu untuk analisis tren
- 3-5 analisis lanjutan yang spesifik

## Keluaran

```markdown
## Profil Data: [nama tabel]

### Ikhtisar
- Baris: [n]
- Kolom: [n] ([n] dimensi, [n] metrik, [n] tanggal, [n] id)
- Rentang tanggal: [awal] sampai [akhir]

### Rincian kolom
[tabel ringkas]

### Masalah mutu data
[masalah yang ditandai, dengan tingkat keparahan]

### Analisis lanjutan yang disarankan
[daftar bernomor]
```

## Tips

- Untuk tabel sangat besar, kueri profilnya pakai sampling; sebutkan kalau butuh angka pasti
- Tanda mutu di atas itu heuristik: tidak setiap tanda masalah nyata, tapi tiap tanda layak dilihat sekilas
- Kalau ini dataset baru, profil ini memberi gambaran sebelum menulis kueri spesifik
