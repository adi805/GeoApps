---
name: {{slug}}-metrics-review
description: Tinjau dan analisis metrik produk {{proyek}} dengan analisis tren dan temuan yang bisa ditindaklanjuti. Pakai saat menjalankan tinjauan metrik berkala, menyelidiki lonjakan atau penurunan mendadak, membandingkan capaian terhadap target, atau mengubah angka mentah jadi papan skor dengan rekomendasi tindakan.
---

<!-- Sumber: product-management/skills/metrics-review @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Tinjauan Metrik

Tinjau metrik produk, temukan tren, dan tarik temuan yang bisa ditindaklanjuti.

## Alur kerja

### 1. Kumpulkan datanya

Sumber di proyek ini:

| Sumber | Cara |
|---|---|
| Basis data D1 | kueri lewat skill `{{slug}}-write-query`, dari salinan berkas |
| Catatan lintas lane | `factory/ledger.jsonl` |
| Papan tugas | `gh issue list --repo {{repo}}` |

Tanyakan: periode apa yang ditinjau, metrik apa yang difokuskan, target pembandingnya apa, dan ada
kejadian yang bisa menjelaskan perubahan (rilis, gangguan, musim).

### 2. Susun metriknya

Hierarki metrik: satu metrik bintang utara di puncak, indikator kesehatan tingkat 1 (aktivasi,
keterlibatan, retensi, pendapatan, kepuasan), dan metrik diagnostik tingkat 2 untuk menelusuri.

Kalau hierarkinya belum ada, bantu tentukan bintang utaranya dulu sebelum lanjut.

### 3. Analisis trennya

Untuk tiap metrik kunci: nilai sekarang, arah (naik/turun/datar), perbandingan ke target, laju
perubahan (mempercepat atau melambat), dan anomali.

Lalu cari korelasi: apakah perubahan satu metrik bergerak bersama metrik lain? Apakah ada indikator
awal yang mendahului metrik akhir? Apakah agregatnya digerakkan oleh satu segmen saja?

### 4. Susun tinjauannya

- **Ringkasan**: 2-3 kalimat tentang kesehatan produk dan perubahan yang paling menonjol
- **Papan skor**: tabel metrik, nilai sekarang, sebelumnya, perubahan, target, status
- **Analisis tren**: apa yang terjadi, kenapa kemungkinan terjadi, sekali kejadian atau berlanjut
- **Titik terang**: yang melewati target atau trennya bagus
- **Perlu perhatian**: yang meleset atau trennya memburuk, termasuk sinyal awal
- **Tindakan yang disarankan**: penyelidikan yang perlu dijalankan, eksperimen, investasi, alarm
- **Konteks dan catatan**: masalah mutu data, kejadian yang mengganggu keterbandingan

## Papan skor

| Metrik | Sekarang | Sebelumnya | Perubahan | Target | Status |
|---|---|---|---|---|---|
| [metrik] | [nilai] | [nilai] | [+/- %] | [target] | sesuai / berisiko / meleset |

## Contoh metrik untuk produk seperti ini

| Kelompok | Metrik |
|---|---|
| Adopsi | jumlah perusahaan aktif, jumlah pengguna aktif per modul |
| Aktivasi | perusahaan yang menyelesaikan satu siklus penuh (mis. satu periode payroll atau satu tutup buku) |
| Keterlibatan | transaksi per perusahaan per periode, jumlah modul yang dipakai bersamaan |
| Retensi | perusahaan yang masih aktif setelah 3, 6, 12 bulan; churn per periode |
| Kepuasan | jumlah keluhan, waktu penyelesaian keluhan, hasil wawancara pengguna |

Kalau sebuah metrik tidak ada datanya, tulis bahwa belum diukur, jangan diisi taksiran.

## Irama tinjauan

| Irama | Tujuan | Yang ditinjau |
|---|---|---|
| Mingguan | menangkap masalah cepat | metrik bintang utara, pergerakan menonjol, anomali |
| Bulanan | analisis tren lebih dalam | papan skor lengkap, kemajuan terhadap target, adopsi fitur baru |
| Kuartalan | penilaian strategis | tren satu periode, capaian target, apa yang berhasil dan tidak |

## Prinsip papan pantau

1. Mulai dari pertanyaannya, bukan dari datanya. Keputusan apa yang dibantu papan ini?
2. Hierarki: metrik terpenting paling menonjol.
3. Konteks di atas angka. Angka tanpa pembanding tidak berarti.
4. Lebih sedikit metrik, lebih banyak temuan. 5-10 metrik yang penting, sisanya di laporan rinci.
5. Periode waktu konsisten di seluruh metrik.
6. Tiap metrik harus bisa dipengaruhi tim. Kalau tidak bisa ditindaklanjuti, tidak perlu ada di papan.

## Aturan angka

**Tiap angka harus dibaca dari hasil alat di giliran yang sama.** Kalau kuerinya gagal, angkanya
belum ada: jangan diisi angka yang seharusnya. Angka proxy yang membaik bukan bukti tujuannya
membaik, jadi sertakan metrik hasilnya secara terpisah. Kalau sebuah metrik diturunkan dari metrik
lain, tulis definisinya dan pastikan kodenya menghitung definisi itu.

## Tips

1. Mulai dari "jadi apa" — temuan terpenting di paling atas.
2. Waspadai atribusi. Korelasi bukan sebab.
3. Analisis segmen sering menunjukkan agregat menyembunyikan perbedaan penting.
4. Tidak semua pergerakan berarti. Fluktuasi kecil itu derau.
5. Kalau sebuah metrik meleset, jangan cuma melaporkan melesetnya: sarankan apa yang dilakukan.
6. Tinjauan yang tidak menghasilkan satu tindakan pun tidak berguna.
