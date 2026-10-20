---
name: {{slug}}-stakeholder-update
description: Susun pembaruan untuk audiens dan irama tertentu. Pakai saat menulis laporan mingguan atau bulanan untuk owner, mengumumkan rilis, mengeskalasi risiko atau penghambat, atau menerjemahkan kemajuan yang sama jadi versi ringkas untuk owner, versi rinci untuk lane, atau versi untuk pengguna.
---

<!-- Sumber: product-management/skills/stakeholder-update @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Pembaruan untuk Audiens

Susun pembaruan yang disesuaikan dengan pembacanya.

## Audiens di proyek ini

| Audiens | Yang dia mau | Panjang |
|---|---|---|
| Owner (Adi) | kesimpulan, status, risiko yang perlu keputusannya, permintaan spesifik | di bawah 300 kata |
| Lane lain | apa yang dikerjakan, apa yang menghambat, keputusan yang mengubah kerja mereka | seperlunya, terstruktur |
| Pengguna | apa yang baru dan manfaatnya, tanpa jargon internal | singkat |

## Cara mengambil datanya

| Angka | Dari mana |
|---|---|
| Commit dan PR | `git log`, `gh pr list --repo {{repo}}` |
| Papan tugas | `gh issue list --repo {{repo}}` |
| Catatan lintas lane | `factory/ledger.jsonl` |
| Lane aktif | `git worktree list`, `{{pohon}}-*/` |

Kalau tidak ditarik dari alat, jangan tulis angkanya. Tulis bahwa angkanya belum diukur.

## Format: pembaruan untuk owner

```
Status: [hijau / kuning / merah]

Intinya: [satu kalimat, hal paling penting untuk diketahui]

Kemajuan:
- [hasil yang dicapai, dengan nomor issue]
- [tonggak, dengan dampaknya]

Risiko:
- [risiko]: [rencana mitigasi]. [permintaan kalau ada].

Keputusan yang dibutuhkan:
- [keputusan]: [opsi + rekomendasi]. Dibutuhkan sebelum [tanggal].

Tonggak berikutnya:
- [tonggak] — [tanggal]
```

## Format: pembaruan untuk lane lain

```
Selesai:
- [item] — [nomor issue/PR]. [dampaknya kalau penting].

Sedang jalan:
- [item] — [lane]. [perkiraan selesai]. [penghambat kalau ada].

Keputusan:
- [keputusan yang sudah diambil]: [alasannya].
- [keputusan yang dibutuhkan]: [konteks], [opsi], [rekomendasi].

Akan datang:
- [item berikutnya] — [kenapa ini berikutnya]
```

## Format: pembaruan untuk pengguna

```
Yang baru:
- [fitur] — [manfaat dalam bahasa pengguna]. [cara memakainya].

Segera hadir:
- [fitur] — [perkiraan waktu]. [kenapa penting buat mereka].

Kendala yang diketahui:
- [kendala] — [status]. [jalan pintas kalau ada].
```

## Warna status

| Warna | Arti |
|---|---|
| Hijau | berjalan sesuai rencana, tidak ada risiko berarti |
| Kuning | lebih lambat dari rencana, atau satu risiko sudah muncul; mitigasi jalan tapi hasilnya belum pasti |
| Merah | jauh di belakang rencana, penghambat besar tanpa mitigasi jelas |

Pindah ke kuning pada tanda risiko **pertama**, bukan setelah yakin buruk. Pindah ke merah saat
opsi sendiri sudah habis dan butuh eskalasi. Kembali ke hijau hanya kalau risikonya benar-benar
selesai, bukan sekadar berhenti sementara.

## Kerangka ROAM untuk risiko

- **Resolved**: risiko selesai. Catat bagaimana diselesaikan.
- **Owned**: ada yang mengelola. Sebut pemiliknya dan rencana mitigasinya.
- **Accepted**: diketahui, dipilih untuk tetap jalan tanpa mitigasi. Catat alasannya.
- **Mitigated**: sudah dikurangi ke tingkat yang bisa diterima. Catat apa yang dilakukan.

## Aturan

1. **Jangan mengubur intinya.** Taruh hal terpenting di paling atas.
2. **Kalau ada kabar buruk, taruh di depan.** Jangan disembunyikan setelah kabar baik.
3. **Permintaan harus spesifik**: "butuh keputusan soal X sebelum Jumat", bukan "butuh dukungan".
4. **Untuk owner, bingkai semuanya sebagai hasil**, bukan aktivitas. "Sinkron sudah jalan untuk 3 perusahaan" lebih berguna daripada "14 kali standup".
5. **Tiap angka punya sumber.** Angka yang tidak ditarik dari alat tidak boleh ditulis.
