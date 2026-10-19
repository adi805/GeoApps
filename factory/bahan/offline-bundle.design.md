# Rancangan: bundel proyek portabel (`offline-bundle`)

> Status: prototipe di `factory/bahan/` (issue #11, lane `offline`).
> Kode uji: `factory/bahan/offline-bundle.test.ts` → `apps/geolibre-desktop/src/lib/offline-bundle.ts`.
> Setelah #10 merge: modul pindah ke `apps/geolibre-desktop/src/lib/project-bundle.ts`
> + `project-manifest.ts`, uji ke `apps/geolibre-desktop/src/lib/*.test.ts`.

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

Dua implementasi menyusul (bukan bagian prototipe ini):

1. **Tauri** — `$APPLOCALDATA/projects/<slug>/` lewat `tauri-io.ts` /
   `file-io/local-fs.ts`. **Butuh `fs:scope` `$APPLOCALDATA/projects/**` di
   `src-tauri/capabilities/default.json`**; sekarang cuma `startup-projects`
   yang di-scope. Path itu milik lane `android` → ajukan lewat komentar #11.
2. **Web** — IndexedDB, object store `bundle-files`, key `"<slug>/<path>"`,
   indeks `slug`. `list()` = semua key dengan prefix slug.

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
| impor → tutup → buka lagi, sha256 cocok | `factory/bahan/offline-bundle.test.ts`: "impor, tutup, buka lagi" |
| berkas hilang dilaporkan, bukan proyek setengah jadi | uji "berkas hilang → incomplete" + "manifes rusak → error" |
| hapus hanya isi direktorinya | uji "hapus tidak menyentuh proyek lain" (store saudara tetap utuh) |
| manifes mencatat region offline | uji `withOfflineRegions` + `totals.offlineRegionBytes` |
| `npm run lint` exit 0 | belum bisa dijalankan di host ini (lihat catatan di bawah) |

Catatan lingkungan: `npx tsc --noEmit` pada modul ini **lolos (exit 0)**. ESLint
type-aware (`eslint apps/... --max-warnings 242`) kehabisan heap di joyboy
(RAM 3.9 GB, PSI memory `full` > 50%, satu percobaan OOM, satu lagi 9 menit
tanpa hasil). Verifikasi lint harus dijalankan di mesin/CI yang punya RAM cukup;
jangan menaikkan `--max-warnings` untuk melewatinya.
