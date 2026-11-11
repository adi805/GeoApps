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
hanya dua berkas:

- `e2e/mobile-offline-field.spec.ts` — bukti otomatis arsip GeoPDF lintas restart proses.
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

### Yang TIDAK dibuktikan oleh tes ini (jangan diklaim)

- **Peta GeoPDF utuh pulih setelah app dibuka lagi.** Itu bergantung pemulihan
  proyek, yang di build browser tidak berjalan (`planStartup` hanya restore di
  desktop). `tilesBefore=-1` di atas artinya rasterisasi bahkan belum ditunggu
  pada run itu; tes sengaja berhenti di arsip, bukan di tile.
- Wake lock layar (`wake-lock.ts`), izin kamera `content://`, GPS asli,
  background track recording, downscale foto di perangkat.
- G4 (drag vertex di layar sentuh).

Semua itu tetap butuh HP Adi atau emulator ber-KVM.

## 3. Cara pakai jalur cepat

```
bash factory/scripts/mobile-web.sh serve    # sajikan dist yang ada di :4173
bash factory/scripts/mobile-web.sh field    # spec offline + arsip (~1 menit)
bash factory/scripts/mobile-web.sh smoke    # suite core repo (boot, peta, tabel)
bash factory/scripts/mobile-web.sh watch    # sama seperti field, jendela terlihat
```

Iterasi: 2 tes dalam 58 detik, tanpa rebuild dan tanpa emulator. Bandingkan
dengan 36 menit emulator yang belum selesai boot.

## 4. Yang masih menunggu Adi

1. **HP tersambung** (wireless debugging atau USB) supaya `adb devices` tidak
   kosong, lalu S1-S8 di `03-uji-offline.md` dijalankan sungguhan.
2. **Kalau mau emulator cepat:** nyalakan Intel Virtualization Technology di
   BIOS. Setelah itu `geotest30` siap dipakai dan boot turun dari "tidak selesai"
   ke hitungan detik.
