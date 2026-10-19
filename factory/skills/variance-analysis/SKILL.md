---
name: {{slug}}-variance-analysis
description: Uraikan selisih keuangan jadi pemicunya, dengan penjelasan naratif dan analisis air terjun. Pakai saat menganalisis anggaran lawan realisasi, perubahan antar periode, selisih pendapatan atau beban, atau saat menyiapkan penjelasan selisih untuk manajemen.
---

<!-- Sumber: finance/skills/variance-analysis @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang ke konteks PSAK dan modul kas-bank {{proyek}} -->

# Analisis Selisih

Skill ini membantu alur analisis selisih, bukan memberi nasihat keuangan. Semua analisis ditinjau
orang yang kompeten sebelum dipakai dalam pelaporan.

## Teknik penguraian selisih

### Harga / volume

Paling dasar. Dipakai untuk pendapatan, harga pokok penjualan, dan metrik apa pun yang bisa ditulis
sebagai harga x volume.

```
Selisih total    = Realisasi - Anggaran
Efek volume      = (Volume realisasi - Volume anggaran) x Harga anggaran
Efek harga       = (Harga realisasi - Harga anggaran) x Volume realisasi
Efek bauran      = sisa (istilah interaksi), atau dialokasikan proporsional

Cek: Efek volume + Efek harga = Selisih total
```

Contoh pendapatan: anggaran 10.000 unit x Rp 50.000 = Rp 500 juta; realisasi 11.000 unit x
Rp 48.000 = Rp 528 juta. Selisih +Rp 28 juta menguntungkan: efek volume +Rp 50 juta, efek harga
-Rp 22 juta.

### Tarif / bauran

Dipakai saat menganalisis tarif gabungan lintas segmen dengan ekonomi satuan yang berbeda. Contoh:
produk A marjin 60%, produk B marjin 40%. Bauran anggaran 50/50 memberi marjin gabungan 50%; bauran
realisasi 40/60 memberi 48%. Efek bauran menjelaskan 2 poin penyusutan marjin itu.

### Jumlah orang / kompensasi

```
Selisih kompensasi total = Kompensasi realisasi - Kompensasi anggaran

Uraikan jadi:
1. selisih jumlah orang  = (orang realisasi - orang anggaran) x kompensasi rata-rata anggaran
2. selisih tarif         = (kompensasi rata-rata realisasi - anggaran) x orang anggaran
3. selisih bauran        = akibat pergeseran tingkat atau departemen
4. selisih waktu         = masuk lebih awal atau lebih lambat dari rencana
5. dampak berhenti       = penghematan dari yang berhenti mendadak
```

### Kategori belanja

```
Selisih beban operasional total = Beban realisasi - Beban anggaran

Uraikan menurut:
1. biaya ikut jumlah orang (gaji, tunjangan, BPJS, rekrutmen)
2. biaya ikut volume (hosting, biaya transaksi, komisi, pengiriman)
3. belanja diskresi (perjalanan, acara, jasa profesional, program pemasaran)
4. biaya tetap kontraktual (sewa, asuransi, lisensi, langganan)
5. sekali jalan (pesangon, penyelesaian hukum, hapus buku, biaya proyek)
6. waktu atau pentahapan (belanja bergeser antar periode)
```

## Ambang materialitas dan pemicu penyelidikan

Tetapkan ambang dari materialitas laporan keuangan (umumnya 1-5% dari tolok ukur kunci), ukuran pos
(makin besar posnya, makin rendah persentase ambangnya), volatilitasnya, dan tingkat yang akan
mengubah keputusan manajemen.

| Perbandingan | Ambang | Pemicu |
|---|---|---|
| Realisasi lawan anggaran | sesuai organisasi | lewat ambang Rupiah atau persentase |
| Realisasi lawan periode lalu | sesuai organisasi | lewat ambang Rupiah atau persentase |
| Realisasi lawan ramalan | sesuai organisasi | lewat ambang Rupiah atau persentase |
| Bulan ke bulan | sesuai organisasi | lewat ambang Rupiah atau persentase |

Urutan prioritas penyelidikan: selisih Rupiah absolut terbesar, lalu persentase terbesar, lalu arah
yang tak terduga, lalu selisih yang baru muncul, lalu selisih yang menumpuk tiap periode.

## Narasi penjelasan selisih

```
[Nama pos]: selisih [menguntungkan/tidak] Rp [nilai] ([persentase]) lawan [pembanding] periode [X]

Pemicu: [uraian pemicu utama]
[2-3 kalimat alasan bisnisnya, dengan kuantifikasi tiap faktor]

Prospek: [sekali jalan / diperkirakan berlanjut / membaik / memburuk]
Tindakan: [tidak perlu / pantau / selidiki lebih lanjut / perbarui ramalan]
```

Daftar periksa mutu narasi: **spesifik** (sebut pemicunya, bukan "lebih tinggi dari perkiraan"),
**terkuantifikasi** (nilai Rupiah dan persentase tiap pemicu), **kausal** (menjelaskan kenapa, bukan
cuma apa), **melihat ke depan** (berlanjut atau tidak), **bisa ditindaklanjuti**, dan **ringkas**
(2-4 kalimat).

Anti-pola yang harus dihindari: "pendapatan lebih tinggi dari anggaran karena pendapatan lebih
tinggi" (sirkular); "beban meningkat periode ini" (kabur); "waktu" tanpa menyebut apa yang lebih
awal atau lambat dan kapan akan normal; "sekali jalan" tanpa menjelaskan posnya; "berbagai pos kecil"
untuk selisih material (harus diuraikan lebih jauh); hanya menyebut pemicu terbesar dan mengabaikan
pos yang saling menutup.

## Air terjun (waterfall)

Bentuk teks kalau alat diagram tidak tersedia:

```
AIR TERJUN: Pendapatan Q4 realisasi lawan anggaran

Pendapatan anggaran Q4                              Rp 10.000 juta
  |--[+] pertumbuhan volume (pelanggan baru)         +Rp 800 juta
  |--[+] pendapatan ekspansi (pelanggan lama)        +Rp 400 juta
  |--[-] potongan harga                              -Rp 200 juta
  |--[-] berhenti langganan                          -Rp 350 juta
  |--[-] waktu (kesepakatan bergeser ke Q1)          -Rp 150 juta
  |
Pendapatan realisasi Q4                             Rp 10.500 juta

Selisih bersih: +Rp 500 juta (+5,0% menguntungkan)
```

Tabel rekonsiliasi pendamping:

| Pemicu | Nilai | % dari selisih | Kumulatif |
|---|---|---|---|
| Pertumbuhan volume | +Rp 800 juta | 160% | +Rp 800 juta |
| Pendapatan ekspansi | +Rp 400 juta | 80% | +Rp 1.200 juta |
| Potongan harga | -Rp 200 juta | -40% | +Rp 1.000 juta |
| Berhenti langganan | -Rp 350 juta | -70% | +Rp 650 juta |
| Waktu | -Rp 150 juta | -30% | +Rp 500 juta |
| **Selisih total** | **+Rp 500 juta** | **100%** | |

Persentase bisa lewat 100% untuk satu pemicu kalau ada pos yang saling menutup. Jaga pemicunya
5-8 saja, gabungkan sisanya jadi "lain-lain", dan pastikan air terjunnya rekonsiliasi (awal +
pemicu = akhir).

## Anggaran lawan realisasi lawan ramalan

| Metrik | Anggaran | Ramalan | Realisasi | Selisih anggaran | Selisih ramalan |
|---|---|---|---|---|---|
| Pendapatan | Rp X | Rp X | Rp X | Rp X (X%) | Rp X (X%) |
| Harga pokok | Rp X | Rp X | Rp X | Rp X (X%) | Rp X (X%) |
| Laba bruto | Rp X | Rp X | Rp X | Rp X (X%) | Rp X (X%) |

Kapan memakai yang mana: **realisasi lawan anggaran** untuk penilaian kinerja tahunan dan pelaporan
ke pemilik; **realisasi lawan ramalan** untuk pengelolaan operasional dan menemukan masalah yang
sedang muncul; **ramalan lawan anggaran** untuk memahami bagaimana ekspektasi berubah sejak
perencanaan; **realisasi lawan periode lalu** untuk tren; **realisasi lawan periode yang sama tahun
lalu** untuk pertumbuhan dan musiman.

Akurasi ramalan:

```
Akurasi ramalan = 1 - |realisasi - ramalan| / |realisasi|
MAPE = rata-rata |realisasi - ramalan| / |realisasi| di seluruh periode
```

Tren selisih sepanjang tahun menunjukkan bias sistematis: konsisten menguntungkan berarti anggaran
terlalu konservatif; konsisten tidak menguntungkan berarti anggaran terlalu agresif atau ada masalah
pelaksanaan; selisih membesar berarti kinerja memburuk; selisih mengecil itu pola normal seiring
tahun berjalan.

## Aturan angka

Tiap angka harus dibaca dari hasil alat di giliran yang sama. Kalau angka ramalan atau realisasinya
belum ada, tulis bahwa belum diukur, jangan diisi taksiran. Kalau selisihnya dihitung dari metrik
turunan, tulis definisinya dan pastikan kodenya menghitung definisi itu.
