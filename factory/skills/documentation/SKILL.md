---
name: {{slug}}-documentation
description: Tulis dan rawat dokumentasi teknis {{proyek}}. Pakai saat menulis dokumentasi untuk sebuah modul, membuat atau memperbarui README, menyusun runbook, atau menulis panduan onboarding.
---

<!-- Sumber: engineering/skills/documentation @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Dokumentasi Teknis

Tulis dokumentasi yang jelas dan terawat, sesuai pembacanya.

## Jenis dokumen dan tempatnya

| Jenis | Tempat di proyek ini |
|---|---|
| Cara menambah modul, perintah, pemeriksa | `docs/CONTRIBUTING.md` |
| Arsitektur dan peta kode | `docs/ARCHITECTURE.md (dokumen produk)`, `docs/CODE-MAP.md (dokumen produk)` |
| Keputusan produk dan teknis yang disetujui | `docs/prd/DECISIONS.md (dokumen produk)` |
| Hukum proses factory | `factory/LAW.md` |
| Runbook operasional | lihat skill `{{slug}}-runbook` |

Jangan taruh aturan proses di README atau di berkas yang selalu dimuat sesi: aturan proses punya
rumahnya sendiri di `factory/LAW.md`, dan aturan lintas proyek milik agent tidak ditulis ke repo ini.

## Bentuk per jenis

### README
- Ini apa dan kenapa ada
- Mulai cepat (kurang dari 5 menit sampai berhasil pertama)
- Konfigurasi dan cara pakai
- Panduan kontribusi

### Dokumentasi API
- Referensi endpoint dengan contoh permintaan/tanggapan
- Autentikasi dan kode error
- Batas laju dan paginasi

### Runbook
- Kapan runbook ini dipakai
- Prasyarat dan akses yang diperlukan
- Prosedur langkah demi langkah
- Langkah rollback
- Jalur eskalasi

### Dokumen arsitektur
- Konteks dan tujuan
- Desain tingkat tinggi dengan diagram
- Keputusan kunci dan trade-off-nya
- Aliran data dan titik integrasi

### Panduan onboarding
- Menyiapkan lingkungan
- Sistem kunci dan cara mereka terhubung
- Tugas yang sering dikerjakan, dengan panduan langkah

## Prinsip

1. **Tulis untuk pembacanya** — siapa yang membaca ini dan apa yang dia butuhkan?
2. **Taruh informasi paling berguna di depan** — jangan dikubur.
3. **Tunjukkan, jangan cuma bilang** — contoh perintah dan keluaran.
4. **Jaga tetap mutakhir** — dokumentasi basi lebih buruk daripada tidak ada.
5. **Tautkan, jangan salin** — tunjuk dokumen lain daripada menduplikasi isinya.

## Gate yang menjaga dokumen ini tetap jujur

Angka di dokumen diperiksa mesin: `python3 tools/verifikasi_dokumen.py` menolak kalau angka di
dokumen tidak cocok dengan kode, dan `python3 tools/audit_consistency.py` menolak kalau satu sisi
berubah sementara sisi lain tidak. Kalau lo mengubah angka di dokumen, jalankan keduanya.
