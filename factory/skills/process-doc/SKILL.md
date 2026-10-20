---
name: {{slug}}-process-doc
description: Dokumentasikan sebuah proses bisnis: diagram alur, RACI, dan SOP. Pakai saat memformalkan proses yang selama ini ada di kepala orang, menyusun RACI untuk memperjelas siapa memiliki apa, menulis SOP untuk serah terima atau audit, atau mencatat pengecualian dan kasus tepi dari cara kerja yang sebenarnya.
---

<!-- Sumber: operations/skills/process-doc @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Dokumen Proses

Dokumentasikan proses bisnis sebagai SOP yang lengkap.

## Cara kerja

Ceritakan prosesnya, tempel dokumen yang sudah ada, atau sebut namanya saja dan gue akan bertanya
hal yang tepat.

## Keluaran

```markdown
## Dokumen Proses: [nama proses]
**Pemilik:** [orang/tim] | **Terakhir diperbarui:** [tanggal] | **Siklus tinjauan:** [kuartalan/tahunan]

### Tujuan
[kenapa proses ini ada dan apa yang dicapainya]

### Lingkup
[apa yang termasuk dan tidak termasuk]

### Matriks RACI
| Langkah | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| [langkah] | [yang mengerjakan] | [yang memiliki] | [yang ditanya] | [yang diberi tahu] |

### Alur proses
[diagram ASCII atau uraian langkah demi langkah]

### Langkah rinci

#### Langkah 1: [nama]
- **Siapa**: [peran]
- **Kapan**: [pemicu atau waktu]
- **Bagaimana**: [instruksi rinci]
- **Keluaran**: [apa yang dihasilkan langkah ini]

### Pengecualian dan kasus tepi
| Skenario | Yang dilakukan |
|---|---|
| [pengecualian] | [cara menanganinya] |

### Metrik
| Metrik | Target | Cara mengukur |
|---|---|---|
| [metrik] | [target] | [metode] |

### Dokumen terkait
- [tautan ke proses atau kebijakan terkait]
```

## Konteks proyek ini

- Proses factory (briefing, dispatch, closing, eskalasi) sudah punya rumahnya di `factory/LAW.md`.
  Jangan diduplikasi di sini: dokumen proses di skill ini untuk proses bisnis modul (mis. alur tutup
  buku, alur penerimaan barang), bukan hukum factory.
- Kalau prosesnya menyentuh rilis atau produksi, langkahnya wajib menyebut jalur eskalasi ke owner
  (`factory/LAW.md` bagian 7).

## Tips

1. **Mulai dari yang berantakan** — tidak perlu uraian sempurna. Ceritakan cara kerjanya hari ini,
   gue yang menstrukturkan.
2. **Sertakan pengecualian** — "biasanya X, tapi kadang Y" itu bagian paling berharga untuk dicatat.
3. **Sebut orangnya** — walau perannya berubah, tahu siapa mengerjakan apa hari ini membantu.
