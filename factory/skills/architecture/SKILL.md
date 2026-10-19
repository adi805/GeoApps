---
name: {{slug}}-architecture
description: Buat atau nilai Architecture Decision Record (ADR) di {{proyek}}. Pakai saat memilih teknologi, mencatat keputusan desain beserta trade-off dan konsekuensinya, menilai usulan desain, atau merancang komponen baru dari kebutuhan dan batasan.
---

<!-- Sumber: engineering/skills/architecture @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# ADR dan Penilaian Desain

Buat Architecture Decision Record (ADR), atau nilai usulan desain sistem.

## Kapan dipakai

- "Pilih X atau Y untuk ..." (mis. format penyimpanan sinkron, cara membaca laporan)
- "Nilai usulan desain ini"
- "Rancang komponen ..." dari kebutuhan dan batasan

Untuk kerangka rancangan yang lebih dalam (kebutuhan, analisis skala, trade-off), lihat skill
`{{slug}}-system-design`.

## Keputusan yang sudah disetujui tinggal di mana

Keputusan produk dan teknis yang sudah disetujui tinggal di `docs/prd/DECISIONS.md (dokumen produk)`, bukan di
benang obrolan. ADR dari skill ini mengalir ke sana sesudah disetujui.

## Keluaran: format ADR

```markdown
# ADR-[nomor]: [Judul]

**Status:** Proposed | Accepted | Deprecated | Superseded
**Tanggal:** [tanggal]
**Pemutus:** [siapa yang menandatangani]

## Konteks
[Situasi apa ini? Gaya apa yang bermain?]

## Keputusan
[Perubahan apa yang diusulkan?]

## Opsi yang Dipertimbangkan

### Opsi A: [nama]
| Dimensi | Penilaian |
|---|---|
| Kompleksitas | [rendah/sedang/tinggi] |
| Biaya | [penilaian] |
| Skala | [penilaian] |
| Keakraban tim | [penilaian] |

**Untung:** [daftar]
**Rugi:** [daftar]

### Opsi B: [nama]
[format sama]

## Analisis Trade-off
[Trade-off utama antar opsi, dengan alasan yang jelas]

## Konsekuensi
- [Yang jadi lebih mudah]
- [Yang jadi lebih sulit]
- [Yang perlu ditinjau ulang]

## Langkah Lanjutan
1. [ ] [langkah implementasi]
2. [ ] [tindak lanjut]
```

## Tips

1. **Sebut batasan di depan** — "harus rilis dua minggu lagi" atau "harus tahan 10 ribu permintaan
   per detik" mengubah jawabannya.
2. **Beri nama tiap opsi** — walau condong ke satu arah, analisisnya jadi seimbang kalau
   alternatifnya eksplisit.
3. **Sertakan kebutuhan non-fungsional** — latensi, biaya, keahlian tim, dan beban perawatan sama
   pentingnya dengan fitur.
4. **Periksa tingkatnya sebelum mengerjakan** — perubahan yang menyentuh
   `apps/geolibre-desktop/src-tauri/tauri.*.conf.json` atau `packaging/**` naik ke owner,
   sedangkan `.github/workflows/**` diputuskan agent dengan label `eskalasi`.
   Lihat `factory/LAW.md` bagian 7.
