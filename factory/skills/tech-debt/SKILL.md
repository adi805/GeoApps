---
name: {{slug}}-tech-debt
description: Temukan, kategorikan, dan prioritaskan utang teknis di {{proyek}}. Pakai saat audit kualitas kode, menyusun urutan refactor, atau menjawab pertanyaan "apa yang harus dibereskan dulu".
---

<!-- Sumber: engineering/skills/tech-debt @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Kelola Utang Teknis

Temukan, kategorikan, dan prioritaskan utang teknis secara sistematis.

## Kategori

| Jenis | Contoh | Risiko |
|---|---|---|
| Kode | logika terduplikasi, abstraksi lemah, angka ajaib | bug, pengembangan lambat |
| Arsitektur | modul yang seharusnya dipisah, penyimpanan salah | batas skala |
| Test | cakupan rendah, test flaky, test integrasi hilang | regresi lolos ke rilis |
| Dependensi | pustaka usang, dependensi tak terawat | celah keamanan |
| Dokumentasi | runbook hilang, README basi, pengetahuan di kepala | onboarding lambat |
| Infrastruktur | deploy manual, tanpa pemantauan | insiden, pemulihan lambat |

## Kerangka prioritas

Nilai tiap item:

- **Dampak**: seberapa menghambat kerja (1-5)
- **Risiko**: apa jadinya kalau tidak dibereskan (1-5)
- **Usaha**: seberapa berat perbaikannya (1-5, dibalik)

Prioritas = (Dampak + Risiko) x (6 - Usaha)

## Keluaran

Daftar berprioritas dengan estimasi usaha, alasan bisnis tiap item, dan rencana bertahap yang bisa
jalan berdampingan dengan kerja fitur.

## Aturan alur di proyek ini

Tiap item yang layak dikerjakan naik dulu ke papan tugas (issue di `{{repo}}`), baru jadi unit
kerja. Kerjaan yang tidak punya nomor issue tidak ada dan tidak akan pernah ditutup, lihat
`factory/LAW.md` bagian 4.
