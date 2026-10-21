# Rancangan: bundel proyek portabel (`offline-bundle`)

> Status: **implementasi** di `apps/geolibre-desktop/src/lib/` (issue #11, lane `offline`).
> Kode: `project-manifest.ts` (skema, jalur, sha256, parse/serialize) ·
> `project-bundle.ts` (impor/verifikasi/buka/hapus) ·
> `offline-region-manifest.ts` (katalog region → manifes) ·
> `project-bundle-tauri.ts` (store `projects/<slug>/` relatif ke app-local data) ·
> `project-bundle-web.ts` (store IndexedDB).
> Uji: `*.test.ts` di sebelah tiap modul (67 uji) + prototipe
> `factory/bahan/offline-bundle.test.ts` (21 uji) = 88 uji, semuanya lulus.
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
   mengikat store ke `projects/<slug>/` **relatif** terhadap app-local data, dan
   setiap panggilan plugin-fs membawa `baseDir: BaseDirectory.AppLocalData`.
   Store tidak pernah menyusun path absolut dari `appLocalDataDir()`: dengan base
   directory plugin yang me-resolve sendiri, jadi root Android tidak perlu
   disamakan antara sisi JS dan Rust. `list()` menelusuri subdirektori;
   `write()` membuat direktori induk (`mkdir recursive`).
   `listBundleProjectSlugs()` memberi daftar bundel di perangkat.
   **Masih butuh `fs:scope` `projects/**`** (relatif ke base directory itu) di
   `src-tauri/capabilities/default.json` — sekarang cuma `startup-projects`
   yang di-scope, jadi setiap tulis gagal "forbidden path". Tidak ada entri path
   absolut yang dibutuhkan, dan `projects/` tidak perlu dibuat lebih dulu: store
   hanya membaca root itu saat listing. Path `capabilities/**` milik lane
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
| `npm run lint` exit 0 | CI job "Lint and type check"; warning `no-floating-promises` dari berkas uji dimatikan per berkas (lihat catatan di bawah) |

Berkas uji: `project-manifest.test.ts` (manifes), `project-bundle.test.ts`
(operasi), `offline-region-manifest.test.ts` (adaptor region),
`project-bundle-tauri.test.ts` (store disk + round trip),
`project-bundle-web.test.ts` (store IndexedDB + round trip), plus prototipe
`factory/bahan/offline-bundle.test.ts`. Total 88 uji, 0 gagal.

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

`it()` dari `node:test` mengembalikan promise yang dilacak runner sendiri, bukan
promise yang perlu di-`await` di berkas uji, dan aturan
`@typescript-eslint/no-floating-promises` tidak bisa membedakannya. Lima berkas
uji baru menyumbang 88 warning dari kelas itu, yang menembus ratchet
`--max-warnings 242`; tiap berkas memakai blok `eslint-disable` beralasan,
mengikuti pola `packages/plugins/src/plugins/gps-averaging.test.ts`. Ratchet-nya
tidak dinaikkan.

## 9. Jalur simpan dan buka (tambahan, PR #111)

Bagian 1-8 di atas membangun lima modul: manifes, operasi berkas, adaptor region,
dua store. Semuanya lulus uji, tapi **tidak ada yang memanggilnya**. Yang hilang
bukan satu modul kecil, melainkan separuh gunanya bundel: tidak ada kode yang
mencari layer dengan `sourcePath` di luar bundel, menyalin berkasnya masuk, lalu
menulis ulang proyeknya. Tanpa bagian itu bundel tetap tidak portabel, karena
`content://` di Android mati bersama proses pemegang izin bacanya, jadi proyek
yang disimpan dengan jalur absolut terbuka kosong di peluncuran berikutnya walau
setiap byte-nya tersalin rapi.

`offline-project-bundle.ts` mengisi lubang itu. Bentuknya:

```ts
saveProjectToBundle({ project, store, readSource, now, manifest?,
                      projectId?, offlineRegions? })
                                                  -> { project, manifest, files, copied }
openProjectFromBundle(store)                      -> { project, manifest, status,
                                                      missing, mismatched, affectedLayers }
isExternalProjectPath(sourcePath)                 -> boolean
bundlePathForSource(sourcePath, kind, taken?)     -> string
collectExternalFiles(project)                     -> ExternalProjectFile[]
missingProjectLayers(project, missingPaths)       -> AffectedLayer[]
```

Proyeknya sendiri tinggal di satu berkas tetap di akar bundel:
`PROJECT_DATA_FILE = "proyek.geolibre.json"`. Nama itu sengaja bukan
`project.json`: yang terakhir sudah dipakai manifes, dan dua berkas berbeda yang
bernama sama di satu direktori adalah cara paling murah membuat salah baca.

**Aturan yang dipegang modul ini:**

1. **Apa yang dianggap "di luar bundel".** Hanya jalur yang menamai berkas yang
   boleh disalin: skema `content:` dan `file:`, jalur absolut POSIX, huruf drive
   Windows (`C:\...`), dan UNC (`\\server\share`). **`http(s):`, `data:`, dan
   `blob:` sengaja TIDAK disalin**: layer itu memang mengambil atau membawa
   isinya sendiri, dan membekukannya jadi salinan lokal justru mengubah layer
   yang berfungsi jadi layer basi. Jalur yang sudah relatif juga tidak disentuh,
   dan itulah yang membuat simpan ulang idempoten.
2. **Ke mana salinannya mendarat.** Ditentukan `bundleFileKind`, dipetakan ke
   `peta/` (peta), `raster/` (GeoTIFF), `foto/` (gambar), `berkas/` (sisanya).
   Nama di dalam bundel adalah nama asli yang disanitasi (karakter di luar
   `A-Za-z0-9._-` jadi `-`, query dan fragmen dibuang lebih dulu supaya
   `scan.pdf?token=x` tetap berekstensi), dipotong 120 karakter dari belakang.
   Dua berkas berbeda yang kebetulan bernama sama tidak saling menimpa: yang
   kedua jadi `scan-2.pdf`, dan `taken` dioper antar layer dalam satu
   penyimpanan supaya tabrakannya terdeteksi sekarang, bukan di penyimpanan
   berikutnya.
3. **Yang ditulis balik ke proyek hanya `sourcePath`.** Properti lain tidak
   disentuh, jadi modul ini tidak perlu tahu arti `geolibre_*`. Salinan proyek
   dibuat lewat `structuredClone`, jadi objek masukan tidak berubah.
4. **Berkas yang isinya tidak berubah tidak disalin ulang.** Entri manifes
   sebelumnya dibandingkan `sha256` dan jumlah byte-nya; kalau cocok, tidak ada
   tulis dan `copied` tidak bertambah. Ini bukan optimasi, ini syarat: autosave
   yang menyalin ulang PDF 200 MB tiap beberapa detik membuat aplikasi tidak
   terpakai.
5. **Membuka bukan menebak.** `openProjectFromBundle` membaca manifes, lalu
   `proyek.geolibre.json`, lalu laporan per berkas. Bundel tanpa berkas proyek
   yang bisa dibaca adalah **error**, bukan proyek kosong: proyek kosong terbaca
   seperti data pengguna hilang, sedangkan "ini bukan bundel" benar dan bisa
   ditindaklanjuti. Jalur relatif tidak diubah jadi absolut oleh fungsi ini;
   store yang memegang `baseDir`, dan `assertSafeBundlePath` di lapisan manifes
   yang menolak jalur keluar dari akar bundel.
6. **Berkas yang hilang dilaporkan berikut layernya.** `missing` dan
   `mismatched` berisi path relatif; `affectedLayers` menerjemahkannya kembali
   ke layer lewat `layerIndex`, supaya UI bisa menampilkan "berkas ini perlu
   dicari lagi" alih-alih proyek yang diam-diam kehilangan satu peta.

**Pembaca berkas disuntikkan (`readSource`), bukan diimpor.** Alasannya sama
dengan store: modul ini lalu tidak terikat Tauri maupun DOM, jadi bisa diuji di
Node dengan store in-memory tanpa menyentuh filesystem. Itu juga alasan
berkasnya ada di `apps/geolibre-desktop/src/lib/`, bukan `src/lib/file-io/`:
`file-io/**` tidak masuk glob lane mana pun di `factory/lanes.json`, jadi berkas
di sana tidak bisa di-commit oleh lane apa pun.

**Yang sengaja belum dikerjakan:**

- **Pemanggilnya.** Belum ada yang memanggil `saveProjectToBundle` dari UI
  maupun dari `file-io/project-files.ts`. Berkas `file-io/**` tidak dimiliki
  lane mana pun, jadi ini butuh keputusan HQ soal lane pemiliknya; dicatat
  sebagai usulan, bukan diputuskan di sini.
- **`fs:scope`.** Store Tauri tetap tidak bisa dipakai dari UI sampai
  `src-tauri/capabilities/default.json` memuat `projects/**` (lane `android`).
- **Foto base64.** Foto koleksi lapangan masih data URL di JSON proyek, jadi ikut
  ditulis ulang tapi belum diekstrak jadi berkas di `foto/`. Memindahkannya
  mengubah format proyek dan butuh migrasi (lihat bagian 7).
- **Slug tabrakan.** `projectId` bawaan tetap `projectSlug(nama)`, dan
  `projectId` yang sama dengan nama manifes ditolak. Kebijakan sufiks masih
  terbuka seperti di bagian 7.
