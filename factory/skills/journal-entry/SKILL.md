---
name: {{slug}}-journal-entry
description: Susun jurnal dengan debit, kredit, dan bukti pendukung yang benar. Pakai saat mencatat akrual akhir bulan, depresiasi atau amortisasi, pengakuan pendapatan, akrual payroll, atau saat menyiapkan jurnal untuk ditinjau.
---

<!-- Sumber: finance/skills/journal-entry @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang ke konteks PSAK dan modul kas-bank {{proyek}} -->

# Penyusunan Jurnal

Skill ini membantu alur jurnal, bukan memberi nasihat keuangan. Semua jurnal ditinjau orang yang
kompeten sebelum diposting.

## Jenis jurnal

| Jenis | Isi | Debit | Kredit |
|---|---|---|---|
| Akrual utang usaha | barang/jasa sudah diterima, belum ditagih | akun beban, atau aset kalau memenuhi syarat kapitalisasi | utang akrual |
| Aset tetap | depresiasi dan amortisasi | beban depresiasi per departemen | akumulasi depresiasi |
| Dibayar di muka | amortisasi asuransi, langganan, sewa | akun beban | biaya dibayar di muka |
| Akrual payroll | upah, tunjangan, BPJS, PPh 21, dan bonus yang belum dibayar | beban gaji dan tunjangan | utang gaji, utang BPJS, utang PPh 21 |
| Pendapatan | pengakuan pendapatan dan penyesuaian pendapatan diterima di muka | pendapatan diterima di muka atau piutang | pendapatan |

## Langkah

### 1. Kumpulkan sumbernya

Tarik neraca saldo periode, rincian buku pembantu untuk akun terkait, dan jurnal periode lalu dengan
jenis yang sama sebagai pembanding.

### 2. Hitung nilainya

Pakai dasar yang bisa dijelaskan: nilai PO, isi kontrak, tarif yang berlaku, atau jadwal amortisasi.
Untuk pendapatan, ikuti kerangka lima langkah PSAK 72. Untuk sewa, ikuti PSAK 73. Untuk aset tetap,
ikuti PSAK 16.

### 3. Susun jurnalnya

```
Jurnal: [jenis] — [periode]
Disusun oleh: [nama]
Tanggal: [akhir periode]

| Baris | Kode Akun | Nama Akun | Debit | Kredit | Departemen | Keterangan |
|---|---|---|---|---|---|---|
| 1 | XXXX | [nama] | X.XXX |  | [dept] | [rincian] |
| 2 | XXXX | [nama] |  | X.XXX | [dept] | [rincian] |
|   |      | **Total** | X.XXX | X.XXX |  |  |

Bukti pendukung:
- [dasar perhitungan dan asumsinya]
- [rujukan ke jadwal atau dokumen pendukung]

Pembalik: [ya/tidak, kalau ya sebutkan tanggalnya]
```

### 4. Daftar periksa sebelum final

- [ ] Debit sama dengan kredit
- [ ] Periode akuntansi benar, tidak memposting ke periode yang sudah ditutup
- [ ] Kode akun ada dan sesuai transaksinya
- [ ] Angka benar dan ada dasar perhitungannya
- [ ] Keterangan cukup jelas untuk audit
- [ ] Kode departemen atau pusat biaya benar
- [ ] Perlakuan konsisten dengan periode sebelumnya dan kebijakan akuntansi
- [ ] Tanda pembalik disetel benar, akrual sebaiknya membalik otomatis
- [ ] Bukan duplikat jurnal yang sudah ada
- [ ] Angka yang tidak wajar dijelaskan

## Keluaran

Jurnal terformat, perhitungan pendukungnya, perbandingan ke jurnal sejenis periode lalu, hal yang
perlu ditindaklanjuti, dan cara mempostingnya.

## Kesalahan yang paling sering terjadi

1. Debit tidak sama dengan kredit
2. Salah periode, atau memposting ke periode yang sudah ditutup
3. Salah sisi, debit ditulis kredit atau sebaliknya
4. Jurnal ganda untuk transaksi yang sama
5. Salah akun, terutama kode akun yang mirip
6. Akrual tidak disetel membalik, jadi terhitung dua kali
7. Akrual berulang yang tidak diperbarui padahal keadaannya berubah
8. Taksiran dengan angka bulat yang mencurigakan
9. Kurs valuta asing yang salah tanggal atau salah nilainya
10. Kesalahan batas waktu, transaksi tercatat di periode yang salah

## Di {{proyek}}

Jurnal masuk lewat modul kas dan bank (BKM/BKK dan jurnal umum). Jurnal yang menyentuh payroll
harus cocok dengan putaran payroll yang benar-benar dijalankan, bukan yang diusulkan. Jurnal yang
menyentuh rilis atau konfigurasi produksi naik ke owner dulu, lihat `factory/LAW.md` bagian 7.
