---
name: {{slug}}-testing-strategy
description: Rancang strategi dan rencana test untuk {{proyek}}. Pakai saat menentukan cara menguji sebuah perubahan, menyusun rencana test, atau menutup celah cakupan test.
---

<!-- Sumber: engineering/skills/testing-strategy @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Strategi Test

Rancang strategi test yang seimbang antara cakupan, kecepatan, dan beban perawatan.

## Piramida test

```
        /  E2E  \         sedikit, lambat, keyakinan tinggi
       / Integrasi \      sebagian, sedang
      /  Unit Test  \     banyak, cepat, terfokus
```

## Strategi per jenis komponen

- **Endpoint API / Worker**: unit test untuk logika bisnis, test integrasi untuk lapisan HTTP, test kontrak untuk konsumen
- **Alur sinkron**: validasi masukan, kebenaran transformasi, test idempotensi (jalankan dua kali, hasil harus sama)
- **Desktop (Tauri + React)**: test komponen, test interaksi, regresi visual
- **Skema D1 / migrasi**: test maju, test mundur, dan test bahwa data lama tetap terbaca
- **Laporan dan ekspor**: test paritas angka, bukan cuma "tidak error"

## Yang perlu dicakup

Alur penting bisnis, penanganan error, kasus tepi, batas keamanan, integritas data.

Lewati: getter/setter sepele, kode framework, skrip sekali pakai.

## Keluaran

Rencana test: apa yang diuji, jenis test tiap area, target cakupan, dan contoh kasus. Sebutkan celah
cakupan yang ada, jangan cuma daftar yang sudah hijau.

## Cara menjalankan di proyek ini

| Perintah | Untuk apa |
|---|---|
| `npm test` | uji frontend (`tests/*.test.ts`) |
| `npm run test:backend` | uji backend Python (`pytest`) |
| `npm run check:rust` | `cargo check` untuk `apps/geolibre-desktop/src-tauri` |
| `npm run typecheck` | TypeScript seluruh workspace |
| `npm run ci` | rantai penuh: lint, build, uji frontend, backend, Rust |

Satu rantai test berat per pohon, dan di joyboy selalu dibungkus `nice -n 19 ionice -c3`, lihat
`factory/LAW.md` bagian 9. Test yang tidak membuktikan apa pun (selalu hijau apa pun inputnya) itu
dekorasi, bukan pemeriksaan.
