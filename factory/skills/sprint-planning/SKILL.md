---
name: {{slug}}-sprint-planning
description: Rencanakan satu periode kerja {{proyek}}: batasi lingkup, hitung kapasitas, tetapkan tujuan, dan susun rencana. Pakai saat memulai periode baru, menyaring papan tugas terhadap kapasitas yang tersedia, menentukan mana P0 dan mana cadangan, atau menangani sisa periode sebelumnya.
---

<!-- Sumber: product-management/skills/sprint-planning @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Rencana Periode Kerja

Susun rencana satu periode dengan membatasi lingkup, menghitung kapasitas, dan menetapkan tujuan.

## Yang gue butuh

- **Periode**: berapa lama (biasanya satu sampai dua minggu)
- **Papan tugas**: apa yang berprioritas? (tarik dari `gh issue list --repo {{repo}}`)
- **Sisa periode lalu**: ada yang belum selesai?
- **Ketergantungan**: ada yang tertahan menunggu hal lain?
- **Kapasitas**: lane mana yang tersedia, dan berapa sesi/rantai yang bisa jalan tanpa bentrok

## Kapasitas di proyek ini

Kapasitas di sini bukan hari-orang, tapi **rantai kerja per pohon**. Batasnya keras:

| Batas | Alasan |
|---|---|
| Satu rantai `dotnet test`/build per pohon | dua rantai di satu pohon saling menghapus artefak, hasilnya merah palsu |
| joyboy: satu rantai berat, dibungkus `nice -n 19 ionice -c3` | RAM 4 GB, host menjalankan produksi |
| tencent: runner CI jalur utama untuk uji Windows dan uji berat | joyboy jalur cadangan |

Jadi rencana yang menumpuk banyak unit kerja berat sekaligus di satu mesin itu bukan rencana, itu
antrean yang akan saling membunuh. Sebutkan urutannya.

## Keluaran

```markdown
## Rencana Periode: [nama]
**Tanggal:** [mulai] sampai [selesai]
**Tujuan periode:** [satu kalimat tentang apa yang berhasil]

### Kapasitas
| Lane | Unit kerja bisa diambil | Catatan |
|---|---|---|
| [lane] | [n] | [ketergantungan, batas mesin] |
| **Total** | **[n]** | |

### Papan periode
| Prioritas | Item | Issue | Lane | Ketergantungan |
|---|---|---|---|---|
| P0 | [harus jalan] | #[n] | [lane] | [tidak ada / tertahan X] |
| P1 | [sebaiknya jalan] | #[n] | [lane] | [tidak ada] |
| P2 | [cadangan] | #[n] | [lane] | [tidak ada] |

### Risiko
| Risiko | Dampak | Mitigasi |
|---|---|---|
| [risiko] | [apa jadinya] | [yang dilakukan] |

### Definisi selesai
- [ ] Kriteria selesai di issue terpenuhi, keluarannya ditempel
- [ ] Pemeriksa yang relevan hijau
- [ ] Commit ada di branch, hash-nya disebut
- [ ] Issue dikomentari dengan hash dan bukti
- [ ] `git status --short` bersih

### Tanggal kunci
| Tanggal | Peristiwa |
|---|---|
| [tanggal] | periode mulai |
| [tanggal] | pemeriksaan tengah periode |
| [tanggal] | periode selesai |
```

## Tips

1. **Sisakan bantalan** — rencanakan sekitar 70-80% kapasitas. Interupsi pasti datang.
2. **Satu tujuan yang jelas** — kalau tidak bisa dinyatakan dalam satu kalimat, periodenya tidak fokus.
3. **Tandai item cadangan** — tahu apa yang dipotong kalau ada yang lebih lama dari perkiraan.
4. **Sisa periode lalu jujur** — kalau ada yang tidak selesai, pahami kenapa sebelum dijanjikan ulang.
5. **Tiap item wajib punya nomor issue.** Kerjaan tanpa nomor issue tidak ada dan tidak akan
   pernah ditutup, lihat `factory/LAW.md` bagian 2.
