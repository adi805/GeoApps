---
name: {{slug}}-cash-flow-snapshot
description: Baca piutang, utang, kebiasaan waktu pembayaran historis, dan biaya tetap dari buku, lalu hasilkan ramalan arus kas 30/60/90 hari dengan pita keyakinan dan tanda risiko bernama. Pakai saat pengguna bertanya "ramalkan arus kas", "apakah kasnya cukup", menyebut "kas menipis", atau menanyakan sisa runway.
---

<!-- Sumber: small-business/skills/cash-flow-snapshot @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang: konektor pihak ketiga dibuang, sumbernya modul {{proyek}} -->

# Potret Arus Kas

Hasilkan ramalan arus kas 30/60/90 hari dengan pita keyakinan berbasis variasi waktu pembayaran, plus
tanda risiko bernama.

**Mulai cepat:** "apakah kasnya cukup untuk payroll bulan depan?"

## Langkah 1 — Tentukan sumber datanya

Sumbernya modul PMS sendiri:

| Data | Dari mana |
|---|---|
| Saldo kas awal | modul kas dan bank, dengan tanggal "per" |
| Umur piutang | daftar piutang: nama pelanggan, nilai faktur, tanggal faktur, tanggal jatuh tempo, hari tunggakan |
| Utang usaha | nama vendor, nilai, tanggal jatuh tempo |
| Biaya tetap berulang | sewa, payroll, langganan |
| Riwayat pelunasan | jeda dari tanggal faktur sampai tanggal penerimaan, per pelanggan |

**Selalu tetapkan saldo kas awal.** Pertanyaan "apakah kasnya cukup" itu soal saldo, bukan soal neto.
Kalau tidak ada yang tahu saldonya, beri judul keluaran "tanpa saldo awal, hanya perubahan neto" dan
keluarkan kas di tangan dari daftar risiko.

## Langkah 2 — Tarik datanya

Ambil neraca kas per tanggal, daftar umur piutang, daftar utang, dan biaya tetap berulang. Sebut
sumber mana yang dipakai di keluaran, karena itu memengaruhi lebar pita keyakinan.

## Langkah 3 — Hitung kebiasaan waktu pembayaran

Untuk tiap pelanggan (atau sumber pemasukan): rata-rata jeda pembayaran dan simpangan bakunya dari
6-12 pelunasan terakhir. Simpangan baku itu yang menentukan lebar pita keyakinan.

Kalau pelunasan kurang dari tiga, pakai rata-rata populasi sebagai titik taksiran dan pita ±30%
sebagai bawaan. Kalau riwayatnya cukup, hitung pitanya dari variasi nyata, jangan diasumsikan ±30%.

## Langkah 4 — Bangun ramalan 30/60/90 hari

| Baris | Cara |
|---|---|
| Arus masuk | piutang yang jatuh tempo di jendela itu, disesuaikan rata-rata jeda pembayaran |
| Arus keluar | utang yang jatuh tempo di jendela itu + biaya tetap di jendela itu |
| Posisi kas neto | arus masuk - arus keluar |
| Pita keyakinan | rata-rata berbobot simpangan baku jeda sebagai persen dari arus masuk |

```
band_pct = rata2_berbobot_simpangan_hari / rata2_jeda_hari
bawah    = kas_neto x (1 - band_pct)
atas     = kas_neto x (1 + band_pct)
```

Bulatkan satu angka di belakang koma. Batasi maksimal ±50%: variasi lebih besar dari itu berarti
datanya terlalu tipis untuk dimodelkan, tandai saja daripada memaksakan angka.

## Langkah 5 — Tandai risiko bernama

- **Pembayar lambat**: "Pelanggan X biasanya telat 18 hari; faktur Rp 8.400.000-nya bergeser keluar dari jendela 30 hari ke hari ke-48."
- **Krisis payroll**: "Payroll Rp 22.000.000 jatuh 15 April. Saldo awal Rp 31.000.000 pada 1 April, plus arus masuk, minus arus keluar, membuat kas batas bawah 14 April Rp 19.200.000. Risiko kurang Rp 2.800.000." Butuh saldo bersumber.
- **Data tipis**: "Cuma dua pelunasan tercatat untuk pelanggan Y, pita keyakinan disetel bawaan ±30%."
- **Tanpa saldo awal**: "Saldo kas awal tidak diketahui, jadi kas di tangan tidak dihitung di daftar risiko."

Batasi lima risiko teratas menurut dampak Rupiah terbesar.

## Langkah 6 — Sajikan

Ringkasan obrolan selalu: baris judul dengan rentang tanggal, sumber yang dipakai, saldo awal, lalu
tabel ramalan.

| Jendela | Perkiraan | Batas bawah | Batas atas |
|---|---|---|---|
| 30 hari neto | Rp X | Rp X | Rp X |
| 60 hari neto | Rp X | Rp X | Rp X |
| 90 hari neto | Rp X | Rp X | Rp X |

Lalu daftar risiko pendek. Kalau preferensi keluaran meminta berkas, sediakan juga dalam bentuk itu.

## Gerbang persetujuan

Skill ini hanya membaca, jadi tidak ada gerbang sebelum menghasilkan ramalan. Setelah menyajikan,
ingatkan: ramalan ini berdasar sumber yang disebut, bukan pengganti nasihat akuntansi. Verifikasi ke
pembukuan sebelum mengambil keputusan pembiayaan.

## Yang tidak boleh dilakukan

- **Jangan mengarang saldo awal.**
- **Jangan menyimpulkan jeda pembayaran tanpa riwayat.** Kalau riwayatnya tidak ada, pakai pita bawaan dan sebut itu.
- **Jangan mencampur angka dari dua sumber berbeda** untuk hal yang sama.
- **Jangan menjanjikan uang yang belum masuk sebagai uang yang sudah masuk.** Yang terproyeksi diberi label terproyeksi.
- **Jangan menulis angka yang tidak dibaca dari hasil alat** di giliran yang sama.

## Setelah dijalankan

Kalau tanda krisis payroll muncul, lanjutkan ke `{{slug}}-plan-payroll`. Kalau pertanyaannya "siapa yang
berutang", jalankan penagihan piutang untuk menarik pelunasan lebih awal.
