---
name: {{slug}}-status-report
description: Susun laporan status dengan KPI, risiko, dan tindak lanjut untuk owner {{proyek}}. Pakai saat menulis pembaruan berkala, merangkum kesehatan proyek dengan status hijau/kuning/merah, atau menyusun daftar keputusan yang perlu diambil owner.
---

<!-- Sumber: operations/skills/status-report @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Laporan Status

Susun laporan status untuk owner. Lawan bicaranya orang sibuk, jadi taruh intinya di depan.

## Keluaran

```markdown
## Laporan Status: [proyek/lane] — [periode]
**Penulis:** [nama] | **Tanggal:** [tanggal]

### Ringkasan
[3-4 kalimat: apa yang on-track, apa yang perlu perhatian, kemenangan kunci]

### Status keseluruhan: hijau / kuning / merah

### Metrik kunci
| Metrik | Target | Kenyataan | Arah | Status |
|---|---|---|---|---|
| [KPI] | [target] | [kenyataan] | naik/turun/datar | hijau/kuning/merah |

### Yang selesai periode ini
- [kemenangan 1, dengan nomor issue]
- [kemenangan 2]

### Yang sedang jalan
| Item | Penanggung jawab | Status | Perkiraan | Catatan |
|---|---|---|---|---|
| [item] | [lane] | [status] | [tanggal] | [konteks] |

### Risiko dan masalah
| Risiko/masalah | Dampak | Mitigasi | Penanggung jawab |
|---|---|---|---|
| [risiko] | [dampak] | [yang dilakukan] | [siapa] |

### Keputusan yang dibutuhkan owner
| Keputusan | Konteks | Tenggat | Rekomendasi |
|---|---|---|---|
| [keputusan] | [kenapa penting] | [kapan] | [apa yang gue sarankan] |

### Prioritas periode berikutnya
1. [prioritas 1]
2. [prioritas 2]
3. [prioritas 3]
```

## Sumber datanya

| Angka | Dari mana |
|---|---|
| Commit dan PR | `git log`, `gh pr list --repo {{repo}}` |
| Papan tugas | `gh issue list --repo {{repo}}` |
| Lane aktif | `git worktree list`, `{{pohon}}-*/` |
| Catatan lintas lane | `factory/ledger.jsonl` |

## Tips

1. **Pimpin dengan kesimpulan** — pembaca sibuk membaca tiga baris pertama. Bikin yang tiga itu berarti.
2. **Jujur soal risiko** — menyebut masalah lebih awal membangun kepercayaan. Kejutan merusaknya.
3. **Permudah keputusan** — tiap keputusan yang diminta sertakan konteks dan rekomendasi.
4. **Tiap angka punya sumber.** Kalau sebuah angka tidak ditarik dari alat, jangan tulis angkanya:
   tulis bahwa angkanya belum diukur.
