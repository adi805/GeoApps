# Rancangan: bundel proyek portabel (`offline-bundle`)

> Status: **implementasi** di `apps/geolibre-desktop/src/lib/` (issue #11, lane `offline`).
> Kode: `project-manifest.ts` (skema, jalur, sha256, parse/serialize) ·
> `project-bundle.ts` (impor/verifikasi/buka/hapus) ·
> `offline-region-manifest.ts` (katalog region → manifes) ·
> `project-bundle-tauri.ts` (store `$APPLOCALDATA/projects/<slug>/`) ·
> `project-bundle-web.ts` (store IndexedDB).
> Uji: `*.test.ts` di sebelah tiap modul (64 uji) + prototipe
> `factory/bahan/offline-bundle.test.ts` (21 uji) = 85 uji, semuanya lulus.
> Verifikasi: `node --import tsx --test <berkas>` dan `npx tsc --noEmit --strict` exit 0.

## 1. Masalah

Proyek `.geolibre.json` menyimpan **jalur absolut** ke berkas yang dipakainya:

| Jenis | Tempat sekarang | Akibat di Android |
|---|---|---|
| PDF peta | `sourcePath` absolut / `content://` | izin baca SAF mati bersama proses |
| GeoTIFF | `sourcePath` absolut / `content://` | sama |
| Foto lapangan | data URL base64 di properti `geolibre_photos` | ikut di JSON, membengkak, tapi tidak hilang |

Di Android, berkas dari pemilih sistem datang sebagai `content://...` dengan
grant sementara. Aplikasi ditutup → grant hilang → proyek dibuka ulang → lapisan
kosong tanpa penjelasan. Di desktop masalahnya lebih ringan tapi sama bentuknya:
proyek cuma seportabel folder yang kebetulan dirujuknya.

## 2. Bentuk solusi

Satu direktori milik aplikasi per proyek:

```
$APPLOCALDATA/projects/<slug>/          (Tauri)
  project.json                          manifes
  peta/scan-desa.pdf                    berkas disalin masuk
  raster/dem.tif
  foto/IMG_0042.jpg
```

Web: root yang sama, tapi lewat IndexedDB (`projects/<slug>/<path>` sebagai key).
Modul ini tidak tahu bedanya — semua I/O lewat antarmuka `BundleStore`.

**Aturan inti: proyek menyimpan jalur RELATIF.** `peta/scan-desa.pdf`, bukan
`/storage/emulated/0/Download/scan-desa.pdf`. Itu yang membuat bundel bisa
dipindah, dicadangkan, dan dibuka di perangkat lain tanpa menulis ulang apa pun.

## 3. Skema `project.json`

```jsonc
{
  "schema": "geolibre.project.manifest",
  "version": 1,
  "projectId": "survei-desa-sukamaju",     // = nama direktori (slug)
  "name": "Survei Desa Sukamaju",
  "createdAt": "2026-10-19T22:00:00.000Z",
  "updatedAt": "2026-10-19T22:04:11.000Z",
  "files": [
    {
      "path": "peta/scan-desa.pdf",        // relatif, POSIX, wajib aman
      "bytes": 1048576,                    // ukuran byte yang disalin
      "sha256": "9f2c…",                   // hex huruf kecil, 64 char
      "kind": "map",                       // map | raster | photo | other
      "importedAt": "2026-10-19T22:00:03.000Z",
      "source": "scan-desa.pdf"            // asal, untuk "cari berkas ini lagi"
    }
  ],
  "offlineRegions": [
    {
      "id": "reg_01H…",
      "name": "Sukamaju",
      "bbox": [106.7, -6.9, 106.9, -6.7],
      "minZoom": 10,
      "maxZoom": 16,
      "tileCount": 4211,
      "hosts": ["tile.openstreetmap.org"],
      "bytes": 188743680
    }
  ],
  "totals": { "files": 1, "bytes": 1048576, "offlineRegionBytes": 188743680 }
}
```

### Kenapa `schema` dan `version` terpisah

`schema` menjawab "ini manifes GeoLibre atau JSON lain?"; `version` menjawab
"build ini paham isinya?". Manifes dengan `version` lebih baru **ditolak**,
bukan diabaikan sebagian: membuka proyek yang setengah dimengerti lebih buruk
daripada pesan "perbarui aplikasi".

### Kenapa `totals` disimpan padahal bisa dihitung

Dihitung ulang saat serialisasi (`serializeManifest`) dan saat parse
(`parseManifest`), jadi nilai di disk tidak pernah dipercaya. Yang disimpan cuma
supaya `project.json` bisa dibaca manusia/tool lain tanpa menjalankan kode kita.

### Kenapa `offlineRegions` ikut

`offline-regions.ts` menyimpan region di `localStorage` (per perangkat, bukan per
proyek). Ubinnya sendiri ada di cache service worker. Manifes mencatat **field
identitasnya** saja, supaya proyek bisa menjawab "berapa ukuran total proyek ini
kalau dibawa offline" dan "region mana yang menyertai proyek ini". Ubin tidak
disalin ke bundel; kalau nanti perlu portabel benar, itu langkah terpisah
(ekspor `.mbtiles` lewat `mbtiles.ts`).

## 4. Aturan keamanan jalur

`isSafeBundlePath` menolak, tanpa kecuali:

| Ditolak | Contoh | Kenapa |
|---|---|---|
| absolut | `/etc/passwd` | keluar dari direktori proyek |
| drive letter | `C:\Windows\x` | Windows, dan backslash ambigu |
| segmen `..` | `../../lain/project.json` | menulis/menghapus proyek lain |
| segmen kosong / `.` | `a//b`, `./a` | normalisasi tidak konsisten antar FS |
| backslash | `peta\a.pdf` | dua konvensi separator |
| NUL byte | `a\0b.pdf` | terpotong di sebagian API FS |
| kosong / > 512 char | `""` | bukan nama |

`assertSafeBundlePath` = versi yang melempar `UnsafeBundlePathError`.
`importBundleFile` juga menolak `path === "project.json"` — manifes tidak boleh
ditimpa lewat jalur impor berkas.

## 5. Operasi

| Fungsi | Sifat |
|---|---|
| `createManifest` | bangun manifes baru; `now` disuntik (uji tidak bergantung jam) |
| `serializeManifest` | urutkan `files` per path, hitung ulang `totals`, tulis 2 spasi + newline |
| `parseManifest` | validasi tiap field, lempar `ManifestError`; duplikat path ditolak |
| `readManifest` / `writeManifest` | lewat `BundleStore` |
| `importBundleFile` | tulis byte dulu → baru catat entri berisi hash byte yang benar-benar ditulis |
| `withOfflineRegions` | ganti daftar region + segarkan `totals` |
| `bundleRegionFromOfflineRegion` | satu `OfflineRegion` → `BundleOfflineRegion` (lihat §5a) |
| `applyOfflineRegions` | seluruh katalog → manifes, ukuran byte opsional per id |
| `missingOfflineRegions` | region yang diminta proyek tapi belum ada di perangkat ini |
| `verifyBundle` | `missing[]` / `mismatched[]` / `ok` |
| `openBundle` | baca manifes → verifikasi → `status: "ok" \| "incomplete"` |
| `deleteBundle` | hapus semua yang di-`list` + manifes; kembalikan daftar yang terhapus |

### Urutan impor (penting)

Salin byte **dulu**, catat entri **belum**. Kalau penulisan gagal, manifes tidak
pernah menyebut berkas yang tidak ada. Impor ulang path yang sama mengganti
entri (yang terbaru menang), bukan menumpuk dua entri untuk satu berkas.

### Berkas hilang ≠ crash

`verifyBundle` **melaporkan**, tidak melempar. `openBundle` mengembalikan
`status: "incomplete"` beserta daftarnya. Pemanggil wajib menampilkan daftar itu
dan menawarkan cari ulang (poin 3 brief), bukan membuka proyek setengah jadi
seolah utuh. Hash yang tidak cocok dilaporkan sama: berkas berubah di luar
aplikasi adalah fakta yang harus dilihat pengguna.

Pengecualian: **manifes** yang gagal parse adalah error. Direktori tanpa
`project.json` bukan bundel, dan "proyek kosong" yang terbuka diam-diam terlihat
persis seperti kehilangan data.

### 5a. Region: pemetaan yang sengaja lossy

Katalog di `offline-regions.ts` itu **per perangkat**; `project.json` **berpindah
perangkat**. Jadi adaptornya membuang, dan yang dibuang itu memang intinya:

| Field `OfflineRegion` | Di manifes? | Alasan |
|---|---|---|
| `id`, `name`, `bbox`, `minZoom`, `maxZoom`, `tileCount`, `hosts` | ya | identitas area yang dibutuhkan proyek |
| `tileUrls`, `assetUrls` | **tidak** | URL yang dihangatkan di sini tak berarti di cache perangkat lain, dan jumlahnya besar |
| `createdAt`, `updatedAt` | **tidak** | per perangkat; manifes sudah punya `updatedAt` sendiri |
| `bytes` | opsional | hanya diisi kalau pemanggil benar-benar mengukur region itu |

`bbox` dan `hosts` **disalin**, bukan di-alias: memutasi manifes tidak boleh
merusak katalog yang masih hidup di `localStorage`. `missingOfflineRegions()`
menjawab kasus buka-di-instalasi-baru: daftar area yang harus diunduh lagi,
dalam urutan manifes supaya prompt-nya stabil.

### Hapus proyek

`BundleStore` sudah terikat ke satu direktori proyek, jadi `list()` secara
konstruksi tidak bisa menyentuh proyek lain. `deleteBundle` menambahkan
`project.json` secara eksplisit (kalau implementasi store lupa memasukkannya),
melewati path tidak aman, dan melanjutkan meski satu berkas gagal dihapus —
pemanggil membandingkan `removed` dengan daftar awal untuk melaporkan sisa.
Tidak ada `rm -rf` rekursif di luar daftar itu.

## 6. Antarmuka penyimpanan

```ts
interface BundleStore {
  write(path: string, bytes: Uint8Array): Promise<void>;
  read(path: string): Promise<Uint8Array>;
  list(): Promise<string[]>;      // relatif, POSIX
  remove(path: string): Promise<void>;
}
```

Dua implementasi, keduanya sudah ada:

1. **Tauri** — `project-bundle-tauri.ts`, `createTauriBundleStore(slug, io?)`
   mengikat store ke `$APPLOCALDATA/projects/<slug>/`. `list()` menelusuri
   subdirektori; `write()` membuat direktori induk (`mkdir recursive`).
   `listBundleProjectSlugs()` memberi daftar bundel di perangkat.
   **Masih butuh `fs:scope` `$APPLOCALDATA/projects/**` di
   `src-tauri/capabilities/default.json`** — sekarang cuma `startup-projects`
   yang di-scope, jadi setiap tulis gagal "forbidden path". Path itu milik lane
   `android` → diajukan lewat komentar #11, bukan dikerjakan di sini.
2. **Web** — `project-bundle-web.ts`, IndexedDB `geolibre-project-bundles` v1,
   object store `bundle-files`, key `"<slug>/<path>"`. Satu record per **berkas**,
   bukan per proyek: menulis ulang satu record proyek tiap impor foto berarti
   menyalin ratusan MB. `list()` = prefix scan atas key saja (tanpa membaca
   bytes), jadi dua proyek tak mungkin saling melihat berkas.

Keduanya menerima I/O yang disuntik (`BundleDirIo`, `BundleFileTable`) dan
memanggil `assertSafeBundlePath` **lagi** di lapisan store: manifes buatan tangan
pun tidak bisa keluar dari direktorinya. Binding asli (`@tauri-apps/plugin-fs`,
`appLocalDataDir`, `indexedDB`) diimpor lazy, jadi modul tetap bisa diuji di Node
dan tidak membebani build web.

## 7. Yang belum diputuskan

- **Slug tabrakan.** Dua proyek bernama sama → slug sama → direktori sama.
  Usul: `projectId` = slug + sufiks `-2`, `-3` saat tabrakan terdeteksi; yang
  menentukan HQ/UI, bukan modul ini.
- **Foto base64 vs berkas.** `field-collection.ts` menyimpan foto sebagai data
  URL di properti `geolibre_photos`. Memindahkannya ke berkas di bundel
  memotong ukuran JSON secara drastis, tapi mengubah format proyek → perlu
  migrasi. `bundleFileKind` sudah siap menerima `photo/*.jpg` kalau itu dipilih.
- **Ukuran region.** `offline-regions.ts` tidak menyimpan byte per region;
  `bytes` opsional sampai ada yang bisa mengukurnya (Cache API `estimate`).
- **Batas ukuran bundel.** `MAX_STARTUP_SNAPSHOT_BYTES = 25 MB` adalah preseden;
  bundel proyek sengaja tanpa batas karena PDF peta bisa ratusan MB. Kalau
  perlu batas, itu keputusan produk.

## 8. Pemetaan ke kriteria selesai #11

| Kriteria | Ditutup oleh |
|---|---|
| impor → tutup → buka lagi, sha256 cocok | `project-bundle.test.ts`: "impor, tutup, buka lagi"; juga lewat kedua store |
| berkas hilang dilaporkan, bukan proyek setengah jadi | uji "berkas hilang → incomplete" + "manifes rusak → error" |
| hapus hanya isi direktorinya | `project-bundle-tauri.test.ts`: hapus satu proyek, store saudara tetap utuh |
| manifes mencatat region offline | `offline-region-manifest.test.ts` + `totals.offlineRegionBytes` |
| `npm run lint` exit 0 | belum bisa dijalankan di host ini (lihat catatan di bawah) |

Berkas uji: `project-manifest.test.ts` (manifes), `project-bundle.test.ts`
(operasi), `offline-region-manifest.test.ts` (adaptor region),
`project-bundle-tauri.test.ts` (store disk + round trip),
`project-bundle-web.test.ts` (store IndexedDB + round trip), plus prototipe
`factory/bahan/offline-bundle.test.ts`. Total 85 uji, 0 gagal.

**Catatan cakupan CI:** `scripts/coverage-check.mjs` hanya menjalankan
`tests/*.test.ts`, jadi uji in-tree `src/**/*.test.ts` **tidak** ikut CI. Itu
usulan terpisah ke lane `uji` (lihat receipt #11), bukan sesuatu yang bisa
diputuskan di lane ini.

Catatan lingkungan: `npx tsc --noEmit --strict` pada seluruh modul dan ujinya
**lolos (exit 0)**. `npx tsc -b apps/geolibre-desktop` dan ESLint type-aware
(`eslint apps/... --max-warnings 242`) **kehabisan heap di joyboy** (RAM 3.9 GB,
~1.4 GB tersedia, proses agen sendiri ~940 MB): `tsc -b` mati
`FATAL ERROR: Reached heap limit` (exit 134), percobaan ESLint dengan
`NODE_OPTIONS=--max-old-space-size=1536` dibunuh `timeout 300` (`Terminated`).
Lint dan build type-aware harus dijalankan di mesin/CI yang punya RAM cukup;
**jangan** menaikkan `--max-warnings` untuk melewatinya.
