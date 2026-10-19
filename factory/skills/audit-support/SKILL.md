---
name: {{slug}}-audit-support
description: Dukung kesiapan audit dengan metodologi pengujian pengendalian, pemilihan sampel, dan standar dokumentasi kertas kerja. Pakai saat menyusun kertas kerja pengujian, memilih sampel audit, mengklasifikasi defisiensi pengendalian, atau bersiap menghadapi audit internal maupun kantor akuntan.
---

<!-- Sumber: finance/skills/audit-support @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang: kerangka kepatuhan AS dibuang, dibingkai untuk kesiapan audit di Indonesia -->

# Dukungan Audit

Skill ini membantu alur kesiapan audit, bukan memberi nasihat audit atau hukum. Semua kertas kerja
dan penilaian ditinjau orang yang kompeten.

**Batas kerangka:** berkas upstream ditulis untuk kepatuhan pengendalian pelaporan keuangan bergaya
Amerika Serikat. Rezim itu tidak berlaku di sini. Yang dipakai dari berkas itu adalah **metodenya**:
penetapan lingkup, pemilihan sampel, standar kertas kerja, dan klasifikasi defisiensi. Bingkainya di
sini adalah kesiapan audit umum oleh kantor akuntan dan pengendalian internal perusahaan, mengacu
pada standar audit yang berlaku (penilaian risiko dan respons atas risiko).

## Metodologi

1. **Penetapan lingkup** — tentukan akun signifikan dan asersi yang relevan
2. **Penilaian risiko** — nilai risiko salah saji material di tiap akun signifikan
3. **Identifikasi pengendalian** — catat pengendalian yang menjawab tiap risiko
4. **Pengujian** — uji desain dan efektivitas operasi pengendalian kunci
5. **Evaluasi** — nilai apakah ada defisiensi dan seberapa berat
6. **Pelaporan** — catat penilaian dan defisiensi material

### Akun signifikan

Faktor kuantitatif: saldo akun melewati ambang materialitas, volume transaksinya tinggi, atau akunnya
banyak berisi taksiran dan pertimbangan.

Faktor kualitatif: akunnya rumit (pengakuan pendapatan, sewa), rawan kecurangan (kas, pendapatan,
transaksi pihak berelasi), pernah salah saji atau pernah dikoreksi auditor, melibatkan pertimbangan
manajemen, atau prosesnya baru atau berubah besar.

### Asersi relevan per jenis akun

| Jenis akun | Asersi kunci |
|---|---|
| Pendapatan | keterjadian, kelengkapan, akurasi, batas waktu |
| Piutang usaha | keberadaan, penilaian (penyisihan), hak |
| Persediaan | keberadaan, penilaian, kelengkapan |
| Aset tetap | keberadaan, penilaian, kelengkapan, hak |
| Utang usaha | kelengkapan, akurasi, keberadaan |
| Utang akrual | kelengkapan, penilaian, akurasi |
| Ekuitas | kelengkapan, akurasi, penyajian |
| Tutup buku dan pelaporan | penyajian, akurasi, kelengkapan |

### Efektivitas desain lawan efektivitas operasi

**Desain**: apakah pengendaliannya dirancang tepat untuk mencegah atau mendeteksi salah saji material
pada asersi yang relevan? Dinilai lewat penelusuran satu transaksi dari awal sampai akhir, setidaknya
setahun sekali atau saat prosesnya berubah.

**Operasi**: apakah pengendaliannya benar-benar berjalan sesuai rancangan sepanjang periode
pengujian? Dinilai lewat pengujian, butuh ukuran sampel yang memadai, dan harus mencakup seluruh
periode yang diandalkan.

## Pemilihan sampel

| Metode | Kapan dipakai | Kelebihan | Kekurangan |
|---|---|---|---|
| Acak | bawaan untuk pengendalian tingkat transaksi dengan populasi besar | sahih secara statistik, tanpa bias | bisa melewatkan pos berisiko tinggi |
| Bertarget | pelengkap, atau metode utama kalau populasinya kecil atau beragam | fokus ke pos berisiko tertinggi | tidak representatif |
| Haphazard | kalau daftar populasi berurutan tidak ada dan populasinya cukup seragam | sederhana | tidak sahih secara statistik, rawan bias tak sadar |
| Sistematis | populasi berurutan dan butuh cakupan merata | cakupan merata, mudah dijalankan | pola berkala di populasi bisa membiaskan hasil |

Contoh sistematis: populasi 1.000, sampel 25, interval 40, titik awal acak 17, maka pilih 17, 57, 97,
137, dan seterusnya.

Pos yang layak dipilih bertarget: nilai besar, transaksi tidak biasa, transaksi akhir periode (risiko
batas waktu), pihak berelasi, transaksi manual atau override, dan vendor atau pelanggan baru.

### Ukuran sampel

| Frekuensi pengendalian | Populasi | Risiko rendah | Risiko sedang | Risiko tinggi |
|---|---|---|---|---|
| Tahunan | 1 | 1 | 1 | 1 |
| Kuartalan | 4 | 2 | 2 | 3 |
| Bulanan | 12 | 2 | 3 | 4 |
| Mingguan | 52 | 5 | 8 | 15 |
| Harian | ~250 | 20 | 30 | 40 |
| Per transaksi (populasi kecil) | <250 | 20 | 30 | 40 |
| Per transaksi (populasi besar) | 250+ | 25 | 40 | 60 |

Ukuran sampel naik kalau risiko bawaan akunnya lebih tinggi, pengendaliannya satu-satunya yang
menjawab risiko itu, periode sebelumnya ada defisiensi, pengendaliannya baru, atau auditor eksternal
mengandalkan pengujian manajemen.

## Dokumentasi kertas kerja

Tiap pengujian memuat: **identifikasi pengendalian** (nomor, uraian, jenis, frekuensi, risiko dan
asersi yang dijawab), **rancangan pengujian** (tujuan, prosedur, bukti yang diharapkan, metode
pemilihan sampel dan alasannya), **pelaksanaan** (uraian populasi dan ukurannya, rincian sampel,
hasil per sampel dengan bukti yang diperiksa, pengecualian dengan uraian lengkap), **kesimpulan**
(penilaian, dasarnya, dampak pengecualian, pengendalian kompensasi yang dipertimbangkan), dan
**tanda tangan** penyusun dan peninjau beserta tanggalnya.

**Bukti yang cukup**: tangkapan layar pengendalian yang ditegakkan sistem, dokumen persetujuan
bertanda tangan atau berinisial, persetujuan surel dengan penyetuju dan tanggal yang bisa dikenali,
log audit sistem yang menunjukkan siapa melakukan apa dan kapan, perhitungan ulang yang cocok, dan
catatan pengamatan berisi tanggal serta pengamatnya.

**Bukti yang tidak cukup**: konfirmasi lisan saja, dokumen tanpa tanggal, bukti tanpa pelaksana atau
penyetuju yang bisa dikenali, laporan sistem generik tanpa cap waktu, dan "menurut diskusi dengan
[nama]" tanpa dokumen pendukung.

## Klasifikasi defisiensi

| Tingkat | Arti |
|---|---|
| Defisiensi | rancangan atau operasi pengendalian tidak memungkinkan pencegahan atau pendeteksian salah saji secara tepat waktu |
| Defisiensi signifikan | kurang berat dari kelemahan material, tapi cukup penting untuk perhatian pihak yang bertanggung jawab atas tata kelola |
| Kelemahan material | ada kemungkinan wajar salah saji material tidak dicegah atau tidak dideteksi tepat waktu |

Petunjuk kelemahan material: kecurangan oleh manajemen senior berapa pun nilainya; penyajian ulang
laporan keuangan yang sudah diterbitkan; auditor menemukan salah saji material yang tidak tertangkap
pengendalian perusahaan; pengawasan pelaporan keuangan yang tidak efektif; dan defisiensi pada
pengendalian yang menyebar luas (tingkat entitas atau TI umum) yang memengaruhi banyak proses.

**Agregasi**: defisiensi yang sendirian tidak signifikan bisa jadi signifikan kalau digabung. Kumpulkan
defisiensi di proses yang sama atau yang mengenai asersi yang sama, nilai apakah efek gabungannya bisa
material, dan catat analisis serta kesimpulannya.

**Remediasi** tiap defisiensi: analisis akar masalah (celah rancangan, kegagalan pelaksanaan,
kekurangan orang, kurang pelatihan, masalah sistem), rencana perbaikan yang spesifik, tenggat,
penanggung jawab, dan cara pengujian ulang untuk memastikan perbaikannya efektif.

## Jenis pengendalian yang umum

**Pengendalian umum TI**: pengendalian akses (pemberian dan pencabutan akses, hak istimewa dibatasi
dan dipantau, tinjauan akses berkala, kebijakan kata sandi, pemisahan tugas); pengendalian perubahan
(permintaan perubahan didokumentasikan dan disetujui sebelum diterapkan, perubahan diuji di lingkungan
non-produksi, pemisahan lingkungan pengembangan dan produksi, prosedur perubahan darurat); dan
operasi TI (pemantauan pekerjaan terjadwal, cadangan dan pemulihan yang diuji, pemantauan
ketersediaan, penanganan insiden, rencana pemulihan bencana).

**Pengendalian manual**: tinjauan manajemen atas laporan keuangan dan metrik kunci, persetujuan
atasan atas jurnal di atas ambang, pencocokan tiga arah (PO, penerimaan, faktur), penyusunan dan
tinjauan rekonsiliasi akun, penghitungan fisik persediaan, persetujuan perubahan data induk vendor,
dan persetujuan kredit pelanggan. Yang diuji: dilakukan orang yang berwenang, tepat waktu, ada bukti
tinjauannya, peninjau punya informasi yang cukup, dan pengecualian ditangani.

**Pengendalian otomatis**: alur persetujuan yang ditegakkan sistem, pencocokan tiga arah otomatis,
deteksi faktur ganda, penegakan batas kredit, perhitungan otomatis (depresiasi, amortisasi, bunga,
pajak), pemisahan tugas yang ditegakkan sistem, validasi masukan, dan pencocokan rekonsiliasi
otomatis. Kalau konfigurasi sistemnya tidak berubah, satu pengujian biasanya cukup untuk periode itu,
ditambah pengujian pengendalian perubahan TI. Kalau sistemnya berubah, uji ulang.

**Pengendalian manual yang bergantung TI**: tinjauan laporan pengecualian dari sistem, tinjauan
laporan umur piutang, rekonsiliasi memakai data neraca saldo dari sistem, persetujuan transaksi dari
alur kerja sistem. Yang diuji bukan cuma tinjauannya, tapi juga kelengkapan dan akurasi laporan yang
diandalkan peninjau itu.

**Pengendalian tingkat entitas**: nada dari puncak dan kode etik, proses penilaian risiko, pengawasan
pelaporan keuangan, fungsi audit internal, penilaian risiko kecurangan, saluran pengaduan,
pemantauan efektivitas pengendalian oleh manajemen, kompetensi pelaporan keuangan, dan proses
pelaporan akhir periode. Pengendalian tingkat entitas bisa mengurangi, tapi biasanya tidak bisa
menggantikan pengendalian tingkat proses. Kalau pengendalian tingkat entitasnya tidak efektif, itu
petunjuk kuat kelemahan material.

## Di {{proyek}}

Kertas kerja dan bukti pengujian adalah artefak kerja, bukan percakapan: simpan sebagai berkas di
repo atau di `factory/receipts/`, jangan hanya di benang obrolan. Kalau sebuah pengendalian diuji
lewat perubahan konfigurasi atau rilis, langkah itu naik ke owner dulu, lihat `factory/LAW.md`
bagian 7.
