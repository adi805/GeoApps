---
name: {{slug}}-reconciliation
description: Rekonsiliasi akun dengan membandingkan saldo buku besar ke buku pembantu, rekening koran bank, atau data pihak ketiga. Pakai saat melakukan rekonsiliasi bank, rekonsiliasi buku besar ke buku pembantu, rekonsiliasi antar-entitas, atau saat mengelompokkan dan menelusuri pos rekonsiliasi.
---

<!-- Sumber: finance/skills/reconciliation @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang ke konteks PSAK dan modul kas-bank {{proyek}} -->

# Rekonsiliasi

Skill ini membantu alur rekonsiliasi, bukan memberi nasihat keuangan. Semua rekonsiliasi ditinjau
orang yang kompeten sebelum ditandatangani.

## Jenis rekonsiliasi

### Buku besar ke buku pembantu

Bandingkan saldo akun kontrol di buku besar dengan saldo rinci di buku pembantu.

Akun yang biasa: piutang usaha, utang usaha, aset tetap, persediaan, biaya dibayar di muka, utang
akrual.

Langkah: tarik saldo akun kontrol per akhir periode, tarik neraca saldo buku pembantu per tanggal
yang sama, bandingkan totalnya, telusuri setiap selisih.

Penyebab umum selisih: jurnal manual yang diposting ke akun kontrol tapi tidak tercermin di buku
pembantu; transaksi buku pembantu yang belum masuk buku besar; perbedaan waktu posting; kesalahan
antarmuka.

### Rekonsiliasi bank

Bandingkan saldo kas di buku besar dengan saldo rekening koran.

```
Saldo menurut rekening koran:             Rp XXX
Tambah: setoran dalam perjalanan          Rp XXX
Kurang: cek/bilyet giro beredar          (Rp XXX)
Tambah/Kurang: koreksi bank               Rp XXX
Saldo bank disesuaikan:                   Rp XXX

Saldo menurut buku besar:                 Rp XXX
Tambah: jasa giro belum dicatat           Rp XXX
Kurang: biaya bank belum dicatat         (Rp XXX)
Tambah/Kurang: koreksi buku besar         Rp XXX
Saldo buku disesuaikan:                   Rp XXX

Selisih:                                  Rp 0
```

### Rekonsiliasi antar-entitas

Pastikan saldo antar entitas yang berhubungan menjumlah nol saat konsolidasi. Bandingkan piutang
entitas A ke entitas B dengan utang entitas B ke entitas A.

Penyebab umum: transaksi dicatat satu pihak saja; kurs berbeda; salah klasifikasi (antar-entitas
dianggap pihak ketiga); jumlah berselisih atau pembayaran belum dialokasikan.

## Pengelompokan pos rekonsiliasi

| Kategori | Isi | Tindakan |
|---|---|---|
| Perbedaan waktu | cek beredar, setoran dalam perjalanan, transaksi menunggu antarmuka | tidak perlu jurnal; tunggu siklus berikutnya, biasanya 1-5 hari kerja |
| Perlu penyesuaian | biaya bank, jasa giro belum dicatat, kesalahan jumlah, entri hilang, salah akun | buat jurnal penyesuaian |
| Perlu penyelidikan | selisih tak terjelaskan, pos berselisih, pos berumur panjang, selisih berulang | selidiki akarnya, catat, naikkan kalau tidak selesai |

## Analisis umur pos terbuka

| Umur | Status | Tindakan |
|---|---|---|
| 0-30 hari | wajar | pantau |
| 31-60 hari | menua | selidiki kenapa belum selesai |
| 61-90 hari | lewat | naikkan ke pengawas, catat penyelidikan |
| di atas 90 hari | basi | naikkan ke manajemen, mungkin perlu hapus buku atau penyesuaian |

## Ambang eskalasi

Tetapkan ambang sesuai materialitas dan selera risiko perusahaan. Bentuknya: satu pos di atas
materialitas → tinjauan pengawas; total pos rekonsiliasi di atas materialitas gabungan → tinjauan
pengendali; pos berumur di atas 60 hari → tindak lanjut pengawas; di atas 90 hari → tinjauan
manajemen; selisih yang belum selesai berapa pun → **tidak boleh tutup buku**, harus diselesaikan
atau didokumentasikan; tren naik tiga periode berturut-turut → perbaikan proses.

## Praktik yang baik

1. **Ketepatan waktu**: selesaikan dalam tenggat kalender tutup buku, biasanya T+3 sampai T+5 hari kerja.
2. **Kelengkapan**: rekonsiliasi semua akun neraca pada frekuensi yang ditetapkan, bulanan untuk akun material.
3. **Dokumentasi**: tiap rekonsiliasi memuat penyusun, peninjau, tanggal, dan penjelasan tiap pos.
4. **Pemisahan tugas**: yang merekonsiliasi bukan orang yang memproses transaksi di akun itu.
5. **Tindak lanjut**: lacak pos terbuka sampai selesai, jangan diteruskan tanpa akhir.
6. **Akar masalah**: untuk pos berulang, perbaiki prosesnya, bukan cuma posnya.
7. **Keseragaman**: pakai templat dan prosedur yang sama untuk semua akun.

## Di {{proyek}}

Modul kas dan bank memegang BKM/BKK, jurnal, dan tutup buku. Rekening koran masuk lewat impor
berkas; kalau format bank berubah dan impornya gagal, itu masalah impor, bukan masalah rekonsiliasi.
Selisih yang belum selesai menahan tutup buku, dan itu disengaja.
