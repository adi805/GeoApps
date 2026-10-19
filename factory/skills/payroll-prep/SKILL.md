---
name: {{slug}}-payroll-prep
description: Siapkan satu putaran payroll {{proyek}} sebelum satu rupiah pun keluar: kunci periode, kumpulkan absensi, jumlahkan upah dan lembur, tandai setiap anomali, lalu tahan di gerbang persetujuan. Pakai saat payroll akan dijalankan, saat memeriksa absensi, saat ada lonjakan upah, atau saat menyiapkan slip gaji.
---

<!-- Sumber: small-business/skills/payroll-prep @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk konteks Indonesia dan modul {{proyek}} -->

# Penyiapan Payroll

Betulkan jam dan upahnya sebelum ada yang dibayar.

Payroll itu alur keuangan dengan ruang salah paling sempit. Faktur yang salah bisa dibetulkan minggu
depan. Slip gaji yang salah itu orang yang tidak bisa membayar sewa, dan itu cara tercepat kehilangan
kru. Semua di skill ini dibangun di atas asimetri itu: mesin yang menyusun dan memeriksa, owner yang
memutuskan.

## Langkah 1 — Kunci periode sebelum apa pun

Pastikan tanggal awal dan akhir periode, tanggal bayar, dan siapa saja yang masuk putaran ini.
Periode yang salah menggandakan atau melewatkan satu periode gaji orang, dan itu gampang terjadi
kalau periodenya melewati batas bulan.

Pastikan rosternya juga: karyawan baru yang masuk di tengah periode, yang berhenti, dan yang sedang
cuti atau sakit.

## Langkah 2 — Kumpulkan absensinya

Sumbernya modul absensi PMS: hasil tarikan mesin fingerprint, atau input manual. Normalisasi jadi satu
baris per orang per hari: tanggal, jam masuk, jam keluar, istirahat, jam kerja, jam lembur, dan
cuti/izin.

**Tidak ada punch yang boleh diisi dengan tebakan.** Shift dengan jam masuk tapi tanpa jam keluar
berarti jamnya tidak diketahui, dan yang dilaporkan adalah jam yang tidak diketahui itu, bukan
tebakan yang kelihatan masuk akal.

## Langkah 3 — Jumlahkan upahnya

Hitung per orang: upah pokok, tunjangan tetap, upah lembur, potongan absen, dan potongan lain. Lalu
per departemen, lalu untuk seluruh putaran.

**Acuan umum di Indonesia. Konfirmasi dulu ke kebijakan perusahaan, jangan diasumsikan:**

| Komponen | Acuan umum |
|---|---|
| Upah per jam lembur | 1/173 x upah sebulan |
| Lembur hari kerja | jam ke-1 1,5x upah/jam, jam berikutnya 2x |
| Lembur hari libur | kelipatan berbeda, cek kebijakan dan aturan yang berlaku |
| BPJS Kesehatan | 4% perusahaan + 1% karyawan, ada batas atas upah |
| BPJS JHT | 3,7% perusahaan + 2% karyawan |
| BPJS JP | 2% perusahaan + 1% karyawan, ada batas atas upah |
| BPJS JKK | 0,24%-1,74% perusahaan, tergantung tingkat risiko |
| BPJS JKM | 0,3% perusahaan |
| PPh 21 | skema tarif efektif bulanan untuk karyawan tetap, perhitungan tahunan untuk yang bukan karyawan tetap |
| THR | wajib, minimal satu kali upah sebulan untuk masa kerja 12 bulan atau lebih, prorata kalau kurang |

Kalau kebijakan perusahaan tidak jelas, sebut aturan mana yang dipakai. Jangan diam-diam memilih.

## Langkah 4 — Tandai setiap anomali

Ini inti skill-nya. Munculkan semuanya, masing-masing dengan nama orangnya, tanggalnya, dan apa yang
persisnya mencurigakan:

- Punch hilang dan shift tanpa jam keluar
- Lembur di atas pola normal orang itu, dengan kedua angkanya
- Nol jam untuk orang yang biasanya bekerja
- Jam jauh di atas jadwal
- Perubahan upah atau tunjangan sejak putaran terakhir
- Entri ganda atau bertumpang tindih
- Cuti di luar saldo yang tersedia
- Orang yang dibayar periode lalu tapi hilang di periode ini
- Orang baru muncul tanpa catatan masuk
- Potongan BPJS atau PPh 21 yang bergeser tanpa perubahan upah

**Tanda ini dikirim ke owner, tidak pernah dibetulkan diam-diam.** Punch yang hilang punya jawaban
nyata yang hanya diketahui karyawan dan owner. Tebakan di tengah situ jadi slip gaji yang salah tapi
tampak benar di laporan.

## Langkah 5 — Tunjukkan putarannya sebelum disetujui

Sajikan lembar putaran: per orang, jam per jenis, upah bruto, potongan, upah neto, dan setiap tanda
yang menempel pada orangnya. Lalu totalnya: total jam, total bruto, total potongan karyawan, total
kontribusi perusahaan, total uang yang keluar, dan tanggal bayar.

Bandingkan dengan periode sebelumnya dan jelaskan setiap pergerakan di atas 10%.

Kalau data kas tersedia, sebut apakah putaran ini tertutup. Kalau tidak tersedia, bilang terus
terang, jangan memberi kesan aman.

## Langkah 6 — Selesaikan tanda satu per satu

Bahas tiap tanda dengan owner. Untuk masing-masing: apa yang ditemukan, apa artinya kalau dibiarkan,
dan apa yang dia mau. Catat jawabannya, lalu terapkan.

Jangan menggabungkan tanda jadi satu pertanyaan "sudah oke?". Tiap tanda itu upah seseorang.

## Langkah 7 — Gerbang persetujuan

**Tidak ada yang dijalankan sebelum owner menyetujui secara eksplisit.**

Sebutkan terus terang sebelum bertanya: jumlah orang, total jam, total bruto, total uang yang keluar
dari rekening, tanggal bayar, dan jumlah tanda yang dipilih untuk dibiarkan terbuka.

Lalu tanya. Owner yang mau melewati gerbang ini diberi tahu sekali, tanpa menggurui, bahwa putaran
yang salah tidak bisa ditarik kembali setelah transfernya masuk.

**Yang menekan tombol kirim adalah owner, bukan skill ini.**

## Langkah 8 — Sinkron ke pembukuan

Setelah putaran dijalankan, catat jurnalnya: upah bruto, kontribusi perusahaan, dan alokasi tenaga
kerja ke pekerjaan kalau perusahaan melacaknya. Pastikan angkanya cocok dengan yang benar-benar
dijalankan, bukan dengan yang diusulkan. Keduanya beda kalau owner mengubah sesuatu di langkah
terakhir.

## Yang tidak boleh dilakukan

- **Jangan menebak punch, upah, atau klasifikasi.** Jam yang tidak diketahui disebutkan dengan nama orang dan tanggalnya.
- **Jangan membetulkan anomali diam-diam,** walau kelihatannya jelas. Owner mungkin tahu sesuatu yang lo tidak tahu.
- **Jangan menjalankan payroll.** Susun dan tahan; owner yang menekan tombolnya.
- **Jangan mengubur tanda di dalam ringkasan.** Tempelkan tiap tanda pada orang yang terdampak.
- **Jangan membatch pemeriksaan tanda.** Satu keputusan per orang per masalah.
- **Jangan percaya sumber absensi yang belum terbukti berisi.** Cek jumlah barisnya dulu; status "terhubung" bukan data.
- **Jangan menyalin NIK, NPWP, tanggal lahir, alamat, atau nomor rekening** ke lembar putaran, ke obrolan, atau ke halaman yang dirender.

## Keluaran

Lembar putaran tervalidasi: per orang jam dan upahnya, potongan, neto, plus panel tanda per orang,
plus blok total. Formatnya ikut preferensi yang sudah disimpan; kalau tidak ada, pakai satu halaman
yang bisa dibaca sekali lihat.

## Setelah putaran

Putaran jalan, tanda selesai, jurnal tercatat. Langkah berikutnya biasanya "apakah kasnya cukup":
skill `{{slug}}-plan-payroll` menjalankan ramalan kas di depan putaran berikutnya.
