---
name: {{slug}}-change-request
description: Susun permintaan perubahan dengan analisis dampak dan rencana rollback untuk {{proyek}}. Pakai saat mengusulkan perubahan sistem atau proses yang perlu persetujuan owner, menyiapkan catatan perubahan sebelum deploy, mencatat risiko dan langkah rollback, atau merencanakan komunikasi ke pengguna.
---

<!-- Sumber: operations/skills/change-request @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Permintaan Perubahan

Susun permintaan perubahan yang terstruktur: analisis dampak, penilaian risiko, dan rencana rollback.

## Kerangka

### 1. Nilai
- Apa yang berubah?
- Siapa yang terdampak?
- Seberapa besar perubahannya? (rendah / sedang / tinggi)

### 2. Rencanakan
- Rencana komunikasi (siapa, apa, kapan, bagaimana)
- Rencana pelatihan (kalau ada perubahan cara kerja)
- Rencana dukungan (siapa yang ditanya kalau ada kendala)
- Garis waktu dengan tonggak

### 3. Jalankan
- Umumkan dan jelaskan "kenapa"-nya lebih dulu
- Pantau adopsi
- Tangani hambatan

### 4. Pertahankan
- Ukur adopsi dan efektivitas
- Perkuat kebiasaan baru
- Catat pelajaran

## Keluaran

```markdown
## Permintaan Perubahan: [judul]
**Pemohon:** [nama] | **Tanggal:** [tanggal] | **Prioritas:** [kritis/tinggi/sedang/rendah]
**Status:** Draf | Menunggu persetujuan | Disetujui | Berjalan | Selesai

### Uraian
[apa yang berubah dan kenapa]

### Alasan bisnis
[kenapa perubahan ini perlu: penghematan, kepatuhan, efisiensi, atau penurunan risiko]

### Analisis dampak
| Area | Dampak | Rincian |
|---|---|---|
| Pengguna | [tinggi/sedang/rendah/tidak ada] | [siapa yang terdampak dan bagaimana] |
| Sistem | [tinggi/sedang/rendah/tidak ada] | [sistem apa yang terdampak] |
| Proses | [tinggi/sedang/rendah/tidak ada] | [alur kerja apa yang berubah] |
| Data | [tinggi/sedang/rendah/tidak ada] | [data apa yang berubah bentuk atau pindah] |

### Penilaian risiko
| Risiko | Kemungkinan | Dampak | Mitigasi |
|---|---|---|---|
| [risiko] | tinggi/sedang/rendah | tinggi/sedang/rendah | [cara menanganinya] |

### Rencana implementasi
| Langkah | Penanggung jawab | Waktu | Ketergantungan |
|---|---|---|---|
| [langkah] | [nama] | [tanggal] | [apa yang harus lebih dulu] |

### Rencana komunikasi
| Audiens | Pesan | Saluran | Waktu |
|---|---|---|---|
| [siapa] | [apa yang diberitahukan] | [bagaimana] | [kapan] |

### Rencana rollback
- Pemicu: [kapan harus mundur]
- Langkah: [cara mundurnya]
- Verifikasi: [cara memastikan rollback berhasil]

### Persetujuan yang diperlukan
| Pemberi persetujuan | Peran | Status |
|---|---|---|
| [nama] | owner | Menunggu |
```

## Aturan di proyek ini

1. **Perubahan yang menyentuh `apps/geolibre-desktop/src-tauri/tauri.*.conf.json` atau
   `packaging/**` selalu naik ke owner** sebelum dikerjakan. `.github/workflows/**` diputuskan
   agent, dengan label `eskalasi` di PR plus entri ledger `ruling` `oleh=agent`.
   Lihat `factory/LAW.md` bagian 7.
2. **Selalu punya rencana rollback** — walau yakin. Perubahan yang tidak bisa dibalik diperlakukan
   sebagai blast radius besar, bukan sebagai perubahan biasa.
3. **Spesifik soal dampak** — "semua orang" bukan analisis dampak. "12 pengguna Android di
   dua perangkat lapangan" itu analisis dampak.
