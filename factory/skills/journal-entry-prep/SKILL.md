---
name: {{slug}}-journal-entry-prep
description: Rujukan penyusunan jurnal untuk tutup buku: katalog jurnal standar, syarat bukti pendukung, matriks persetujuan, dan daftar periksa peninjau. Dipakai oleh skill lain sebagai rujukan, bukan dijalankan sendiri.
---

<!-- Sumber: finance/skills/journal-entry-prep @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang ke konteks PSAK dan modul kas-bank {{proyek}} -->

# Rujukan Penyusunan Jurnal

**Catatan peran:** ini berkas rujukan. Alur kerjanya ada di skill `{{slug}}-journal-entry`; berkas ini
dipakai saat butuh katalog jurnal standar, syarat dokumentasi, atau daftar periksa peninjau.

Skill ini membantu alur jurnal, bukan memberi nasihat keuangan. Semua jurnal ditinjau orang yang
kompeten sebelum diposting.

## Katalog jurnal standar

### Akrual utang usaha

Untuk barang atau jasa yang sudah diterima tapi belum ditagih per akhir periode.

- Debit: akun beban, atau aset kalau memenuhi syarat kapitalisasi
- Kredit: utang akrual

Sumber perhitungan: PO terbuka dengan penerimaan terkonfirmasi, kontrak dengan jasa yang sudah
diberikan tapi belum ditagih, langganan dan jasa berulang, klaim biaya karyawan yang sudah
diserahkan tapi belum diproses.

Catatan: balik di periode berikutnya (pembalikan otomatis dianjurkan), pakai metode taksiran yang
konsisten antar periode, catat dasar taksirannya, dan lacak taksiran lawan kenyataan untuk
memperbaiki taksiran berikutnya.

### Depresiasi aset tetap

- Debit: beban depresiasi atau amortisasi, per departemen atau pusat biaya
- Kredit: akumulasi depresiasi atau amortisasi

Metode: garis lurus (paling umum untuk pelaporan keuangan), saldo menurun, atau unit produksi.

Catatan: jalankan dari daftar aset tetap, pastikan penambahan baru punya masa manfaat dan metode
yang benar, periksa pelepasan atau penurunan nilai yang perlu dihapus, dan jaga konsistensi antara
catatan komersial dan fiskal.

### Amortisasi biaya dibayar di muka

- Debit: akun beban (asuransi, langganan, sewa)
- Kredit: biaya dibayar di muka

Kategori umum: premi asuransi, lisensi dan langganan perangkat lunak, sewa dibayar di muka, kontrak
pemeliharaan, uang muka acara.

Catatan: pelihara jadwal amortisasi dengan tanggal mulai, tanggal berakhir, dan nilai bulanan;
periksa kontrak yang dibatalkan sehingga amortisasinya perlu dipercepat; pastikan pos baru segera
masuk jadwal.

### Akrual payroll

- Gaji: debit beban gaji per departemen, kredit utang gaji
- Bonus: debit beban bonus, kredit utang bonus
- Tunjangan: debit beban tunjangan, kredit utang tunjangan
- BPJS dan PPh 21: debit beban terkait, kredit utang BPJS dan utang PPh 21

Catatan: hitung akrual gaji dari hari kerja di periode dibanding periode bayarnya; akrual bonus
mengikuti isi rencana bonus; sertakan kontribusi perusahaan; lacak kewajiban cuti kalau kebijakan
atau aturan mengharuskannya. Angka akrual harus bisa direkonsiliasi ke putaran payroll.

### Pengakuan pendapatan

- Mengakui pendapatan diterima di muka: debit pendapatan diterima di muka, kredit pendapatan
- Mengakui pendapatan dengan piutang baru: debit piutang usaha, kredit pendapatan
- Menangguhkan pendapatan diterima di muka: debit kas atau piutang, kredit pendapatan diterima di muka

Catatan: ikuti kerangka lima langkah PSAK 72, tentukan kewajiban pelaksanaan yang berbeda di tiap
kontrak, tentukan harga transaksi termasuk imbalan variabel, alokasikan ke kewajiban pelaksanaan,
lalu akui saat kewajiban itu terpenuhi. Pelihara rincian tingkat kontrak untuk audit.

## Syarat bukti pendukung

Tiap jurnal harus punya: keterangan yang jelas tentang apa yang dicatat dan kenapa; dasar
perhitungan (rumus, jadwal, atau rujukan sumber data); dokumen sumber (nomor PO, nomor faktur,
rujukan kontrak, daftar gaji); periode yang berlaku; identitas penyusun dan tanggalnya; bukti
tinjauan dan persetujuan; serta penanda pembalik dan tanggalnya.

## Matriks persetujuan

Tetapkan ambangnya sesuai materialitas dan selera risiko perusahaan. Bentuknya:

| Jenis jurnal | Ambang | Pemberi persetujuan |
|---|---|---|
| Berulang standar | berapa pun | manajer akuntansi |
| Manual tidak berulang | di bawah ambang sedang | manajer akuntansi |
| Manual tidak berulang | antara ambang sedang dan tinggi | pengendali |
| Manual tidak berulang | di atas ambang tinggi | pimpinan keuangan |
| Penyesuaian di luar periode | berapa pun | pengendali atau di atasnya |

## Daftar periksa peninjau

- [ ] Debit sama dengan kredit
- [ ] Periode benar, tidak memposting ke periode tertutup
- [ ] Kode akun ada dan sesuai
- [ ] Angka akurat dan didukung perhitungan
- [ ] Keterangan jelas dan cukup untuk audit
- [ ] Kode departemen, pusat biaya, atau proyek benar
- [ ] Perlakuan konsisten dengan periode sebelumnya dan kebijakan akuntansi
- [ ] Pembalikan otomatis disetel dengan benar untuk akrual
- [ ] Bukti pendukung lengkap dan dirujuk
- [ ] Nilainya di dalam kewenangan penyusun
- [ ] Bukan duplikat jurnal yang sudah ada
- [ ] Angka besar atau tidak wajar sudah dijelaskan
