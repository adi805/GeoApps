# Audit Gate Role Seluruh Modul

Tanggal: 2026-09-19
Alat: `tools/audit_gate_role.py`
Cakupan: 20 modul, 76 op bergerbang service, 228 panggilan op dari JS, 116 op terikat elemen

Laporan ini adalah hasil pertama audit otomatis gerbang role di seluruh modul. Angka dan
temuannya bisa direproduksi kapan saja dengan perintah di bagian akhir. Temuan yang sudah
dicatat di `tools/gate_role_baseline.json` dijelaskan di sini supaya ada keputusan tertulis,
bukan hanya daftar mesin.

**Status: seluruh temuan sudah diperbaiki, dan baseline sekarang kosong.** Angka naik seiring
alatnya sendiri diperbaiki: mula-mula 26 temuan, lalu 2 lagi setelah invarian C ditambahkan,
lalu 1 lagi setelah `RoleGuard.RequireAdmin` dikenali sebagai gerbang. Tiap kenaikan itu
berarti pemeriksa sebelumnya buta pada satu kelas, bukan bahwa kodenya bertambah buruk.
Bagian "Keputusan yang diambil" mencatat arah perbaikan tiap temuan dan alasannya.

## Kenapa audit ini ada

Dua bug nyata lolos seluruh pemeriksaan yang ada sebelum alat ini dibuat:

| Bug | Kenapa lolos |
|---|---|
| Halaman Kontrak tertutup untuk KASIR | Gerbang ada di menu sidebar, bukan di `<section>`, jadi tidak ada pemeriksa yang melihat pertentangan |
| Form Denda Panen terbuka untuk ASKEP | Gerbang ada di tombol sub-nav, bukan di pane, jadi pane-nya terlihat terbuka untuk semua role yang lolos gerbang modul |

Dua-duanya bug gabungan: UI benar sendiri, service benar sendiri, yang salah relasinya. Tidak
ada pemeriksa yang membandingkan kedua sisi itu, jadi keduanya hanya bisa ditemukan dengan
membaca kode satu per satu.

## Ringkasan temuan

| Invarian | Arti | Jumlah | Status |
|---|---|---|---|
| A. UI buntu | Elemen menampilkan kontrol ke role yang op-nya ditolak service | 19 | Semua diperbaiki |
| B. Fitur terkurung | Service mengizinkan role, tapi tidak ada elemen yang bisa diklik role itu | 7 | Semua diperbaiki |
| C. Tombol dinamis tanpa guard | Tombol template-string yang tidak bisa disaring `data-roles` | 2 | Semua diperbaiki |
| A. UI buntu (gelombang kedua) | Muncul setelah cakupan alat diperluas | 1 | Diperbaiki |
| A. UI buntu (gelombang keempat) | Muncul setelah elemen tanpa gerbang ikut diperiksa | 2 | Diperbaiki |
| D. Op tulis tanpa gerbang | Op yang mengubah data tapi bisa dipanggil siapa pun yang sudah login | 28 | Semua diperbaiki, 1 dikecualikan beralasan |
| E. Op admin tanpa gerbang | Op di modul yang halamannya hanya untuk ADMIN, tapi op-nya bisa dipanggil role lain | 9 | Semua diperbaiki |

Total 68 temuan. Angka ini naik enam kali, dan setiap kenaikan datang dari alatnya sendiri
yang diperbaiki, bukan dari kode yang berubah: 26 temuan pada audit pertama, 2 lagi setelah
invarian C ditambahkan untuk tombol template-string, 1 lagi setelah `RoleGuard.RequireAdmin`
dikenali sebagai gerbang, 2 lagi setelah elemen tanpa gerbang ikut diperiksa, 28 lagi
setelah invarian D menuntut setiap op tulis punya gerbang, dan 9 lagi setelah invarian E
menuntut op di modul ADMIN-saja bergerbang. Tidak ada yang dibiarkan di baseline.

## Invarian A: UI buntu (19)

### Kelompok 1: ASKEP melihat tombol tulis yang tidak bisa dipakai (17)

ASKEP adalah pengawas teknis. Di banyak modul dia memang perlu melihat angka, jadi gerbang
modulnya sengaja dibuka untuk ASKEP. Masalahnya, tombol tulisnya ikut terlihat, padahal
service menolak ASKEP. Yang terjadi di lapangan: ASKEP mengisi form, menekan simpan, lalu
ditolak. Tombolnya tidak pernah bisa berhasil.

| Halaman | Elemen | Op | Service menerima |
|---|---|---|---|
| kontrak | `btn-kt-add-ms` | `add_milestone` | ADMIN, KTU |
| kontrak | `btn-kt-create-spk` | `create_agreement` | ADMIN, KTU |
| kontrak | `btn-kt-create-wip` | `create_wip` | ADMIN, KTU |
| kontrak | `btn-kt-save-ktr` | `save_contractor` | ADMIN, KTU |
| keuangan | `btn-keu-calc-tb` | `calculate_trial_balance` | ADMIN, KTU |
| keuangan | `btn-keu-save-coa` | `save_gl_account` | ADMIN, KTU |
| keuangan | `btn-keu-save-ic` | `save_interco` | ADMIN, KTU |
| keuangan | `btn-keu-save-jv` | `save_journal_voucher` | ADMIN, KTU |
| keuangan | `btn-keu-zerorise` | `zerorise_interco` | ADMIN, KTU |
| gang | `btn-gang-save` | `save_gang` | ADMIN, KTU |
| gang | `btn-md-save` | `save_mandore_hierarchy` | ADMIN, KTU |
| gang | `btn-slip-save` | `save_payslip_component` | ADMIN, KTU |
| gang | `btn-grid-save` | `set_gang_attendance` | ADMIN, KTU |
| berita-acara | `btn-save-ba` | `save_ba` | ADMIN, KERANI_AFDELING, KTU |
| rawat | `btn-rawat-simpan` | `save_rawat_proporsi` | ADMIN, KERANI_AFDELING, KTU |
| rawat | `btn-rawat-seed` | `seed_rawat_staging` | ADMIN, KERANI_AFDELING, KTU |
| rawat | `btn-premi-simpan` | `save_rawat_premi` | ADMIN, KERANI_AFDELING, KTU |

Perbaikannya satu pola: sembunyikan tombol tulis dari ASKEP, atau beri `data-roles` pada
tombolnya dengan himpunan yang sama seperti service. Mana yang dipilih tergantung keputusan
apakah ASKEP memang boleh menulis di modul tertentu.

### Kelompok 2: dead-end di fitur yang baru dibangun (2)

Dua ini di fitur yang baru dikerjakan, dan lolos karena tidak ada pemeriksa yang
membandingkan gate UI dengan gate service saat itu.

| Halaman | Elemen | Op | Gerbang elemen | Service menerima |
|---|---|---|---|---|
| kontrak | `btn-simpan-bayar` | `save_contractor_payment` | KASIR, KTU, ASKEP, ADMIN | ADMIN, KASIR |
| traksi | `btn-selesaikan-servis` | `selesaikan_spk_servis` | KERANI_AFDELING, ASKEP, KTU, ADMIN | ADMIN, ASKEP, KERANI_GUDANG |

`btn-simpan-bayar`: KTU dan ASKEP melihat tombol "Simpan Draft Pembayaran", padahal hanya
KASIR dan ADMIN yang boleh membuat draft. Sesuai desain, KTU dan ASKEP memang penyetuju,
bukan pembuat. Tombolnya harus disembunyikan dari keduanya.

`btn-selesaikan-servis`: KERANI_AFDELING dan KTU melihat tombol "Selesaikan SPK", padahal
service menolak keduanya. Lebih jauh, role yang diizinkan service (`KERANI_GUDANG`) tidak
punya jalan masuk sama sekali karena modul Traksi digerbang tanpa KERANI_GUDANG. Ini
pertentangan dua arah: UI menampilkan ke role yang salah, dan menyembunyikan dari role yang
benar.

## Invarian B: fitur terkurung (7)

Ketujuhnya berbentuk sama: service mengizinkan sebuah role, tetapi UI tidak memberi role itu
jalan menuju op tersebut. Arah perbaikannya tidak selalu di UI. Sebagian justru menandakan
service terlalu longgar, dan itu temuan keamanan, bukan temuan UX.

| Op | Role yang terkurung | Service menerima | Modul di UI | Perkiraan arah perbaikan |
|---|---|---|---|---|
| `create_archive` | KTU | ADMIN, KTU | Admin (ADMIN) | Service atau UI, perlu keputusan |
| `compress_archives` | KTU | ADMIN, KTU | Admin (ADMIN) | Service atau UI, perlu keputusan |
| `save_ba` | KERANI_AFDELING | ADMIN, KERANI_AFDELING, KTU | Berita Acara (ADMIN, ASKEP, KTU) | Kemungkinan service terlalu longgar |
| `seed_ba_payroll` | KERANI_AFDELING | ADMIN, KERANI_AFDELING, KTU | Payroll (ADMIN, KTU) | Kemungkinan service terlalu longgar |
| `save_employee` | KERANI_AFDELING | ADMIN, KERANI_AFDELING, KTU | Master Karyawan (ADMIN, KTU) | Kemungkinan service terlalu longgar |
| `save_spb` | KASIR | semua kecuali ASKEP | SPB (KERANI_AFDELING, KERANI_GUDANG, KTU, ADMIN) | Kemungkinan service terlalu longgar |
| `selesaikan_spk_servis` | KERANI_GUDANG | ADMIN, ASKEP, KERANI_GUDANG | Traksi (KERANI_AFDELING, ASKEP, KTU, ADMIN) | UI terlalu sempit, ini bug nyata |

Catatan penting untuk `save_spb`: gerbangnya di `CheckAccess` berbentuk daftar larangan
("semua kecuali ASKEP"), bukan daftar izin. Pola daftar larangan mudah menjadi terlalu
longgar ketika ada role baru ditambahkan, karena role baru otomatis diizinkan tanpa ada yang
memutuskan. Enam dari tujuh temuan di atas berasal dari himpunan role yang lebih lebar di
service daripada di UI.

## Yang tidak diperiksa

Alat ini hanya membandingkan op yang punya gerbang role di service. Op tanpa gerbang bisa
dipanggil siapa pun yang sudah login, jadi tidak ada pertentangan yang bisa muncul di sana.
Angka cakupan saat laporan ini dibuat: 228 panggilan op literal di JS menuju 185 op berbeda.
116 op terikat pada elemen yang bisa diklik, 75 hanya dipanggil loader (beberapa di antaranya
keduanya), dan 76 op punya gerbang role di service. Sisanya tidak diperiksa karena tidak ada
gerbang yang bisa dibandingkan.

Dua batas lain yang perlu diketahui:

- Op yang hanya dipanggil dari loader (75 buah) tidak punya elemen terikat, jadi tidak masuk
  pemeriksaan invarian A maupun B. Loader biasanya memuat data untuk ditampilkan, bukan untuk
  dipicu, tetapi kalau ada loader yang memanggil op tulis, itu tidak akan terlihat di sini.
  Kelima op tulis tanpa gerbang yang terikat elemen sudah ditutup di gelombang ketiga, jadi
  sekarang tidak ada lagi op tulis terikat elemen yang bisa dipanggil tanpa batasan role.
- Handler anonim di JS sengaja dilewati saat memetakan op ke elemen. Tombol yang dirender
  dinamis seperti `.btn-appr-doc` dipasang lewat `forEach` dengan arrow function tanpa nama,
  dan atribusinya tidak bisa dipercaya. Memaksakannya menghasilkan 114 temuan palsu saat alat
  ini pertama dijalankan. Kelas itu sekarang ditangani dari sisi lain oleh invarian C, yang
  memeriksa guard di perendernya, bukan menebak elemennya.

Alat ini juga tidak memeriksa apakah gerbang sebuah op benar secara domain. Kalau UI dan
service sama-sama salah dengan cara yang sama, alat ini diam. Itu sebabnya keputusan di
bagian berikut tetap butuh penilaian manusia.

## Keputusan yang diambil

Seluruh 31 temuan sudah diperbaiki pada 2026-09-19. Tidak ada yang dipindahkan ke daftar
"diketahui": baseline sekarang kosong. Empat commit, dipisah per perubahan logis:

| Commit | Isi |
|---|---|
| `1a552a3` | Buka pintu role yang benar di UI |
| `e452467` | Perketat gerbang service yang tidak punya pintu di UI |
| `cc73394` | Beri gerbang eksplisit untuk pengajuan SPK servis |
| `55cc879` | Audit gate role: benahi alatnya, tambah invarian C |

**Kelompok 1, 17 tombol tulis untuk ASKEP: arah perbaikannya UI, bukan service.** ASKEP
adalah pengawas teknis, dan gerbang modulnya sengaja dibuka supaya dia bisa melihat angka.
Yang salah bukan izinnya, melainkan tombol tulisnya ikut terlihat. Jadi tombolnya yang
diberi `data-roles` dengan himpunan yang sama seperti gerbang service: 13 tombol di Kontrak,
Keuangan, dan Gang memakai `KTU,ADMIN`; 4 tombol di Rawat dan Berita Acara memakai
`KERANI_AFDELING,KTU,ADMIN`.

**Kelompok 2, dua buntu di fitur yang baru dibangun: keduanya diperbaiki, tapi arahnya
berbeda.** `btn-simpan-bayar` diperbaiki di UI: KTU dan ASKEP adalah penyetuju, bukan
pembuat draft, jadi tombolnya dipersempit ke `KASIR,ADMIN` sesuai desain. `btn-selesaikan-servis`
diperbaiki di UI juga, tetapi dengan membuka modul Traksi untuk KERANI_GUDANG. Di situ UI-nya
yang salah dua arah sekaligus: menampilkan tombol ke role yang ditolak service, dan
menyembunyikan modulnya dari role yang justru diizinkan service. Bengkel ada di bawah gudang,
jadi kerani gudang memang orang yang menutup SPK servis.

**Tujuh temuan invarian B: arah perbaikannya service, sesuai rekomendasi.** Alasannya sama
untuk semuanya: izin yang tidak punya pintu masuk tidak pernah dipakai siapa pun, jadi tidak
ada yang tahu izin itu masih benar atau sudah basi. Daftar izin juga lebih mudah diaudit
daripada daftar larangan.

| Op | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| `create_archive` | ADMIN, KTU | ADMIN | Halaman Admin hanya terbuka untuk ADMIN |
| `compress_archives` | ADMIN, KTU | ADMIN | Sama, satu halaman dengan arsip |
| `save_employee` | + KERANI_AFDELING | ADMIN, KTU | Master karyawan bukan wilayah kerani afdeling |
| `seed_ba_payroll` | + KERANI_AFDELING | ADMIN, KTU | Persiapan payroll; simpan BA satu per satu tetap terbuka |
| `save_spb` | semua kecuali ASKEP | KERANI_AFDELING, KERANI_GUDANG, KTU, ADMIN | Daftar larangan jadi daftar izin; KASIR tercabut karena halamannya tertutup untuknya |
| `selesaikan_spk_servis` | ADMIN, ASKEP, KERANI_GUDANG | tidak berubah | UI-nya yang dibuka, bukan service-nya |

Satu temuan baru di luar daftar awal: **`AjukanSpk` tidak punya gerbang role sama sekali.**
Siapa pun yang sudah login bisa menerbitkan SPK servis, dan itu sekaligus mengubah status
unitnya menjadi WORKSHOP sehingga unit tersebut hilang dari daftar unit siap pakai. Daftar
izinnya diisi dengan himpunan yang sama seperti gerbang modul Traksi di UI, jadi tidak ada
role yang kehilangan akses; yang berubah hanya bentuknya, dari gerbang implisit menjadi
gerbang eksplisit yang bisa dibaca dan diuji.

## Invarian C, dan dua bug yang ditemukan setelahnya

Setelah 26 temuan itu diperbaiki, alatnya sendiri masih buta pada satu kelas: tombol yang
lahir dari template string. Tombol seperti itu tidak bisa diberi `data-roles`, dan op-nya
dipanggil dari handler anonim yang sengaja dilewati pemetaan. Dua tombol nyata ditemukan
lewat invarian baru ini:

| Tombol | Op | Gerbang service | Masalah |
|---|---|---|---|
| "Ke Payroll" di Berita Acara | `issue_ba_payroll` | KERANI_AFDELING, KTU, ADMIN | ASKEP melihatnya dan selalu ditolak |
| "Finalkan" di Payroll | `finalize_payroll_run` | KTU, ADMIN | Tanpa guard sama sekali |

Keduanya sekarang dijaga `bolehRole()`, dan invarian C memastikan guard-nya cocok dengan
gerbang service-nya. Guard diperiksa di **perender**, bukan di handler: keputusan menampilkan
tombol diambil di kode yang menyusun baris tabel.

## Gelombang kedua: satu temuan setelah cakupan alat diperluas

Setelah 28 temuan pertama diperbaiki dan alatnya ditambal tiga kali, satu temuan lagi muncul.
Ini bukan kode yang berubah, melainkan kemampuan alat melihat gerbang yang sudah ada.

| Halaman | Elemen | Op | Gerbang service | Masalah |
|---|---|---|---|---|
| blok | `data-sub-blok="form"`, `btn-save-master-blok` | `save_blok` | ADMIN | Empat role bisa membuka tab ubah dan mengisi formnya, lalu ditolak saat menyimpan |

`MasterDataService.SimpanBlok` memakai `RoleGuard.RequireAdmin`, pola gerbang keempat yang
tidak menyebut `UserRole` sama sekali. Parser alat hanya mengenali tiga pola, jadi op itu
terbaca sebagai "tanpa gerbang" dan dilewati sepenuhnya. Ada 14 pemakaian pola yang sama di
repo ini, jadi yang tersembunyi bukan satu op.

Perbaikannya memakai pola yang sama seperti 17 tombol sebelumnya: sub-tab, entri sub-menu
sidebar, dan tombol simpannya diberi `data-roles="ADMIN"`. Tab Hectare Statement sengaja
dibiarkan terbuka untuk keempat role pengawas, karena `DaftarHectareStatement` hanya memakai
`RequireAuthenticated` dan memang untuk dibaca lapangan.

## Sebelas cacat pada alat ini sendiri

Alat yang dipakai untuk membuktikan temuan harus dibuktikan dulu. Sebelas cacat ditemukan,
semuanya dengan menyerang alat itu sendiri, bukan dengan membacanya:

| Cacat | Akibatnya | Perbaikan |
|---|---|---|
| Daftar gerbang `CheckAccess` disalin tangan | Daftar salinan bisa berbeda dari gerbang yang benar-benar jalan tanpa ada yang sadar | Seluruhnya diparse dari kode, termasuk membalik polaritas "semua kecuali X" |
| Rantai pemanggilan digabung semua dengan OR | `MuatDariCsv` yang sudah dipersempit ke KTU/ADMIN terbaca selebar `Simpan` yang dipanggilnya | Pemanggilan sekelas diiris (berurutan), lintas kelas digabung (alternatif) |
| Parser fungsi JS melewatkan `window.nama = async function(...)` | Handler yang ditulis begitu tidak masuk peta, op di dalamnya tidak pernah diperiksa | Tiga bentuk penugasan fungsi ditambahkan ke parser |
| Alat TIDAK menangkap bug KASIR aslinya saat bug-nya dibalik | Gerbangnya ada di menu sidebar, bukan di `<section>` | Gerbang menu modul diikutkan ke rantai; `uji_gate_role_bug_asli.py` jadi uji tetap |
| `RoleGuard.RequireAdmin` tidak dikenali sebagai gerbang | 14 pemakaian pola itu terbaca sebagai "tanpa gerbang" lalu dilewati sepenuhnya | Pola keempat ditambahkan; `RequireAuthenticated` sengaja tidak dihitung |
| Pemanggilan beresiver tidak diresolusi | `_beritaAcara.List` dan `UserService.List` disatukan, gate ADMIN menempel ke `list_ba`, muncul 3 temuan palsu | Resolusi memakai tipe field; resiver tak dikenal tidak menebak |
| Variabel lokal penampung service tidak punya tipe | Pemanggilan lewat `svc` tidak bisa diresolusi, gate `create_archive` dan `compress_archives` hilang | Dua bentuk inferensi lokal: `new X(...)` dan helper berpeta tipe kembalian |
| Invarian A melewati elemen tanpa gerbang, invarian B tidak | Dua kelas elemen tidak pernah diperiksa: tombol di modul yang gerbangnya kosong, dan modal yang berdiri di luar semua halaman. Invarian A dan B membaca keadaan yang sama dengan arti berbeda | Elemen tanpa gerbang diperlakukan sebagai "terlihat semua role", sama seperti invarian B; kasus uji ditambahkan |
| Atribusi kelas dipindai atas sumber mentah, jadi komentar ikut terbaca | Komentar "record yang ada tidak disentuh" di `ClosingService.cs` dibaca regex sebagai kelas bernama `yang`, sehingga setiap metode setelahnya diatribusikan ke kelas yang tidak ada. `CloseModule` dan `ReopenModule` tidak teresolusi, dan dua op tutup buku terbaca "tanpa gerbang" sambil alat melapor bersih | Kelas dipindai atas sumber yang komentarnya dikosongkan, dengan panjang dan posisi dijaga supaya offset pemotongan metode tidak bergeser |
| Gerbang yang ditulis di dalam handler `Do*` tidak dipindai | Alat memindai `CheckAccess` dan metode service, tidak pernah handler App. `approve_stock_opname` memeriksa ADMIN/KTU di baris pertamanya tapi terbaca tanpa gerbang, lalu dilewati sepenuhnya | `gate_handler_app` memindai handler, dengan pola `_currentUser?.Role` supaya cek role objek LAIN (seperti `userRole != ADMIN` di `DoSaveUser`) tidak terbaca sebagai gerbang pemanggil |
| Invarian A/B/C hanya melihat op yang terikat elemen | Op tulis tanpa tombol, atau yang hanya dipanggil dari loader, tidak pernah masuk pemeriksaan sama sekali. 28 op tulis terbaca tanpa gerbang | Invarian D menuntut setiap op tulis di `OpCatalog` punya gerbang, atau terdaftar di daftar pengecualian beralasan |

Tiga cacat terakhir ditemukan di gelombang kelima, dan ketiganya ketemu dengan cara yang sama
seperti tujuh sebelumnya: bukan dengan membaca alatnya, melainkan dengan menuntut alat itu
menjawab pertanyaan yang belum pernah ditanyakan.

Tiga cacat terakhir saling menutupi, dan itu yang membuatnya layak dicatat. Cacat kelima
menaikkan temuan dari 0 ke 3, cacat keenam menurunkannya kembali ke 1, cacat ketujuh
menaikkan cakupan dari 67 ke 70 op. Kalau hanya salah satunya yang diperbaiki, angkanya akan
terlihat "lebih baik" sementara alatnya tetap salah. Angka yang berubah tanpa alasan yang
dipahami adalah gejala, bukan hasil.

Cacat keempat adalah yang paling penting, dan cara menemukannya yang perlu dicatat: bukan
dengan membaca ulang alatnya, tetapi dengan **membalik bug yang sudah diperbaiki dan melihat
apakah alatnya gagal**. Alat yang melaporkan bersih tanpa pernah terbukti bisa gagal belum
membuktikan apa pun.

## Gelombang ketiga: lima op tulis tanpa gerbang

Gelombang ini berangkat dari daftar kerja yang ditinggalkan gelombang kedua, dan sebelum satu
gerbang pun ditulis, dua cacat parser di alat ini ditemukan lebih dulu.

Cacat pertama: kondisi `CheckAccess` yang memuat beberapa `op.Equals` hanya terbaca op
pertamanya. Blok approval berisi empat op (`approve_doc`, `revisi_doc`, `approve_voucher`,
`revisi_voucher`), dan tiga di antaranya tidak pernah masuk peta gerbang. Cacat kedua: himpunan
role di-hardcode ke tiga nama (`OpsKhususAdmin`, `OpsKeuanganWrite`, `OpsKeuanganBaca`), jadi
setiap himpunan baru harus didaftarkan ulang di alat, dan kalau lupa, op-nya lolos pemeriksaan
sementara alat melaporkan bersih.

Urutannya disengaja: menulis kelima gerbang lebih dulu akan menghasilkan laporan "lima op sudah
bergerbang" dari alat yang tidak bisa membacanya. Yang kedua dulu, supaya yang pertama bisa
dipercaya. Setelah kedua cacat diperbaiki, cakupan naik dari 70 ke 71 op, lalu ke 76 setelah
kelima gerbang ditambahkan.

Himpunan role kelima gerbang diambil dari gerbang tombolnya di UI, bukan dikarang, supaya tidak
ada role yang kehilangan akses:

| Op | Elemen | Himpunan role | Sumber |
|---|---|---|---|
| `save_doc` | lima tombol gudang | KERANI_GUDANG, KTU, ADMIN | tombol Simpan halaman Gudang |
| `save_inventory_param` | `btn-save-reorder-param` | KERANI_GUDANG, KTU, ADMIN | sub-tab Parameter Inventory |
| `save_purchase_order` | `btn-save-po` | KERANI_GUDANG, KTU, ADMIN | modul Procurement |
| `save_absensi_panen` | `btn-save-absensi` | KERANI_AFDELING, ASKEP, KTU, ADMIN | halaman Absensi Panen |
| `save_traksi_logsheet` | `btn-save-traksi` | KERANI_AFDELING, ASKEP, KTU, ADMIN | modul Traksi |

`save_doc` yang paling penting dari kelimanya: tanpa gerbang role, siapa pun yang sudah login
bisa menyimpan dokumen gudang. Gate periode sudah ada sebelumnya, jadi yang hilang memang hanya
batasan role.

Satu hal yang perlu dicatat tentang `save_absensi_panen` dan `save_traksi_logsheet`: ASKEP ikut
di dalam himpunannya karena dia pengawas teknis di lapangan, bukan karena gerbang modulnya
kebetulan terbuka. Keputusan yang sama juga dipakai saat menutup temuan invarian B di gelombang
pertama.

Gerbangnya diuji dua arah: 32 test di `tests/PMS.App.Tests/GerbangTulisOpsTests.cs` (13 kasus
penolakan role, 19 kasus penerimaan dan validasi payload). Pembuktian terbaliknya juga
dijalankan: dengan kedua blok gerbang dilepas sementara, 13 dari 13 kasus penolakan gagal. Test
yang tidak pernah gagal saat kodenya dirusak belum membuktikan apa pun.

## Gelombang keempat: elemen tanpa gerbang

Gelombang ini tidak berangkat dari audit, melainkan dari suite test yang merah setelah kelima
gerbang gelombang ketiga ditulis. Test `SetiapModulTransaksi_MeninggalkanJejakDiModulnya` gagal
dengan `save_absensi_panen harus sukses`.

Setelah ditelusuri, test itu memang salah, bukan gerbangnya. Test itu menyentuh modul Absensi,
Agronomi, dan Traksi sekaligus, tetapi login sebagai `KERANI_GUDANG`. Gerbang modul Absensi
adalah `KERANI_AFDELING, ASKEP, KTU, ADMIN`, jadi akun gudang memang ditolak di sana. Hanya KTU
yang ada di gerbang ketiga modul itu, jadi test-nya sekarang login sebagai KTU. Perbaikannya di
test, dan alasannya ditulis di komentar supaya tidak dikembalikan orang lain.

Yang lebih penting muncul saat memeriksa apakah alat ini akan menangkap ketidakcocokan serupa
di modul yang gerbangnya kosong. Jawabannya tidak, dan sebabnya:

```python
# invarian A
if g is None or SEMUA in g:
    continue                     # elemen tanpa gerbang langsung dilewati
```

Invarian B membaca keadaan yang sama dengan arti yang berlawanan, di komentarnya sendiri:
"elemen tanpa gerbang: bisa diakses semua". Jadi A dan B tidak sepakat soal apa arti "tidak
punya gerbang". Akibatnya dua kelas elemen tidak pernah diperiksa sama sekali:

| Kelas elemen | Kenapa lolos |
|---|---|
| Tombol di modul yang gerbangnya kosong | Gerbang efektifnya `None`, jadi dilewati |
| Modal yang berdiri di luar semua `<section>` | Tidak mewarisi gerbang apa pun, jadi `None` juga |

Kelas kedua punya contoh nyata: `#modal-revisi` ada di luar semua halaman, dan tombol
`#btn-submit-modal-revisi` mengirim `revisi_doc` atau `revisi_voucher`, yang service-nya hanya
menerima ASKEP dan KTU.

Alat yang sudah ditambal menemukan 2 temuan itu. Keduanya diperlakukan sebagai temuan nyata,
bukan diabaikan, walaupun dalam praktik modalnya `hidden` sehingga hanya halaman Pusat Approval
yang bisa membukanya, dan halaman itu sendiri sudah bergerbang `ASKEP,KTU,ADMIN`. Gerbang di
tombolnya tetap ditambahkan supaya tidak bergantung pada gerbang halaman lain: modal yang
dibuka dari tempat lain di kemudian hari tidak otomatis bocor.

| Op | Elemen | Terlihat oleh | Service menerima | Gerbang yang ditambahkan |
|---|---|---|---|---|
| `revisi_doc` | `#btn-submit-modal-revisi` | KASIR, KERANI_AFDELING, KERANI_GUDANG | ASKEP, KTU | ASKEP, KTU, ADMIN |
| `revisi_voucher` | `#btn-submit-modal-revisi` | KASIR, KERANI_AFDELING, KERANI_GUDANG | ASKEP, KTU | ASKEP, KTU, ADMIN |

Self-test ditambah satu kasus untuk perilaku baru ini: elemen tanpa gerbang harus tetap
diperiksa, dan role yang dilaporkan bocor harus tepat `ROLES_SISTEM` dikurangi gerbang service.
Cara membuktikannya sama seperti cacat keempat: perilaku lamanya dikembalikan di salinan
sementara, dan self-test harus gagal. Terbukti gagal dengan dua pesan, `invarian A TIDAK
memeriksa elemen tanpa gerbang` dan `kontrol: suntikan invarian A tidak menambah temuan (0 vs 0)`.

## Gelombang kelima: 28 op tulis tanpa gerbang, dan tiga lubang cakupan lagi

Gelombang ini berangkat dari pertanyaan yang lebih luas daripada tiga gelombang sebelumnya:
bukan "apakah UI dan service sepakat", melainkan "apakah setiap op yang MENGUBAH DATA punya
penjaga sama sekali". Daftar op tulis diambil langsung dari `OpCatalog`, dan 28 di antaranya
terbaca tanpa gerbang role.

Alat versi sebelumnya tidak bisa melihat dua kelompok op ini, dan sebabnya berbeda dari cacat
yang sudah tercatat:

| Sebab | Op yang lolos | Akar |
|---|---|---|
| Atribusi kelas membaca komentar | `close_module`, `reopen_module` | Komentar "record yang ada tidak disentuh" di `ClosingService.cs` dibaca regex sebagai kelas bernama `yang` |
| Gerbang di handler App tidak dipindai | `approve_stock_opname` | Alat memindai `CheckAccess` dan metode service, tidak pernah handler `Do*` |
| Op tulis tanpa elemen | 28 op | Invarian A dan B hanya melihat op yang terikat elemen |

Yang paling berdampak dari 28 op itu: 15 op agronomi (`record_produksi_harian`,
`record_bjr_mingguan`, dan seterusnya), `run_sync` yang mengirim dokumen ke server cloud,
`save_stock_opname_session` dan `match_receive_po` yang mengubah stok, dan `save_traksi_unit`.

Himpunan role tiap baris diambil dari gerbang MODUL di sidebar, bukan dikarang, dengan alasan
yang sama seperti gelombang ketiga: kalau modulnya disembunyikan untuk sebuah role, service-nya
juga harus menolak, dan tidak ada role yang kehilangan akses yang memang sudah dimilikinya.

Satu op sengaja TIDAK diberi gerbang role: `change_password`. Setiap pengguna harus bisa
mengganti password miliknya sendiri, termasuk saat password awalnya masih wajib diganti.
Gerbangnya sesi login dan password lama yang harus benar, dan keputusan itu dikunci test
supaya tidak "diperbaiki" jadi gerbang role.

### Invarian D

Karena akar masalahnya bukan satu bug melainkan satu KELAS bug, gelombang ini menambah
invarian, bukan cuma gerbang:

> Setiap op tulis di `OpCatalog` harus punya gerbang role, atau terdaftar di
> `OP_TULIS_TANPA_GERBANG_DISENGAJA` beserta alasannya.

Daftar pengecualiannya sengaja harus ditulis tangan, bukan dihitung otomatis. Setiap entri di
situ adalah op yang boleh dipanggil oleh SETIAP pengguna yang sudah login, jadi menambah entri
harus terasa seperti keputusan, bukan seperti melewatkan sesuatu. Kalau daftar itu membengkak,
itu sinyalnya.

### Pembuktian

Tiga perbaikan cakupan dan invarian D dibuktikan bisa gagal dengan membalik perbaikannya:

| Perbaikan yang dibalik | Hasil |
|---|---|
| Pemindaian kelas kembali ke sumber mentah | Self-test gagal: `metode setelah komentar berisi kata 'record' harus tetap SvcUji, dapat [('yang', 'SetelahKomentar')]` |
| Pola handler dilonggarkan jadi `Role` tanpa `_currentUser` | Self-test gagal: `cek role OBJEK LAIN (userRole != ADMIN) bukan gerbang pelaku, tidak boleh masuk peta` |
| Satu gerbang op gudang dilepas | Invarian D melaporkan `match_receive_po`, exit code 1 |

Pola longgar di baris kedua itu penting dan sengaja diuji: `DoSaveUser` memeriksa
`userRole != UserRole.ADMIN` untuk mencegah ADMIN terakhir dinonaktifkan, dan itu role user
yang sedang DIUBAH, bukan role pemanggil. Pola yang salah membacanya sebagai gerbang pemanggil
dan menghasilkan gerbang PALSU, yang lebih berbahaya daripada tidak ada gerbang karena
memberi rasa aman palsu.

Test C#: `tests/PMS.App.Tests/GerbangOpTulisTests.cs`, 35 test. Dua arah untuk 17 op. Arah
negatif memastikan role di luar gerbang ditolak DENGAN pesan gerbang role, bukan karena
kegagalan lain; arah positif memastikan role yang berhak tidak ikut tertutup.

### Invarian E

Invarian D menutup op tulis, tapi op BACA masih lolos dengan cara yang sama: invarian A dan B
hanya melihat op yang terikat elemen, dan op baca di modul Admin sering dipanggil dari loader
halaman tanpa tombol sendiri. Sembilan op jejak terbaca tanpa gerbang sama sekali:

| Op | Isi yang terbaca |
|---|---|
| `list_audit_logs` | `user_id`, `username`, `action`, `entity`, `entity_id`, dan `new_value` |
| `list_transaction_logs`, `get_trace_detail`, `get_trace_summary` | jejak transaksi lengkap dengan payload |
| `get_admin_overview` | ringkasan status sistem |
| `module_closing_status` | status penutupan periode |
| `get_change_batch`, `list_change_batches`, `list_change_batches_without_fields` | batch perubahan data |

`new_value` di audit log adalah nilai LAMA dari setiap perubahan. Jadi yang terbaca bukan
sekadar daftar aktivitas, melainkan riwayat lengkap: siapa mengubah data siapa, kapan, dan
dari nilai apa ke nilai apa. Digabung dengan kebocoran data pribadi karyawan, jejak itu
memberi konteks penuh.

Gerbangnya ADMIN, sama dengan gerbang modul Admin di sidebar tempat panelnya berada.

### Cakupan invarian E sengaja dibatasi

Aturan "op harus lebih sempit dari modulnya" kedengaran lebih benar daripada "op di modul
ADMIN-saja harus bergerbang", dan itu yang pertama gue coba. Hasilnya **104 temuan**, dan
mayoritas bukan masalah: banyak op baca memang sengaja lebih longgar dari modulnya. `get_bincard`
boleh dibaca semua role yang login, dan itu memang desainnya.

Aturan yang menghasilkan 104 temuan yang harus disaring satu per satu akan diabaikan orang
berikutnya, dan alat yang diabaikan sama dengan tidak ada alat. Jadi cakupannya dipersempit ke
modul yang gerbangnya **hanya** ADMIN, di mana aturannya tidak ambigu: kalau halamannya cuma
untuk administrator, op-nya juga.

Yang penting, arah kedua itu ikut diuji: self-test memastikan op di modul non-ADMIN TIDAK
dilaporkan. Tanpa itu, cakupan ini bisa "diperluas" lagi tanpa ada yang menahan.

### Pembuktian invarian E

| Perbaikan yang dibalik | Hasil |
|---|---|
| Tiga op change batch dilepas dari gerbang | Invarian E melaporkan ketiganya, exit code 1 |

Self-test menambah tiga kasus: op admin tanpa gerbang terdeteksi, op yang sudah bergerbang
tidak dilaporkan, dan op di modul non-ADMIN tidak dilaporkan.

## Batas yang masih ada

Alat ini hanya membandingkan op yang **punya gerbang role di service**. Op tanpa gerbang bisa
dipanggil siapa pun yang sudah login, jadi tidak ada pertentangan yang bisa muncul di sana.
Itu sebabnya invarian D memeriksanya secara terpisah: bukan dengan membandingkan, melainkan
dengan menuntut gerbangnya ada.
Sebaliknya, elemen tanpa gerbang sekarang diperiksa: elemen seperti itu tidak pernah disaring
`applyRoleVisibility`, jadi semua role melihatnya, dan itulah yang dibandingkan alat ini terhadap
gerbang service-nya.
Setelah tiga perbaikan cakupan, tersisa 5 op tulis tanpa gerbang yang terikat elemen. Kelimanya
sudah ditutup di gelombang ketiga, jadi daftar kerja itu sekarang kosong:

| Op | Elemen | Gerbang yang ditambahkan |
|---|---|---|
| `save_doc` | lima tombol gudang | KERANI_GUDANG, KTU, ADMIN |
| `save_inventory_param` | `btn-save-reorder-param` | KERANI_GUDANG, KTU, ADMIN |
| `save_purchase_order` | `btn-save-po` | KERANI_GUDANG, KTU, ADMIN |
| `save_absensi_panen` | `btn-save-absensi` | KERANI_AFDELING, ASKEP, KTU, ADMIN |
| `save_traksi_logsheet` | `btn-save-traksi` | KERANI_AFDELING, ASKEP, KTU, ADMIN |

Tiga op yang tadinya ada di daftar ini sudah keluar setelah cakupan alat diperbaiki:
`save_warehouse`, `update_warehouse`, dan `save_blok` ternyata memang bergerbang ADMIN lewat
`RoleGuard.RequireAdmin`. Jadi yang berubah bukan kodenya, melainkan kemampuan alat melihat
gerbangnya. `save_blok` bahkan langsung memunculkan temuan nyata begitu terlihat.

Alat ini juga tidak memeriksa apakah gerbang sebuah op benar secara domain. Kalau UI dan
service sama-sama salah dengan cara yang sama, alat ini diam.

## Cara menjalankan ulang

```bash
python3 tools/audit_gate_role.py               # laporan; gagal kalau ada temuan baru
python3 tools/audit_gate_role.py --verbose     # peta lengkap op, gerbang, dan elemen
python3 tools/audit_gate_role.py --self-test   # uji parser dan ketiga invarian
python3 tools/uji_gate_role_bug_asli.py        # kembalikan bug KASIR asli, pastikan terdeteksi
python3 tools/audit_gate_role.py --write-baseline   # hanya setelah temuan lama benar-benar diperbaiki
```
