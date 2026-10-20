# #95: dua spec yang tidak mengikuti boot HomeScreen

Lane `uji`, branch `uji/95-boot-home`, worktree `~/GeoApps-uji-95`.

## 1. style-manager: reload mendarat di HomeScreen

`e2e/style-manager.spec.ts:69-70` memanggil `openStyleManager(page)` tepat setelah `page.reload()`.
Reload mengembalikan `screen` ke `home`, `DesktopShell` hanya dipasang untuk `viewer`, jadi
`getByRole("button", { name: "Settings", exact: true })` tidak pernah resolve dan kliknya menunggu
120 detik penuh.

Perbaikan: `await enterViewer(page);` di antara keduanya. Pola yang sama sudah dipakai
`plugin-install.spec.ts:113-114` dan `pwa.spec.ts:117-120`. Nol perubahan produk.

## 2. open-recent: seed menimpa daftar recent aplikasi

`waitForMap()` -> `openViewer()` -> `seedViewerEntry()` memasang `addInitScript` yang menulis
`localStorage["geolibre.recentProjects"] = [seed]` pada SETIAP navigasi, sementara aplikasi menyimpan
daftar recent-nya sendiri di kunci yang sama (`useRecentProjectsPersistence.ts:43`). Spec memanggil
`waitForMap` untuk kedua kalinya sesudah menyimpan proyek, jadi proyek itu terhapus dari menu Open
Recent dan klik pada barisnya menunggu menuitem yang tidak ada.

Dua arah yang ditawarkan issue:

| Arah | Isi | Kenapa dipilih / tidak |
|---|---|---|
| 1 | Seed sekali saja (jangan `waitForMap` untuk navigasi kedua, atau `openViewer` menerima opsi melewati seeding) | Risiko kecil, tapi hanya memperbaiki satu pemanggil. 19 spec memanggil `waitForMap` lebih dari sekali, dan semuanya kehilangan state recent aplikasi pada navigasi kedua. |
| 2 | Seed digabung, bukan ditimpa | **Dipilih.** Memperbaiki kelasnya, bukan satu test. `seedViewerEntry` dipakai banyak spec, jadi perbaikan di helper menutup seluruh jalur. |

Bentuk yang dipakai: daftar yang sudah ada dibaca, entri seed diletakkan paling depan (supaya baris
yang diklik `enterViewer` tetap yang teratas), entri dengan `path` yang sama tidak diduplikasi, dan
storage yang tidak terbaca atau JSON cacat jatuh ke seed saja supaya kliknya masih punya target.

## Bukti

- `features 4/4`: 25 passed, 0 failed (sebelumnya 2 failed 23 passed). Dua test style-manager lulus
  di percobaan pertama, 18,9 dtk dan 20,0 dtk.
- `features 2/4`: `open-recent` lulus 8,6 dtk di percobaan pertama (sebelumnya gagal 1,1 menit).
  Shard itu tetap merah karena 17 kegagalan `mapbox-*`, kelas yang menunggu keputusan owner soal
  token Mapbox di CI (usulan `u-uji-59c1ec`). Nol baris `mapbox-*` disentuh.
- `npx eslint` ketiga berkas exit 0; `tsc --noEmit` nol galat.

Batas: spec tidak bisa dijalankan di mesin lane (cgroup `memory.max = 2516582400`, `npx playwright
test` mati `Reached heap limit` di heap ~707 MB; `node_modules` worktree symlink ke pohon lain yang
hardlink-nya tidak lengkap). Verifikatornya runner CI, dan angka di atas keluaran runner apa adanya.
