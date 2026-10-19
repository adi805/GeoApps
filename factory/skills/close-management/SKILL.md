---
name: {{slug}}-close-management
description: Kelola proses tutup buku bulanan dengan urutan tugas, ketergantungan, dan pelacakan status. Pakai saat menyusun kalender tutup buku, melacak kemajuannya, menemukan penghambat, atau mengurutkan kegiatan tutup buku per hari.
---

<!-- Sumber: finance/skills/close-management @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang ke konteks PSAK dan modul kas-bank {{proyek}} -->

# Manajemen Tutup Buku

Skill ini membantu alur tutup buku, bukan memberi nasihat keuangan. Semua kegiatan tutup buku
ditinjau orang yang kompeten.

## Kalender tutup buku

### Pra-tutup (2-3 hari kerja terakhir bulan berjalan)

- [ ] Kirim kalender tutup buku dan pengingat tenggat ke semua penyumbang
- [ ] Pastikan prosedur batas waktu untuk utang, piutang, payroll, dan kas
- [ ] Periksa semua subsistem berjalan normal
- [ ] Rekonsiliasi bank awal (semua kecuali aktivitas hari terakhir)
- [ ] Tinjau PO terbuka untuk kebutuhan akrual
- [ ] Pastikan jadwal payroll sejalan dengan garis waktu tutup buku
- [ ] Kumpulkan informasi transaksi tidak wajar yang sudah diketahui

### Hari tutup 1 (T+1)

- [ ] Pastikan semua modul buku pembantu selesai diproses
- [ ] Jalankan akrual utang usaha
- [ ] Posting jurnal payroll dan akrualnya kalau periode gaji melewati akhir bulan
- [ ] Catat penerimaan dan pengeluaran kas sampai akhir bulan
- [ ] Posting transaksi antar-entitas dan konfirmasi ke pihak lawan
- [ ] Selesaikan rekonsiliasi bank dengan rekening koran final
- [ ] Jalankan depresiasi aset tetap
- [ ] Posting amortisasi biaya dibayar di muka

### Hari tutup 2 (T+2)

- [ ] Selesaikan jurnal pengakuan pendapatan dan penyesuaian pendapatan diterima di muka
- [ ] Posting jurnal akrual sisanya
- [ ] Selesaikan rekonsiliasi buku pembantu piutang
- [ ] Selesaikan rekonsiliasi buku pembantu utang
- [ ] Catat penyesuaian persediaan kalau ada
- [ ] Posting penjabaran ulang valuta asing
- [ ] Mulai rekonsiliasi akun neraca

### Hari tutup 3 (T+3)

- [ ] Selesaikan semua rekonsiliasi akun neraca
- [ ] Posting jurnal penyesuaian yang ditemukan saat rekonsiliasi
- [ ] Selesaikan rekonsiliasi antar-entitas dan jurnal eliminasinya
- [ ] Jalankan neraca saldo dan laba rugi awal
- [ ] Lakukan analisis selisih awal atas laba rugi
- [ ] Selidiki dan selesaikan selisih material

### Hari tutup 4 (T+4)

- [ ] Posting jurnal penyisihan pajak
- [ ] Selesaikan perubahan ekuitas
- [ ] Finalkan semua jurnal, tutup buku lunak
- [ ] Susun draf laporan keuangan (laba rugi, neraca, arus kas)
- [ ] Lakukan analisis selisih rinci dan siapkan penjelasannya
- [ ] Tinjauan manajemen atas laporan keuangan dan metrik kunci

### Hari tutup 5 (T+5)

- [ ] Posting penyesuaian akhir dari tinjauan manajemen
- [ ] Finalkan laporan keuangan, tutup buku keras
- [ ] Kunci periode di sistem
- [ ] Bagikan paket pelaporan ke pemangku kepentingan
- [ ] Perbarui ramalan berdasarkan hasil kenyataan
- [ ] Lakukan retrospektif tutup buku, temukan perbaikan proses

## Ketergantungan

```
Tingkat 1 (tanpa ketergantungan, bisa mulai di T+1):
  catat penerimaan/pengeluaran kas, ambil rekening koran, proses payroll,
  jalankan depresiasi, amortisasi dibayar di muka, siapkan akrual utang,
  posting transaksi antar-entitas

Tingkat 2 (butuh Tingkat 1):
  rekonsiliasi bank, pengakuan pendapatan, rekonsiliasi buku pembantu piutang
  dan utang, penjabaran ulang valuta asing, jurnal akrual sisanya

Tingkat 3 (butuh Tingkat 2):
  semua rekonsiliasi akun neraca, rekonsiliasi antar-entitas, jurnal penyesuaian,
  neraca saldo awal

Tingkat 4 (butuh Tingkat 3):
  penyisihan pajak, perubahan ekuitas, konsolidasi dan eliminasi,
  draf laporan keuangan, analisis selisih awal

Tingkat 5 (butuh Tingkat 4):
  tinjauan manajemen, penyesuaian akhir, tutup buku keras, paket pelaporan,
  pembaruan ramalan
```

**Jalur kritis** menentukan durasi minimum tutup buku:
kas/utang/piutang → rekonsiliasi buku pembantu → rekonsiliasi neraca → penyisihan pajak → draf
laporan keuangan → tinjauan manajemen → tutup buku keras.

Cara memperpendek: otomatiskan jurnal berulang di Tingkat 1, rekonsiliasi berjalan selama bulan,
proses paralel untuk rekonsiliasi yang mandiri, tenggat jelas, dan templat seragam.

## Pelacakan status

| Tugas | Penanggung jawab | Tenggat | Status | Penghambat | Catatan |
|---|---|---|---|---|---|
| [nama tugas] | [orang/lane] | [T+N] | belum mulai / berjalan / selesai / tertahan / berisiko | [kalau tertahan, apa] | [catatan] |

Definisi status: **belum mulai** (mungkin menunggu ketergantungan), **berjalan**, **selesai** (sudah
ditinjau dan disetujui), **tertahan** (tidak bisa lanjut karena ketergantungan, data hilang, atau
masalah), **berisiko** (berjalan tapi mungkin tidak tepat tenggat).

Rapat status harian singkat (15 menit) selama periode tutup buku: tinjau papan status, temukan
penghambat, alihkan atau naikkan, lalu perbarui garis waktunya.

## Metrik yang dilacak

| Metrik | Definisi | Sasaran |
|---|---|---|
| Durasi tutup buku | hari kerja dari akhir periode sampai tutup buku keras | turun dari waktu ke waktu |
| Jumlah jurnal penyesuaian setelah tutup lunak | jurnal yang diposting saat tinjauan manajemen | sedikit mungkin |
| Jumlah tugas terlambat | tugas yang selesai setelah tenggat | nol |
| Jumlah selisih rekonsiliasi | pos rekonsiliasi yang perlu penyelidikan | turun dari waktu ke waktu |
| Jumlah koreksi setelah tutup buku | kesalahan yang ditemukan setelah tutup | nol |

## Penghambat yang umum dan penyelesaiannya

| Penghambat | Akar masalah | Penyelesaian |
|---|---|---|
| Akrual utang telat | menunggu konfirmasi belanja departemen | taksiran akrual berjalan, tenggat batas waktu yang tegas |
| Jurnal manual menumpuk | jurnal berulang disiapkan manual tiap bulan | otomatiskan jurnal berulang standar |
| Rekonsiliasi lambat | mulai dari nol tiap bulan | rekonsiliasi berjalan sepanjang bulan |
| Antar-entitas telat | menunggu konfirmasi pihak lawan | pencocokan antar-entitas otomatis, tenggat lebih tegas |
| Banyak penyesuaian saat tinjauan | proses tinjauan awal lemah | perkuat tinjauan awal, berdayakan tim menemukan masalah lebih dini |
| Dokumen pendukung hilang | dokumen dicari saat tutup buku | pelihara dokumentasi sepanjang bulan |

## Pertanyaan retrospektif

1. Apa yang berjalan baik dan perlu diteruskan?
2. Apa yang lebih lama dari perkiraan, dan kenapa?
3. Penghambat apa yang muncul, dan bagaimana mencegahnya?
4. Ada kejutan di hasil keuangan yang seharusnya bisa ditangkap lebih dini?
5. Apa yang bisa diotomatiskan atau dirampingkan bulan depan?

## Di {{proyek}}

Modul kas dan bank memegang tutup buku. Selisih rekonsiliasi yang belum selesai menahan tutup buku.
Kalau penghambatnya butuh keputusan yang menyentuh produksi atau rilis, itu naik ke owner, lihat
`factory/LAW.md` bagian 7.
