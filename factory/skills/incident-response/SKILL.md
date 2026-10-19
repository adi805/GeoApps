---
name: {{slug}}-incident-response
description: Jalankan alur penanganan insiden: triase, komunikasi, mitigasi, dan postmortem. Pakai saat ada insiden produksi, alarm yang perlu dinilai tingkatannya, pembaruan status di tengah insiden, atau saat menulis postmortem tanpa menyalahkan orang.
---

<!-- Sumber: engineering/skills/incident-response @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Penanganan Insiden

Tangani insiden dari deteksi sampai postmortem.

## Mode

- **Baru** — mulai insiden baru, tentukan tingkat keparahan
- **Pembaruan** — tulis pembaruan status di tengah insiden
- **Postmortem** — susun postmortem dari data insiden

## Fase

```
Fase 1: TRIASE
  - nilai tingkat keparahan
  - tentukan sistem dan pengguna yang terdampak
  - tunjuk peran: komandan insiden, komunikasi, penanggung jawab teknis

Fase 2: KOMUNIKASI
  - susun pembaruan status internal
  - susun komunikasi ke pengguna kalau perlu
  - tetapkan irama pembaruan

Fase 3: MITIGASI
  - catat langkah mitigasi yang diambil
  - lacak garis waktu kejadian
  - pastikan pemulihan terkonfirmasi

Fase 4: POSTMORTEM
  - dokumen tanpa menyalahkan orang
  - rekonstruksi garis waktu
  - analisis akar masalah (5 why)
  - tindak lanjut dengan penanggung jawab
```

## Tingkat keparahan

| Tingkat | Kriteria | Respons |
|---|---|---|
| SEV1 | Worker/D1 mati atau data pelanggan tidak bisa diakses | segera, semua tangan |
| SEV2 | Alur sinkron berhenti untuk banyak pengguna, atau dashboard mati | dalam 15 menit |
| SEV3 | Satu modul terganggu (mis. ekspor gudang), sebagian pengguna | dalam 1 jam |
| SEV4 | Kosmetik atau dampak rendah | hari kerja berikutnya |

## Keluaran — pembaruan status

```markdown
## Pembaruan Insiden: [judul]
**Tingkat:** SEV[1-4] | **Status:** Menyelidiki | Teridentifikasi | Memantau | Selesai
**Dampak:** [siapa/apa yang terdampak]
**Pembaruan terakhir:** [waktu]

### Keadaan sekarang
[apa yang sudah diketahui]

### Tindakan yang sudah diambil
- [tindakan]

### Langkah berikut
- [apa berikutnya dan kapan]

### Garis waktu
| Waktu | Kejadian |
|---|---|
| [HH:MM] | [kejadian] |
```

## Keluaran — postmortem

```markdown
## Postmortem: [judul insiden]
**Tanggal:** [tanggal] | **Durasi:** [X jam] | **Tingkat:** SEV[X]
**Penulis:** [nama] | **Status:** Draf

### Ringkasan
[2-3 kalimat bahasa biasa]

### Dampak
- [pengguna terdampak]
- [durasi dampak]
- [dampak bisnis kalau bisa diukur]

### Garis waktu
| Waktu | Kejadian |
|---|---|
| [HH:MM] | [kejadian] |

### Akar masalah
[penjelasan rinci]

### 5 Why
1. Kenapa [gejala]? → [karena ...]
2. Kenapa [sebab 1]? → [karena ...]
3. Kenapa [sebab 2]? → [karena ...]
4. Kenapa [sebab 3]? → [karena ...]
5. Kenapa [sebab 4]? → [akar masalah]

### Yang berjalan baik
- [hal yang berhasil]

### Yang berjalan buruk
- [hal yang tidak berhasil]

### Tindak lanjut
| Tindakan | Penanggung jawab | Prioritas | Tenggat |
|---|---|---|---|
| [tindakan] | [nama] | P0/P1/P2 | [tanggal] |
```

## Tips

1. **Mulai menulis segera** — jangan menunggu informasi lengkap. Perbarui sambil belajar.
2. **Jaga pembaruan faktual** — apa yang diketahui, apa yang sudah dilakukan, apa berikutnya. Tanpa spekulasi.
3. **Postmortem tanpa menyalahkan orang** — fokus ke sistem dan proses, bukan individu.
4. **Kalau insidennya menyentuh produksi, naik ke owner** — aksi yang tidak bisa dibalik selalu naik
   dulu, lihat `factory/LAW.md` bagian 7.
