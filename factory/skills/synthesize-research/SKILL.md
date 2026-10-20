---
name: {{slug}}-synthesize-research
description: Sintesis riset pengguna dari wawancara, survei, dan keluhan jadi temuan terstruktur. Pakai saat ada tumpukan catatan wawancara, jawaban survei, atau keluhan pengguna yang perlu dimengerti, perlu menarik tema dan mengurutkan temuan menurut frekuensi dan dampak, atau ingin mengubah masukan mentah jadi rekomendasi peta jalan.
---

<!-- Sumber: product-management/skills/synthesize-research @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Sintesis Riset Pengguna

Ubah riset pengguna dari berbagai sumber jadi temuan dan rekomendasi terstruktur.

## Sumber yang diterima

- Catatan wawancara, transkrip, jawaban survei, keluhan pengguna
- Tiket dukungan dan permintaan fitur dari papan tugas
- Catatan sesi pelatihan atau pendampingan pengguna
- Data pemakaian dari salinan basis data (lewat skill `{{slug}}-analyze`)

Tanyakan: jenis risetnya apa, berapa sumber/pesertanya, ada pertanyaan atau dugaan spesifik yang
diselidiki, dan keputusan apa yang akan dibantu riset ini.

## Alur kerja

### 1. Olah tiap sumber

Tarik dari tiap sumber: pengamatan kunci, kutipan apa adanya, perilaku nyata (bukan yang dikatakan),
titik sakit, sinyal positif, dan konteks (segmen pengguna, jenis pemakaian, tingkat pengalaman).

### 2. Temukan tema

Analisis tematik:

1. **Pembiasaan** — baca semua data dulu sebelum memberi kode apa pun
2. **Pengodean awal** — tandai tiap pengamatan dengan kode deskriptif; lebih baik kebanyakan kode, nanti bisa digabung
3. **Pembentukan tema** — kelompokkan kode terkait jadi calon tema
4. **Tinjauan tema** — cek tiap tema punya bukti cukup dan berbeda dari tema lain
5. **Perbaikan tema** — beri nama dan uraian 1-2 kalimat per tema
6. **Laporan** — tulis temanya sebagai temuan dengan bukti pendukung

Lalu susun matriks prioritas: frekuensi tinggi + dampak tinggi (prioritas teratas), frekuensi
rendah + dampak tinggi (penting untuk segmen tertentu), frekuensi tinggi + dampak rendah
(perbaikan kenyamanan), frekuensi rendah + dampak rendah (catat, tunda).

### 3. Segitigakan bukti

Temuan yang didukung beberapa metode dan beberapa sumber jauh lebih kuat daripada yang cuma dari
satu sumber. Kalau sumbernya saling bertentangan, itu menarik: bisa jadi tanda segmen pengguna yang
berbeda, bukan kesalahan data.

### 4. Keluaran

```markdown
## Sintesis Riset: [topik]

### Ikhtisar riset
- Metode: [jenis riset, jumlah peserta/sumber]
- Pertanyaan: [apa yang hendak diketahui]
- Rentang waktu: [kapan dilakukan]

### Temuan kunci
Untuk tiap temuan (sasaran 5-8):
- **Temuan**: satu kalimat jelas
- **Bukti**: kutipan, angka, atau pengamatan, dengan sumbernya
- **Frekuensi**: berapa peserta/sumber yang mendukung
- **Dampak**: seberapa besar pengaruhnya
- **Keyakinan**: tinggi / sedang / rendah

### Segmen pengguna
[segmen yang muncul dari data: ciri, kebutuhan, titik sakit]

### Peluang
[kebutuhan yang belum terpenuhi, urut berdasar potensi dampak]

### Rekomendasi
[apa yang dibangun, diubah, atau diselidiki lebih lanjut, terkait ke temuan]

### Pertanyaan terbuka
[apa yang belum terjawab, dan metode lanjutan yang disarankan]
```

## Persona dari data

Persona dibentuk dari data, bukan imajinasi: cari pola perilaku yang serupa, tentukan variabel
pembeda, lalu susun profilnya (nama, perilaku, tujuan, titik sakit, konteks, kutipan wakil).

Jangan membuat persona berdasar demografi (usia/jenis kelamin/lokasi): perilaku lebih meramalkan
kebutuhan produk daripada demografi. 3-5 persona itu titik manisnya; lebih dari itu tidak lagi bisa
ditindaklanjuti.

## Mengukur besarnya peluang

Untuk tiap temuan: berapa pengguna yang terdampak, seberapa sering mereka menemui masalahnya,
seberapa berat dampaknya, dan apakah menyelesaikannya mendorong retensi atau akuisisi.

Sajikan hitungannya, bukan cuma angkanya: "berdasar volume keluhan, sekitar 2.000 pengguna per bulan
menemui ini; data wawancara menunjukkan 60% menganggapnya penghambat serius". Pakai rentang daripada
presisi palsu: "1.500-2.500 pengguna per bulan", bukan angka yang terlalu rinci.

## Tips

1. Biarkan datanya bicara. Jangan memaksa temuan masuk ke narasi yang sudah disiapkan.
2. Bedakan yang dikatakan pengguna dari yang mereka lakukan. Perilaku lebih kuat daripada pernyataan.
3. Kutipan itu bukti yang kuat. Sertakan dengan atribusi jenis peserta, bukan nama orang.
4. Nyatakan tingkat keyakinan. Temuan dari 2 wawancara itu dugaan, bukan kesimpulan.
5. Pertentangan di data itu menarik, bukan mengganggu.
6. Rekomendasi harus cukup spesifik untuk dikerjakan. "Perbaiki onboarding" tidak bisa dikerjakan;
   "tambah penunjuk langkah di alur penyiapan" bisa.
