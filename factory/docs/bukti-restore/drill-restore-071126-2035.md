# Drill Restore Bundel Proyek 071126-2035

Drill restore yang benar-benar dijalankan, bukan rencana. Diuji di laptop `adijr`, 2026-11-07 20:35 WIB.

## Cakupan

| Item | Nilai |
|---|---|
| Sumber | `factory/docs/contoh-proyek/proyek-lapangan` |
| Arsip | `factory/docs/contoh-proyek/bundel-proyek.zip` (748 byte) |
| Tujuan | `~/g98/GeoApps-restore/proyek-lapangan` |
| Perintah restore | `unzip -o factory/docs/contoh-proyek/bundel-proyek.zip -d ~/g98/GeoApps-restore/` |
| Berkas diuji | 3 |

## Hasil

| Berkas | sha256 sebelum zip | sha256 setelah unzip | Cocok |
|---|---|---|---|
| catatan.txt | c110fb8028d59eab6b8adec55f179394da5320770e8ade7e3ff8c6e781ab4edd | sama | ya |
| jejak-1.csv | 03ff61bd7691ad89b0c2c9f128920ac36bde021dba7edd2331e82dca2b76aeba | sama | ya |
| project.json | 9242d3b471bb062fd1391c1aa89e0969d64d87cd50ff6c4c526212879a87566a | sama | ya |

Kesimpulan: arsip bundel kembali utuh, 3 dari 3 berkas identik.

## Yang Belum Diuji

- Impor lewat aplikasi GeoApps di perangkat Android belum pernah dijalankan. Drill ini membuktikan bentuk arsipnya, bukan jalur `importBundleFile` di perangkat.
- Belum ada uji restore untuk arsip basemap di IndexedDB maupun untuk foto titik lapangan.

Celah ini masuk Milestone 3 di `PRD.md`, bukan dianggap selesai oleh drill ini.
