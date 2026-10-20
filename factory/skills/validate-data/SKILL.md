---
name: {{slug}}-validate-data
description: QA sebuah analisis sebelum dibagikan: metodologi, akurasi, dan bias. Pakai saat meninjau analisis sebelum dipresentasikan, memeriksa perhitungan dan logika agregasi, memverifikasi hasil kueri, atau menilai apakah kesimpulannya benar-benar didukung datanya.
---

<!-- Sumber: data/skills/validate-data @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Validasi Analisis Sebelum Dibagikan

Tinjau sebuah analisis untuk akurasi, metodologi, dan bias sebelum dibagikan ke owner atau pengguna.

## Alur kerja

1. **Tinjau metodologi dan asumsinya** — apakah pertanyaannya sudah benar, sumber datanya tepat,
   definisi metriknya jelas, dan pembandingnya adil?
2. **Jalankan daftar periksa sebelum kirim** (di bawah).
3. **Periksa jebakan analisis yang umum** (di bawah).
4. **Verifikasi perhitungan** — hitung ulang beberapa angka kunci secara mandiri, pastikan subtotal
   menjumlah ke total, pastikan persentase menjumlah ke 100 kalau memang seharusnya.
5. **Nilai visualisasinya** — sumbu mulai dari nol untuk diagram batang, skala konsisten antar
   panel, judul menggambarkan isinya.
6. **Nilai kesimpulannya** — didukung data yang ditampilkan? Ada penjelasan alternatif yang diakui?
   Tingkat keyakinannya sepadan dengan kekuatan buktinya?
7. **Saran perbaikan** — analisis tambahan, catatan yang perlu disebut, penyajian yang lebih baik.
8. **Nilai keyakinan** — siap dibagikan / dibagikan dengan catatan / perlu revisi.

## Keluaran

```markdown
## Laporan Validasi

### Penilaian keseluruhan: [siap dibagikan | dibagikan dengan catatan | perlu revisi]

### Tinjauan metodologi
[temuan soal pendekatan, pemilihan data, definisi]

### Masalah yang ditemukan
1. [tingkat: tinggi/sedang/rendah] [uraian dan dampaknya]

### Perhitungan yang dicek ulang
- [metrik]: [cocok / ada selisih]

### Tinjauan visualisasi
[masalah pada diagram atau penyajian]

### Saran perbaikan
1. [perbaikan dan kenapa penting]

### Catatan yang wajib disampaikan
- [catatan yang harus ikut disampaikan ke pembaca]
```

## Daftar periksa sebelum kirim

**Mutu data**
- [ ] Sumber data yang dipakai sudah benar untuk pertanyaan ini
- [ ] Data cukup mutakhir, tanggal "per" dicatat
- [ ] Tidak ada celah tak terduga di deret waktu atau segmen
- [ ] Null di kolom kunci sudah ditangani (dibuang, diimputasi, atau ditandai)
- [ ] Tidak ada penghitungan ganda dari join yang salah
- [ ] Semua filter benar, tidak ada pengecualian yang tak disengaja

**Perhitungan**
- [ ] `GROUP BY` memuat semua kolom yang tidak diagregasi
- [ ] Penyebut untuk rate dan persentase sudah benar dan tidak nol
- [ ] Perbandingan memakai rentang waktu yang sama panjangnya
- [ ] Jenis join tepat, join banyak-ke-banyak tidak menggelembungkan jumlah
- [ ] Definisi metrik sama dengan yang dipahami pembaca
- [ ] Subtotal menjumlah ke total, atau selisihnya dijelaskan

**Kewajaran**
- [ ] Angka di rentang yang masuk akal (persentase 0-100, jumlah tidak negatif)
- [ ] Tidak ada lompatan atau penurunan tak terjelaskan di deret waktu
- [ ] Angka kunci cocok dengan sumber lain yang diketahui
- [ ] Kasus tepi sudah dicek: segmen kosong, periode tanpa aktivitas, entitas baru

**Penyajian**
- [ ] Diagram batang mulai dari nol, sumbu berlabel, skala konsisten
- [ ] Format angka konsisten dan presisinya pantas
- [ ] Judul menyatakan temuannya, bukan cuma metriknya; rentang tanggal disebut
- [ ] Keterbatasan dan asumsi dinyatakan eksplisit
- [ ] Orang lain bisa mengulang analisis ini dari dokumentasinya

## Jebakan yang sudah pernah menggigit di proyek ini

1. **Metrik proxy yang membaik bukan bukti tujuannya membaik.** Sebelum menyimpulkan dari angka
   proxy (skor, cakupan, biaya per token), ukur metrik hasilnya secara terpisah dan periksa
   pengganggunya: satu sampel? beda alat ukur? beda skala?
2. **Metrik turunan dihitung pakai definisinya, bukan pendekatan yang kebetulan cocok.** Kalau
   metriknya ROI, hitung `rata-rata((harga-1) kalau kena, -1 kalau tidak)`, bukan
   `presisi x harga rata-rata - 1`. Keduanya cuma sama saat harga tidak berkorelasi dengan hasil.
3. **Alat ukur yang jalan tanpa error belum tentu mengukur hal yang benar.** Kalau semua sampel
   gagal seragam dengan angka ekstrem yang identik, curigai alat ukurnya dulu. Uji tiap probe baru
   pada fixture yang jawabannya sudah diketahui: satu positif, satu negatif, satu nyaris.
4. **Jangan simpulkan berkas rusak dari keluaran alat baca berformat.** Konfirmasi dengan `od -c`,
   `cmp`, atau `grep -c` dulu.
5. **Angka yang tidak ditarik dari alat itu tidak ada.** Kalau run yang menghasilkan angkanya gagal,
   laporkan kegagalannya, perbaiki, jalankan ulang, baru tulis angkanya. Jangan menjembatani
   celahnya dengan angka yang "seharusnya".
