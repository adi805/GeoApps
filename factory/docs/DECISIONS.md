# GeoApps Decisions

Catatan keputusan yang mengubah arah kerja, beserta alasannya dan biaya membaliknya. PRD tetap sumber kebenaran untuk lingkup; berkas ini menjelaskan kenapa bentuknya begitu.

## 2026-11-07: PRD GeoApps ditulis ulang dari nol

- **Keputusan:** membuat `factory/docs/PRD.md` baru memakai template Full toolkit 4.4.0, bukan memperbaiki PRD yang lama.
- **Alasan:** repo tidak punya PRD sama sekali (`find . -maxdepth 3 -iname "PRD*"` kosong) dan laporan pemindaian `prd-toolkit/SCAN SEMUA PRD 071126-0633.md` tidak memuat satu pun entri GeoApps. Dokumen lama yang "lolos 4.0.0" lolos karena gate senior belum ada di versi itu.
- **Akibat:** dokumen sekarang punya 10 kontrak senior, matriks ketertelusuran 14 requirement dan 17 kriteria penerimaan, dan 3 milestone dengan Done When yang bisa diperiksa.

## 2026-11-07: Milestone disusun dari gejala lapangan, bukan dari daftar fitur

- **Keputusan:** Milestone 1 adalah peta offline yang benar-benar terbuka tanpa sinyal, bukan georeferensi PDF.
- **Alasan:** probe 2026-11-06 mencatat dua permintaan ke CDN tile saat start tanpa jaringan, jadi peta kosong walau arsip ada. Peta kosong membuat seluruh fitur lain tidak bisa dipakai di lapangan.
- **Biaya membalik:** rendah, urutan milestone hanya menyentuh bagian 10 dan PROGRESS.

## 2026-11-07: Ubin 512 px dengan cache 48 entri sebagai batas memori

- **Keputusan:** render PDF memakai ubin dan cache berbatas 48 ubin, bukan kanvas penuh.
- **Alasan:** satu halaman A1 pada skala 2 menjadi sekitar 95 juta piksel dan sekitar 380 MB RAM sebelum kompresi, cukup untuk membuat WebView Android dibunuh sistem.
- **Belum terbukti:** angka 380 MB berasal dari hitungan luas kanvas di dokumen riset, bukan dari profiler perangkat. Angka RAM puncak 512 MB di AC-006 adalah target yang harus diukur.

## 2026-11-07: Drill restore dijalankan sungguhan sebelum tanggalnya ditulis

- **Keputusan:** menjalankan drill arsip bundel (zip, unzip, `sha256sum`) sebelum mengisi `last verified restore` dengan tanggal, bukan menulis tanggal tanpa drill.
- **Alasan:** gate restore menolak tanggal yang tidak bisa dipastikan, dan menulis tanggal karangan berarti dokumen ini berbohong di bagian yang justru dipakai saat data hilang.
- **Cakupan yang jujur:** yang diuji adalah arsip bundel di laptop, 3 berkas identik. Impor lewat aplikasi di perangkat Android belum pernah dijalankan dan dicatat sebagai celah Milestone 3.

## 2026-11-07: Produk tidak dijual

- **Keputusan:** mengisi pricing model dengan N/A plus alasan, bukan mengarang harga.
- **Alasan:** belum ada permintaan komersial dari owner, dan menjual produk butuh entitas, penagihan, dan dukungan yang belum ada.
- **Biaya membalik:** rendah, hanya menyentuh kontrak Commercial Readiness dan Go-to-Market.
