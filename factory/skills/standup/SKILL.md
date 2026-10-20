---
name: {{slug}}-standup
description: Susun laporan standup dari aktivitas terakhir. Pakai saat menyiapkan standup harian, merangkum commit, PR, dan perpindahan issue kemarin, atau merapikan catatan kasar jadi laporan yang bisa dibagikan.
---

<!-- Sumber: engineering/skills/standup @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Standup

Susun laporan standup dari aktivitas terakhir di repo dan papan tugas.

## Cara menarik datanya

| Sumber | Perintah |
|---|---|
| Commit | `git log --since=yesterday --pretty='%h %s'` |
| PR | `gh pr list --repo {{repo}} --state all --limit 20` |
| Issue | `gh issue list --repo {{repo}} --state all --limit 20` |
| Lane yang sedang jalan | `git worktree list` dan `{{pohon}}-*/` |

Kalau tidak ada akses ke alat di atas, cukup ceritakan apa yang dikerjakan dan gue yang merapikan.

## Keluaran

```markdown
## Standup — [tanggal]

### Kemarin
- [item selesai, dengan nomor issue kalau ada]
- [item selesai]

### Hari ini
- [item yang direncanakan, dengan nomor issue]
- [item yang direncanakan]

### Penghambat
- [penghambat, dengan konteks dan siapa yang bisa membantu]
```

## Aturan isi

1. **Sebut nomor issue** — kerjaan tanpa nomor issue tidak akan pernah ditutup, jadi standup yang
   menyebutnya lebih berguna daripada yang tidak.
2. **Jujur soal yang belum selesai** — laporan setengah jadi yang jujur lebih berharga daripada
   laporan selesai yang salah.
3. **Penghambat wajib punya nama** — "butuh keputusan owner soal X" lebih berguna daripada "terhambat".
4. **Jangan mengarang aktivitas.** Kalau datanya tidak ditarik, bilang tidak ditarik.
