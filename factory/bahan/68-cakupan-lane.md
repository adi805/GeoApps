# #68 — celah cakupan lane: tiga path tanpa pemilik

Untuk HQ. Ditulis di `factory/bahan/` karena berkas jejak `factory/usulan-ui.jsonl` dimiliki lane
`HQ` dan gate menolaknya dari PR berlabel `lane:ui`; isinya disalin ke sini supaya bisa dibaca dari
PR tanpa menunggu salvage.

## Usulan yang dicatat

```
id           : u-ui-6e0442
lane         : ui
issue        : 68
status       : menunggu
ts           : 2026-10-20T18:39:51+07:00
berkas asli  : ~/GeoApps-ui-token-visual/factory/usulan-ui.jsonl (untracked)
```

**Ringkas.** Tiga path yang diberikan brief issue #68 tidak masuk glob lane mana pun di
`factory/lanes.json`. Diperiksa untuk kesembilan lane, nol kecocokan:

| Path | Lane yang mencakup |
|---|---|
| `apps/geolibre-desktop/scripts/gen-tokens-css.mjs` | tidak ada |
| `apps/geolibre-desktop/src/index.css` | tidak ada |
| `apps/geolibre-desktop/src/styles/tokens.css` | tidak ada |

(`apps/geolibre-desktop/src/styles/tokens.test.ts` **masuk** lane `ui` lewat
`src/**/*.test.ts`, jadi ujinya sendiri tidak bermasalah.)

**Tiga opsi.**

1. Tambah tiga path itu apa adanya ke glob lane `ui`.
2. Perluas dengan pola: `apps/geolibre-desktop/src/*.css`,
   `apps/geolibre-desktop/src/styles/**`, `apps/geolibre-desktop/scripts/gen-*-css.mjs`.
3. Biarkan glob sekarang, dan tiap commit #68 diajukan manual ke HQ lewat override lane.

**Rekomendasi: opsi 2.** Generator CSS akan dipakai lagi tiap palet berubah, dan `src/*.css`
adalah tempat setiap app memasang stylesheet akarnya. Satu pola lebih murah daripada tiga entri
literal yang harus ditambah lagi di unit berikutnya.

**Dampak tunda.** Commit dan PR #73 sudah ada dan tiga kriteria pertama hijau lokal; yang tertahan
hanya merge, karena `factory-gate` merah pada langkah "Cakupan lane dan eskalasi". LAW 7.3 syarat 1
menuntut `factory-gate` hijau sebelum agent boleh merge, jadi PR ini naik ke HQ.

## Catatan pelaksanaan

`factory/lanes.json` dibaca dari **HEAD PR**, bukan dari `origin/main`. Jadi setelah glob diperluas
di `main`, branch `ui/token-visual` tetap merah sampai `main` di-merge ke dalamnya. Urutannya:
perluas glob di `main` → `git merge origin/main` di branch ini → gate hijau → merge.

## Celah kedua yang belum punya lane

`apps/geolibre-desktop/src/styles/tokens.test.ts` hijau lokal (`5 pass, 0 fail`), tetapi CI tidak
pernah menjalankannya: `test:frontend` hanya memanggil `node --import tsx --test tests/*.test.ts`,
sedangkan berkas ini ada di `apps/**`. Menyambungkannya butuh `package.json` akar atau
`.github/workflows/ci.yml`, dua-duanya di luar cakupan lane `ui` dan di luar izin lane ini. Sampai
itu terjadi, kriteria 3 issue #68 hanya terbukti kalau perintahnya dijalankan manual.
