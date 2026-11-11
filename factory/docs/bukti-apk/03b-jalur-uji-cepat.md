# Bukti 03b: jalur uji cepat tanpa HP (Chrome emulasi + emulator Android)

Dokumen ini mencatat dua upaya mendapat jalur uji cepat untuk celah P0 G1-G4
selama HP Adi belum terhubung, plus apa yang BERHASIL dibuktikan dan apa yang
TETAP tidak bisa diklaim dari sini. Ditulis 2026-11-11 18:15 WIB.

Alasan dokumen ini terpisah dari `03-uji-offline.md`: berkas itu berisi prosedur
S1-S8 untuk HP dan status jujurnya masih "belum dijalankan". Yang di bawah ini
bukan pengganti S1-S8, melainkan bukti mekanisme di lapisan yang bisa diotomasi.

## 1. Emulator Android: TIDAK VIABEL di laptop ini, dan penyebabnya keras

Bukan soal setelan emulator. Laptop ini **tidak punya KVM**:

| Pemeriksaan | Keluaran |
|---|---|
| `ls -l /dev/kvm` | `No such file or directory` |
| `modprobe kvm_intel` | `Operation not supported` |
| `dmesg` | `kvm_intel: VMX not enabled (by BIOS) in MSR_IA32_FEAT_CTL` |
| `grep -c vmx /proc/cpuinfo` | `0` (CPU i3-2328M punya VT-x, dimatikan di BIOS) |
| `free -m` | 7782 MB total, ~5,3 GB available setelah emulator dimatikan |

Yang sudah dipasang dan tetap berguna kalau VT-x dinyalakan:

| Item | Nilai |
|---|---|
| SDK root | `~/android-sdk` (4,2 GB) |
| Emulator | 37.2.13.0 |
| System image | `system-images;android-30;default;x86_64` |
| AVD | `geotest30` (Android 11, RAM 2048, 2 core, `swiftshader_indirect`) |
| APK x86_64 | `~/g98/apk-out/geolibre-android-x86_64.apk` (55.980.089 B) |

**Hasil pengukuran boot TCG (`-accel off`), bukan perkiraan:**

| Waktu | Keadaan |
|---|---|
| 17:31:17 | emulator diluncurkan (`-no-window -no-audio -no-boot-anim -accel off`) |
| +00:20 | `adb` melihat `emulator-5554` status `offline` |
| +19:20 | `qemu-system-x86_64-headless` 99,6% CPU, RSS 2,2 GB, guest uptime 1155 s |
| +22:00 | `system_server` + `zygote` + `surfaceflinger` hidup, `dex2oat32` masih memverifikasi paket sistem, `iorapd` menunggu `package_native` 58 kali |
| +36:02 | `sys.boot_completed` **masih kosong**, 97,2% CPU. Emulator dimatikan |

Kesimpulan: boot tidak selesai dalam 36 menit. Untuk "cepat debugging" ini tidak
terpakai. Satu toggle BIOS (Intel Virtualization Technology) mengubah ini total;
selama mati, jalur emulator ditutup dan tidak dicoba lagi.

## 2. Jalur yang berhasil: Chrome emulasi lewat Playwright (nol emulator)

Repo ini sudah punya seluruh bahannya: `playwright.config.ts` menyajikan build
`dist` lewat `vite preview` (jadi nol rebuild, nol risiko OOM `tsc`), helper
`openViewer`/`enterViewer`, dan helper hitung cache tile GeoPDF. Yang ditambahkan
hanya empat berkas:

- `e2e/mobile-offline-field.spec.ts` — bukti otomatis arsip GeoPDF lintas restart proses (G1).
- `e2e/mobile-wake-lock.spec.ts` — bukti wake lock diminta/dilepas saat merekam (G2).
- `e2e/mobile-photo-downscale.spec.ts` — bukti foto kamera dikecilkan sebelum disimpan (G3).
- `factory/scripts/mobile-web.sh` — wrapper tipis (`serve|field|watch|smoke|all`).

### Model "mode pesawat" yang dipakai, dan kenapa bukan `setOffline(true)`

Percobaan pertama memakai `context.setOffline(true)` lalu `page.goto("/")`. Hasilnya
**gagal, dan kegagalan itu benar**: halaman jadi blank. `index.html` terlayani
dari cache, tetapi chunk JS-nya gagal diambil, sehingga React tidak pernah mount
dan tombol proyek tidak ada. Itu menguji service worker, bukan arsip GeoPDF.

Di APK, aset app ikut di dalam paket, jadi jaringan mati tidak mematikan shell.
Padanan yang tepat untuk build web: **request ke luar localhost ditolak, localhost
tetap boleh**. Itu yang dipakai sekarang (`blockExternalNetwork`).

### Inti tes: proses browser benar-benar mati, bukan reload

`chromium.launchPersistentContext(userDataDir)` dipakai supaya `context.close()`
mematikan proses Chrome-nya. Profil yang sama dibuka lagi di putaran kedua. Itu
padanan "tutup paksa aplikasi" di HP: IndexedDB harus selamat tanpa bantuan memori.

### Hasil (dijalankan 2026-11-11 18:12 WIB)

```
$ bash factory/scripts/mobile-web.sh field
Running 2 tests using 1 worker
{"controlArchiveCount":-1}
  ✓ 1 … profil baru tanpa impor: arsip belum ada (probe bisa merah) (13.1s)
{"archiveBefore":1,"archiveAfter":1,"tilesBefore":-1,
 "externalNetwork":"blocked","shellButtons":5,"processRestarted":true}
  ✓ 2 … arsip byte PDF bertahan setelah proses browser dibunuh (44.9s)
  2 passed (1.0m)
```

Angka itu artinya:

| Bukti | Nilai | Arti |
|---|---|---|
| Arsip sebelum proses mati | `archiveBefore=1` | byte PDF benar-benar ditulis ke `geolibre-geopdf-pdfs` |
| Arsip sesudah proses mati | `archiveAfter=1` | selamat melewati kematian proses, jaringan luar diblokir |
| Shell tanpa jaringan luar | `shellButtons=5` | app tetap ter-mount dengan request eksternal ditolak |
| Kontrol negatif | `controlArchiveCount=-1` | probe bisa MERAH; ia tidak selalu mengembalikan angka positif |

Kontrol negatif itu penting: tanpa dia, `archiveAfter=1` tidak membedakan
"perbaikan bekerja" dari "probe selalu bilang ada".

### G2: wake lock saat merekam jejak

Dua klaim dipisah, dan pemisahan itu bukan formalitas.

**Klaim 1 — wiring.** `navigator.wakeLock` diganti stub yang mencatat
`request`/`release`. Ini membuktikan app memanggil API di saat yang benar dan
melepasnya, BUKAN bahwa layar menyala.

**Klaim 2 — ketahanan saat platform menolak.** API ASLI dipakai, dibungkus untuk
mencatat hasilnya. Diukur lebih dulu sebelum menulis assertion apa pun:

```
$ node -e '…navigator.wakeLock.request("screen")…'   # chromium headless, :4173
{"supported":true,"result":"error:NotAllowedError","visibility":"visible"}
```

Jadi mesin ini justru menguji jalur GAGAL: `requestScreenWakeLock` berjanji tidak
pernah melempar, dan dialog harus tetap merekam. Itu yang di-assert.

Hasil (build `dist` di `:4173`, 2026-11-11 20:35 WIB):

```
{"phase":"idle","requests":[],"releases":0}
  ✓ dialog terbuka tanpa merekam: kunci belum diminta
{"phase":"wiring","requests":["screen","screen"],"releases":2}
  ✓ meminta kunci saat merekam, melepas saat jeda, meminta lagi saat lanjut
{"phase":"real-api","calls":1,"outcomes":["error:NotAllowedError"]}
  ✓ tetap merekam walau platform menolak kunci (API asli)
```

| Bukti | Nilai | Arti |
|---|---|---|
| Kontrol negatif | `requests=[]` saat dialog terbuka tanpa merekam | efek tidak salah tempat; baterai tidak terkuras tanpa manfaat |
| Wiring | `requests=["screen","screen"]`, `releases=2` | satu kunci per segmen rekaman, tidak menumpuk |
| Tahan gagal | `calls=1`, `outcomes=["error:NotAllowedError"]`, nol `pageerror` | penolakan platform tidak merusak perekaman |

### G3: foto lapangan dikecilkan sebelum disimpan

Unit test `tests/photo-downscale.test.ts` (9 tes) sudah hijau, TAPI itu menguji
`planPhotoResize` sebagai fungsi murni dan `shrinkPhotoToDataUrl` dengan
`createImageBitmap` yang di-stub. Yang tidak diuji di sana: berkas nyata dari
input kamera, `createImageBitmap` asli, kanvas asli, dan apa yang benar-benar
tersimpan. Kalau pemanggilannya lupa dipasang, unit test tetap hijau. Itu bentuk
regresi yang lolos, jadi butuh tes di runtime.

Hasil (2026-11-11 20:38 WIB):

```
{"phase":"downscale",
 "source":{"width":3200,"height":2400,"bytes":2508876},
 "stored":{"width":1600,"height":1200,"bytes":237639},
 "capBytes":2097152,"ratioPreserved":0}
  ✓ foto kamera besar diperkecil ke 1600 px dan masuk batas simpan
{"phase":"control","reEncoded":false,"bytes":69}
  ✓ foto kecil tidak di-encode ulang (byte identik)
```

| Bukti | Nilai | Arti |
|---|---|---|
| Sumber | 3200x2400, 2.508.876 byte | ukuran foto kamera HP yang dulu ditolak |
| Tersimpan | 1600x1200, 237.639 byte | sisi terpanjang tepat `MAX_STORED_PHOTO_EDGE_PX` |
| Rasio | `ratioPreserved: 0` | 4:3 terjaga, bukan dipotong persegi |
| Kontrol | PNG 1x1 byte identik (`reEncoded:false`) | tidak ada encode ulang saat tidak perlu |

Sumber diperkecil 10,6 kali dan masuk batas 2 MiB dengan sisa ruang besar, jadi
foto 4-8 MB dari kamera HP tidak lagi jatuh ke pesan "terlalu besar".

### Bukti tes ini bisa MERAH (bukan cuma hijau)

Tes yang selalu hijau tidak membedakan apa pun. Dua patch sementara dipasang di
`vite dev` (`:4174`), dijalankan, lalu dikembalikan. Keduanya terbukti merah:

| Patch sementara | Hasil | Pesan kegagalan |
|---|---|---|
| `shrinkPhotoToDataUrl` mengembalikan `null` selalu | G3 merah | `"That photo is too large (max 2 MB). Choose a smaller image."` — persis keluhan asli G3 |
| Efek wake lock di-`return` lebih awal | G2 merah | `expect(received).toBeGreaterThanOrEqual(1)` — `Received: 0` permintaan kunci |

Sesudah revert, `grep -c DISCRIMINATION` = 0 di kedua berkas dan `git diff` kosong,
lalu 7/7 hijau lagi. Jadi hijau-nya punya daya beda, bukan kebetulan.

### Yang TIDAK dibuktikan oleh tes ini (jangan diklaim)

- **Peta GeoPDF utuh pulih setelah app dibuka lagi.** Itu bergantung pemulihan
  proyek, yang di build browser tidak berjalan (`planStartup` hanya restore di
  desktop). `tilesBefore=-1` di atas artinya rasterisasi bahkan belum ditunggu
  pada run itu; tes sengaja berhenti di arsip, bukan di tile.
- **Layar HP benar-benar tetap menyala saat merekam** (G2). Yang terbukti adalah
  kontrak kodenya: kunci diminta saat merekam, dilepas saat jeda, dan penolakan
  platform tidak merusak rekaman. Di headless kuncinya bahkan ditolak
  (`NotAllowedError`), jadi jalur "berhasil memegang kunci" belum pernah jalan.
- **Foto dari kamera HP asli** (G3). Yang terbukti: JPEG 3200x2400 hasil kanvas
  diperkecil ke 1600x1200. Orientasi EXIF, HEIC, dan `content://` dari kamera
  Android belum diuji.
- Izin kamera `content://`, GPS asli, background track recording.
- G4 (drag vertex di layar sentuh).

Semua itu tetap butuh HP Adi atau emulator ber-KVM.

## 3. Cara pakai jalur cepat

```
bash factory/scripts/mobile-web.sh serve    # sajikan dist yang ada di :4173
bash factory/scripts/mobile-web.sh field    # G1+G2+G3, 7 tes (~6 menit)
bash factory/scripts/mobile-web.sh smoke    # suite core repo (boot, peta, tabel)
bash factory/scripts/mobile-web.sh watch    # sama seperti field, jendela terlihat
```

`field` menjalankan tiga spec serial (`mobile-offline-field`,
`mobile-photo-downscale`, `mobile-wake-lock`) karena SwiftShader memakai CPU dan
tiap spec membuka proses Chrome sendiri. Hasil 2026-11-11 20:42 WIB lewat
wrapper ini: **7 passed (6.2m)**, tanpa rebuild dan tanpa emulator. Untuk
iterasi satu celah saja, panggil Playwright langsung dengan `-g`:

```
E2E_PORT=4173 npx playwright test e2e/mobile-photo-downscale.spec.ts \
    --project=features --reporter=list --workers=1 -g "foto kamera besar"
```

Bandingkan dengan 36 menit emulator yang belum selesai boot.

## 4. Yang masih menunggu Adi

1. **HP tersambung** (wireless debugging atau USB) supaya `adb devices` tidak
   kosong, lalu S1-S8 di `03-uji-offline.md` dijalankan sungguhan.
2. **Kalau mau emulator cepat:** nyalakan Intel Virtualization Technology di
   BIOS. Setelah itu `geotest30` siap dipakai dan boot turun dari "tidak selesai"
   ke hitungan detik.
