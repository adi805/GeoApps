---
name: {{slug}}-system-design
description: Rancang sistem, layanan, atau arsitektur untuk {{proyek}}. Pakai saat mendesain komponen baru, menentukan batas modul, merancang API atau model data, atau menilai pilihan arsitektur dari kebutuhan dan batasan.
---

<!-- Sumber: engineering/skills/system-design @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Rancang Sistem

Bantu merancang sistem dan menilai keputusan arsitektur. Kalau hasilnya sebuah keputusan yang perlu
ditandatangani, catat pakai skill `{{slug}}-architecture`.

## Kerangka

### 1. Kumpulkan kebutuhan

- Fungsional: sistem ini melakukan apa
- Non-fungsional: skala, latensi, ketersediaan, biaya
- Batasan: ukuran tim, tenggat, tumpukan teknologi yang sudah ada

### 2. Desain tingkat tinggi

- Diagram komponen
- Aliran data
- Kontrak API
- Pilihan penyimpanan

### 3. Telusuri ke dalam

- Model data
- Rancangan endpoint
- Strategi cache
- Rancangan antrean/event
- Penanganan error dan percobaan ulang

### 4. Skala dan keandalan

- Estimasi beban
- Skala horizontal vs vertikal
- Failover dan redundansi
- Pemantauan dan alarm

### 5. Analisis trade-off

- Tiap keputusan punya trade-off. Buat eksplisit.
- Pertimbangkan: kompleksitas, biaya, keakraban tim, waktu ke pasar, beban perawatan

## Keluaran

Dokumen desain terstruktur: diagram (ASCII atau deskripsi), asumsi eksplisit, dan analisis trade-off.
Selalu sebutkan apa yang akan ditinjau ulang saat sistem tumbuh.

## Batasan nyata di proyek ini

{{proyek}} bukan layanan yang mendengarkan port. Bentuknya aplikasi desktop (WPF, dipak jadi MSI) plus
Worker/D1 dan dashboard. Jadi "desain sistem" di sini biasanya soal alur sinkron, skema D1, bentuk
berkas ekspor, dan batas modul (payroll, kas-bank, gudang), bukan penempatan pod. Sebut batas itu
di dokumennya, karena desain yang mengasumsikan server sendiri akan salah di sini.
