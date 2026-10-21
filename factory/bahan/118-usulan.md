# #118: satu usulan yang harus diambil lane HQ

**Punya:** lane `ui`, issue #118.
**Kenapa berkas ini ada:** usulan di bawah ditulis lewat `tools/factory/usulan.py catat` dan mendarat di `factory/usulan-ui.jsonl`. Berkas jejak itu dimiliki lane `HQ` lewat glob `factory/**`, jadi lane `ui` tidak boleh meng-commit-nya: `gate_commit_paths.py --lane ui` menolaknya dengan `GAGAL cakupan lane ui dilanggar: 1 path - factory/usulan-ui.jsonl`. Isinya disalin apa adanya di sini supaya tidak hilang, dan `factory/usulan-ui.jsonl` dikembalikan ke versi `origin/main`.

## Cara HQ mengambil

Tambahkan baris di bawah ke `factory/usulan-ui.jsonl` (atau tulis ulang lewat `usulan.py catat` dengan isi yang sama), lalu commit di bawah lane HQ.

```jsonl
{"event": "usulan", "id": "u-ui-e80ba3", "ts": "2026-10-21T17:54:23+07:00", "lane": "ui", "ringkas": "Beranda melaporkan ruang penyimpanan nol karena RecentProjectEntry hanya menyimpan path, name, dan openedAt; komposisi #102 menampilkan 1,7 GB dari 4,2 GB yang tidak bisa diukur dari data itu", "opsi": ["Hitung ukuran berkas proyek dari path saat daftar dimuat (fs stat / Tauri), total penyimpanan dari navigator.storage.estimate", "Biarkan nol dan hapus bilahnya, cukup teks Belum diukur", "Tambahkan field sizeBytes ke RecentProjectEntry di packages/core, isi saat proyek disimpan"], "rekomendasi": 1, "dampak_tunda": "Kartu ruang penyimpanan di beranda tetap melaporkan nol dengan teks Belum diukur, dan bilah kemajuan tidak pernah menjadi ukuran nyata; komposisi #102 tetap tidak sepenuhnya hidup di layar produksi", "issue": 118, "status": "menunggu"}
```

Baris asli yang ditulis `usulan.py` meninggalkan `issue` sebagai `null` dan `dampak_tunda` sebagai string kosong. Dua medan itu diisi di sini: `issue` = 118, dan `dampak_tunda` menyebut apa yang tertunda kalau usulannya tidak diambil. Isi `ringkas`, `opsi`, dan `rekomendasi` tidak diubah.

## Kenapa ini bukan keputusan lane `ui`

`RecentProjectEntry` adalah `{path, name, openedAt}` (`packages/core/src/types.ts`) milik lane lain. Menambah `sizeBytes` ke tipe itu, atau mengukur berkas dari jalur penyimpanan, bukan wewenang lane `ui`: unit #118 hanya memindahkan komposisi #102 ke layar produksi, dan brief-nya eksplisit melarang mengarang angka.

Yang dikerjakan unit ini dengan data yang ada: kartu penyimpanan melaporkan `0` dengan `aria-valuetext="Belum diukur"`, sehingga pembaca layar tidak mengumumkan "0 persen" sebagai hasil pengukuran. Angka 1,7 GB / 4,2 GB dan "12 lapisan" dari komposisi tidak direproduksi.

## Usulan uji yang ikut

Tidak ada. Unit ini tidak menambah usulan lane `uji`: `relativeTime.test.ts` diletakkan di sebelah kodenya (`apps/geolibre-desktop/src/components/layout/mobile/`) karena glob lane `ui` mencakup `src/components/**` sedangkan `tests/**` milik lane `uji`, dan pola "uji di sebelah kode" sudah dipakai `src/styles/tokens.test.ts`.
