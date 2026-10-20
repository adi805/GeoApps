# Fixture GeoPDF

Bahan uji impor peta PDF (issue [#6](https://github.com/adi805/GeoApps/issues/6), lane `uji`).
Isinya empat berkas PDF nyata dengan tiga bentuk georeferensi berbeda, plus satu PDF tanpa
georeferensi yang harus ditolak parser dengan pesan jelas.

**Berkas di sini bukan oracle parser.** Fixture ini cuma membuktikan berkasnya ada, utuh
(sha256), dan nilai acuannya masuk akal. Parser-nya sendiri belum diuji di sini; itu pekerjaan
issue [#7](https://github.com/adi805/GeoApps/issues/7) di lane `geo-pdf`. Jangan membaca direktori
ini sebagai bukti impor GeoPDF sudah jalan.

## Daftar berkas

Angka `west`/`south`/`east`/`north` adalah batas WGS84 (EPSG:4326) dalam derajat desimal, dihitung
dari keempat sudut berkas memakai `gdaltransform` (lihat bagian *Cara angka ini dihitung*).

| Berkas | Bytes | sha256 | Halaman | Kamus georeferensi | EPSG | west | south | east | north |
|---|---|---|---|---|---|---|---|---|---|
| `esri-arcmap-utm20n.pdf` | 57553 | `8492c975c7dd68977566d95b0c1f0db2a24d464bf2105612e20799b04485766b` | 1 | `/VP` | 32620 | -65.100733 | 43.968223 | -64.405492 | 44.608042 |
| `ogc-lgidict.pdf` | 1367 | `ec2a34f853a4d5bf86ccf6a7170439b5c89e9a6a674db965ba7d762cbea3a93b` | 1 | `/LGIDict` | 4326 | 2.000000 | 48.000000 | 3.000000 | 49.000000 |
| `qgis-3.35-getprint.pdf` | 19102 | `6139acfc22356d670ac9e62fef445121426a587601c934580f6f882b3e891ee3` | 1 | `/VP` | 3857 | 4.249555 | -88.923500 | 29.790392 | 88.761125 |
| `tanpa-georeferensi.pdf` | 2881 | `7e8f2f4ce6ebac632390908943bc9073ca7c3149803e8c0e3636d0733df6caa9` | 2 | - | - | - | - | - | - |

Daftar sha256 yang sama juga ada di [`SHA256SUMS`](SHA256SUMS), jadi pemeriksaan berkas bisa
dilakukan tanpa membaca README:

```bash
cd tests/fixtures/geopdf && sha256sum -c SHA256SUMS
```

## Asal dan lisensi

Ketiga berkas pertama diambil dari repositori sumber terbuka dengan commit yang dipin, bukan dari
berkas milik owner. Berkas milik owner masih menunggu keputusan #3 di issue #14; selama keputusan
itu belum turun, fixture publik inilah yang dipakai.

| Berkas | Repositori | Commit | Path | Blob |
|---|---|---|---|---|
| `esri-arcmap-utm20n.pdf` | `OSGeo/gdal` | `acae266360bc32f08cacab028b83bde308bf6dac` | `autotest/gdrivers/data/pdf/adobe_style_geospatial.pdf` | `d4a808fd4979ad13670261524727e1d5a91bcecf` |
| `ogc-lgidict.pdf` | `OSGeo/gdal` | `acae266360bc32f08cacab028b83bde308bf6dac` | `autotest/gdrivers/data/pdf/test_ogc_bp.pdf` | `8f57732ccbca8ca4dca95893ebac06240a1ea7dc` |
| `tanpa-georeferensi.pdf` | `OSGeo/gdal` | `acae266360bc32f08cacab028b83bde308bf6dac` | `autotest/gdrivers/data/pdf/test_pdf_composition_outline.pdf` | `b5c4d977a16b78a2343bf85b35179dc262789227` |
| `qgis-3.35-getprint.pdf` | `qgis/QGIS` | `0379e5917f7508cbf72ba55f977e90bd1d81f329` | `tests/testdata/control_images/qgis_server/WMS_GetPrint_Basic_Pdf/WMS_GetPrint_Basic_Pdf.pdf` | `6cb9217ccc501edf674094bede679c7627a580b8` |

**Lisensi.**

- Tiga berkas dari `OSGeo/gdal` ikut lisensi repositori itu: MIT-style, lihat
  [LICENSE.TXT](https://github.com/OSGeo/gdal/blob/master/LICENSE.TXT). Berkas di
  `autotest/gdrivers/data/` tidak punya berkas lisensi terpisah dan tidak punya catatan provenance
  sendiri di upstream; satu-satunya pernyataan lisensi yang tersedia adalah lisensi repositori.
  Metadata lisensi GitHub untuk repo itu terbaca `NOASSERTION` karena `LICENSE.TXT` memuat
  lisensi pihak ketiga juga, bukan karena berkas ujinya berlisensi lain.
- `qgis-3.35-getprint.pdf` ikut lisensi `qgis/QGIS`: GPL-2.0, lihat
  [COPYING](https://github.com/qgis/QGIS/blob/master/COPYING). Berkas ini adalah citra kontrol
  hasil uji QGIS Server, bukan peta produksi.

Tidak ada berkas berlisensi tertutup di direktori ini. Khusus TerraGo Publisher: keluarannya
berlisensi komersial dan tidak ada contoh publik yang boleh disalin, jadi yang dipakai di sini
adalah bentuk kamus `/LGIDict` versi 2.1 (OGC PDF Georeferencing Best Practice) yang ditulis oleh
driver PDF GDAL sendiri. Keluarga kamusnya sama, penerbitnya bukan TerraGo; jangan menyebut berkas
ini "keluaran TerraGo".

## Rincian tiap berkas

Nilai di bawah ini keluaran `gdalinfo` apa adanya, plus terjemahan ke WGS84.

### `esri-arcmap-utm20n.pdf` — ESRI ArcMap, kamus `/VP`

```
Creator        : ESRI ArcMap 10.0.0.2414
CreationDate   : 2010-10-22
Driver         : PDF/Geospatial PDF
Size is        : 1275, 1650
CRS            : WGS 84 / UTM zone 20N (EPSG:32620)
Origin         : (333274.616544059, 4940391.759349998)
Pixel Size     : (42.353069656602, -42.392994002227)
Kamus          : /VP [ ... ] dengan /Measure dan /GPTS, tanpa /LGIDict
```

Batas WGS84 hasil `gdaltransform -s_srs EPSG:32620 -t_srs EPSG:4326` atas keempat sudut:
west `-65.100733`, south `43.968223`, east `-64.405492`, north `44.608042` (pulau Baffin,
Kanada). Berkas ini juga memuat lima layer PDF; `gdalinfo` melaporkannya sebagai
`LAYER_00_NAME=New_Data_Frame` dan seterusnya.

### `ogc-lgidict.pdf` — OGC Best Practice, kamus `/LGIDict`

```
Driver         : PDF/Geospatial PDF
Size is        : 20, 20
CRS            : WGS 84 (EPSG:4326)
Origin         : (2.0, 49.0)
Pixel Size     : (0.05, -0.05)
Kamus          : /LGIDict dengan /Version (2.1), /ProjectionType (GEOGRAPHIC), /CTM, /Neatline
```

Batas WGS84: west `2.000000`, south `48.000000`, east `3.000000`, north `49.000000` (Prancis
utara). Berkas kecil (1,4 KB) dan rasternya cuma 20x20 piksel, jadi yang diuji di sini bentuk
kamarnya, bukan isi petanya. `gdalinfo` mengeluarkan peringatan `Non closed ring detected` untuk
neatline-nya; itu sifat berkas aslinya, bukan kerusakan saat pengunduhan, dan sha256 di tabel
membuktikan byte-nya utuh.

### `qgis-3.35-getprint.pdf` — QGIS Server, kamus `/VP`

```
Title          : QGIS Server Hello World
Creator        : QGIS 3.35.0-Master
Driver         : PDF/Geospatial PDF
Size is        : 1754, 1240
CRS            : WGS 84 / Pseudo-Mercator (EPSG:3857)
Origin         : (473058.286044557, 28874663.254860174)
Pixel Size     : (1620.976638780, -47294.715717572)
Kamus          : /VP [ ... ] dengan /Measure, tanpa /LGIDict
```

Batas WGS84: west `4.249555`, south `-88.923500`, east `29.790392`, north `88.761125`.

**Perhatian:** extent berkas ini hampir seluruh bola dunia (lintang -88,9 sampai 88,8), yang jelas
bukan extent peta sungguhan. Berkas ini citra kontrol `WMS_GetPrint` QGIS Server, dan neatline-nya
memang ditulis selebar kanvas. Pakai untuk menguji pembacaan `/VP` dan konversi EPSG:3857, jangan
pakai sebagai patokan batas peta: nilai batasnya benar sebagai hasil hitung, tapi tidak masuk akal
sebagai lembar peta.

### `tanpa-georeferensi.pdf` — tanpa kamus georeferensi

```
Driver         : PDF/Geospatial PDF
Size is        : 20, 20
CRS            : tidak ada
Kamus          : tidak ada /VP, tidak ada /LGIDict, tidak ada /Measure
Halaman        : 2
```

`gdalinfo` tetap bisa membukanya sebagai raster (dua halaman, `SUBDATASET_1` dan `SUBDATASET_2`),
tapi tanpa sistem koordinat: sudut yang dilaporkan `(0,0)` sampai `(20,20)` adalah satuan piksel,
bukan derajat. Inilah berkas negatif: parser wajib menolaknya dengan pesan yang menyebut
georeferensi tidak ditemukan, bukan diam-diam memakai koordinat piksel sebagai derajat.

## Cara angka ini dihitung

1. `gdalinfo <berkas>` memberi CRS, ukuran, origin, dan pixel size.
2. Keempat sudut raster (upper-left, lower-left, upper-right, lower-right) diubah ke EPSG:4326
   dengan `gdaltransform -s_srs <CRS berkas> -t_srs EPSG:4326`.
3. `west`/`east` = min/max bujur, `south`/`north` = min/max lintang dari keempat sudut itu.

Untuk berkas tanpa georeferensi, langkah 2 dan 3 tidak berlaku dan kolomnya diisi `-`.

`gdalinfo` tidak selalu terpasang di host. Kalau tidak ada, angka di tabel ini tetap dipakai apa
adanya; asalnya tetap langkah di atas, dijalankan pada host yang punya GDAL 3.x. Jangan menulis
ulang angka ini dari ingatan: jalankan ulang perintahnya, atau biarkan tabel apa adanya.

## Mengunduh ulang

```bash
cd tests/fixtures/geopdf && ./unduh.sh
```

Skrip itu mengunduh keempat berkas dari commit yang dipin di tabel *Asal dan lisensi*, lalu
memverifikasi sha256 terhadap `SHA256SUMS`. Kalau verifikasi gagal, berarti berkas di upstream
berubah atau unduhannya rusak; jangan lanjut memakai berkasnya.

## Apa yang diperiksa uji

`tests/geopdf-fixtures.test.ts` memeriksa:

- keempat berkas ada, dan tidak ada PDF lain di direktori ini yang tidak tercatat di README;
- ukuran byte dan sha256 cocok dengan tabel di README dan dengan `SHA256SUMS`;
- batas WGS84 di README terbaca sebagai angka (bukan `NaN`), lintang di -90..90, bujur di
  -180..180, dan `west < east`, `south < north`;
- berkas ber-`/VP` memang memuat `/VP` dan `/Measure`, berkas ber-`/LGIDict` memuat `/LGIDict`,
  dan berkas tanpa georeferensi tidak memuat keduanya;
- kalau `gdalinfo` ada di `PATH`, berkas tanpa georeferensi tidak punya sistem koordinat dan tiga
  berkas lainnya punya.

Yang **tidak** diperiksa: apakah parser GeoApps bisa membaca berkas ini. Itu issue #7.
