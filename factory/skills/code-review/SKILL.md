---
name: {{slug}}-code-review
description: Tinjau perubahan kode {{proyek}} untuk keamanan, performa, dan kebenaran. Pakai saat meninjau PR, diff, atau berkas sebelum merge, atau saat memeriksa perubahan untuk risiko injeksi, kueri N+1, kasus tepi yang hilang, dan celah penanganan error.
---

<!-- Sumber: engineering/skills/code-review @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Tinjau Kode

Tinjau perubahan kode dengan lensa terstruktur: keamanan, performa, kebenaran, dan beban perawatan.

## Cara pakai

Sebutkan PR (nomor atau URL), diff, atau berkas. Di proyek ini diff-nya bisa diambil langsung:

```
gh pr diff <nomor> --repo {{repo}}
```

## Dimensi tinjauan

### Keamanan

- Injeksi SQL pada kueri D1/Worker, XSS pada dashboard
- Celah autentikasi dan otorisasi (sesi dashboard, batas kepercayaan device)
- Rahasia atau kredensial di dalam kode
- Deserialisasi tidak aman
- Path traversal pada impor/ekspor berkas
- SSRF pada panggilan keluar

### Performa

- Kueri N+1
- Alokasi memori yang tidak perlu
- Kompleksitas algoritmik (O(n^2) di jalur panas)
- Indeks basis data yang hilang
- Kueri atau loop tanpa batas
- Kebocoran sumber daya

### Kebenaran

- Kasus tepi (masukan kosong, null, overflow)
- Kondisi balapan dan konkurensi
- Penanganan dan propagasi error
- Kesalahan off-by-one
- Keamanan tipe

### Beban perawatan

- Kejelasan penamaan
- Tanggung jawab tunggal
- Duplikasi
- Cakupan test
- Dokumentasi untuk logika yang tidak jelas

## Keluaran

```markdown
## Tinjauan Kode: [judul PR atau berkas]

### Ringkasan
[1-2 kalimat tentang perubahan dan mutunya]

### Masalah Kritis
| # | Berkas | Baris | Masalah | Tingkat |
|---|---|---|---|---|
| 1 | [berkas] | [baris] | [uraian] | kritis |

### Saran
| # | Berkas | Baris | Saran | Kategori |
|---|---|---|---|---|
| 1 | [berkas] | [baris] | [uraian] | performa |

### Yang Sudah Baik
- [pengamatan positif]

### Putusan
[Setuju / Minta Perubahan / Perlu Diskusi]
```

## Sebelum menyimpulkan

Baca perubahan yang sebenarnya, bukan judulnya. Kalau sebuah temuan datang dari bot atau alat lain,
reproduksi dulu di versi dependency yang dipin sebelum menambal. Temuan yang tidak bisa direproduksi
jangan ditambal: patch yang tidak perlu bikin diff kotor dan menutupi kalau reviewernya yang salah.

## Tips

1. **Sebut konteks** — "ini jalur panas" atau "ini memegang data pelanggan" membantu memfokuskan.
2. **Sebut kekhawatiran** — "fokus ke keamanan" mempersempit tinjauan.
3. **Sertakan test** — cakupan dan mutu test ikut dinilai.
