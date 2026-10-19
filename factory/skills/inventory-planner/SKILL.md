---
name: {{slug}}-inventory-planner
description: Hitung apa yang perlu dipesan ulang dan kapan, dari penjualan yang benar-benar terjadi: hitung kecepatan penjualan 7 hari dan 28 hari per barang, proyeksikan tanggal kehabisan stok, tentukan jumlah pesan ulang 60 hari, dan susun draf pesanan pembelian beserta surel vendornya. Pakai saat stok jadi bahasan, termasuk "apa yang perlu dipesan ulang", "apakah akan kehabisan", atau "berapa uang yang menganggur di gudang".
---

<!-- Sumber: small-business/skills/inventory-planner @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang ke modul gudang {{proyek}} -->

# Perencana Persediaan

Beli yang terjual, sebelum kehabisan, dan berhenti membeli yang tidak terjual.

Stok itu kas yang sudah dibelanjakan pemilik. Dua hal yang salah: kehabisan barang yang dicari
pelanggan, dan menumpuk barang yang tidak ada yang mau. Keduanya terlihat di riwayat penjualan jauh
sebelum jadi masalah, dan itu yang dibaca skill ini.

## Langkah 1 — Ambil data penjualan dan stok

Sumbernya modul gudang PMS: kartu stok untuk pergerakan masuk dan keluar, BPB-OUT untuk penjualan,
BPB-IN untuk penerimaan, dan stok akhir per barang.

Bentuk cadangan yang tetap didukung: ekspor CSV riwayat penjualan plus hitungan stok di tangan.

Yang dibutuhkan per barang: kode barang, nama, jumlah terjual per tanggal, stok di tangan saat ini,
harga pokok satuan, harga jual satuan, vendor, dan waktu tunggu (lead time) kalau diketahui. Waktu
tunggu yang belum ada ditanyakan sekali lalu diingat.

**Sebut hitungan stoknya per tanggal berapa.** Angka stok yang umurnya dua minggu menghasilkan
tanggal kehabisan yang salah dua minggu juga.

## Langkah 2 — Hitung kecepatan penjualan, dua jendela

Untuk tiap barang:

- **Kecepatan 7 hari** — unit per hari selama sepekan terakhir. Menangkap apa yang terjadi sekarang.
- **Kecepatan 28 hari** — unit per hari selama empat pekan. Garis dasar yang stabil.

Keduanya penting, dan ketidakcocokan di antara keduanya itu informasi. Barang yang pekan ini terjual
tiga kali laju 28 harinya itu sedang naik tren, atau cuma satu pesanan borongan, dan keduanya butuh
respons berbeda.

Keluarkan distorsi sekali jalan dari garis dasarnya kalau bisa dikenali: satu pesanan grosir, satu
batch yang diretur, atau periode kehabisan stok saat barangnya tidak bisa terjual. **Periode tanpa
penjualan karena stoknya kosong bukan berarti permintaannya nol**, dan memperlakukannya sebagai nol
membuat barang itu terus dipesan kurang selamanya.

## Langkah 3 — Proyeksikan tanggal kehabisan, secara konservatif

Tanggal kehabisan = stok di tangan dibagi kecepatan harian yang paling tidak dipercaya, yaitu yang
lebih tinggi di antara dua jendela.

Lalu bandingkan dengan waktu tunggu. Angka yang penting bukan kapan habis, tapi apakah masih ada
waktu untuk memesan:

| Keadaan | Arti |
|---|---|
| Lewat titik tak bisa kembali | waktu tunggu melebihi hari cakupan; sudah pasti kehabisan, katakan terus terang |
| Pesan sekarang | cakupan tinggal sebesar waktu tunggu plus bantalan keamanan |
| Pesan segera | masih nyaman, tapi masuk siklus berikutnya |
| Aman | tidak perlu tindakan |

**Jangan pernah menyebut tanggal kehabisan untuk barang yang kecepatannya tidak bisa dipercaya.**
Barang baru dengan riwayat dua minggu, dan barang yang penjualannya sempat terganggu, ditandai
"riwayat belum cukup", dengan namanya.

## Langkah 4 — Tentukan jumlah pesan ulang

Sasaran bawaan: **cakupan 60 hari plus waktu tunggu**, dihitung dari **laju 28 hari**, bukan dari
yang lebih cepat. Stoknya harus bertahan sejak hari barang datang sampai pesanan berikutnya datang,
jadi mengabaikan waktu tunggu membuat barangnya kurang persis selama itu tiap siklus. Lalu sesuaikan
dengan ukuran kemasan, jumlah pesanan minimum, dan apa yang sudah dalam perjalanan.

Kedua laju itu punya tugas berbeda dan keduanya disebut di barisnya: yang lebih tinggi menentukan
kapan habis, yang 28 hari menentukan berapa yang dibeli. Menentukan pesanan 60 hari dari lonjakan
sepekan itu cara uang berakhir di palet.

Jangan menentukan jumlah pesan ulang tanpa mengurangi stok yang sudah dalam perjalanan. Memesan
ganda barang yang lambat bergerak itu cara sebuah usaha berakhir dengan stok tiga tahun.

Bulatkan ke ukuran kemasan vendornya dan sebut dibulatkan ke arah mana. Tunjukkan biaya Rupiah tiap
rekomendasi, karena pemilik sedang memutuskan soal kas, bukan soal unit.

## Langkah 5 — Tangani barang yang tidak bergerak

Barang berkecepatan nol dan sangat lambat itu daftar terpisah dengan tujuan terpisah. **Mereka tidak
pernah jadi kandidat pesan ulang.**

- **Kecepatan nol** — tidak ada unit terjual dalam 28 hari. Laporkan sebagai barang lambat beserta uang yang tertahan di dalamnya. **Jangan hitung hari cakupan untuk barang ini**; tidak ada yang terjual, jadi tidak ada yang habis. Satu pengecualian: barang yang sedang musimnya, itu masuk daftar pantau bertanggal, bukan daftar bersihkan.
- **Kelebihan stok** — cakupan lebih dari 120 hari. Laporkan unit berlebih dan nilai Rupiahnya.
- **Stok mati** — tidak ada pergerakan dalam 90 hari. Sarankan dijual murah, dibundel, atau didiskon.

Total uang yang tertahan di daftar ini biasanya angka paling mengejutkan di seluruh laporan, dan
sering yang paling berguna.

## Langkah 6 — Terapkan musiman hanya kalau riwayatnya mendukung

Dengan riwayat setidaknya setahun, bandingkan periode yang akan datang dengan periode yang sama tahun
lalu, lalu sesuaikan.

**Kalau riwayatnya kurang dari setahun, katakan itu dan jangan menyesuaikan.** Pengali musiman yang
dikarang dari sembilan bulan data itu tebakan yang memakai jas. Tanya pemiliknya; dia lebih tahu
musimnya daripada riwayat pendek.

## Langkah 7 — Sajikan daftar belinya

Pimpin dengan total Rupiah dan jumlah barang yang akan segera habis. Lalu: pesan sekarang, pesan
segera, barang lambat, dan barang yang riwayatnya belum cukup untuk dinilai.

Tiap baris membawa angka di belakangnya: kecepatan, hari cakupan, waktu tunggu, jumlah, dan biaya.
Pemilik yang bisa melihat alasannya akan menyetujui dalam satu menit; yang tidak bisa akan membangun
ulang seluruhnya dengan tangan.

## Langkah 8 — Susun draf pesanan pembelian dan surel vendor, dengan persetujuan

Pesanan pembelian itu mengikat uang dan surel vendor keluar atas nama pemilik, jadi keduanya menunggu
persetujuan eksplisit.

Sebutkan vendor, pos-posnya, dan totalnya sebelum bertanya. Susun draf surel vendornya dengan nada
pemilik. Kalau belum ada contoh nadanya, minta tiga surel yang pernah dia kirim ke vendor. Kalau dia
enggan, tulis surelnya netral dan sebut bahwa itu belum dalam nadanya. **Jangan mengarang kepribadian
untuk hubungan pemilik dengan vendornya.**

## Yang tidak boleh dilakukan

- **Jangan mengarang kecepatan, waktu tunggu, atau tanggal kehabisan.** Riwayat yang kurang dilaporkan per kode barang, bukan diratakan.
- **Jangan memperlakukan periode kehabisan stok sebagai permintaan nol.** Itu permintaan yang tertahan, dan itu membiaskan semua perhitungan di hilirnya.
- **Jangan menyarankan pesan ulang untuk barang berkecepatan nol.** Tidak ada penjualan berarti berhenti membeli, bukan beli lebih banyak.
- **Jangan menentukan jumlah pesan ulang tanpa mengurangi stok yang sudah dalam perjalanan.**
- **Jangan menerapkan musiman tanpa riwayat setahun.** Tanya pemiliknya.
- **Jangan mengirim pesanan pembelian atau surel vendor tanpa persetujuan.** Keduanya membelanjakan uang atau membelanjakan hubungan baik.
- **Jangan melaporkan unit tanpa Rupiah.** Pemilik berpikir dalam kas.

## Setelah dijalankan

Tutup dengan satu baris tentang apa yang diputuskan, yaitu total belanja dan barang yang akan segera
habis. Lalu tawarkan langkah berikutnya yang paling relevan, misalnya `{{slug}}-restock` kalau pemilik
ingin pesanannya disusun dan dicatat sampai selesai, atau `{{slug}}-cash-flow-snapshot` untuk melihat
dampak pesanan itu ke 60 hari ke depan. Paling banyak tiga tawaran.
