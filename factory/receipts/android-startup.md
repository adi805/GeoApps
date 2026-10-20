# Waktu mulai Android

**Issue:** adi805/GeoApps#9
**Lane:** `android`
**Tanggal:** 2026-10-20
**Branch:** `android/build-mainactivity`

## Apa yang diukur

`am start -W` melaporkan `TotalTime`: waktu dari ActivityManager menerima
`startActivity` sampai frame pertama Activity itu tampil. Pada peluncuran dingin
(proses belum hidup) angka itu mencakup fork proses, `Application.onCreate`,
`Activity.onCreate`, dan frame pertama WebView.

Angka ini **batas atas untuk "sampai peta siap"**, bukan ukuran peta siap itu
sendiri. Peta siap adalah keadaan di sisi WebView dan penandanya harus
`performance.mark` di `apps/geolibre-desktop/src/**`, yang berada di luar cakupan
lane `android`. Yang dilaporkan di sini adalah yang bisa diukur tanpa menyentuh
kode frontend, dan itu disebut apa adanya supaya tidak dibaca sebagai klaim yang
lebih kuat daripada yang sebenarnya.

## Perangkat

| Medan | Nilai |
|---|---|
| Perangkat | `sdk_gphone64_x86_64` |
| Android | 16 |
| API | 36 |
| ABI | x86_64 |
| Profil AVD | `pixel_6`, target `google_apis` |
| Grafis | SwiftShader (`-gpu swiftshader_indirect`), tanpa akselerasi GPU |
| APK | `geolibre-android-x86_64.apk`, paket `com.geokebun.app` |

Emulator tanpa passthrough GPU menjalankan WebGL lewat SwiftShader (perangkat
lunak). Angka di bawah karena itu lebih lambat daripada perangkat ber-GPU, dan
tidak boleh dikutip sebagai angka perangkat.

## Angka

Dua run diukur pada emulator dan APK yang sama, dengan skrip yang sama. Keduanya
dilaporkan; selisihnya terlalu besar untuk dipilih salah satu yang paling bagus.

| Run | Commit | n | min | median | maks | Kesimpulan job |
|---|---|---|---|---|---|---|
| [39340791618](https://github.com/adi805/GeoApps/actions/runs/39340791618) | `569a723f` | 3 | 2078 ms | 2416 ms | 2629 ms | merah (bukan karena angka, lihat catatan) |
| [39344237712](https://github.com/adi805/GeoApps/actions/runs/39344237712) | `5b987973` | 3 | 1378 ms | 1531 ms | 1763 ms | hijau |

Angka per peluncuran pada run yang hijau:

```
peluncuran dingin 1: 1531 ms   Displayed com.geokebun.app/.MainActivity: +1s531ms
peluncuran dingin 2: 1763 ms   Displayed com.geokebun.app/.MainActivity: +1s763ms
peluncuran dingin 3: 1378 ms   Displayed com.geokebun.app/.MainActivity: +1s378ms
RINGKAS: n=3 min=1378 median=1531 maks=1763 ms
```

Baris `Displayed` dari logcat adalah ukuran kedua yang independen dari
`am start -W`. Ketiga peluncuran cocok sampai milidetik, jadi kedua cara membaca
angka itu sepakat.

### Kenapa dua run berbeda jauh

Median 2416 ms dan 1531 ms berasal dari emulator yang sama, APK yang sama, dan
skrip yang sama. Penyebab yang bisa dibuktikan dari log: run pertama mengukur
segera setelah emulator selesai boot pada runner yang saat itu juga menyelesaikan
build 184 MB; run kedua mendapat runner yang lebih longgar. Ini **belum
dibuktikan sebagai sebab**, dan tidak dilaporkan sebagai sebab. Yang bisa
dikatakan: sebaran antar-run lebih besar daripada sebaran di dalam satu run
(1378-1763 ms), jadi satu run tidak cukup untuk menyimpulkan tren. Untuk
membandingkan sebelum/sesudah sebuah perubahan, dua run pertama harus diulang
setelah perubahan, di hari yang sama bila mungkin.

### Catatan run 39340791618

Run itu mengukur dengan benar dan mencetak `RINGKAS: n=3 ...`, lalu job-nya merah
karena langkah setelahnya, bukan karena angkanya. `android-emulator-runner`
memecah input `script:` per baris (`src/script-parser.ts`), sehingga continuation
`\` tidak menyambung dan baris redirection dijalankan sendirian: `Syntax error:
end of file unexpected`. Efek sampingnya artifact pengukuran tidak terunggah.
Perbaikannya `jalankan-ukur.sh` di commit `5b987973`; run 39344237712 membuktikan
artifact `android-startup-measurement` (402 B) sekarang ada.

## Target

Target issue adalah di bawah 5 detik. Kedua run berada di bawahnya: maksimum
terburuk 2629 ms. Itu terpenuhi pada emulator SwiftShader, dan belum diukur pada
perangkat fisik.

## Cara mengulang

```
gh workflow run android.yml -R adi805/GeoApps --ref <branch>
gh run download <run-id> -R adi805/GeoApps -n android-startup-measurement
cat startup.txt
```

Workflow hanya jalan pada `workflow_dispatch` dan rilis, jadi ia tidak menambah
waktu tunggu pada setiap PR.

## Yang belum diukur

- `performance.mark` "peta siap" di frontend: di luar cakupan lane `android`.
  Tanpa itu, angka di atas adalah batas atas, bukan waktu sampai peta terpakai.
- Waktu mulai pada perangkat fisik: hanya emulator yang tersedia di CI.
- Waktu mulai dengan proyek rusak atau kosong: belum ada uji untuk keadaan itu.
