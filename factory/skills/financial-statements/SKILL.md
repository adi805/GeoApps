---
name: {{slug}}-financial-statements
description: Susun laporan keuangan (laba rugi, neraca, arus kas) dengan perbandingan antar periode dan analisis selisih. Pakai saat menyiapkan laba rugi bulanan atau kuartalan, menutup buku dan perlu menandai selisih material, membandingkan realisasi dengan anggaran, atau menyusun ringkasan keuangan untuk tinjauan manajemen.
---

<!-- Sumber: finance/skills/financial-statements @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang ke PSAK dan format laporan {{proyek}} -->

# Laporan Keuangan

Skill ini membantu alur penyusunan laporan keuangan, bukan memberi nasihat keuangan. Semua laporan
ditinjau orang yang kompeten sebelum dipakai dalam pelaporan.

## Langkah 1 — Kumpulkan datanya

Tarik neraca saldo periode yang dilaporkan, data periode pembanding (periode sebelumnya, periode yang
sama tahun lalu, dan anggaran kalau ada), serta hierarki akun untuk penyajiannya.

## Langkah 2 — Susun laba rugi

Format multikolom: periode ini, periode pembanding, selisih Rupiah, selisih persen, anggaran, dan
selisih terhadap anggaran.

```
LABA RUGI
Periode: [uraian periode]
(dalam ribuan rupiah, kecuali dinyatakan lain)

                                 Periode   Periode   Selisih   Selisih   Anggaran   Sel. Angg.
                                 ini       lalu      (Rp)      (%)       (Rp)       (Rp)
PENDAPATAN
  Pendapatan jasa                XX.XXX    XX.XXX    X.XXX     X,X%      XX.XXX     X.XXX
  Pendapatan lain                XX.XXX    XX.XXX    X.XXX     X,X%      XX.XXX     X.XXX
TOTAL PENDAPATAN                 XX.XXX    XX.XXX    X.XXX     X,X%      XX.XXX     X.XXX

BEBAN POKOK PENDAPATAN
  [pos beban]                    XX.XXX    XX.XXX    X.XXX     X,X%      XX.XXX     X.XXX
LABA BRUTO                       XX.XXX    XX.XXX    X.XXX     X,X%      XX.XXX     X.XXX
  Marjin bruto                   XX,X%     XX,X%

BEBAN USAHA
  Beban penjualan                XX.XXX    XX.XXX    X.XXX     X,X%      XX.XXX     X.XXX
  Beban umum dan administrasi    XX.XXX    XX.XXX    X.XXX     X,X%      XX.XXX     X.XXX
TOTAL BEBAN USAHA                XX.XXX    XX.XXX    X.XXX     X,X%      XX.XXX     X.XXX

LABA USAHA                       XX.XXX    XX.XXX    X.XXX     X,X%      XX.XXX     X.XXX
  Marjin usaha                   XX,X%     XX,X%

PENDAPATAN (BEBAN) LAIN
  Pendapatan bunga               XX.XXX    XX.XXX    X.XXX     X,X%
  Beban bunga                   (XX.XXX)  (XX.XXX)   X.XXX     X,X%
  Lain-lain, neto                XX.XXX    XX.XXX    X.XXX     X,X%
TOTAL PENDAPATAN (BEBAN) LAIN    XX.XXX    XX.XXX    X.XXX     X,X%

LABA SEBELUM PAJAK               XX.XXX    XX.XXX    X.XXX     X,X%
  Beban pajak penghasilan        XX.XXX    XX.XXX    X.XXX     X,X%

LABA BERSIH                      XX.XXX    XX.XXX    X.XXX     X,X%      XX.XXX     X.XXX
  Marjin bersih                  XX,X%     XX,X%
```

## Langkah 3 — Analisis selisih

Untuk tiap pos: selisih Rupiah, selisih persen, dan perubahan dalam poin persentase untuk marjin dan
rasio.

Ambang materialitas dipakai berlapis: ambang Rupiah tetap, ambang persen, atau gabungan. Sesuaikan
dengan ukuran organisasi, misalnya pos besar 5%, pos sedang 10%, pos kecil 15%.

Uraikan selisih total jadi pemicunya: efek volume, efek harga atau tarif, efek bauran, pos baru atau
dihentikan, pos sekali jalan, efek waktu, dan efek kurs. Untuk tiap selisih material: kuantifikasi,
tentukan menguntungkan atau tidak, uraikan pemicunya, beri penjelasan bisnisnya, nilai apakah
sementara atau perubahan tren, lalu catat tindakan yang diperlukan.

## Langkah 4 — Metrik kunci

| Metrik | Periode ini | Periode lalu | Perubahan |
|---|---|---|---|
| Pertumbuhan pendapatan (%) | | | |
| Marjin bruto (%) | | | |
| Marjin usaha (%) | | | |
| Marjin bersih (%) | | | |
| Beban usaha sebagai % pendapatan | | | |
| Tarif pajak efektif (%) | | | |

## Langkah 5 — Daftar selisih material

| Pos | Selisih (Rp) | Selisih (%) | Arah | Pemicu awal | Tindakan |
|---|---|---|---|---|---|
| [pos] | X.XXX | X,X% | tidak menguntungkan | [kalau diketahui] | selidiki |

## Langkah 6 — Keluaran

Laporan terformat dengan pembanding, ringkasan metrik kunci, daftar selisih material yang perlu
diselidiki, pertanyaan lanjutan untuk selisih yang belum terjelaskan, dan tawaran menelusuri selisih
tertentu lebih dalam.

## Syarat penyajian (PSAK)

**Laba rugi**: sajikan semua pos pendapatan dan beban periode itu; klasifikasikan beban menurut fungsi
(beban pokok, penjualan, umum dan administrasi) atau menurut jenis; kalau diklasifikasi menurut
fungsi, ungkapkan pos menurut jenis yang tidak terlihat di sana (penyusutan, amortisasi, imbalan
kerja); pisahkan pos usaha dan di luar usaha; tampilkan beban pajak sebagai baris tersendiri; pisahkan
operasi yang dihentikan, neto setelah pajak.

**Neraca**: pisahkan aset dan liabilitas lancar dan tidak lancar (lancar = direalisasi, dipakai, atau
diselesaikan dalam 12 bulan); sajikan aset menurut urutan likuiditas; piutang disajikan neto setelah
penyisihan kerugian kredit (PSAK 71); aset tetap disajikan neto setelah akumulasi penyusutan; sewa
mengakui aset hak-guna dan liabilitas sewa (PSAK 73); aset takberwujud dengan masa manfaat tidak
terbatas tidak diamortisasi, tapi diuji penurunan nilainya.

**Arus kas**: metode tidak langsung paling umum (mulai dari laba bersih, sesuaikan pos non-kas); bunga
dan pajak yang dibayar diungkapkan; aktivitas investasi dan pendanaan non-kas diungkapkan terpisah;
setara kas adalah investasi jangka pendek sangat likuid dengan jatuh tempo awal tiga bulan atau kurang.

## Format rujukan neraca

Aset lancar (kas dan setara kas, piutang neto, persediaan, biaya dibayar di muka dan aset lancar lain)
→ total aset lancar → aset tidak lancar (aset tetap neto, aset hak-guna, aset takberwujud neto,
investasi jangka panjang, aset tidak lancar lain) → total aset. Lalu liabilitas lancar (utang usaha,
utang akrual, pendapatan diterima di muka bagian lancar, bagian lancar utang jangka panjang,
liabilitas sewa bagian lancar) → total liabilitas lancar → liabilitas tidak lancar → total liabilitas
→ ekuitas (modal saham, tambahan modal disetor, saldo laba) → total liabilitas dan ekuitas.

## Format rujukan arus kas (tidak langsung)

Laba bersih → penyesuaian (penyusutan dan amortisasi, pos non-kas lain) → perubahan aset dan
liabilitas operasi (piutang, persediaan, biaya dibayar di muka, utang usaha, utang akrual, pendapatan
diterima di muka) → arus kas bersih dari operasi → arus kas dari investasi (perolehan aset tetap,
perolehan dan pencairan investasi) → arus kas dari pendanaan (penerimaan dan pembayaran utang, dividen)
→ efek perubahan kurs → kenaikan atau penurunan kas bersih → kas awal periode → kas akhir periode.

## Penyesuaian akhir periode yang umum

1. Akrual: beban yang sudah terjadi tapi belum dibayar (utang usaha, gaji, bunga)
2. Penangguhan: penyesuaian biaya dibayar di muka, pendapatan diterima di muka, biaya ditangguhkan
3. Penyusutan dan amortisasi dari daftar aset
4. Penyisihan piutang tak tertagih dari analisis umur dan tarif kerugian historis
5. Penyesuaian persediaan untuk barang usang, lambat bergerak, atau turun nilai
6. Penjabaran ulang valuta asing pada kurs akhir periode
7. Penyisihan pajak penghasilan kini dan tangguhan
8. Penyesuaian nilai wajar untuk investasi dan instrumen lain

Reklasifikasi yang umum: utang jangka panjang yang jatuh tempo dalam 12 bulan direklasifikasi jadi
lancar; akun kontra disajikan neto; saldo antar-entitas dieliminasi saat konsolidasi; hasil operasi
yang dihentikan dipisah.

## Di {{proyek}}

Laporan disusun dari modul kas dan bank. Tiap angka harus dibaca dari hasil alat di giliran yang sama;
kalau angkanya belum ada, tulis belum diukur, jangan diisi taksiran. Perubahan yang menyentuh format
rilis atau konfigurasi produksi naik ke owner dulu, lihat `factory/LAW.md` bagian 7.
