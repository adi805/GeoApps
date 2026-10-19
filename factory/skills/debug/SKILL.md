---
name: {{slug}}-debug
description: Sesi debugging terstruktur: reproduksi, isolasi, diagnosis, perbaikan. Pakai saat ada pesan error atau stack trace, "jalan di lokal tapi tidak di CI", "rusak setelah deploy", atau saat perilaku menyimpang tanpa sebab yang jelas.
---

<!-- Sumber: engineering/skills/debug @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Debug Terstruktur

Cari dan perbaiki masalah secara sistematis, bukan dengan menebak.

## Empat langkah

```
Langkah 1: REPRODUKSI
  - pahami perilaku yang diharapkan vs yang terjadi
  - tentukan langkah reproduksi yang persis
  - tentukan cakupan: sejak kapan, siapa yang terdampak

Langkah 2: ISOLASI
  - persempit ke komponen, modul, atau jalur kode
  - periksa perubahan terakhir (commit, perubahan config, dependency)
  - baca log dan pesan error apa adanya

Langkah 3: DIAGNOSIS
  - bentuk hipotesis, lalu uji
  - telusuri jalur kode
  - temukan akar masalah, bukan cuma gejalanya

Langkah 4: PERBAIKAN
  - usulkan perbaikan dengan penjelasan
  - pertimbangkan efek samping dan kasus tepi
  - usulkan test supaya tidak terulang
```

## Yang gue butuh dari lo

- Pesan error atau stack trace, apa adanya (jangan diparafrase)
- Langkah reproduksi
- Apa yang berubah belakangan ini
- Log atau tangkapan layar
- Perilaku yang diharapkan vs yang terjadi

## Keluaran

```markdown
## Laporan Debug: [ringkasan masalah]

### Reproduksi
- **Diharapkan**: [apa yang seharusnya terjadi]
- **Kenyataan**: [apa yang terjadi]
- **Langkah**: [cara mengulanginya]

### Akar Masalah
[penjelasan kenapa bug-nya muncul]

### Perbaikan
[perubahan kode atau konfigurasi yang diperlukan]

### Pencegahan
- [test yang perlu ditambah]
- [penjaga yang perlu dipasang]
```

## Jebakan yang mahal di proyek ini

1. **Kegagalan yang kelihatan sukses.** Rantai yang exit 0 belum berarti kerjanya benar: `bash -c
   'cmd; echo EXIT=$?'` selalu keluar 0 karena perintah terakhirnya `echo`. Baca log-nya, jangan
   cuma baca exit code.
2. **Harness yang salah ukur.** Kalau semua sampel gagal seragam dengan angka yang identik,
   curigai alat ukurnya dulu, bukan datanya. Uji probe baru pada fixture yang jawabannya sudah
   diketahui: satu positif, satu negatif, satu nyaris.
3. **Berkas yang terlihat rusak.** Jangan simpulkan berkas korup cuma dari keluaran alat baca yang
   berformat. Konfirmasi dengan `od -c`, `cmp`, atau `grep -c` dulu.
4. **Dua rantai di satu pohon.** `dotnet test` atau build yang jalan bersamaan saling menghapus
   artefak dan menghasilkan merah palsu. Cek dulu: `pgrep -f "[d]otnet test"`.

## Tips

1. **Tempel pesan error apa adanya** — teks persisnya penting.
2. **Sebut apa yang berubah** — deploy, update dependency, dan perubahan config adalah tersangka utama.
3. **Sebut konteks** — "hanya kena payload besar" atau "hanya di Windows" mempersempit dengan cepat.
