# Audit: kenapa basemap offline tidak hidup di APK Android

> Lane `offline`, worktree `/home/adijr/g98/lane-offline`, cabang `feat/basemap-offline-apk`,
> basis `d5702a8`. Semua klaim di bawah punya `file:baris`; yang tidak bisa dibuktikan dari
> kode ditandai **BELUM TERBUKTI**.
>
> Konteks: issue #14 (paritas Avenza) dan #11 (bundel proyek portabel). Baris "Basemap offline
> di HP" di `Bandingkan FO Maps vs Kita 061126-1222.md` masih berstatus **NO** untuk kita.

## 0. Ringkasan satu paragraf

Ekstraksi PMTiles-nya sendiri **jalan** di Android: arsip dibuat penuh di memori WebView dan
langsung dipasang sebagai basemap pada sesi itu. Yang gagal adalah **penyimpanan dan pemulihan**.
Arsip ditulis ke lokasi yang dipilih lewat dialog sistem, di Android itu URI `content://` yang
izinnya mati bersama proses; katalog perangkat menyimpan URI itu apa adanya, jadi setelah app
ditutup entri "tersimpan" menunjuk ke berkas yang tidak bisa dibaca lagi. Tidak ada satu pun kode
yang membaca katalog itu saat boot, dan gaya basemap yang menyertainya sengaja hidup hanya selama
sesi (`globalThis`). Hasilnya: setiap kali app dibuka, basemap kembali ke default dan pengguna
harus mencari ulang berkas `.pmtiles` lewat pemilih berkas. Di web lebih pendek lagi jalurnya:
`savedPath` selalu `null`, jadi berkasnya memang tidak pernah tersimpan.

## 1. Tiga pertanyaan yang diminta, dijawab dengan bukti

### 1.1 Ke mana `.pmtiles` hasil ekstrak ditulis di Android? (`savedPath` null?)

Jalurnya: `BasemapExtractPanel` mengekstrak arsip ke memori, mendaftarkannya ke protokol
`pmtiles://`, lalu **mencoba** menyimpannya ke disk sebagai langkah best-effort.

| Langkah | Bukti |
|---|---|
| Ekstraksi menghasilkan `archive` di memori (Uint8Array), lalu didaftarkan sebagai arsip in-memory | `apps/geolibre-desktop/src/components/layout/BasemapExtractPanel.tsx:612` (`registerPMTilesArchive`) |
| Penyimpanan ke disk | `BasemapExtractPanel.tsx:649-671` → `saveBinaryFileWithFallback(archive, …)` |
| Di Tauri (termasuk Android) fungsi itu membuka dialog **save** sistem, lalu menulis ke path yang dikembalikan dialog | `apps/geolibre-desktop/src/lib/file-io/file-dialogs.ts:407-427` (`save()` di :415, `writeFile(path, bytes)` di :425, `return path` di :426) |
| Path itu disimpan ke katalog perangkat sebagai `savedPath` | `BasemapExtractPanel.tsx:704` |
| Di luar Tauri (web) hasilnya selalu `null` | `file-dialogs.ts:412` → `saveBinaryFileBrowser`, dan komentar tipe di `lib/offline-basemaps.ts:29-31` |

Jadi: **`savedPath` tidak `null` di Android** — dialog save Tauri v2 di Android memakai
`ACTION_CREATE_DOCUMENT` dan mengembalikan URI `content://…` (bukan path filesystem). Yang `null`
adalah web, dan Android saat pengguna membatalkan dialog.

Konsekuensi yang menentukan ada di sifat URI itu sendiri, dan repo ini sudah mendokumentasikannya
sendiri untuk kasus proyek:

- `apps/geolibre-desktop/src/lib/startup-project-snapshot.ts:5-13`: "That URI carries a one-off read
  grant tied to the activity that received it: it reads fine for the rest of the session, and is
  dead the moment the process is gone. Nothing in the app can renew it".
- `apps/geolibre-desktop/src/lib/project-bundle-tauri.ts:6-11`: alasan yang sama, dipakai untuk
  membenarkan menyalin berkas ke direktori milik app.
- `apps/geolibre-desktop/src/lib/android-content-uri.ts:5-12`: `open()` memberi grant read-only,
  `save()` memberi grant yang termasuk write. Tidak ada yang memberi grant **persistable**.

Artinya: berkas `.pmtiles` hasil ekstrak **ada** di penyimpanan pengguna setelah disimpan, tapi
app tidak punya izin membacanya lagi setelah proses mati. Tidak ada salinan di storage app.

### 1.2 Siapa yang membaca berkas itu sesudah app restart?

Tidak ada yang otomatis. Yang ada hanya satu jalur manual, dan jalur itu pun rusak di Android.

| Klaim | Bukti |
|---|---|
| Katalog perangkat (`localStorage`) hanya dibaca oleh panelnya sendiri, saat panel dibuka | `offline-basemaps.ts:46` (`loadOfflineBasemaps`) dipanggil di `BasemapExtractPanel.tsx:304` (initial state) dan `:305` (subscribe). `grep -rn loadOfflineBasemaps apps/ packages/` tidak menemukan pemanggil lain — tidak ada boot/restore |
| Pemakaian ulang hanya lewat tombol "Use as basemap" per entri | `BasemapExtractPanel.tsx:755-790` (`applySaved`) |
| Di jalur itu, `savedPath` dipakai kalau Tauri | `BasemapExtractPanel.tsx:764-766` → `readLocalFileBytes(entry.savedPath)` |
| `readLocalFileBytes` mencoba `readFile(path)`, lalu jatuh ke perintah Rust `read_local_file` | `lib/file-io/local-fs.ts:68-81` |
| Di Android, `savedPath` adalah `content://` yang grant-nya sudah mati → dua-duanya gagal; pengguna diarahkan ke pemilih berkas | `BasemapExtractPanel.tsx:768-775` (`openLocalDataFileWithFallback`) |
| Proyek yang disimpan hanya membawa **sentinil** gaya basemap, bukan arsipnya; registry gaya hidup di `globalThis` dan sengaja sesi-saja | `packages/map/src/protomaps-basemap.ts:67-71` ("Session-scoped: a saved project stores the sentinel, but the backing style (and its in-memory PMTiles source) is gone on reload, so resolveMapStyle falls back to the default basemap then") + `apps/geolibre-desktop/src/lib/offline-basemaps.ts:8-10` (katalog device-scoped, bukan bagian `.geolibre.json`) |
| Bundel proyek pun tidak membawa arsip: `collectExternalFiles` hanya melihat `sourcePath` lapisan yang `content:`/`file:`/absolut, sedangkan basemap styled bukan lapisan sama sekali dan overlay PMTiles memakai URL `pmtiles://…` | `lib/offline-project-bundle.ts:132-140` (`isExternalProjectPath`), `:212-231` (`collectExternalFiles`) |
| Registry arsip hidup di `globalThis` per sesi | `packages/map/src/pmtiles-archive.ts:14-15`, `:120-128` |

Jadi urutan sesudah restart: (1) app membuka proyek, `basemapStyleUrl` berisi sentinil
`geolibre://offline-basemap/<id>/<n>`; (2) registry gaya kosong → `resolveMapStyle` memakai basemap
default; (3) pengguna membuka panel ekstrak, entri masih terdaftar di katalog (localStorage), tapi
"savedPath" menunjuk URI mati; (4) pengguna harus memilih ulang berkas `.pmtiles` secara manual
lewat pemilih sistem. Di web, langkah (3)-(4) sama tapi tanpa harapan sama sekali karena tidak ada
path yang tersimpan.

### 1.3 Apakah `pmtiles://` bisa resolve dari berkas lokal tanpa service worker?

**Bisa, dan sudah begitu sekarang.** Protokol `pmtiles://` bukan urusan service worker.

- `packages/map/src/pmtiles-archive.ts:55-69`: `registerPMTilesArchive(key, bytes)` membuat
  `new PMTiles(new FileSource(new File([bytes])))` — sepenuhnya di memori, tanpa HTTP, tanpa SW.
  URL `pmtiles://<key>` lalu diselesaikan MapLibre lewat `addProtocol` di `:31`/`:57-59`.
- Service worker hanya dipakai oleh **jalur unduh area** yang lain (cache tile per-URL):
  `lib/offline-tiles.ts:1-16`, `warmUrls` di `:543-614`, `hasActiveServiceWorker` di `:616-623`.
- SW itu memang tidak ada di build Tauri: `vite.config.ts:149` + `:199-206`
  (`PWA_DISABLED = IS_TAURI_BUILD || IS_EMBED`, `IS_TAURI_BUILD = !!process.env.TAURI_ENV_PLATFORM`),
  dikonfirmasi `main.tsx:267-269` dan `docs/android.md:289-292`.

Kesimpulan: satu-satunya yang kurang adalah **byte arsip yang tetap ada setelah proses mati**.
Kalau byte-nya ada, `pmtiles://` menyala lagi tanpa SW, tanpa Rust, tanpa izin tambahan. Itu yang
menentukan bentuk perbaikan di bagian 3.

## 2. Kenapa "Download Offline Area" tidak bisa menyelamatkan

Jalur itu (`offline-tiles.ts`) menulis ke Cache Storage lewat SW yang tidak pernah terdaftar di
build Tauri — lihat 1.3. Di APK `navigator.serviceWorker.controller` bernilai null, jadi `warmUrls`
hanya memanaskan jaringan tanpa menyimpan apa pun. Ini sudah dicatat sebagai batasan di
`docs/android.md:289-292`, dan panelnya sendiri tidak memeriksa `hasActiveServiceWorker`
(fungsi itu tidak punya pemanggil: `grep -rn hasActiveServiceWorker apps/` → hanya definisi di
`offline-tiles.ts:617`).

## 3. Kenapa perbaikan "tulis ke storage app" belum bisa dari lane ini

Rencana yang paling wajar — simpan arsip ke `$APPLOCALDATA/basemaps/<id>.pmtiles` lewat
`@tauri-apps/plugin-fs` — **belum mungkin tanpa menyentuh `src-tauri/**`**:

- Scope fs hanya mengizinkan dua path di app-local data:
  `apps/geolibre-desktop/src-tauri/capabilities/default.json:33-39` (`startup-projects`,
  `startup-projects/*`). Tidak ada entri lain.
- Karena itu `project-bundle-tauri.ts:26-32` mencatat sendiri bahwa store `projects/**` belum
  berfungsi sampai ada entri `fs:scope` — masih berupa "request lane android". Artinya bundel
  proyek #11 pun saat ini akan gagal `forbidden path` di perangkat.
- Menambah entri scope = mengubah `src-tauri/capabilities/default.json` = di luar glob lane ini.

Jadi jalur Tauri (tulis ke storage app) **butuh eskalasi ke lane `android`**. Usulan konkret:

```jsonc
// capabilities/default.json, di dalam blok "fs:scope" yang sudah ada
{ "path": "$APPLOCALDATA/basemaps" },
{ "path": "$APPLOCALDATA/basemaps/*" },
{ "path": "$APPLOCALDATA/projects" },
{ "path": "$APPLOCALDATA/projects/**" }
```

`$APPLOCALDATA/basemaps/*` cukup untuk satu berkas per basemap; `projects/**` sekalian menutup
kebutuhan bundel #11. Tanpa dua entri terakhir, seluruh fitur "simpan ke storage app" (basemap
maupun bundel) tetap tidak bisa diverifikasi di perangkat.

## 4. Yang dikerjakan di lane ini (Tahap B)

Karena jalur fs di atas terhalang, jalur yang ditutup adalah yang **tidak butuh izin apa pun dan
dipakai bersama web + APK**: byte arsip disimpan di storage milik WebView (IndexedDB), satu record
per basemap, dan dipulihkan dari sana saat app dibuka lagi. Ini bukan storage baru buatan sendiri —
pola dan adapter-nya sudah ada di repo untuk bundel web (`lib/project-bundle-web.ts`, tabel
`BundleFileTable` di atas IndexedDB), jadi modul baru memakai adapter yang sama persis.

Kode: `apps/geolibre-desktop/src/lib/offline-basemap-archive.ts`.

Permukaan API yang ditambahkan (`apps/geolibre-desktop/src/lib/offline-basemap-archive.ts`):

| Fungsi | Gunanya |
|---|---|
| `persistOfflineArchiveIfNeeded(entry, bytes)` | menyalin byte ke storage perangkat bila platform ini membutuhkannya, mengembalikan `"stored"` / `"skipped"` |
| `resolveOfflineBasemapArchive(entry, deps)` | memilih sumber byte: sesi, lalu storage perangkat, lalu path filesystem, lalu `missing` |
| `storeOfflineArchiveBytes` / `readOfflineArchiveBytes` / `deleteOfflineArchiveBytes` | I/O satu arsip |
| `listStoredOfflineArchiveIds` / `pruneOfflineArchiveBytes` | daftar arsip, dan sapuan arsip yatim |
| `shouldStoreOfflineArchive(savedPath)` | aturan platform di tabel berikut, diekspor supaya UI bisa jujur menyebut apakah sebuah basemap akan hidup lagi |

Uji: `apps/geolibre-desktop/src/lib/offline-basemap-archive.test.ts`, 20 uji, semua lulus
(`node --import tsx --test`), dan `npx tsc --noEmit -p apps/geolibre-desktop/tsconfig.json` bersih.

Aturan yang dikodekan (dan diuji):

| Kondisi `savedPath` | Byte arsip disimpan ke IndexedDB? | Alasan |
|---|---|---|
| `null` (web, atau dialog dibatalkan) | ya | tidak ada path yang bisa dibaca ulang |
| `content://…` (Android) | ya | grant mati bersama proses |
| path filesystem biasa (desktop) | tidak | path-nya sendiri sudah tahan restart; menyalin 100 MB ke IDB hanya menggandakan |

Urutan pemulihan: arsip sudah terdaftar di sesi ini → byte di IndexedDB → path filesystem
(`readFile`) → tidak ada sumber (pemilih berkas). Tiga platform jadi satu aturan, dan tiap cabang
punya uji.

### 4.1 Yang masih harus disambungkan di lane lain (bukan bagian commit ini)

Modul di atas tidak mengubah UI. Tiga titik sambung, semuanya di `BasemapExtractPanel.tsx`
(lane `ui`):

1. sesudah `saveBinaryFileWithFallback` dan sebelum `upsertOfflineBasemap` (`:649-704`) —
   `await persistOfflineArchiveIfNeeded({ id: layerId, savedPath }, archive)`;
2. di `applySaved` (`:761-781`), ganti blok `if (!hasPMTilesArchive(key)) { … }` dengan
   `const restored = await resolveOfflineBasemapArchive(entry, { isRegistered: hasPMTilesArchive, register: registerPMTilesArchive, readFile: readLocalFileBytes })`
   lalu pakai `restored.url`; `restored.kind === "missing"` → tampilkan pemilih berkas seperti
   sekarang (itu keadaan hari ini di Android);
3. di jalur hapus entri, panggil `deleteOfflineArchiveBytes(entry.id)`; dan sekali saat boot
   `pruneOfflineArchiveBytes(loadOfflineBasemaps().map((b) => b.id))` supaya arsip milik entri
   yang sudah dihapus tidak menumpuk di storage.

Untuk "basemap otomatis hidup lagi saat app dibuka", panggil `resolveOfflineBasemapArchive` untuk
entri yang `id`-nya cocok dengan sentinil di `basemapStyleUrl` saat boot (lane `ui`/`app`).
Setelah ketiga sambungan itu, klaim "basemap offline dipakai lagi setelah app ditutup" punya bukti
kode di Android; sekarang buktinya baru sampai lapisan penyimpanan byte.

## 5. Yang BELUM TERBUKTI

- **Belum diuji di perangkat Android.** Tidak ada `adb`, tidak ada emulator di mesin ini (lihat
  `LAPORAN-QC-2026-10-27.md` §1). Yang terbukti hanya aturan penyimpanan/pemulihan lewat uji Node
  dengan tabel IndexedDB palsu.
- **Kuota dan pengusiran IndexedDB di WebView Android** belum diukur. PMTiles ekstrak bisa puluhan
  sampai ratusan MB; Chrome/WebView punya kuota per-origin dan bisa mengusir data di bawah tekanan
  penyimpanan. Mitigasi yang disediakan modul: `navigator.storage.persist()` dipanggil best-effort
  sebelum penulisan pertama. Perilaku sebenarnya di perangkat belum diukur.
- **Waktu dan memori ekstraksi di ponsel** tidak diukur (arsip ditahan penuh di memori; ekstrak
  planet bbox besar bisa OOM di HP kelas menengah). Ini di luar cakupan audit ini.
- **Dialog save Tauri di Android**: docs plugin menyebut Android "partial support" (tanpa folder
  picker) dan README plugin menyatakan Android didukung; yang saya buktikan dari kode repo adalah
  jalur panggilannya (`file-dialogs.ts:415-426`), bukan perilaku runtime di HP.
- **`read_local_file` (perintah Rust) dengan URI `content://`** — tidak saya baca implementasi
  Rust-nya untuk memastikan ia menolak; yang saya pakai sebagai bukti adalah grant SAF yang mati
  bersama proses (`startup-project-snapshot.ts:5-13`).
- **Basemap offline "menyatu" dengan proyek** (ikut pindah perangkat lewat bundel) belum
  dikerjakan; itu pekerjaan #11 tahap berikutnya dan butuh `BundleOfflineRegion` diperluas atau
  berkas arsip masuk daftar `files`.