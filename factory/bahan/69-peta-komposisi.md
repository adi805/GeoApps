# #69: peta komposisi ke layar nyata

**Punya:** lane `ui`, issue #69.
**Dasar:** `apps/geolibre-desktop/src/visual/screens/` (31 komposisi, 7 berkas) ditutup lane `visual` di #24.
**Sasaran #69:** layar nyata di `components/` memakai tata letak, hierarki, dan target sentuh komposisi, tanpa memindahkan data palsu galeri ke kode produksi.

## Ringkasan cakupan

| Fungsi | Komposisi sumber | Layar nyata | Lane | Tindakan |
|---|---|---|---|---|
| peta | `visual/screens/peta.tsx` (7) | `components/panels/layer-panel/**`, `components/legend/MapLegendPanel.tsx`, `components/layout/add-data/**` | `ui` | dikerjakan |
| titik | `visual/screens/lapangan-titik.tsx` (2) | `components/layout/FieldCollectionDialog.tsx` | `ui` | dikerjakan |
| rekam | `visual/screens/lapangan-rekam.tsx` (3) | `components/layout/GpsTrackingDialog.tsx` | `ui` | dikerjakan |
| offline | `visual/screens/offline.tsx` (5) | `components/layout/BasemapExtractPanel.tsx`, `components/layout/NoServiceWorkerBanner.tsx` | `ui` | dikerjakan |
| sistem | `visual/screens/sistem.tsx` (6) | `components/layout/SettingsDialog.tsx`, `components/layout/settings/**`, `components/layout/ManagePluginsDialog.tsx` | `ui` | dikerjakan |
| ukur | `visual/screens/lapangan-ukur.tsx` (4) | `packages/plugins/src/plugins/components/measure.ts` | tidak ada | eskalasi |
| geofence | `visual/screens/geofence.tsx` (4) | `packages/plugins/src/plugins/maplibre-geofence.ts`, `gps-averaging.ts` | `geofence` | eskalasi |

## Dua layar di luar cakupan lane `ui`

Pemeriksa cakupan menolak kedua jalur, dibuktikan dengan `gate_commit_paths.py --lane ui`:

| Jalur | Hasil pemeriksa | Sebab |
|---|---|---|
| `packages/plugins/src/plugins/components/measure.ts` | GAGAL, di luar cakupan lane ui | glob lane `geo-pdf` hanya `packages/plugins/src/plugins/*.ts` (satu tingkat), jadi `plugins/components/**` tidak dimiliki lane mana pun |
| `packages/plugins/src/plugins/maplibre-geofence.ts` | GAGAL, di luar cakupan lane ui | dimiliki lane `geofence` |

Keduanya bukan keputusan lane `ui`. Usulan dicatat lewat `tools/factory/usulan.py catat`, dan layar nyatanya tetap tidak disentuh di unit ini.

## Bahasa komposisi yang dipindah

Tujuh berkas komposisi memakai kosakata tata letak yang sama, dan itu yang dipindah, bukan datanya:

| Unsur komposisi | Arti di layar nyata |
|---|---|
| `BilahAtas` | bilah atas: judul layar, keterangan konteks, lencana status |
| `Kartu` + `Bidang` + `Pemisah` | satu kartu berjudul, isinya baris label dan nilai, bukan tabel |
| `Chip` | pilihan kategori yang bisa disentuh |
| `Tombol lebarPenuh` | aksi utama selebar layar di dasar isi |
| `LencanaStatus` | lencana sukses, peringatan, atau info |
| `Kosong`, `Memuat`, `Galat`, `Offline`, `IzinDitolak` | keadaan yang harus punya layar sendiri, bukan pesan sekilas |
| `sentuh` di `visual/tokens.ts` | target sentuh minimal 48 px |

## Bukti yang harus ikut

1. Tiap berkas berubah disebut di `factory/receipts/69.json` dengan alasan singkat dan komposisi asalnya.
2. `grep -rnE "#[0-9a-fA-F]{6}" apps/geolibre-desktop/src/components` tidak bertambah dibanding `origin/main` (dasar 62 kemunculan).
3. E2E mengukur `boundingBox()` aksi utama minimal 48 px pada viewport 360 px.
4. Tangkapan layar tiap layar nyata pada 360 px dan 412 px.
