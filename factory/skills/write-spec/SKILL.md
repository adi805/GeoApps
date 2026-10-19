---
name: {{slug}}-write-spec
description: Tulis spesifikasi fitur atau PRD {{proyek}} dari rumusan masalah atau ide. Pakai saat mengubah ide kabur jadi dokumen terstruktur, membatasi lingkup fitur dengan tujuan dan non-tujuan, menetapkan metrik keberhasilan dan kriteria penerimaan, atau memecah permintaan besar jadi tahapan.
---

<!-- Sumber: product-management/skills/write-spec @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Tulis Spesifikasi (PRD)

## Alur kerja

### 1. Pahami fiturnya

Terima salah satu: nama fitur, rumusan masalah, permintaan pengguna, atau ide kabur.

### 2. Kumpulkan konteks

- **Masalah pengguna**: masalah apa ini, siapa yang mengalaminya
- **Pengguna sasaran**: segmen mana (surveyor lapangan, operator GIS, admin proyek, pengguna Android)
- **Metrik keberhasilan**: bagaimana kita tahu ini berhasil
- **Batasan**: teknis, tenggat, aturan (mis. aturan pajak dan ketenagakerjaan), ketergantungan
- **Preseden**: pernah dicoba sebelumnya, ada solusi lain?

Tanya yang paling penting dulu, jangan melontarkan semua pertanyaan sekaligus.

### 3. Tarik konteks dari repo

| Sumber | Cara |
|---|---|
| Papan tugas | `gh issue list --repo {{repo}}` |
| Keputusan yang sudah disetujui | `docs/prd/DECISIONS.md (dokumen produk)` |
| Arsitektur dan peta kode | `docs/ARCHITECTURE.md (dokumen produk)`, `docs/CODE-MAP.md (dokumen produk)` |
| Modul yang terdampak | `packages/plugins/src/plugins/` (geo-pdf, geofence, offline) |

### 4. Susun PRD

- **Rumusan masalah**: 2-3 kalimat. Siapa yang terdampak, seberapa sering, dan apa biaya kalau tidak diselesaikan. Sandarkan pada bukti, bukan dugaan.
- **Tujuan**: 3-5 hasil terukur. Tujuan itu hasil, bukan keluaran: "memotong waktu rekap gaji dari 3 jam ke 30 menit", bukan "bikin layar rekap".
- **Non-tujuan**: 3-5 hal yang eksplisit di luar lingkup, masing-masing dengan alasan singkat.
- **Cerita pengguna**: "Sebagai [jenis pengguna], gue ingin [kemampuan] supaya [manfaat]". Sebut kasus tepi dan keadaan kosong.
- **Kebutuhan**: Wajib (P0), Bagus kalau ada (P1), Pertimbangan masa depan (P2), masing-masing dengan kriteria penerimaan.
- **Metrik keberhasilan**: indikator awal (cepat berubah) dan indikator akhir (lambat berubah), dengan target spesifik dan cara ukurnya.
- **Pertanyaan terbuka**: tandai siapa yang harus menjawab, dan mana yang menghambat.
- **Pertimbangan jadwal**: tenggat keras, ketergantungan, tahapan.

### 5. Tinjau dan ulangi

Tanya bagian mana yang perlu disesuaikan, lalu tawarkan lanjutan (brief desain, pemecahan
tiket, bahan presentasi).

## Kategorisasi kebutuhan (MoSCoW)

| Tingkat | Arti |
|---|---|
| Wajib | tanpa ini fiturnya tidak layak |
| Sebaiknya | penting tapi tidak menghambat rilis |
| Boleh | bagus kalau ada waktu |
| Tidak sekarang | eksplisit di luar lingkup, bisa dibuka lagi |

Bersikap tegas soal P0. Kalau semua P0, tidak ada yang P0. Tiap calon P0 ditanya: "kalau ini
dipotong, fiturnya masih menyelesaikan masalah intinya?"

## Kriteria penerimaan

Format "Diberikan / Ketika / Maka", atau daftar centang. Cakup jalur bahagia, kasus error, kasus
tepi, dan apa yang **tidak** boleh terjadi. Tiap kriteria harus bisa diuji sendiri. Hindari kata
kabur seperti "cepat", "mudah", "intuitif" tanpa angka.

## Menjaga lingkup

- Tulis non-tujuan di tiap spesifikasi
- Tiap penambahan lingkup wajib disertai pengurangan lingkup atau perpanjangan waktu
- Pisahkan v1 dan v2 dengan jelas
- Uji tiap kebutuhan terhadap rumusan masalah aslinya
- Sediakan "parkiran" untuk ide bagus yang di luar lingkup

## Aturan alur di proyek ini

1. PRD yang disetujui mengalir ke `docs/prd/DECISIONS.md (dokumen produk)`.
2. Fitur yang menyentuh `apps/geolibre-desktop/src-tauri/tauri.*.conf.json` atau `packaging/**`
   wajib naik ke owner dulu, lihat `factory/LAW.md` bagian 7. `.github/workflows/**` diputuskan
   agent.
3. Unit kerja hasil pemecahan PRD naik dulu ke papan tugas (issue), baru jadi kerjaan.
