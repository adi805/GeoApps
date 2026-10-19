---
name: {{slug}}-plan-payroll
description: Jalankan rantai keyakinan payroll dari hulu ke hilir: ramalkan kas di jendela payroll, urutkan dan susun pengingat piutang untuk menutup selisihnya, lalu siapkan putaran payroll. Rantai ini tidak pernah menekan tombol kirim payroll. Pakai saat payroll jadi kekhawatiran, termasuk "apakah kasnya cukup", "payroll jatuh hari Jumat", atau "rencanakan payroll".
---

<!-- Sumber: small-business/skills/plan-payroll @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk konteks Indonesia dan modul {{proyek}} -->

# Rencana Payroll

Tiga langkah berurutan: pastikan payroll tertutup, tutup selisihnya kalau tidak, lalu jalankan.

Owner tidak menanyakan dua hal terpisah di sini. "Apakah kasnya cukup" dan "jalankan payroll" itu satu
kekhawatiran, dan memisahkannya jadi dua sesi adalah cara putaran dijalankan jam 11 malam tanpa ada
yang memeriksa saldo dulu.

Argumen: `--horizon` (bawaan 30 hari) dan `--tanggal-payroll` (bawaan: tanggal bayar terjadwal
berikutnya).

## Langkah 1 — Apakah payroll tertutup?

Panggil `{{slug}}-cash-flow-snapshot`. Itu yang memiliki matematika ramalan, pita keyakinan, dan jalur
cadangan berkas. Jangan dibangun ulang di sini.

- **Masuk**: horizon dan tanggal payroll
- **Keluar**: ramalan 30/60/90 hari, tanda risiko bernama, ringkasan obrolan

Sebut putusannya dalam satu baris sebelum apa pun: tertutup, mepet, atau kurang sekian rupiah pada
tanggal sekian.

**Gerbang.** Kalau payroll tertutup dengan nyaman, tanyakan apakah langkah penagihan dilewati dan
langsung ke penyiapan putaran. Kalau ada selisih, sajikan dan tunggu perintah eksplisit sebelum
Langkah 2.

## Langkah 2 — Tutup selisihnya

Urutkan piutang yang lewat jatuh tempo, lalu susun draf pengingat per faktur. Kaitkan urutannya ke
Langkah 1: tunjukkan mana yang tertagih di dalam horizon, dan apakah itu benar-benar menutup selisih
payroll. Pengingat yang baru dibayar 45 hari lagi tidak membantu putaran hari Jumat, katakan itu.

**Gerbang: tidak ada yang terkirim tanpa persetujuan.** Draf saja sampai owner bilang kirim, per
pengingat atau sekaligus.

## Langkah 3 — Siapkan putarannya

Panggil `{{slug}}-payroll-prep`. Itu yang memiliki penyiapan periode, penjumlahan jam, pemeriksaan
anomali, dan sinkron pembukuan.

Bawa hasil Langkah 1, jangan dihitung ulang. Satu set angka kas, dari satu tempat.

**Gerbang: tanda satu per satu.** Jangan digabung jadi satu "sudah oke?". Tiap tanda itu upah
seseorang.

**Gerbang: putaran itu sendiri.** Yang menekan tombol kirim adalah owner. Skill ini menyusun dan
menahan.

## Langkah 4 — Tutup lingkarannya

Satu rekap, dengan urutan ini: putusan kas, apa yang dikirim dan ke siapa, posisi terproyeksi kalau
pengingatnya masuk, lalu putaran yang disiapkan (jumlah orang, total jam, total bruto, uang yang
keluar, tanggal bayar, dan tanda yang dibiarkan terbuka).

Contoh bentuknya, empat baris: kas kurang Rp 4.200.000 pada tanggal 15, tiga pengingat terkirim
menutup Rp 6.800.000, dua kemungkinan masuk di dalam jendela, putaran disiapkan untuk 9 orang
Rp 18.340.000 dengan satu punch hilang masih terbuka.

## Yang tidak boleh dilakukan

- **Jangan menjalankan payroll.** Rantai ini menyiapkan; owner yang mengirim.
- **Jangan mengirim pengingat tanpa persetujuan.**
- **Jangan melewati Langkah 1** walau owner minta "langsung jalankan payroll". Pemeriksaan kas itu tiga puluh detik, dan itulah alasan rantai ini ada.
- **Jangan menghitung ulang ramalan di Langkah 3.** Satu set angka kas, dari satu tempat.
- **Jangan membatch pemeriksaan anomali.**
- **Jangan menjanjikan uang yang belum masuk sebagai uang yang sudah masuk.** Yang terproyeksi diberi label terproyeksi.
- **Jangan menyalin NIK, NPWP, tanggal lahir, alamat, atau nomor rekening** di keluaran rantai ini.

## Setelah rantai

Payroll tertutup, pengingatnya keluar, putarannya disiapkan untuk dikirim owner. Langkah berikutnya
biasanya sisi vendor: membayar utang usaha dengan gambaran kas yang sama.
