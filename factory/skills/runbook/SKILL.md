---
name: {{slug}}-runbook
description: Buat atau perbarui runbook operasional untuk tugas atau prosedur berulang di {{proyek}}. Pakai saat mendokumentasikan tugas yang harus dijalankan berulang dengan langkah persis, menambah langkah troubleshooting dan rollback, atau menulis jalur eskalasi.
---

<!-- Sumber: operations/skills/runbook @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Runbook

Susun runbook operasional langkah demi langkah untuk tugas atau prosedur berulang.

## Keluaran

```markdown
## Runbook: [nama tugas]
**Pemilik:** [tim/orang] | **Frekuensi:** [harian/mingguan/bulanan/sewaktu-waktu]
**Terakhir diperbarui:** [tanggal] | **Terakhir dijalankan:** [tanggal]

### Tujuan
[runbook ini mencapai apa dan kapan dipakai]

### Prasyarat
- [ ] [akses atau izin yang diperlukan]
- [ ] [alat atau sistem yang diperlukan]
- [ ] [data atau masukan yang diperlukan]

### Prosedur

#### Langkah 1: [nama]
```
[perintah, tindakan, atau instruksi persis]
```
**Hasil yang diharapkan:** [apa yang seharusnya terjadi]
**Kalau gagal:** [apa yang harus dilakukan]

#### Langkah 2: [nama]
[format sama]

### Verifikasi
- [ ] [cara memastikan tugas selesai dengan benar]

### Troubleshooting
| Gejala | Penyebab dugaan | Perbaikan |
|---|---|---|
| [yang terlihat] | [kenapa] | [apa yang dilakukan] |

### Rollback
[cara membatalkan ini kalau ada yang salah]

### Eskalasi
| Situasi | Kontak | Cara |
|---|---|---|
| [kapan naik] | [siapa] | [bagaimana] |
```

## Aturan penulisan

1. **Sespesifik mungkin** — "jalankan skripnya" bukan langkah. "Jalankan
   `python3 tools/factory/sync_skill.py` dari akar repo" itu langkah.
2. **Sertakan mode kegagalan** — apa yang bisa salah di tiap langkah dan apa yang harus dilakukan.
3. **Uji runbook-nya** — minta orang yang belum paham prosesnya mengikutinya. Perbaiki di bagian
   dia tersangkut.
4. **Eskalasi menyentuh owner kalau aksinya tidak bisa dibalik** — lihat `factory/LAW.md` bagian 7.
5. **Jangan taruh aturan proses di runbook.** Aturan proses tinggal di `factory/LAW.md`; runbook
   cuma prosedur tugas.
