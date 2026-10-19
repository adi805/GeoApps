---
name: {{slug}}-restock
description: Ubah penjualan yang benar-benar terjadi jadi keputusan pesan ulang dan catat sampai ke buku: hitung kecepatan penjualan dan tanggal kehabisan per barang, tentukan jumlah pesan ulang, susun pesanan pembelian dan surel vendor, lalu catat memo berkode supaya tagihannya nanti bisa dicocokkan ke pesanannya. Pakai saat pemilik bilang "restok", "draft PO untuk supplier", atau "berapa uang yang menganggur di gudang".
---

<!-- Sumber: small-business/skills/restock @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang ke modul gudang dan kas-bank {{proyek}} -->

# Restok

Rantai dua langkah supaya pesan ulang berakhir di buku, bukan di surel yang terlupakan:
`{{slug}}-inventory-planner` memutuskan apa yang dibeli, lalu tahap pencatatan menyiapkan berapa
biayanya.

Celah yang ditutup ini kecil dan mahal. Pesan ulangnya dihitung, PO-nya disusun, surelnya dikirim,
lalu tidak ada yang tercatat di mana pun. Enam minggu kemudian tagihannya datang dan tidak ada yang
bisa memastikan apakah harga atau jumlahnya benar.

## Langkah 1 — Tentukan apa yang dibeli

Jalankan `{{slug}}-inventory-planner`.

- **Masuk**: riwayat penjualan dan stok di tangan dari modul gudang, atau CSV keduanya
- **Keluar**: kecepatan 7 dan 28 hari per barang, tanggal kehabisan yang konservatif, jumlah pesan ulang 60 hari beserta biayanya, dan daftar barang lambat yang terpisah

Semua matematikanya milik `{{slug}}-inventory-planner`. Jangan diulang di sini.

Dua aturannya cukup penting untuk disebut di rantai ini:

- **Barang berkecepatan nol tidak pernah jadi kandidat pesan ulang.** Barang itu lewat sebagai barang lambat beserta uang yang tertahan. Tidak ada penjualan berarti berhenti membeli.
- **Periode kehabisan stok bukan permintaan nol.** Itu permintaan yang tertahan, dan memperlakukannya sebagai nol membuat barang itu terus dipesan kurang.

**Gerbang: daftar belinya.** Tunjukkan total Rupiah dan jumlah barang yang akan segera habis sebelum
apa pun disusun. Pemilik menyetujui daftarnya, memangkasnya, atau mengubah jumlahnya. Tiap baris
membawa kecepatan, hari cakupan, waktu tunggu, jumlah, dan biayanya.

## Langkah 2 — Susun PO dan surel vendornya

Untuk baris yang disetujui, susun satu pesanan pembelian per vendor beserta surel pendampingnya,
dalam nada pemilik.

**Gerbang: keduanya menunggu persetujuan eksplisit, terpisah dari Langkah 1.** Menyetujui daftar beli
itu menyetujui apa yang dipesan. Mengirim PO itu mengikat uang dan membelanjakan hubungan dengan
vendornya. Sebut vendor, pos-posnya, dan totalnya sebelum bertanya.

Tanpa koneksi surel, PO dan surelnya jadi berkas yang dikirim pemilik dengan tangan. Itu hasil yang
lengkap, bukan hasil yang kurang.

## Langkah 3 — Tinggalkan catatan yang bisa dicocokkan tagihan nanti

Dua hal berbeda terjadi di sini, dan penting siapa yang memiliki yang mana.

**PO-nya sendiri dipegang langkah Langkah 2.** PO yang disetujui adalah dokumennya: vendor, pos-pos,
jumlah, harga, dan tanggal perkiraan datang. Itu catatan tentang apa yang dipesan.

**Yang dicatat ke modul utang usaha adalah memo berkodenya**, bukan PO-nya. Serahkan vendor, nomor PO,
total, tanggal perkiraan, serta akun, pusat biaya, dan pekerjaan tempat belanja itu dibebankan. Modul
utang usaha tidak membuat PO di buku; ia membaca PO saat tagihannya datang, untuk mencocokkan tagihan
lawan PO lawan bukti penerimaan. Yang dibutuhkannya dari langkah ini adalah catatan berkode yang
duduk di tempat pencocokan itu akan mencarinya.

- **Masuk**: vendor, nomor PO, total, tanggal perkiraan, dan pengodeannya
- **Keluar**: memo berkode yang tercatat pada vendornya, supaya saat tagihannya datang enam minggu kemudian harga dan jumlahnya bisa dicek terhadap apa yang benar-benar disetujui

**Gerbang: persetujuan pengodeannya.** Tidak ada yang dicatat ke buku sebelum pemilik bilang ya, dan
yang dicatat adalah utang, bukan pembayaran. **Tidak ada uang yang berpindah di rantai ini sama
sekali**; pembayaran atas barang yang datang itu urusan terpisah.

Kalau kodenya belum pasti untuk vendor baru, tanyakan daripada menebak. Satu pertanyaan sekarang lebih
baik daripada satu tahun salah kode.

Tanpa data buku yang lengkap, memo berkodenya keluar sebagai berkas impor dan ringkasan di samping
PO-nya. Pencocokan tiga arahnya tetap terjadi nanti, dengan tangan, terhadap catatan yang ada.

## Langkah 4 — Jadikan irama

Kalau kalender tersedia, tawarkan sekali, setelah restok yang pemilik rasa berguna, untuk memasang
blok berulang bagi keputusan pesan ulangnya. Ini jauh lebih baik sebagai irama daripada sebagai
kebakaran yang dipadamkan. Tawarkan sekali. Kalau ditolak atau didiamkan, hentikan tawaran itu.

## Jalur cadangan

CSV penjualan plus hitungan stok itu masukan yang didukung penuh. Banyak usaha menghitungnya di atas
kertas, dan itu data yang sah. Kecepatan, tanggal kehabisan, jumlah pesan ulang, PO, dan surel
vendornya keluar sama. Catatan bukunya jadi berkas impor.

## Yang tidak boleh dilakukan

- **Jangan mengirim PO atau surel vendor tanpa persetujuan.** Yang satu membelanjakan uang, yang lain membelanjakan hubungan baik.
- **Jangan memperlakukan persetujuan daftar beli sebagai persetujuan mengirim.** Dua gerbang, dua keputusan.
- **Jangan memesan ulang barang berkecepatan nol.**
- **Jangan menentukan jumlah pesan ulang tanpa mengurangi stok yang sudah dalam perjalanan.**
- **Jangan mengarang kecepatan, waktu tunggu, atau tanggal kehabisan.** Riwayat yang kurang dilaporkan per kode barang.
- **Jangan membayar apa pun di sini.** PO disiapkan, tidak dibayar.
- **Jangan melaporkan unit tanpa Rupiah.** Pemilik memutuskan soal kas, bukan soal keping.

## Keluaran

Rencana pesan ulang: total yang diikat sebagai angka utama, tiap kode barang satu baris dengan
kecepatan, tanggal kehabisan, dan jumlah pesan ulangnya, plus penanda untuk apa pun yang sudah dalam
perjalanan. Dokumen PO dan berkas impornya menyertai sebagai berkas kerja, bukan hasil kedua. Kalau
preferensi keluaran meminta bentuk lain, sediakan juga dalam bentuk itu.

## Setelah dijalankan

PO-nya sudah keluar dan catatan berkodenya menunggu tagihannya cocok. Saat tagihannya datang,
langkah berikutnya adalah mencocokkan dan membayar. Di dekatnya juga ada
`{{slug}}-cash-flow-snapshot` untuk melihat dampak pesanan yang sudah diikat ke 60 hari ke depan, dan
`{{slug}}-close-month` saat periodenya berakhir. Paling banyak tiga tawaran.
