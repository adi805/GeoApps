# Hukum Proses, Factory {{proyek}}

**Versi:** 0.62.0
**Punya:** bagaimana factory ini berjalan: briefing, dispatch, closing, escalation.
**Identitas proyek:** `factory/identitas.json` — nama, slug, grup, kanal owner, repo, pohon kanonik.
**Daftar lane, topic, cakupan, dan path eskalasi:** `factory/lanes.json`.
**Skill hasil generate:** `{{skill_factory}}/SKILL.md` (jangan diedit tangan)

Kenapa berkas ini ada: aturan proses proyek ini sebelumnya cuma hidup di kepala operator dan di
dalam prompt cron. Dua-duanya hilang saat sesi berganti, dan yang tersisa cuma kebiasaan. Berkas
ini menjadikan proses itu **berkas yang di-version**, bukan yang diingat. Kalau satu aturan di sini
tidak punya pemeriksa mesin, aturan itu ditandai `[prosa]`, dan yang bertanda itu boleh dilanggar
tanpa ada yang menolak.

**Aturan tulis:** jangan pernah mengedit `SKILL.md` hasil generate. Sumbernya berkas ini.
Jalankan `python3 tools/factory/sync_skill.py` sesudah mengubah berkas ini.

---

## 1. Apa ini

Factory ini adalah pasangan dari tiga kaki. Hilangkan satu, dan ini berhenti jadi factory:

| Kaki | Di mana |
|---|---|
| Hukum proses | berkas ini, di repo, ikut di-commit |
| Surface chat | grup `{{proyek}}`, tiap lane satu topic (id grup dan topic: `factory/identitas.json` dan `factory/lanes.json`) |
| Papan tugas | issue di `{{repo}}` |

Papan tugas adalah daftar tugasnya. Kalau sebuah kerjaan tidak punya nomor issue, kerjaan itu
tidak ada, dan tidak akan pernah ditutup. Nomor issue ditulis di judul commit dan di laporan closing.

---

## 2. Lane

Satu lane = satu sesi persisten yang terikat satu topic. Lane tidak saling menulis berkas yang sama.

Tabel di bawah **dihasilkan** dari `factory/lanes.json`, jadi topic dan cakupannya tidak bisa
melenceng dari yang dibaca gate. Jangan diedit tangan: jalankan
`python3 tools/factory/sync_law.py`, lalu sahkan versinya.

<!-- MULAI: tabel lane (dihasilkan tools/factory/sync_law.py dari factory/lanes.json, jangan diedit tangan) -->
| Lane | Topic | Cakupan |
|---|---|---|
| `HQ` | 12 | hukum, ruling, gate, percakapan dengan owner; tidak mengerjakan implementasi |
| `android` | 13 | build dan paket Android: Tauri mobile, gradle, izin lokasi, workflow android dan ios, rilis ke Play Store, plus shell Rust Tauri (src-tauri/src, src-tauri/Cargo.toml) |
| `geo-pdf` | 15 | impor GeoPDF dan GeoTIFF: parser georeferensi, render PDF ke raster, bounds dan CRS, jalur raster source; juga plugin peta dan raster lain di packages/plugins/src/plugins/*.ts yang tidak punya lane sendiri |
| `geofence` | 16 | geofence, GPS averaging, pelacakan GPS, track dan UTM, preset lokasi lapangan |
| `offline` | 17 | peta offline: unduh region, MBTiles, basemap offline, cache tile, bundel proyek portabel dan koleksi lapangan |
| `ui` | 19 | shell aplikasi: home My Maps, navigasi bawah, branding, tema |
| `gh-ops` | 20 | issue, PR, label, dan rilis di GitHub |
| `uji` | 21 | berkas uji dan verifikasi: tests/**, e2e/**, skrip cek penerimaan, baseline modul tanpa uji, dan workflow ci.yml; uji satuan yang tinggal di sebelah kodenya milik lane modulnya |
| `visual` | 157 | bahasa visual aplikasi yang digenerate lewat kode: token, primitif, satu komposisi per fungsi, galeri dan tangkapan layarnya. Tidak menyentuh App.tsx, komponen, atau hook yang sudah ada: lane ini menggambar ulang, bukan menambal shell |
<!-- SELESAI: tabel lane -->

`HQ` sengaja dijaga kosong dari implementasi. Setiap unit kerja dikirim ke lane lain. Factory yang
`HQ`-nya ikut mengerjakan kode akan menumpuk kerjaan manajerial di satu sesi, dan dispatch berhenti.

**Uji satuan tinggal di sebelah kodenya, jadi ia milik lane modulnya.** Berkas `*.test.ts` di dalam
`apps/geolibre-desktop/src/**` atau `packages/plugins/src/plugins/**` masuk cakupan lane pemilik
kodenya, bukan lane `uji`: menambah satu kasus uji untuk fungsi yang baru diubah tidak boleh
menuntut dua lane bekerja di satu PR. Lane `uji` tetap memegang `tests/**` dan `e2e/**`, yaitu uji
yang berdiri sendiri di luar pohon sumber. Satu berkas uji boleh cocok dengan lebih dari satu glob;
gate cakupan memeriksa "cocok salah satu", bukan kepemilikan eksklusif.

**Lane tanpa sesi terikat topic belum bisa dibrief.** Brief dikirim ke sesi, bukan ke topic: topic
cuma ruangannya. Sesi lahir dari pesan masuk di topic itu, jadi topic yang belum pernah menerima
pesan belum punya sesi, dan brief ke sana mengerjakan nol pekerjaan. Periksa dengan
`python3 tools/factory/cek_lane.py`; ia juga menolak binding yang menunjuk sesi milik topic lain,
karena push seperti itu mendarat di ruangan yang salah tanpa satu pun error.

Berkas ini dan lane-nya **bukan** pengganti [factory/docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).
CONTRIBUTING tetap sumber kebenaran soal perintah, pemeriksa, dan cara menambah modul. Berkas ini
cuma mengatur siapa mengerjakan apa, kapan sebuah unit kerja ditutup, dan apa yang wajib terbukti.

---

## 3. Briefing

**Brief dikirim sebagai pesan langsung ke sesi lane, membawa identitas sesi itu. Bukan sebagai
postingan di grup.**

Grup itu untuk owner mengawasi dan mengarsipkan. Lane tidak membaca grup. Brief yang diposting di
grup mengerjakan **nol** pekerjaan untuk worker-nya, dan lebih buruk lagi, ia terlihat seperti sudah
dikerjakan.

Isi brief minimum, tidak boleh kurang:

1. Nomor issue di `{{repo}}`
2. Cakupan: berkas atau modul mana yang boleh disentuh
3. Kriteria selesai, dalam bentuk perintah yang bisa dijalankan dan hasil yang dituntut
4. Worktree dan nama branch yang dipakai
5. Batas: apa yang **tidak** boleh disentuh di unit kerja ini

Brief tanpa nomor 3 bukan brief, itu harapan.

---

## 4. Dispatch

1. Temuan atau permintaan masuk ke papan tugas dulu, jadi issue. Bukan langsung jadi kerjaan.
2. `HQ` menilai: lane mana, cakupan mana, kriteria selesai apa.
3. Brief dikirim ke sesi lane (bagian 3).
4. Lane membuat worktree sendiri, mengerjakan, menutup (bagian 6).

**Satu unit kerja, satu worktree, satu branch.** Worktree dibuat dari `origin/main` yang baru
di-fetch, bukan dari worktree lain yang kebetulan sedang terbuka. Pola `~/GeoApps-<slug>` sudah
dipakai; ikuti, jangan bikin direktori di luar pola itu.

**Jangan jalankan dua rantai build atau test di satu pohon yang sama.** Dua `full_build` atau dua
`npm test` di pohon yang sama saling menghapus artefak dan menghasilkan merah palsu. Sebelum
memulai rantai berat: `pgrep -f "[n]pm test"` dan periksa `~/GeoApps-*/` yang sedang aktif.

---

## 5. Definisi selesai

Sebuah unit kerja selesai hanya kalau **semuanya** ini benar:

| # | Syarat | Cara membuktikan |
|---|---|---|
| 1 | Kriteria selesai di issue terpenuhi | perintahnya dijalankan, keluarannya ditempel |
| 2 | Pemeriksa yang relevan hijau | daftar perintah di CONTRIBUTING bagian 2, dipilih sesuai berkas yang disentuh |
| 3 | Commit ada di branch, dan hash-nya disebut | `git log --oneline` |
| 4 | Issue dikomentari dengan hash commit dan bukti | `gh issue comment` |
| 5 | Tidak ada berkas setengah jadi yang tertinggal | `git status --short` bersih |

Hijau di CI **bukan** pengganti nomor 1 dan 2. CI cuma membuktikan apa yang dijalankannya, dan
`npm test` yang lulus tidak membuktikan modul yang tidak punya test itu benar.

Kalau salah satu nomor di atas tidak bisa dipenuhi, unit kerja itu **belum selesai**, dan itu yang
dilaporkan. Laporan setengah jadi yang jujur lebih berharga daripada laporan selesai yang salah.

---

## 6. Closing

1. Jalankan ulang pemeriksa yang relevan di worktree unit kerja, bukan di worktree lain.
2. Commit atomik: satu perubahan logis satu commit. Pesan commit pakai bahasa Indonesia, mengikuti
   gaya yang sudah ada di `git log` (mis. `perbaikan export: kegagalan baca panen tidak lagi
   menjadi laporan kosong`), dan menyebut nomor issue kalau ada.
3. Push branch ke `origin`.
4. Buka PR ke `main`. **Merge commit, jangan squash, jangan rebase.** Tag rilis menempel di riwayat;
   rebase menulis ulang SHA dan meninggalkan tag itu di luar `main`.
5. **Badan PR memuat baris `Closes #<nomor>` berbahasa Inggris**, satu baris per issue yang ditutup.
   GitHub cuma memproses `close`, `fix`, dan `resolve` beserta variannya; klaim penutup dalam bahasa
   Indonesia (`Menutup #75`) terbaca sebagai rujukan biasa, jadi issue-nya tetap terbuka dan yang
   menutupnya harus orang yang ingat. Tiga PR yang sudah di-merge (#94, #78, #70) meninggalkan 15
   issue terbuka seperti itu, dan `gate_pr_link.py` hijau di ketiganya.
6. Komentari issue: hash commit, apa yang berubah, pemeriksa mana yang hijau, berkas apa yang disentuh.
7. Hapus worktree sesudah PR merge: `git worktree remove ~/GeoApps-<slug>`.

**Riwayat branch sendiri boleh ditulis ulang, tapi hanya sebelum PR di-merge dan hanya kalau
perlu.** Yang dilarang di nomor 4 adalah menulis ulang riwayat `main`: tag rilis menempel di sana.
Branch yang belum di-merge tidak memikul tag, jadi membetulkan judul commit di sana tidak merusak
apa pun, asal tiga syarat ini benar: (1) tidak ada tag di rentang yang ditulis ulang, (2) isi
pohonnya tidak berubah: `git diff <tip lama> <tip baru>` harus kosong, dan (3) setiap jangkar
`commit` di `factory/ledger.jsonl` ikut dipindahkan lewat `ledger.py reanchor`, bukan dengan
mengedit berkasnya. Syarat 3 ada karena jangkar ledger menunjuk SHA: ledger yang tidak ikut
dipindahkan masih lulus di mesin yang menyimpan objek lama, lalu gagal di klon bersih. Gate yang
hijau di satu mesin dan merah di mesin lain bukan gate, itu kebetulan.

Jangan menutup issue dari worktree yang masih kotor. Jangan menutup issue orang lain tanpa membaca
seluruh komentarnya lebih dulu.

---

## 7. Escalation

Ada dua tingkat, dan yang membedakannya **siapa yang memutuskan**, bukan besar-kecilnya perubahan.
Nama tingkatnya hidup di `factory/lanes.json` (`eskalasi.glob` dan `eskalasi.glob_agen`), dan
`gate_commit_paths.py` menyebut tingkatnya di pesan penolakan.

### 7.1 Tingkat owner: naik lewat lane `HQ`

Naikkan ke owner begitu salah satu ini benar:

| Pemicu | Kenapa naik |
|---|---|
| Perubahan menyentuh satu path tingkat owner (daftar persisnya di bawah tabel) | Rilis dan produksi, blast radius-nya di luar repo |
| Perubahan skema basis data yang menyentuh data pelanggan | Tidak bisa di-undo dengan revert |
| Operasi di VPS produksi (`joyboy`) | Host itu yang melayani pelanggan |
| Operasi VPS yang tidak bisa dibalik, di host mana pun: hapus data, buka port ke publik, putar atau hapus kredensial | Tidak ada jalan kembali |
| Kriteria selesai tidak bisa dipenuhi dengan cakupan yang diberikan | Butuh keputusan cakupan, bukan kerja lebih keras |
| Dua pemeriksa saling bertentangan | Mekanismenya yang salah, bukan nilainya |
| Satu goal gagal tiga kali dengan protokol yang benar | Targetnya perlu didefinisikan ulang |

<!-- MULAI: path eskalasi owner (dihasilkan tools/factory/sync_law.py dari factory/lanes.json, jangan diedit tangan) -->
**Path tingkat owner**

| Path |
|---|
| `apps/geolibre-desktop/src-tauri/tauri.conf.json` |
| `apps/geolibre-desktop/src-tauri/tauri.android.conf.json` |
| `apps/geolibre-desktop/src-tauri/tauri.ios.conf.json` |
| `apps/geolibre-desktop/src-tauri/tauri.mas.conf.json` |
| `packaging/**` |

identitas paket dan rilis: applicationId Android dibakar permanen oleh Google Play pada unggahan pertama, jadi blast radius-nya di luar repo dan wajib naik ke owner dulu
<!-- SELESAI: path eskalasi owner -->

Path tingkat owner itu dibaca `gate_commit_paths.py` dari `factory/lanes.json`, dan PR yang
menyentuhnya wajib berlabel `eskalasi`.

Aksi yang tidak bisa dibalik (hapus, push ke `main`, terbitkan rilis, kirim ke pihak luar) selalu
naik dulu. Aksi yang bisa dibalik (commit di branch, buka PR, tulis berkas) tidak perlu.

### 7.2 Tingkat agent: diputuskan agent, tanpa menunggu owner

Daftar ini pindah dari tingkat owner ke keputusan agent lewat instruksi owner 2026-10-11, karena
menahan tiap perubahannya cuma memindahkan kerja ke owner tanpa menambah keamanan: berkasnya di
dalam repo, ditinjau lewat PR, dan bisa dibalik dengan revert.

| Pemicu | Kenapa agent yang memutuskan |
|---|---|
| Perubahan menyentuh satu path tingkat agent (daftar persisnya di bawah tabel) | Di dalam repo, ditinjau PR, dibalik revert; CI sendiri yang memvalidasi |
| Operasi VPS non-produksi (`tencent`) yang bisa dibalik: pasang atau cabut baris crontab, restart service runner, keanggotaan grup | Reversible, dan host itu host uji, bukan host produksi |

<!-- MULAI: path eskalasi agent (dihasilkan tools/factory/sync_law.py dari factory/lanes.json, jangan diedit tangan) -->
**Path tingkat agent**

| Path |
|---|
| `.github/workflows/**` |

CI dan runner: berkasnya di dalam repo, ditinjau lewat PR, dan bisa dibalik dengan revert. Izin tetap lewat label PR `eskalasi`, dan tiap keputusan wajib dicatat sebagai entri ledger `ruling` dengan oleh=agent.
<!-- SELESAI: path eskalasi agent -->

Syaratnya, dan ini yang membuatnya tetap terlacak:

1. Label `eskalasi` **tetap dipasang di PR**. `gate_commit_paths.py` menolak path ini tanpa label,
   di kedua tingkat. Labelnya tripwire deklarasi, bukan izin owner, dan agent memasangnya sendiri.
2. Entri ledger `ruling` dengan `oleh=agent` dicatat sebelum merge, memuat alasan dan keluarannya.
3. Label `eskalasi` di **issue** tetap berarti "menunggu keputusan owner". Jadi issue yang menyentuh
   path tingkat agent **tidak** dilabeli `eskalasi`: kalau dilabeli, pacemaker melewatinya dan
   issue-nya berhenti dilaporkan padahal tidak ada owner yang menunggu.

Batasnya tetap: begitu operasinya menyentuh host produksi, atau tidak bisa dibalik, dia naik lagi ke
7.1. Yang berubah hanya operasi non-produksi yang reversible.

### 7.3 Delegasi merge

**Instruksi owner:** merge PR ke `main` **didelegasikan ke agent**. Owner menyebutnya dua kali
(2026-10-10 01:02 dan 05:06), karena menahan merge yang gate-nya sudah hijau cuma memindahkan kerja
ke owner tanpa menambah keamanan. Syaratnya semua ini benar:

1. `factory-gate` hijau di PR itu.
2. Berkasnya di dalam cakupan lane yang berlabel.
3. Tidak menyentuh satu pun path pemicu **tingkat owner** di 7.1.

Path tingkat agent di 7.2 **boleh** di-merge agent, asal syarat 7.2 terpenuhi. Merge yang tidak
memenuhi ketiganya tetap naik.

Saat naik, sertakan: apa yang dicoba, keluaran tool-nya apa adanya, dan keputusan apa yang diminta.
Escalation tanpa keluaran tool cuma keluhan.

---

## 8. Gate

Gate di bawah ini yang mekanis. Selebihnya `[prosa]`, dan yang `[prosa]` akan dilanggar.

| Gate | Perintah | Menolak kalau |
|---|---|---|
| Konsistensi antar lapisan | `python3 tools/audit_consistency.py` (produk) | satu sisi berubah, sisi lain tidak |
| Angka dokumen | `python3 tools/verifikasi_dokumen.py` (produk) | angka di dokumen tidak cocok kode |
| Versi satu tempat | `python3 tools/cek_versi.py` (produk) | nomor versi berbeda antar berkas |
| Berkas hukum tersinkron | `python3 tools/factory/sync_skill.py --check` | `SKILL.md` berbeda dari `LAW.md` |
| Hukum tidak basi | `python3 tools/factory/gate_law_fresh.py` | isi `LAW.md` beda dari baseline, atau versinya tidak naik |
| Tabel lane tidak melenceng | `python3 tools/factory/sync_law.py --check` | blok hasil generate di `LAW.md` (tabel lane, path eskalasi) berbeda dari `factory/lanes.json`, atau penandanya hilang/dobel |
| Cakupan lane | `python3 tools/factory/gate_commit_paths.py --lane <id>` | lane menyentuh berkas di luar cakupannya, atau menyentuh path eskalasi tanpa izin |
| Entri eskalasi tidak mati | `python3 tools/factory/gate_commit_paths.py` (cek bawaan, semua mode) | entri `lanes.json` tanpa wildcard menunjuk path yang tidak eksis: berkasnya jadi tidak terdeteksi butuh tingkat owner maupun agent, dan gate-nya hijau karena tidak memeriksa apa pun |
| Unit kerja tertaut issue | `python3 tools/factory/gate_pr_link.py` | judul/badan PR atau judul commit non-merge tidak menyebut nomor issue, atau badan PR tidak memuat kata kunci penutup berbahasa Inggris (`Closes #N`) |
| Bukti closing | `python3 tools/factory/gate_receipt.py --berkas factory/receipts/<issue>.json` | commit tidak ada, ada perintah exit != 0, worktree kotor, komentar issue tidak ada |
| Ledger bisa ditulis | `python3 tools/factory/ledger.py append ...` | lane selain `HQ` mencoba menulis, atau entri baru merusak skema (dobel, `ts` mundur, commit tidak ada) |
| Ledger bisa di-anchor ulang | `python3 tools/factory/ledger.py reanchor --peta <berkas>` | kunci peta tidak dipakai entri mana pun, nilainya bukan commit, atau hasilnya merusak skema |
| Ledger satu penulis | `python3 tools/factory/gate_ledger.py` | penulis bukan `HQ`, `ts` mundur, entri dobel, commit tidak ada |
| Lint skill plugin | `python3 tools/factory/gate_plugin_lint.py` | ada skill tanpa frontmatter yang benar, masih memuat konvensi Cowork, tanpa header sumber, SHA sumbernya beda dari pin, atau berkasnya ada di disk tapi tidak ter-track git |
| Kosakata terkendali | `python3 tools/factory/gate_ontology.py` | sinonim terlarang dari `ONTOLOGY.md` muncul di prosa `factory/**` atau `factory/docs/**`, daftar terlarangnya kosong, atau nol berkas diperiksa |
| Salinan skill tersinkron | `python3 tools/factory/sync_plugins.py --check` | `~/.opencrabs/skills/geoapps-<nama>/SKILL.md` berbeda dari `factory/skills/`, atau ada salinan `geoapps-*` tanpa sumbernya di repo |
| Pemicu CI tidak mematikan pemeriksa | `python3 tools/factory/gate_pemicu_ci.py` | `factory-gate.yml` memasang penyaring path (`paths`/`paths-ignore`), tidak mendengar event `labeled`, ada job yang menyaring `github.event.action`, atau grup `concurrency` tidak memuat action |
| Lane terikat topic | `python3 tools/factory/cek_lane.py --wajib-lengkap` | ada lane yang topic-nya belum punya sesi, atau `session_bindings` dan `sessions.channel_chat_key` menunjuk hal yang berbeda |
| Lane dorman bersinyal | `python3 tools/factory/jaga_lane.py` | ada lane bukan `terikat` dan alarmnya tidak dikirim: `cek_lane.py --wajib-lengkap` keluar 1 tapi sesi agent tidak dibangunkan, atau alarm menyala saat semua lane sudah terikat |
| Alamat laporan agent | `python3 tools/factory/gate_kanal.py` | `owner.kanal` kosong, bentuk kuncinya bukan `[chat:<grup>]` atau `[chat:<grup>:topic:<N>]`, grupnya bukan grup papan ini, menunjuk topic lane, atau tidak punya tepat satu sesi hidup |
| Pacemaker | `python3 tools/factory/pacemaker.py --uji-mandiri` | gate-nya membangunkan sesi saat tidak ada sinyal, atau diam saat ada sinyal baru |
| Skor day-1 | `python3 tools/factory/skor.py --uji-mandiri` | resolver memberi skor pada syarat yang tidak bisa ditunjukkan, atau berkas kosong dihitung sebagai ada |
| Perilaku | `npm test` | ada test gagal |

Baris bertanda **(produk)** memeriksa berkas milik repo produk (`src/`, dokumen arsitektur, nomor versi rilis), jadi gate-nya hidup di sana, bukan di repo mesin ini. Daftarnya sengaja tetap ditulis lengkap: begitu mesin ini dipasang di sebuah proyek, gate itulah yang harus dipasang di sana, dan daftar ini yang jadi rujukannya.

`sync_skill.py --check` ada supaya berkas ini tidak bisa basi diam-diam: selama `LAW.md` berubah
tanpa `SKILL.md` ikut diperbarui, gate ini merah. Gate yang tidak punya cara menolak cuma dekorasi.

Commit merge tidak diperiksa: merge itu integrasi, bukan unit kerja, dan GitHub membuat satu commit
merge sintetis (`Merge <sha> into <sha>`) untuk tiap PR yang judulnya tidak ditulis siapa pun.
Memeriksanya membuat gate tautan issue merah di setiap PR, dan gate yang selalu merah berhenti
dipercaya, yang sama saja dengan tidak punya gate.

### 8.1 Gate factory dan uji mandirinya

Gate di `tools/factory/` semuanya Python stdlib (tidak ada yang butuh cargo, jadi tidak ada yang
butuh joyboy). Tiap gate punya dua jalur: menerima dan menolak.

```
python3 tools/factory/uji_gate_mandiri.py     # 78 kasus, tiap gate wajib punya kasus negatif
python3 tools/factory/gate_plugin_lint.py --uji-mandiri   # 10 kasus, 8 negatif
python3 tools/factory/sync_plugins.py --uji-mandiri       # 9 kasus
python3 tools/factory/sync_skill.py --uji-mandiri         # 14 kasus
python3 tools/factory/sync_law.py --uji-mandiri           # 6 kasus
python3 tools/factory/ledger.py --uji-mandiri # 19 kasus untuk jalur tulis dan anchor ledger
python3 tools/factory/cek_lane.py --uji-mandiri    # 7 kasus, 6 negatif
python3 tools/factory/jaga_lane.py --uji-mandiri    # 14 kasus, termasuk yang harus DIAM
python3 tools/factory/pacemaker.py --uji-mandiri   # 33 kasus
python3 tools/factory/skor.py --uji-mandiri        # 13 kasus, 9 negatif
python3 tools/factory/usulan.py --uji-mandiri      # 80 kasus
python3 tools/factory/lapor.py --uji-mandiri       # 14 kasus
python3 tools/factory/pintu.py --uji-mandiri       # 15 kasus
python3 tools/factory/sinkron_pohon.py --uji-mandiri       # 25 kasus, termasuk yang harus BERHENTI
python3 tools/factory/gate_ontology.py --uji-mandiri       # 11 kasus, 6 negatif
python3 tools/factory/gate_kanal.py --uji-mandiri          # 10 kasus, 8 negatif
python3 tools/factory/gate_pemicu_ci.py --uji-mandiri      # 14 kasus, 11 negatif (penyaring path + trigger labeled)
```

Uji itu dijalankan di direktori sementara dan tidak pernah menulis ke repo. Ia dihitung gagal kalau
ada gate yang tidak punya kasus negatif, supaya "cuma jalur bahagia" tidak bisa lolos sebagai
pemeriksaan. `--sahkan` dan `--izin-eskalasi` adalah dua pintu yang sengaja dibuat sempit:
`--sahkan` menolak kalau isi berkas ini berubah tanpa nomor versi naik, dan `--izin-eskalasi` di CI
datang dari label PR `eskalasi`, bukan dari niat baik.

Enam berkas terakhir bukan penolak berkas seperti yang lain, dan itu sebabnya uji mandirinya
menguji keputusan, bukan exit code: `cek_lane.py` membandingkan dua tabel yang harus sepakat,
`pacemaker.py` harus bisa DIAM saat tidak ada sinyal (dan diamnya itu yang diuji), `skor.py`
harus memberi nol pada pohon kosong, `usulan.py` harus menolak lane asing, opsi yang cacat, dan
pembalikan tanpa `--ganti`/`--alasan`, dan
`lapor.py` tidak boleh mengirim ulang opsi yang sudah dilaporkan, dan `pintu.py` harus nol di pohon
  tanpa kejadian tapi satu saat sesi lane memanggil `suggest_options`.
`gate_ontology.py` punya tiga keputusan yang disengaja, dan ketiganya pernah jadi sumber temuan
palsu di tempat lain: yang diperiksa hanya berkas Markdown dan teks (berkas kode memuat pengenal
seperti `warehouse_doc` yang wajib ditulis persis), potongan kode dilewati sebelum pencocokan, dan
**nol berkas diperiksa dihitung gagal** supaya pohon yang salah tidak terbaca sebagai hijau. Daftar
istilahnya sendiri ada di `ONTOLOGY.md`, dan tiap pengecualian di berkas itu wajib menyebut
alasannya, karena pengecualian tanpa alasan sama saja dengan menghapus aturannya.

**Kenapa `--check` tidak ada di CI, dan `--uji-mandiri` ada (2026-10-11).** Dua penjaga salinan
(`sync_skill.py`, `sync_plugins.py`) membandingkan sumber di repo dengan salinan **hidup** di
`~/.opencrabs/skills/`. Runner tidak punya direktori itu, jadi `--check` di CI merah karena alasan
yang salah (terukur: `exit 1` di `HOME` bersih, dan pesannya "belum ada: <path>"), dan gate yang
merah karena alasan yang salah akan diabaikan orang sampai tidak dipercaya lagi. Karena itu
pembagiannya: `--uji-mandiri` (keputusan alatnya, tidak butuh mesin hidup) di CI, `--check` (drift
salinan hidup) di jalur yang memang punya salinan itu. Sampai 2026-10-11 `--check` **belum
terpasang di jalur mana pun**, dan itu sebabnya `SKILL.md` bisa tertinggal satu versi dari `LAW.md`
tanpa ada gate yang menolak: satu-satunya cara ia ketahuan adalah ada orang yang menjalankannya
manual. Memasang `--check` di CI bukan perbaikannya, justru itu yang harus dihindari.

**Keputusan "Bukti closing" menuntut minimal satu receipt (2026-10-10).** Sebelum ada lane yang
menutup kerja, langkah itu cuma mencetak jumlah yang diperiksa dan tidak menolak apa pun; menuntut
`>= 1` saat itu hanya memblokir PR yang tidak berhubungan. Setelah sepuluh receipt ada di `main`,
syaratnya berbalik: langkah itu sekarang **menolak** kalau `receipt diperiksa` bernilai nol, karena
tahap yang memeriksa nol objek lalu keluar 0 menghasilkan laporan kosong yang terbaca seperti hijau.

### 8.2 Artefak yang dibaca gate

| Artefak | Isinya | Siapa yang menulis |
|---|---|---|
| `factory/lanes.json` | daftar lane, topic, cakupan glob, penulis ledger, kanal owner, daftar path eskalasi | `HQ` |
| `factory/law_baseline.json` | versi + sidik isi berkas ini yang terakhir disahkan | `gate_law_fresh.py --sahkan` |
| `factory/ledger.jsonl` | catatan peristiwa lintas lane, satu objek JSON per baris | `tools/factory/ledger.py`, hanya lane `HQ` |
| `factory/usulan-<lane>.jsonl` | opsi pekerjaan yang menunggu keputusan, satu objek JSON per baris; **satu berkas per lane** sejak #217 | `tools/factory/usulan.py`, dipanggil lane mana pun |
| `factory/receipts/<issue>.json` | bukti closing: commit, perintah, keluaran, status worktree | lane yang mengerjakan |
| `factory/skills/<nama>/SKILL.md` | skill lane, hasil tulis ulang plugin upstream | `HQ` dan lane pemiliknya |
| `factory/upstream/PIN.md` | SHA upstream yang dipin, lisensi, dan peta lane ke skill | `HQ` |
| `factory/SKOR.md` | rubrik day-1 dan angka terakhirnya | `HQ` |
| `factory/skor/YYYY-MM.md` | snapshot skor bertanggal, satu berkas per bulan, ditulis `HQ` tiap angkanya bergerak | `HQ` |
| `ONTOLOGY.md` | istilah baku, sinonim terlarang, dan daftar pengecualian yang tiap barisnya beralasan | `HQ` |

**Jalur tulis ledger satu, dan itu disengaja.** `tools/factory/ledger.py` adalah satu-satunya
penulis: berkasnya dikunci `flock` selama baca-validasi-tulis, entri baru divalidasi bersama seluruh
isi lama sebelum ditulis, dan `penulis` wajib lane `HQ`. Lane itu dibaca dari `$GEOAPPS_LANE` kalau
`--penulis` tidak diberikan, dan `--penulis` yang diberikan tetap wajib sama dengan penulis tunggal
di `lanes.json`. Kapan peristiwanya dicatat: `dispatch` saat brief dikirim ke lane, `buka-pr` saat PR
dibuka, `tutup` saat unit kerja ditutup, `naik` saat eskalasi, `ruling` saat owner memutuskan.
Lane lain tidak menulis ledger; mereka melaporkan ke `HQ`, dan `HQ` yang mencatat. Semua seat boleh
menghasilkan, satu seat yang menulis. Satu pasangan (issue, event) ditolak kalau tercatat dua kali,
karena pengulangan biasanya kecelakaan: entri kedua untuk pasangan yang sama memakai
`--ulang "<alasan>"`, dan `--ulang` yang pasangannya belum pernah tercatat ditolak. Jalur itu ada
karena beberapa event memang berulang pada satu issue: owner bisa memutuskan dua kali, dan sebuah
issue bisa naik dua kali. Sebelum ada `--ulang`, entri kedua terpaksa dilabeli `catatan`, sehingga
pertanyaan "keputusan owner apa saja untuk issue ini" tidak bisa dijawab dari medan `event` (#165).

Jangkar `commit` di ledger menunjuk SHA, dan SHA berubah begitu judul commit ditulis ulang. Untuk
itu ada `ledger.py reanchor --peta <berkas>`: ia memindahkan jangkar di dalam kunci berkas yang
sama dengan `append`, menolak kunci peta yang tidak dipakai satu entri pun, menolak nilai yang
bukan commit, lalu memvalidasi seluruh isi berkas sebelum menulis. Dengan jalur itu, berkas ledger
tidak pernah perlu disentuh editor.

Gate cakupan lane butuh tahu lane mana yang bekerja, dan lane itu baru terbaca dari label PR
`lane:<id>`. Tanpa label, `gate_commit_paths.py --hanya-eskalasi` tetap memeriksa daftar eskalasi
dan mengatakan terus terang bahwa cakupan tidak diperiksa. Diam-diam melewati pemeriksaan lebih
buruk daripada tidak punya pemeriksaan.

Sejak 2026-10-11, cabang tanpa label di CI memakai `gate_commit_paths.py --tanpa-label`, bukan
`--hanya-eskalasi`. Bedanya satu: `--tanpa-label` **menolak** berkas jejak
(`factory/usulan*.jsonl`, `factory/ledger.jsonl`). Berkas itu ditulis lane mana pun lewat
`usulan.py`/`ledger.py` tapi dimiliki lane `HQ` lewat glob `factory/**`, jadi pemiliknya bisa
dipastikan tanpa label: PR yang menyentuhnya wajib memasang `lane:HQ`. Alasan angkanya terukur,
73 dari 100 PR merged terakhir menyentuh berkas jejak, dan dua di antaranya (#246, #223) lolos
dengan cakupan tidak diperiksa karena cuma berlabel `eskalasi`. `--hanya-eskalasi` tetap ada
untuk pemakaian lokal dan uji mandiri.

Sejak 2026-10-11 `factory-gate.yml` juga mendengar event `labeled`, jadi memasang label sesudah PR
terbuka menjalankan ulang pemeriksa cakupan. Sebelum itu run lama tetap hijau dengan cakupan tidak
diperiksa: PR #225 lahir tanpa label lane dan `Gate pada pohon ini` tetap `pass`, jadi cakupan
barunya cuma bisa dicek manual.

Tiga hal yang tidak boleh dilakukan pada trigger ini, dan ketiganya sudah kejadian di repo ini:

1. **Job tidak boleh menyaring `github.event.action`.** Gate membaca DUA label, `lane:` dan
   `eskalasi`. Filter yang cuma menyebut satu label melewati yang lain, dan bentuk gagalnya
   berbahaya: run untuk label itu tetap lahir, lalu di-SKIP, dan run itulah yang tersisa. Terukur
   2026-10-11 di PR #227: satu push plus dua label melahirkan tiga run bersamaan, dua `cancelled`,
   satu `skipped`, dan gate yang seharusnya memeriksa justru tidak jalan sementara check-nya
   terbaca hijau. Label dibaca **live** dari PR di dalam run (`gh pr view --json labels`), jadi
   tidak ada yang perlu disaring di level event.
2. **Grup `concurrency` wajib memuat `github.event.action`.** Tanpa itu event `opened` dan
   `labeled` untuk PR yang sama berbagi satu grup dan saling membatalkan. Dengan action di grup,
   push (`synchronize`) tetap saling membatalkan seperti sebelumnya, karena action-nya sama.
3. **Blok `pull_request` tidak boleh punya penyaring path.** `paths:` atau `paths-ignore:` membuat
   GitHub melewati SELURUH workflow untuk PR yang tidak menyentuh path itu, termasuk pemeriksa
   cakupan lane. Gate ini memeriksa tiap PR, jadi penyaring path di berkasnya DITOLAK, bukan
   diatur isinya. Kalau suatu saat pemeriksaan memang perlu dipersempit, persempit di dalam job
   (langkah yang membaca `git diff`), jangan di trigger: di trigger, yang tidak diperiksa tidak
   meninggalkan jejak apa pun.

Penjaganya `gate_pemicu_ci.py`, dan ketiga aturan itu punya kasus negatifnya sendiri.

**Cakupan lane dihitung sejak titik pisah branch, bukan sejak tip base.** `git diff base head` itu
perbandingan dua pohon: kalau `origin/main` sudah maju sesudah branch dibuat, kerja lane lain yang
sudah masuk main ikut terhitung sebagai kerja branch ini. Nyata pada 2026-10-09: 8 berkas milik
lane lain (`packages/plugins/**`, `.gitlab-ci.yml`) dilaporkan sebagai pelanggaran cakupan `HQ`. Gate
itu sekarang memakai `git merge-base base head` sebagai pangkalnya. Di CI hasilnya tidak berubah,
karena di sana head adalah commit merge GitHub dan titik pisahnya memang tip base; yang berubah
hanya run lokal di atas branch yang belum di-merge, dan justru di situ gate-nya dulu berbohong.
`.gitignore` masuk cakupan `HQ`: berkas itu menentukan berkas mana yang pernah dilihat git, jadi
ia bagian dari aturan main repo, bukan bagian dari modul mana pun.

### 8.3 Skill lane dan plugin upstream

Hukum di berkas ini mengatur **cara** lane bekerja. Isi yang dikerjakan lane tinggal di
`factory/skills/<nama>/SKILL.md`, satu direktori per skill, dan itu lapisan yang berbeda: hukum itu
aturan, skill itu prosedur. Yang satu tidak menggantikan yang lain.

Skill-skill itu hasil adopsi dari `anthropics/knowledge-work-plugins` (Apache-2.0), bukan tulisan
asli. Karena itu ada tiga hal yang diikat mesin, dan ketiganya pernah gagal di pohon ini:

1. **Sumber dan SHA-nya dicatat.** `factory/upstream/PIN.md` memuat SHA upstream yang dipin, dan
   tiap berkas skill menyebut path sumbernya beserta SHA itu. `gate_plugin_lint.py` menolak skill
   yang headernya hilang atau SHA-nya tidak sama dengan yang dipin. Apache-2.0 mewajibkan
   pernyataan perubahan, dan SHA yang tercatat adalah bentuknya.
2. **Isi upstream tidak disalin mentah.** Skill yang ditulis untuk pasar Amerika Serikat ditulis
   ulang ke konteks lapangan dan modul GeoApps, bukan diterjemahkan kata per kata. Sisa konvensi
   Cowork (`CONNECTORS.md`, `$ARGUMENTS`, `~~tool`, `allowed-tools`) ditolak gate, karena
   menunjuk berkas dan placeholder yang tidak ada di sini.
3. **Salinan yang dibaca agent tidak boleh melenceng dari sumbernya.** `sync_plugins.py` menurunkan
   `factory/skills/` ke `~/.opencrabs/skills/geoapps-<nama>/`, dan `--check` menolaknya kalau
   berbeda. Salinan `geoapps-*` yang tidak punya sumber di repo juga ditolak: sisa skill yang sudah
   dihapus tetap terdaftar dan tetap dimuat agent, dan itu aturan yang berlaku dari sumber yang
   sudah tidak ada.

Satu direktori sengaja tidak dikelola `sync_plugins.py`: `geoapps-factory`. Itu hasil
`sync_skill.py` dari berkas ini, dan dua penulis untuk satu direktori adalah cara salinan itu
melenceng.

**Pola `.gitignore` adalah jalur kegagalan yang senyap, dan sudah terbukti.** Template Visual Studio
membawa pola `[Dd]ebug/`, dan pola itu menelan `factory/skills/debug/SKILL.md`: berkasnya ada di
disk, git tidak pernah melihatnya, dan tidak ada satu pun error. 18 berkas ada di disk sementara 17
yang ke-commit. Dua penangkalnya sekarang ada dan keduanya wajib: negasi `!factory/**` di
`.gitignore`, dan pemeriksaan `git ls-files` di `gate_plugin_lint.py` yang menolak berkas skill yang
tidak ter-track. Pemeriksa lain tidak akan pernah melihat berkas yang tidak ada di git.

### 8.4 Pacemaker, kadens, dan skor

Sesi lane yang menunggu tidak bangun sendiri. `tools/factory/pacemaker.py` menjalankan gate tanpa
LLM: ia membaca sinyal lewat `gh` dan dari berkas jejak usulan (`factory/usulan*.jsonl`), lalu memanggil
`opencrabs session notify` hanya kalau sinyalnya berbeda dari run terakhir. Tanpa sinyal,
satu token pun tidak dibayar. Sebelum notify, lane-nya diperiksa `cek_lane.py`: lane yang belum
punya sesi terikat membuat pacemaker diam, bukan menebak tujuan.

Empat sinyalnya:

| # | Sinyal | Sumber | Dikirim ke |
|---|---|---|---|
| 1 | PR dengan check merah | `gh pr list --state open` | HQ saja |
| 2 | Issue terbuka **tanpa** label `lane:` | `gh issue list --state open` | HQ saja |
| 3 | Issue terbuka berlabel `lane:` yang **nol PR terbuka** menyatakannya | `gh issue list` + `gh pr list` | lane pemilik label; HQ menerima **seluruh** lane |
| 4 | Opsi pekerjaan yang menunggu keputusan | `factory/usulan*.jsonl` | HQ saja |

Sinyal 1, 2, dan 4 cuma pergi ke HQ karena cakupannya tidak bisa dibaca dari sinyalnya sendiri: PR
merah tidak menyebut lane-nya, issue belum berlabel justru kerja HQ (label dan ruling), dan opsi
menunggu keputusan adalah keputusan agent. Mengirim ketiganya ke lane modul cuma membangunkan lane
untuk kerjaan yang bukan miliknya. Sinyal 3 punya pemilik yang terbaca, jadi dialah yang membangunkan
lane itu. HQ tetap menerima sinyal 3 **seluruh** lane, dan itu disengaja: kalau cuma lane itu sendiri
yang melihat kerjanya, lane yang sesinya mati jadi lubang yang tidak kelihatan dari mana pun.

**Satu pemanggilan, tiap lane (#187).** `--lane` bawaan sekarang `semua`: satu pemanggilan
`pacemaker.py` menjalankan gate untuk HQ **dan** tiap lane di `factory/lanes.json`, jadi satu baris
crontab cukup dan lane yang baru muncul di `lanes.json` ikut terlayani tanpa ada yang menyunting
crontab. Tiap lane punya berkas state dedup sendiri (`geoapps-pacemaker-<lane>.json`; HQ tetap
memakai `geoapps-pacemaker.json` supaya state lama tidak hilang). Berkas state bersama tidak bisa
dipakai untuk fan-out: lane A menulis digest A, lane B melihatnya berbeda dari digest B lalu bangun
dan menulis digest B, dan tick berikutnya lane A bangun lagi, sehingga tiap lane dibangunkan tiap
tick. `--lane <id>` masih ada untuk memeriksa satu lane saja.

Sinyal 3 ada karena tanpa dia board yang bersih dan berlabel justru menghasilkan senyap: makin
tertib papannya, makin sepi lane-nya (#142). Kejadian nyata 2026-10-10: lane HQ diam sekitar 5 jam
dengan 6 issue berlabel kebuka (#120, #121, #124, #125, #84, #105), nol sinyal, dan yang
membangunkan akhirnya agent secara manual.

Rujukan yang dihitung cuma yang **menyatakan diri**, lewat `gate_pr_link.nomor_deklarasi`: klaim
penutup berbahasa Inggris (`Closes`/`Fixes`/`Resolves #N`) dan rujukan non-penutup (`Refs #N`), di
judul, badan, dan nama branch PR. Sebelumnya pola `#N` dihitung apa adanya, dan itu salah arah:
PR yang sekadar MENYEBUT `#55` (mis. PR jejak yang menyebutnya untuk konteks) sudah cukup memadamkan
sinyal issue #55 tanpa mengerjakannya (u-HQ-719710 opsi 1). Klaim penutup berbahasa Indonesia
("Menutup #N") juga **tidak** dihitung, dan itu disengaja: `gate_pr_link.py` menolaknya justru
karena GitHub tidak memprosesnya, jadi issue-nya tetap terbuka setelah PR-nya di-merge dan sinyalnya
harus tetap menyala. Nalar itu hidup di satu tempat saja; pacemaker mengimpornya, tidak menyalinnya.

Empat hal yang menjaganya dari kebisingan: PR yang sudah **ditutup** tidak pernah masuk (`gh pr list`
dipanggil dengan `--state open`), issue berlabel `eskalasi` tidak ikut dilaporkan, issue berlabel
`ai-blocked` juga tidak, dan issue berlabel `induk` juga tidak, walau keempatnya sama-sama bisa
berlabel `lane:`.

`eskalasi` dihitung sebagai label terminal, sama seperti `lane:` (#97). Issue yang menyentuh path
eskalasi menunggu keputusan owner, jadi tidak ada lane yang bisa ditugaskan sebelum owner
memutuskan; menghitungnya "belum berlabel lane" membuat pacemaker membangunkan lane selamanya untuk
sinyal yang tidak bisa dikerjakan siapa pun. `ai-blocked` sama kelasnya (#142, keputusan agent
u-HQ-8fd82e): usulannya sudah diputuskan atau sudah dilaporkan ke owner, jadi langkah berikutnya
bukan kerja lane. Label itu sudah ada di repo dan nol dipakai sebelum ini; lane memasangnya saat
usulan terkait sudah diputuskan atau dilaporkan, dan pacemaker melewati issue berlabel itu di
**kedua** sinyal (yang belum berlabel lane dan yang nol PR terbuka).

`induk` juga terminal, kelas yang sama (keputusan agent u-HQ-52b3f1 opsi 1). Issue induk/epic
memecah kerjanya ke turunan (#255-258 dari #253), jadi ia memang tidak punya PR sendiri, dan
sinyal "nol PR terbuka" di sini adalah false positive: turunannya sudah menyalakan sinyal yang
sama. Melaporkan induknya cuma membangunkan lane untuk kerjaan yang bukan miliknya. Menyetel
`ai-blocked` untuk keperluan ini salah kelas: label itu berarti usulannya sudah diputuskan,
sedangkan pada issue induk langkah berikutnya memang kerja lane, hanya saja di turunannya.

Tiap notify membawa `ATURAN_KEPUTUSAN` (alasannya di 8.5): lane diingatkan mencatat opsi lewat
`usulan.py`, bukan menanyakannya ke owner.

Jadwalnya di crontab pengguna, bukan di cron OpenCrabs. Alasannya terukur: satu tick cron OpenCrabs
membayar ulang system prompt dan brain file (tercatat 60.403 token input, $0.181854), jadi pacemaker
yang bangun tiap 20 menit untuk melaporkan "tidak ada apa-apa" itu mahal. Lima barisnya, dan
kelimanya memakai resolusi eksplisit yang sama:

```
*/20 * * * * S=/home/agentadmin/GeoApps/tools/factory/pacemaker.py; [ -f "$S" ] || S=/home/agentadmin/GeoApps-factory/tools/factory/pacemaker.py; [ -f "$S" ] || S=; SY=/home/agentadmin/GeoApps/tools/factory/sinkron_pohon.py; [ -f "$SY" ] && /usr/bin/python3 "$SY" --cron >> /home/agentadmin/.opencrabs/logs/geoapps-sinkron.log 2>&1; if [ -n "$S" ]; then /usr/bin/python3 "$S" >> /home/agentadmin/.opencrabs/logs/geoapps-pacemaker.log 2>&1; else echo "$(date -Is) pacemaker tidak ditemukan di ~/GeoApps maupun ~/GeoApps-factory" >> /home/agentadmin/.opencrabs/logs/geoapps-pacemaker.log; fi
0 8 1 * * S=/home/agentadmin/GeoApps/tools/factory/skor.py; [ -f "$S" ] || S=/home/agentadmin/GeoApps-factory/tools/factory/skor.py; [ -f "$S" ] || S=; SY=/home/agentadmin/GeoApps/tools/factory/sinkron_pohon.py; [ -f "$SY" ] && /usr/bin/python3 "$SY" --cron >> /home/agentadmin/.opencrabs/logs/geoapps-sinkron.log 2>&1; if [ -n "$S" ]; then /usr/bin/python3 "$S" --rinci >> /home/agentadmin/.opencrabs/logs/geoapps-skor.log 2>&1; else echo "$(date -Is) skor tidak ditemukan di ~/GeoApps maupun ~/GeoApps-factory" >> /home/agentadmin/.opencrabs/logs/geoapps-skor.log; fi
*/30 * * * * S=/home/agentadmin/GeoApps/tools/factory/lapor.py; [ -f "$S" ] || S=/home/agentadmin/GeoApps-synclane/tools/factory/lapor.py; [ -f "$S" ] || S=; SY=/home/agentadmin/GeoApps/tools/factory/sinkron_pohon.py; [ -f "$SY" ] && /usr/bin/python3 "$SY" --cron >> /home/agentadmin/.opencrabs/logs/geoapps-sinkron.log 2>&1; if [ -n "$S" ]; then /usr/bin/python3 "$S" >> /home/agentadmin/.opencrabs/logs/geoapps-lapor.log 2>&1; else echo "$(date -Is) lapor tidak ditemukan" >> /home/agentadmin/.opencrabs/logs/geoapps-lapor.log; fi
*/15 * * * * S=/home/agentadmin/GeoApps/tools/factory/pintu.py; [ -f "$S" ] || S=/home/agentadmin/GeoApps-synclane/tools/factory/pintu.py; [ -f "$S" ] || S=; SY=/home/agentadmin/GeoApps/tools/factory/sinkron_pohon.py; [ -f "$SY" ] && /usr/bin/python3 "$SY" --cron >> /home/agentadmin/.opencrabs/logs/geoapps-sinkron.log 2>&1; if [ -n "$S" ]; then /usr/bin/python3 "$S" --sejak 20 --lapor --oc-bin /usr/local/bin/opencrabs >> /home/agentadmin/.opencrabs/logs/geoapps-pintu.log 2>&1; else echo "$(date -Is) pintu tidak ditemukan" >> /home/agentadmin/.opencrabs/logs/geoapps-pintu.log; fi
0 * * * * S=/home/agentadmin/GeoApps/tools/factory/jaga_lane.py; [ -f "$S" ] || S=/home/agentadmin/GeoApps-synclane/tools/factory/jaga_lane.py; [ -f "$S" ] || S=; SY=/home/agentadmin/GeoApps/tools/factory/sinkron_pohon.py; [ -f "$SY" ] && /usr/bin/python3 "$SY" --cron >> /home/agentadmin/.opencrabs/logs/geoapps-sinkron.log 2>&1; if [ -n "$S" ]; then /usr/bin/python3 "$S" --oc-bin /usr/local/bin/opencrabs >> /home/agentadmin/.opencrabs/logs/geoapps-jaga-lane.log 2>&1; else echo "$(date -Is) jaga_lane tidak ditemukan" >> /home/agentadmin/.opencrabs/logs/geoapps-jaga-lane.log; fi
```

**Kenapa resolusi eksplisit, bukan `ls A B | head -1` (#125).** Bentuk lamanya memilih berkasnya
dengan `S=$(ls <A> <B> 2>/dev/null | head -1)`, dan `ls` MENGURUTKAN operandnya: pada posisi setelah
awalan yang sama, `-` (0x2D) lebih kecil dari `/` (0x2F), jadi `~/GeoApps-factory/...` selalu terurut
lebih dulu dari `~/GeoApps/...`, dan `head -1` tidak pernah memilih pohon utama. Terukur
2026-10-10:

```
$ ls ~/GeoApps/tools/factory/pacemaker.py ~/GeoApps-factory/tools/factory/pacemaker.py
/home/agentadmin/GeoApps-factory/tools/factory/pacemaker.py
/home/agentadmin/GeoApps/tools/factory/pacemaker.py
```

Dampaknya laten, bukan kerusakan aktif: keempat skripnya byte-identik di ketiga pohon saat
diperiksa, jadi belum ada perilaku yang menyimpang. Yang rusak arah resolusinya: begitu `main`
mengubah salah satu skrip, cron tetap menjalankan salinan pohon basi tanpa error, dan begitu
worktree cadangan itu dihapus, baris cron-nya mati.

Bentuk yang dipakai sekarang menaruh pohon utama lebih dulu lalu menurunkannya lewat `[ -f ]`
berurutan. Jadi pohon utama selalu menang, cabang `else` (berkas tidak ditemukan sama sekali) tetap
hidup dan berisik alih-alih diam, dan tidak ada `ls` yang mengurutkan operand. Path-nya absolut,
bukan `~/...`, karena cron tidak meluaskan `~`. Berkas crontab-nya disunting di host, dengan cadangan
di `~/.opencrabs/projects/geoapps-audit/crontab.<stamp>.bak`.

`trigger_cmd` bukan jalurnya di sini: di build v0.5.5 ia hanya dievaluasi pada job yang berprofil
berbeda dari profil yang sedang jalan, dan semua job di box ini berprofil `default`.

**Penjaga branch (#160).** Kelima skrip di crontab itu menolak jalan kalau pohon tempat kodenya
hidup bukan `main`, atau `main`-nya ketinggalan `origin/main`. Alasannya terukur 2026-10-10:
`~/GeoApps` adalah jalur **pertama** yang dipilih crontab, dan pohon itu terparkir di branch
kerjaan yang sudah selesai, 7 commit di belakang `main` dan 0 di depan. Jadi pacemaker yang bangun
tiap 20 menit menjalankan kode basi dan perbaikan yang baru di-merge tidak pernah dieksekusi, tanpa
satu gate pun menolak, karena tiap gate hanya membaca pohon tempat ia dijalankan.

Dua kelasnya dipisah, dan pemisahan itu yang penting: memeriksa "HEAD bukan ancestor `origin/main`"
saja **salah** untuk kelas ini, sebab pohon yang terparkir di belakang punya HEAD yang ADALAH
ancestor `origin/main`. Yang benar: branch harus `main`, **dan** `main` tidak boleh ketinggalan.
Penolakannya mencetak nama branch dan jumlah commit yang ketinggalan ke log cron, jadi berhentinya
terbaca, bukan senyap. Jalan lewatnya sengaja lewat env `FACTORY_PAKSA_BRANCH`, bukan `--paksa`,
karena `--paksa` di skrip-skrip ini sudah berarti "abaikan state dedup" dan arti kedua tidak
ditumpangkan ke sana. Batas yang disengaja: yang dibandingkan adalah `origin/main` yang ada di disk,
yaitu hasil fetch terakhir; penjaganya tidak menjalankan `git fetch`, karena cron tiap 20 menit tidak
perlu jaringan. Kelas pertama (branch salah) tidak terpengaruh oleh batas itu, dan kelas pertama
itulah yang benar-benar kejadian. Batas yang disengaja: penjaganya sendiri tidak menjalankan `git fetch`,
karena tujuannya memutuskan, bukan menyinkronkan; yang memakai jaringan adalah langkah sinkronisasi
di bawah ini, dan ia berjalan SEBELUM penjaganya.

**Langkah sinkronisasi (#169, u-HQ-8491e4 opsi 2).** Penjaga di atas sempat menukar "diam-diam basi"
dengan "berisik berhenti", dan itu memang tujuannya, tapi jadi ketergantungan baru: tiap kali ada PR
merge ke `main`, keempat skrip cron berhenti (exit 1) sampai ada yang menyinkronkan `~/GeoApps`
dengan tangan. Karena itu tiap baris crontab menjalankan
`tools/factory/sinkron_pohon.py --cron` SEBELUM skripnya. Langkah itu tidak menggantikan penjaga:
ia menyinkronkan, penjaganya yang tetap memutuskan jalan atau berhenti.

Sinkronisasinya **satu berkas di dalam repo**, `tools/factory/sinkron_pohon.py`, dan crontab
memanggilnya langsung dengan `--cron`. Tidak ada pembungkus di luar repo, dan itu disengaja: berkas di
luar repo itu nol berkas ter-track, sementara repo ini berulang kali kena kelas bug yang sama (salinan
yang dibaca melenceng dari sumbernya), dan berkas di luar repo tidak bisa diuji CI. Tiga hal yang dulu
jadi alasan mempertahankan pembungkus dikerjakan alatnya sendiri: `HOME` dipin lewat `pwd.getpwuid`
(bukan path host yang di-hardcode) karena `git fetch` butuh kredensial dan tanpa itu gagal "could not
read Username"; `git fetch` dan `merge` dibatasi `BATAS_GIT` detik supaya fetch yang menggantung tidak
menahan baris crontab itu selamanya; dan `--cap-waktu` (dipakai `--cron`) memberi cap waktu ISO di
tiap baris log, jadi replay bisa dibedakan dari laporan baru. Mode `--cron` selalu keluar 0: kegagalan
sinkronisasi bukan alasan mematikan sisa baris crontab itu, dan yang memutuskan "jalan atau berhenti"
tetap penjaga di atas.

Ditambah satu hal yang pembungkus shell tidak punya: **kunci satu-instance**. Empat baris crontab
memanggil alat ini, dan `*/15`, `*/20`, `*/30` bertemu di menit :00, jadi tanpa kunci dua `git merge`
berebut `index.lock` dan yang kalah menulis kegagalan yang menyesatkan di log. Yang kedua keluar 0
dengan "LEWAT", bukan gagal. Berkas kuncinya ditaruh di dalam direktori git lewat `rev-parse
--absolute-git-dir` (bukan `<akar>/.git`, karena di worktree `.git` itu berkas penunjuk), jadi tidak
pernah ikut terlacak.

`git fetch && git merge --ff-only` saja tidak cukup, dan sebabnya terukur: git menolak merge kalau ada
berkas terlacak yang kotor dan merge itu akan memperbaruinya, walaupun isi lokalnya identik dengan
versi yang datang. Keputusannya karena itu dibuat eksplisit, dan kode keluarnya dibedakan supaya log
cron bisa dibaca tanpa menebak: 0 sukses, 2 fetch/status gagal, 3 berkas tak terlacak akan tertabrak,
4 berkas kotor isinya BEDA (berhenti, jangan hapus kerja yang belum di-commit), 5 `merge --ff-only`
gagal. Berkas kotor yang isinya SAMA dengan `origin/main` dibuang, dan itu aman justru karena isinya
sama: tidak ada satu byte pun yang hanya ada di lokal. Berkas jejak append-only
(`factory/usulan.jsonl` dan `factory/usulan-<lane>.jsonl`) diperlakukan tersendiri: baris lokal yang
belum ada di `origin/main` disimpan, lalu ditulis ulang di atas versi origin, karena berkas itu
memang ditulis alat lain di pohon yang sama. Penulisan ulangnya terjadi di **setiap** jalur keluar
sesudah berkasnya disetel ulang, bukan cuma jalur sukses (#303): jalur gagal (kode 4 dan 5) dulu
membuang barisnya, dan itu terukur 2026-10-12 saat pohon kanonik terparkir di branch kerja,
`merge --ff-only` gagal, dan baris keputusan `u-uji-644962` hilang dari pohon.

Akar kotornya ikut ditutup: penanda `dilaporkan` tidak lagi mendarat di berkas yang dilacak git.
Berkas jejak usulan sekarang hanya memuat peristiwa yang perlu dibaca manusia dan di-commit lewat
PR (`usulan`, `diputuskan`), sementara penanda operasional "digest ini sudah dikirim" pindah ke
`factory/state/dilaporkan.jsonl` yang di-ignore. Status sebuah usulan tetap dibaca sebagai gabungan
keduanya, tapi yang menentukan adalah `ts` TERBESAR untuk id itu, bukan urutan penggabungan (#231).
Aturan lama "letakkan penanda di belakang supaya ia menang" benar untuk entri `usulan`, dan keliru
untuk `diputuskan`: dilaporkan-lalu-diputuskan itu urutan yang NORMAL, jadi penanda yang selalu
menang membuat keputusan yang lebih baru kalah dan statusnya macet `dilaporkan` selamanya. Terukur
2026-10-11: 9 dari 45 id salah baca, dan `daftar --status dilaporkan` menyodorkan 11 opsi sebagai
"menunggu keputusan" padahal 9 di antaranya sudah diputuskan. Pada `ts` yang seri, `diputuskan`
menang atas `dilaporkan` (resolusi detik bisa bertabrakan); peristiwa tanpa `ts` dianggap paling tua,
jadi penanda cacat tidak bisa membungkam keputusan yang bertanggal.

Keduanya diuji di alatnya masing-masing, bukan di skrip pemanggil: `sinkron_pohon.py --uji-mandiri`
menjalankan repo git sungguhan (bukan tiruan) untuk tiap kelas keputusan, termasuk yang harus
BERHENTI, dan `usulan.py --uji-mandiri` menguji pemisahan berkas statusnya.

**Kadens skor.** `factory/SKOR.md` memuat rubrik quality-criteria v0.5 milik agent-factories, tier
Day-1 Mandatory (8 kriteria, maksimum 32), dan `tools/factory/skor.py` menghitungnya dari keadaan
repo dengan bukti per syarat. Kadensnya bulanan, dijalankan crontab yang sama, dan hasilnya masuk
`~/.opencrabs/logs/geoapps-skor.log`. Snapshot bertanggal di-commit ke `factory/skor/YYYY-MM.md`
oleh `HQ` tiap kali angkanya bergerak; yang pertama `2026-10.md`. Yang masih `[prosa]`: belum ada
gate yang menolak kalau satu bulan terlewat tanpa snapshot.

Angka skor itu **bukan** target. Rubriknya dipakai supaya celah kelihatan, jadi skor yang rendah di
satu kriteria adalah temuan yang harus jadi issue, bukan angka yang dibulatkan ke atas.

### 8.5 Laporan opsi kerja ke agent

Pacemaker membangunkan lane, arah agent ke lane. Jalur sebaliknya juga wajib ada: ketika sebuah
lane punya **opsi pekerjaan** yang butuh keputusan, opsi itu harus sampai ke **agent**, bukan
langsung ke owner.

Lane **tidak** menanyakan keputusan itu ke owner sendiri, baik lewat tombol pilihan maupun pesan
langsung. Satu-satunya jalurnya adalah mencatat opsi lewat `usulan.py`, dan agent yang mengantarkan
ke owner kalau keputusannya memang milik owner. Alasannya bukan kesopanan: lane yang bertanya
langsung membuat owner menerima pertanyaan dari tujuh arah sekaligus dan kehilangan satu tempat
untuk melihat semua keputusan, sementara opsi yang sebenarnya bisa diputuskan agent ikut menumpuk
di meja owner.

- `tools/factory/usulan.py` mencatat opsi ke `factory/usulan-<lane>.jsonl`: **satu berkas per lane**
  sejak #217 (keputusan agent `u-HQ-f406ac` opsi 2). Sebelumnya semua lane menulis ke satu berkas
  `factory/usulan.jsonl`, dan karena tiap penulis menambah di ujungnya, dua PR jejak yang jalan
  bersamaan selalu bertabrakan di posisi yang sama: terukur 2026-10-11, PR #215 jadi `CONFLICTING`
  setelah #216 mendarat lebih dulu, dan perbaikannya butuh membangun ulang lima commit. Dengan
  berkas terpisah, dua lane tidak lagi menyentuh berkas yang sama. Tiap berkas append-only, satu
  objek JSON per baris, dan status sebuah usulan adalah baris TERAKHIR dengan id itu. Karena itu
  semua peristiwa satu id tinggal di satu berkas: `putuskan` menulis ke berkas yang memuat entri
  `usulan`-nya, dan `pisah-berkas` memindahkan seluruh peristiwa satu id bersama-sama. Pembaca
  (`daftar`, `pacemaker`, `lapor`, `--periksa`) membaca SEMUA berkas jejak, termasuk
  `usulan.jsonl` lama selama masih ada. Tiap opsi memuat lane, ringkas, 2 sampai 3 pilihan,
  rekomendasi, dan dampak kalau ditunda. Lane memanggil alat ini, **tidak** menulis berkasnya
  dengan tangan.

  Dua aturan soal identitas, keduanya lahir dari kejadian nyata 2026-10-10:

  1. **Id tidak diurutkan dari isi berkas (#121).** Tiap lane bekerja di worktree dengan salinan
     berkasnya sendiri, jadi `flock` tidak mengunci apa pun lintas lane. Bentuk lama `u-<nomor urut>`
     membuat dua lane mendapat id yang sama (`u-0002` sempat punya tiga arti; `u-0021` dipakai gh-ops
     sekaligus android), dan setelah digabung yang satu menimpa yang lain tanpa error. Id sekarang
     berbentuk `u-<lane>-<6 heksadesimal>`, mis. `u-android-a3f1c9`: prefiks lane menutup kasus
     antar-lane, akar acaknya menutup kasus dua salinan dari lane yang sama.
  2. **Id kembar dengan isi berbeda DITOLAK, bukan ditimpa diam-diam (#144).** Poin 1 mencegah
     tabrakan baru, bukan menangkap yang sudah masuk lewat penggabungan. `catat` dan `putuskan`
     menolak berjalan di atas berkas yang punya id kembar, karena `keadaan()` melipat satu record per
     id dan keputusan bisa mendarat di usulan yang bukan dimaksud pemanggilnya. `usulan.py --periksa`
     memeriksanya tanpa menulis dan keluar 1 kalau ada, jadi ia bisa dipasang sebagai langkah gate;
     saat ini belum ada langkah CI yang memanggilnya. Dua entri ber-id sama dengan isi
     SAMA bukan tabrakan: itu salinan identik, dan menggabungkannya tidak menghilangkan apa pun.

  Alat ini juga menolak menulis kalau worktree tujuan bukan worktree pemanggil (#121): akar repo
  diturunkan dari lokasi skrip, jadi lane yang memanggil salinan di pohon bersama akan menulis ke
  sana dalam keadaan tidak ter-commit, dan `git checkout .` menghapusnya tanpa jejak. `--paksa` ada
  untuk kasus yang memang disengaja.
- `tools/factory/lapor.py` menyusun digest opsi berstatus `menunggu` dan mengirimnya ke sesi agent,
  yaitu sesi pada kanal `owner.kanal` di `lanes.json`. Kanal itu adalah topic `agent` (262) di grup
  GeoApps, diputuskan owner 2026-10-10 (#177) supaya laporan agent dan balasan owner bertemu di satu
  ruangan. Digest itu masuk sebagai giliran baru di sesi
  agent, jadi agent yang memutuskan: menyelesaikannya sendiri, atau meminta approval owner lewat
  kanal yang sama kalau keputusannya memang milik owner. Opsi yang sudah dikirim ditandai lewat
  `usulan.py`, jadi tidak terkirim dua kali.
- **Tidak ada jalur cadangan.** Kalau `owner.kanal` tidak diisi, tidak punya sesi hidup, atau
  punya lebih dari satu, `lapor.py` dan `pintu.py` **diam** dan opsinya tetap `menunggu`. Lane `HQ`
  pernah dipakai sebagai cadangan, dan itu keliru: topic lane adalah ruangan yang dibaca owner, jadi
  begitu sesi agent tidak ada, digest mendarat di ruangan yang justru membuat lane kelihatan
  menanyakan keputusan langsung ke owner. Tertunda dan tercatat lebih baik daripada terkirim ke
  ruangan yang salah. Karena tidak ada cadangan lagi, `lapor.py` memakai aturan resolusi sesinya
  sendiri (`lapor.sesi_owner`), bukan `cek_lane.sesi_lane`.
- **Alamat itu diperiksa gate, bukan cuma dipakai.** `gate_kanal.py` menolak `owner.kanal` yang
  kosong, bentuk kuncinya tidak sah, grupnya bukan grup papan ini, menunjuk topic lane, atau tidak
  punya tepat satu sesi hidup. Pemeriksaan sesinya memanggil `lapor.sesi_owner` yang sama dengan
  yang dipakai `lapor.py`, jadi yang diperiksa gate persis yang akan dijalankan pengantarnya. Runner
  CI tidak punya basis data, jadi di sana pemeriksaan sesinya dilewati lewat baris `LEWAT` yang
  menyebut jumlah pemeriksaan yang tidak dijalankan, dan `--wajib-db` ada untuk jalur yang
  menuntutnya (#179).
- Keputusan dicatat dengan `usulan.py putuskan <id> --pilihan <n> --oleh <agent|owner>`, dan
  tersimpan di berkas yang sama. Owner memakainya untuk opsi yang dia putuskan, agent memakainya
  untuk opsi yang dia putuskan sendiri. `--oleh` **wajib dan tidak punya default**: dulu defaultnya
  `owner`, jadi keputusan agent tercatat sebagai keputusan owner tanpa ada yang menolak (kejadian
  2026-10-10, `u-0014`). Atribusi tidak boleh terjadi karena lupa, karena `oleh` adalah satu-satunya
  jejak tentang siapa yang memutuskan.
- **Keputusan yang BERBALIK arah dicatat dengan `--ganti --alasan`, bukan dengan menyunting berkas
  (#164).** Status sebuah usulan adalah baris TERAKHIR dengan id itu, dan berkas jejak penulisnya
  tunggal, jadi arah yang berubah tidak bisa dicatat dengan menyunting berkasnya; tanpa jalur ini
  status yang terbaca gate berikutnya tetap opsi LAMA padahal arahnya sudah berubah. Kejadian
  nyatanya `u-0014`: owner menegaskan ulang dan memilih arah sebaliknya, tapi berkasnya tetap
  terbaca sebagai perintah menambal sumber laporan keuangan perusahaan. Karena itu pembalikan butuh
  niat eksplisit: `--ganti` disertai `--alasan`, dan event-nya memuat `mengganti_pilihan`,
  `mengganti_oleh`, dan `alasan_ganti` supaya riwayatnya terbaca. Dua penolakan lama dipertahankan
  karena keduanya menjaga kekeliruan, bukan pembalikan: tanpa `--ganti`, usulan yang sudah
  diputuskan tetap ditolak, dan `--ganti` pada usulan yang BELUM diputuskan juga ditolak.

**Pemeriksa mesin.** `tools/factory/pintu.py` menolak aturan ini dengan keras, bukan cuma
menuliskannya. Satu-satunya cara sebuah lane "bertanya ke owner" di OpenCrabs adalah memanggil tool
`suggest_options`: tombol pilihan selalu lahir dari situ, dan tiap panggilan tercatat di tabel
`tool_executions` beserta `session_id` dan waktunya. Alat itu mengambil sesi tiap lane lewat
`cek_lane.sesi_lane` - jalur yang sama dengan pacemaker dan lapor - lalu menyimpulkan `melanggar`
dan exit 1 (`--wajib-bersih`) kalau ada panggilan `suggest_options` dari sesi lane di dalam jendela
`--sejak` menit. Basis datanya dibuka read-only, dan alat itu tidak mengirim apa pun kecuali diminta
(`--lapor`).

**Kenapa aturan ini tetap bisa dilanggar, dan apa yang ditambal.** Pintu di atas menangkap sesudah
kejadian. Akarnya beda, dan bukan niat lane: pacemaker membangunkan lane dengan "Pacemaker: ada yang
menunggu keputusan" tanpa menyebut siapa yang memutuskan, jadi lane mengisi kekosongan itu dengan
bertanya ke owner (2026-10-10 05:40 WIB, lane `HQ`, tiga tombol keputusan muncul di topic 23).
Pesan yang mengabarkan adanya keputusan tanpa memberi alamat akan dicarikan alamat sendiri oleh
penerimanya. Karena itu `ATURAN_KEPUTUSAN` ikut di **badan tiap notify** pacemaker, bukan hanya di
berkas hukum ini: lane membaca notify itu sebagai giliran baru, sedangkan berkas hukum bisa saja
belum masuk konteksnya. Uji mandiri pacemaker memeriksa isi notify, bukan cuma keberadaannya, jadi
notify yang kehilangan aturan itu merah di CI.

Terbukti menolak, bukan cuma menerima: pada jendela 60 menit setelah kejadian 2026-10-10 05:02 WIB,
alat ini menemukan panggilan `suggest_options` dari sesi lane `HQ` (topic 23) - persis tombol
pilihan yang mendarat di meja owner. Karena ia butuh basis data runtime, ia bukan gate CI.

Satu hal yang alat ini **tidak** bisa, dan itu disebut apa adanya supaya tidak terbaca lebih kuat
daripada kenyataannya: ia tidak menghentikan lane SEBELUM pesannya terkirim. OpenCrabs mengantar
balasan sebuah sesi ke topic tempat sesi itu terikat, dan tidak ada setelan untuk membelokkannya.
Jadi `pintu.py` adalah backstop - mendeteksi sesudah kejadian lalu melapor ke agent - sementara
pencegahannya tetap ada di instruksi lane dan di jalur `usulan.py`.

Keduanya tanpa LLM: gate-nya Python murni, dan `notify` masuk ke sesi yang sudah ada.

**Kadens terpasang:** baris crontab `*/30 * * * *` menjalankan `lapor.py` tiap 30 menit, tanpa token.
Kalau tidak ada opsi berstatus `menunggu`, alatnya memutuskan `diam` dan tidak mengirim apa pun.
Baris `*/15 * * * *` menjalankan `pintu.py --sejak 20 --lapor`: kalau ada pelanggaran, ia
mengirimnya ke sesi agent lewat jalur `notify` yang sama. Keduanya nol token, dan keduanya tidak
mengirim apa pun saat tidak ada yang perlu dilapor.

### Kuota Actions: runner self-hosted sebagai bawaan

Akun `adi805` punya kuota 2.000 menit Actions per bulan, dan **hanya repo private** yang menghitung
terhadap kuota itu. Repo publik dan fork gratis, sebesar apa pun pemakaiannya.

| Aturan | Alasan |
|---|---|
| Workflow baru memakai `runs-on` self-hosted (`tencent-ubuntu`) sebagai bawaan | menit runner GitHub-hosted ditagih ke kuota akun |
| Jalur cadangan saat runner self-hosted mati: masukan `pakai_hosted` di `workflow_dispatch` | gate yang tidak bisa jalan bukan gate |
| Job di runner self-hosted WAJIB berpenjaga fork (`github.event.pull_request.head.repo.full_name == github.repository`) | runner self-hosted itu mesin persisten, bukan sekali pakai |
| Job Windows tetap `windows-latest` | tidak ada runner Windows self-hosted; biayanya diterima |

Terukur 2026-10-10 dari `/users/adi805/settings/billing/usage?year=2026&month=10`: akun memakai
1.629 menit ditagih di Oktober, dan GeoApps menyumbang 1.162 menit (71%). Dari jumlah itu, 710
menit berasal dari `factory-gate` dan `PR Agent` di `ubuntu-latest` (#196).

### Known issue: check `Review` merah karena kapasitas provider

Check `Review` (job `pr_agent`) bisa merah sementara **kedua gate factory hijau**, dan sebabnya
**bukan kode repo ini**: model PR Agent kehabisan kapasitas di dalam batas harga akun InferHub.
Pesan di log yang menandainya:

```
RateLimitError: every provider within your price limit is busy or rate-limited
ServiceUnavailableError: no available provider (all offers exhausted or in cooldown)
```

Kalau dua gate factory hijau dan log memuat salah satu pesan itu: **abaikan, jangan diagnosa ulang,
merge mengikuti `factory-gate` sesuai 7.3.** Sudah tiga kali satu turn terbuang untuk menemukan hal
yang sama. Kalau `Review` merah dengan sebab LAIN, merah itu tetap diperiksa seperti biasa: pola ini
tidak memaafkan merah yang lain. Pemeriksaannya lewat **pola pesan di log**, bukan lewat warna check,
karena merah yang selalu diabaikan melemahkan merah yang asli.

Rincian gejala dan risiko yang diterima dicatat di issue repo `adi805/GeoApps`, bukan di berkas ini.

---

## 9. Larangan di joyboy

VPS `joyboy` (23.238.114.7, 4 GB RAM) menjalankan produksi. Yang dilarang di sana:

| Dilarang | Alasan |
|---|---|
| `cargo build`, `cargo test` | OOM, zombie proses detached, host ikut jatuh |
| Dua rantai `npm test` bersamaan | RAM habis, `npm test` saling membunuh |
| Rantai berat tanpa `nice`/`ionice` | produksi kena imbas |

Yang boleh, dan sudah terbukti: satu `npm test` atau satu rantai build pada satu waktu, dibungkus
`nice -n 19 ionice -c3`, dijalankan serial, tidak diparalelkan. Runner CI self-hosted `tencent-ubuntu`
tetap jalur utama untuk uji Windows dan uji berat; joyboy jalur cadangan, bukan jalur utama.

Lane `vps-verify` yang menjalankan tes di VPS, bukan lane modul. Lane modul tidak menyentuh VPS.

---

## 10. Identitas proyek dan cara memakai mesin ini di proyek lain

Seluruh nilai yang membedakan satu proyek dari proyek lain hidup di **satu berkas**,
`factory/identitas.json`. Tidak ada skrip di `tools/factory/` yang boleh menulisnya secara
literal, dan `factory/lanes.json` memegang daftar lane, topic, cakupan, dan path eskalasi.

| Medan | Dipakai untuk |
|---|---|
| `proyek`, `slug` | nama di dokumen, awalan nama skill terpasang, nama berkas state dan log |
| `repo.github`, `repo.gitlab` | perintah `gh`, cermin, judul brief |
| `grup`, `grup_nama` | surface chat, kunci sesi `[chat:<grup>:topic:<N>]` |
| `owner.kanal` | alamat laporan agent. `lapor.py` dan `pintu.py` DIAM kalau kanal ini tidak punya tepat satu sesi hidup |
| `pohon` | pohon kanonik. Alat yang menulis berkas hidup menolak jalan dari pohon lain |
| `log_dir`, `state_dir`, `skills_dir` | jalur di luar repo |

Berkas di `factory/skills/` dan berkas ini memakai placeholder `{{slug}}`, `{{proyek}}`,
`{{repo}}`, `{{pohon}}`, `{{skills_dir}}`, dan `{{skill_factory}}`. Nilainya diisi saat
berkas itu dipasang atau dibangkitkan. Placeholder asing **melempar**, bukan dibiarkan jadi
teks di berkas hasil: salah ketik yang lolos akan terbaca agent sebagai instruksi biasa.

### Cara memakai mesin ini di proyek baru

1. Salin repo ini ke repo baru, lalu jalankan dari **pohon kanonik proyek baru itu**.
2. Ganti nilai di `factory/identitas.json`: `proyek`, `slug`, `repo`, `grup`, `owner`, `pohon`.
3. Ganti daftar `lane` di `factory/lanes.json` beserta topic dan globnya.
4. Jalankan `python3 tools/factory/sync_law.py`, lalu `gate_law_fresh.py --sahkan`.
5. Jalankan `python3 tools/factory/sync_plugins.py` untuk memasang skillnya.

Langkah 1 bukan saran. Jalur di luar repo dinamespace slug, jadi menjalankan alat dari repo
mesin sementara `slug`-nya masih sama dengan proyek lain akan menulis ke jalur yang SAMA dan
menimpa berkas milik proyek itu. `u.penjaga_pohon()` menolaknya, dan `--paksa` membukanya
kalau memang disengaja.

## 11. Di mana aturan tinggal

| Jenis aturan | Tempatnya |
|---|---|
| Cara menambah modul, perintah, pemeriksa | `factory/docs/CONTRIBUTING.md` |
| Arsitektur aplikasi | `docs/architecture.md` |
| Keputusan produk dan teknis yang disetujui | issue dan PR di `adi805/GeoApps` |
| Cara factory ini berjalan | berkas ini |
| Aturan lintas proyek milik agent | brain file agent, **bukan** berkas ini |

Aturan proyek **tidak** ditulis ke brain file yang selalu dimuat. Brain file cuma menyimpan satu
baris penunjuk ke berkas ini. Alasannya: brain file dimuat setiap sesi, termasuk sesi yang tidak
berhubungan dengan {{proyek}}, dan aturan proyek yang menumpuk di sana terbaca sebagai aturan global.
