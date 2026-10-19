---
name: {{slug}}-close-month
description: Tutup buku bulanan sebagai rantai tiga mata: persiapan tutup buku merekonsiliasi buku dan menulis narasi laba rugi, potret arus kas memperbarui ramalan 30/60/90 dari angka yang baru ditutup, lalu paket tutup buku disusun dan disebarkan. Pakai saat diminta "tutup bulan", "tutup buku", "rekonsiliasi", atau saat pemilik bertanya kenapa pendapatan atau marjin bergerak bulan lalu.
---

<!-- Sumber: small-business/skills/close-month @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang: konektor pihak ketiga dibuang, sumbernya modul {{proyek}} -->

# Tutup Bulan

Jalankan rantai akhir bulan: tutup, lalu ramalkan dari buku yang sudah ditutup, lalu susun dan
sebarkan paketnya. **Urutannya itu produknya.**

Argumen: `--bulan` (bawaan: bulan kalender sebelumnya, format `YYYY-MM`).

## Langkah 1 — Tutup dan rekonsiliasi

Jalankan persiapan tutup buku sampai selesai.

- **Masuk**: bulan sasaran
- **Keluar**: tabel rekonsiliasi, pos yang ditandai (belum terkategori, duplikat mencurigakan, bukti hilang), narasi laba rugi, dan paket tutup buku
- **Gerbang**: pemilik menuntaskan setiap pos yang ditandai, atau secara eksplisit melewatinya, sebelum langkah berikutnya jalan

**Langkah ini yang memiliki angkanya.** Tidak ada langkah berikutnya yang mengategorikan ulang
transaksi atau menyatakan ulang pendapatan.

## Gerbang keras sebelum Langkah 2

Jangan mulai ramalan sebelum pemilik menyetujui tutup bukunya. Sebut terus terang apa yang menunggu:

> "Buku April sudah ditutup, selisih Rp 3.200.000 selesai, dua bukti masih hilang. Lanjut perbarui
> ramalan kas dari angka yang sudah ditutup ini?"

Kalau pos yang ditandai masih terbuka, sebut namanya dan tanyakan apakah tetap mau diramalkan.
Ramalan yang dibangun di atas sebelas transaksi belum terkategori itu ramalan di atas tebakan, dan
pemilik berhak tahu dia dapat yang mana.

## Langkah 2 — Ramalkan dari buku yang sudah ditutup

Jalankan `{{slug}}-cash-flow-snapshot` memakai bulan yang sudah direkonsiliasi sebagai dasar
historisnya.

- **Masuk**: angka bulan tertutup dari Langkah 1 (waktu penagihan piutang nyata, biaya tetap sesuai pengodean nyata, jeda pelunasan nyata)
- **Keluar**: ramalan 30/60/90 hari dengan pita keyakinan dan risiko bernama
- **Gerbang**: tidak ada, ramalan itu hanya membaca

Sebut kenapa urutannya penting, satu baris cukup: ramalan yang dijalankan di atas buku mentah
mewarisi setiap beban yang salah kode dan setiap pelunasan yang belum dicocokkan. Dijalankan sesudah
tutup buku, riwayat waktu pembayarannya nyata dan lantai biaya tetapnya benar.

Kalau tutup buku memunculkan sesuatu yang menggeser ramalan (beban vendor ganda yang dihapus,
pelunasan yang akhirnya cocok), sebutkan selisihnya terhadap ramalan bulan lalu.

## Langkah 3 — Susun dan sebarkan paketnya

Paket tutup buku yang menyatu: ringkasan obrolan dulu, lalu berkasnya.

- **Masuk**: narasi laba rugi dan paket dari Langkah 1, plus ramalan dari Langkah 2
- **Keluar**: paket tutup buku yang menyatu
- **Gerbang**: menyimpan ke tempat pemilik otomatis. **Mengirim ke akuntan atau pihak lain tidak.** Susun pesannya, tunjukkan, lalu tunggu.

Gabungkan, jangan staples. Paketnya berbunyi: bulan ini apa, buku bilang apa, 90 hari ke depan
terlihat apa dari buku itu, dan apa yang masih terbuka.

## Yang tidak boleh dilakukan

- **Jangan meramalkan sebelum tutup bukunya disetujui.** Urutannya itu alasan rantai ini ada.
- **Jangan membetulkan pos yang ditandai secara otomatis.** Tunjukkan celahnya, sarankan tindakannya, tunggu.
- **Jangan menghapus duplikat yang dicurigai tanpa konfirmasi eksplisit.** Tunjukkan kedua catatannya berdampingan.
- **Jangan menyatakan ulang angka di langkah berikutnya.** Langkah 1 yang memiliki bukunya.
- **Jangan mengirim paket ke akuntan tanpa persetujuan.**
- **Jangan menulis angka yang tidak dibaca dari hasil alat** di giliran yang sama.

## Keluaran

Tutup dengan satu paragraf rekap: pendapatan dan marjin, celah yang masih terbuka, titik tengah
ramalan 30 hari dan risiko teratasnya, dan path berkasnya. Kalau ada yang dilewati bukan diselesaikan,
daftarkan supaya pemilik bisa kembali ke situ.

## Setelah dijalankan

Kalau ramalan menandai risiko payroll, lanjutkan ke `{{slug}}-plan-payroll`. Kalau pertanyaannya "siapa
yang berutang", jalankan penagihan piutang atas piutang yang baru dikonfirmasi tutup buku.
