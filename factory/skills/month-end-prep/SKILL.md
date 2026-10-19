---
name: {{slug}}-month-end-prep
description: Rekonsiliasi buku terhadap rekening koran dan berkas pelunasan, tandai transaksi yang perlu perhatian, duplikat mencurigakan, dan bukti yang hilang, lalu tulis narasi laba rugi dan susun paket tutup buku. Pakai saat pemilik hanya ingin rekonsiliasi tanpa ramalan, bertanya "apa yang hilang dari buku", atau minta narasi laba rugi bulan ini.
---

<!-- Sumber: small-business/skills/month-end-prep @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang: konektor pihak ketiga dibuang, sumbernya modul {{proyek}} -->

# Persiapan Tutup Buku

Ini mata pertama dari rantai `{{slug}}-close-month`. Kalau permintaannya "tutup bulan", jalankan
rantai itu. Skill ini dipakai langsung hanya saat pemilik ingin rekonsiliasinya saja, tanpa
pembaruan ramalan dan tanpa penyebaran paket.

## Alur kerja

Kerjakan berurutan. Tiap langkah punya keadaan selesai; jangan maju sebelum langkah sekarang
beres.

### Langkah 1 — Sepakati bulan sasarannya

Tanyakan bulan mana yang ditutup. Bawaan: bulan kalender sebelumnya. Pastikan dulu sebelum menarik
data apa pun.

### Langkah 2 — Tarik laba rugi dan daftar transaksinya

Ambil laba rugi bulan sasaran (pendapatan, beban pokok, marjin bruto, beban usaha, laba bersih) dan
daftar transaksinya.

Tandai segera transaksi yang perlu perhatian: baris belum terkategori, baris kosong, dan transaksi
yang masih bertanda perlu ditinjau.

Sajikan jumlahnya ("14 transaksi perlu perhatian") dan daftarkan supaya pemilik menuntaskannya di
modul sebelum lanjut. Jangan maju dengan pos terbuka kecuali pemilik eksplisit bilang "lewati dulu".

### Langkah 3 — Cocokkan pelunasan dengan buku

Tarik berkas pelunasan (rekening koran bank dan laporan pelunasan dari penyedia pembayaran) untuk
bulan kalender yang sama.

**Periksa mutasi bank dulu.** Kalau pelunasan penyedia masuk lewat mutasi bank, pelunasan itu sudah
jadi baris di buku dan pertanyaannya tinggal apakah sudah dicocokkan. Daftarkan baris bank yang belum
dicocokkan itu sebagai butir tindakan sebelum melakukan pencocokan berkas.

**Bandingkan neto lawan neto, atau setiap baris akan terlihat rusak.** Buku mencatat setoran bank
neto; laporan penyedia menampilkan penjualan bruto. Dicocokkan langsung, setiap baris akan
menunjukkan selisih sebesar biaya layanannya. Pakai nilai pelunasan neto, yaitu bruto dikurangi
biaya.

| Hasil | Perlakuan |
|---|---|
| Nilai dan tanggal cocok dalam 2 hari | tandai cocok |
| Selisih kecil (pembulatan atau biaya) | catat, jangan tandai |
| Selisih di atas ambang kecil | tandai beserta nilai selisihnya |
| Pelunasan ada, setoran di buku tidak ada | tandai "hilang dari buku" |
| Setoran di buku ada, pelunasan tidak ada | tandai "tidak ada di data pelunasan" |
| Penyedia tidak mengembalikan pelunasan apa pun untuk periode itu | perlakukan sebagai celah data, bukan nol yang bersih: sebut penyedianya mengembalikan kosong, minta berkasnya, dan sebut celah itu di laporan |

### Langkah 4 — Deteksi duplikat mencurigakan

Pindai daftar transaksi untuk kemungkinan tagihan atau setoran ganda. Tandai sebagai duplikat
mencurigakan kalau **ketiganya** cocok: nilainya sama (selisih di bawah ambang pembulatan), nama
vendor atau pelanggannya sama, dan diposting dalam 5 hari kalender satu sama lain.

Sajikan pasangan yang ditandai. Pemilik yang memutuskan mana yang wajar (misalnya langganan mingguan)
dan mana duplikat yang perlu dibatalkan.

**Jendela 5 hari itu penyaring, bukan jaminan.** Jendela itu menangkap tagihan yang terketik dua kali
tanpa menenggelamkan pemilik dalam tagihan berulang, tapi pembayaran ganda yang berjarak tiga minggu
lolos. Sebut apa yang dipindai ("pengulangan dalam 5 hari"), dan lebarkan jendelanya untuk vendor
yang dicurigai, jangan mengklaim bersih.

### Langkah 5 — Periksa bukti

Periksa modul dulu: lampiran pada transaksi dihitung sebagai bukti yang ada. Lalu, kalau ada folder
bukti, pindai folder itu untuk bulan sasaran.

Untuk tiap transaksi beban di atas ambang kecil tanpa dokumen terlampir: cari berkas bukti yang
cocok (nilainya dalam toleransi kecil dan tanggalnya dalam 3 hari). Kalau cocok, catat "bukti ada";
kalau tidak, tandai "bukti hilang".

Daftarkan bukti yang hilang. Pemilik bisa menyediakan berkasnya atau menandainya "bukti tidak
diperlukan" (misalnya pembayaran otomatis berulang). Kalau folder bukti tidak bisa dipindai, minta
pemilik mengonfirmasi status bukti tiap beban yang ditandai. Jangan melewati langkah ini diam-diam.

### Langkah 5a — Silang periksa payroll

Jalan hanya kalau modul payroll ada isinya untuk bulan itu. Kalau tidak, lewati dan sebut bahwa
paketnya tidak membawa kolom payroll.

Tarik apa yang benar-benar dibayarkan bulan itu, **total saja**: upah bruto, kontribusi perusahaan,
potongan karyawan, dan upah neto, dari putaran payroll yang tanggal bayarnya jatuh di bulan sasaran.

Silang periksa ke buku: upah neto ditambah kontribusi perusahaan harus muncul sebagai baris beban
payroll bulan itu. Selisih di atas ambang kecil adalah pos rekonsiliasi, biasanya putaran yang
tercatat di bulan yang salah atau jurnal payroll yang belum diposting.

**Total saja, jangan per orang.** Paketnya membawa total bulan itu dan jumlah putarannya. Tidak ada
nama, tarif, atau nilai per orang yang keluar dari modul payroll.

### Langkah 6 — Gerbang persetujuan pemilik

Sajikan ringkasannya sebelum lanjut:

```
Perlu perhatian (belum terkategori atau belum cocok):  X dari X selesai
Selisih pelunasan:                                     X ditandai, X selesai
Duplikat mencurigakan:                                 X ditandai, X dibersihkan
Bukti hilang:                                          X masih terbuka
Silang periksa payroll:                                cocok / selisih X / tidak ada putaran
```

Tanya: "Siap tulis ringkasan laba rugi dan susun paket tutup bukunya?"

**Jangan lanjut ke Langkah 7-8 tanpa konfirmasi eksplisit.**

### Langkah 7 — Tulis narasi laba rugi

Tulis ringkasan bahasa biasa untuk bulan itu, jenis yang dibagikan pemilik ke pasangannya atau ke
akuntannya, bukan memo direktur keuangan. Sasaran 150-250 kata.

1. **Judul**: satu kalimat, misalnya "Maret ditutup Rp 12.400.000 bersih, naik 6% dari Februari."
2. **Pendapatan**: apa yang menggerakkannya; sebut produk, jasa, atau pelanggan kalau datanya menunjukkan pemusatan.
3. **Marjin bruto**: bertahan, naik, atau menyusut, dan alasan utamanya.
4. **Beban kunci**: pos yang bergerak lebih dari 10% dibanding bulan lalu atau di luar rentang wajar, satu kalimat masing-masing.
5. **Hasil akhir**: laba bersih dibanding bulan sebelumnya.
6. **Daftar pantau**: satu sampai tiga hal untuk dipantau bulan depan.

Hindari jargon, atau jelaskan kalau terpaksa dipakai.

### Langkah 8 — Susun paket tutup buku

Hasilkan dua berkas:

- `paket-tutup-buku-[YYYY-MM].xlsx`: lembar laba rugi, lembar rekonsiliasi (transaksi cocok dan ditandai berdampingan), lembar butir tindakan, dan lembar payroll (total Langkah 5a berdampingan dengan beban payroll di buku, beserta selisihnya).
- `paket-tutup-buku-[YYYY-MM]-ringkasan.pdf`: satu halaman berisi bulan dan nama perusahaan, angka kunci (pendapatan, marjin bruto, laba bersih), narasi laba rugi dari Langkah 7, dan jumlah butir tindakan yang masih terbuka.

Simpan keduanya ke path yang ditentukan pemilik, dan konfirmasi pathnya.

### Langkah 9 — Setelah tutup buku

Sebut dalam satu baris apa yang sudah ditutup dan apa yang masih terbuka. Lalu tawarkan langkah
berikutnya yang paling relevan: ramalan kas dari angka yang baru ditutup (`{{slug}}-cash-flow-snapshot`),
atau penagihan piutang. Paling banyak tiga tawaran, dan jangan mengulang tawaran yang sudah ditolak.

## Gerbang persetujuan

- **Jangan merekonsiliasi bulan yang sudah dilaporkan.** Pastikan bukunya masih terbuka sebelum menarik data.
- **Jangan membatalkan atau mengubah transaksi di buku secara langsung.** Munculkan tandanya; pemilik yang mengubah.
- **Selalu berhenti di Langkah 6** sebelum menghasilkan keluaran. Pos yang belum selesai harus diakui atau dilewati secara eksplisit.
- **Jangan menyalin upah per orang, NIK, atau nomor rekening** di paket tutup buku di luar total jurnalnya.

## Kalau sumber datanya tidak lengkap

| Yang kurang | Ganti dengan |
|---|---|
| Daftar transaksi | minta ekspor transaksi per akun untuk bulan itu |
| Rekening koran | minta berkas rekening koran bank; kalau ada, sebut bahwa sisi bank diambil dari berkas, bukan dari feed |
| Laporan pelunasan penyedia | minta ekspor pelunasan dari situs penyedianya; wajib memuat kolom biaya, bukan cuma bruto, atau pencocokan neto lawan neto di Langkah 3 tidak bisa dikerjakan |
| Penyedia mengembalikan nol pelunasan | perlakukan sebagai celah data, bukan nol bersih; minta ekspornya dan sebut celahnya |
| Putaran payroll | lewati Langkah 5a; paketnya tidak punya lembar payroll dan ringkasannya menyebut tidak ada data payroll |
| Folder bukti | minta pemilik mengonfirmasi status bukti tiap beban yang ditandai |

## Aturan angka

Tiap angka harus dibaca dari hasil alat di giliran yang sama. Kalau kueri atau ekspornya gagal,
angkanya belum ada: jangan diisi angka yang seharusnya.
