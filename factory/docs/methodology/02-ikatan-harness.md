# 02: Ikatan Harness

**Punya:** bagaimana agen dipanggil, konteks apa yang diterimanya, dan apa yang menahan keluarannya.
**Rubrik:** *harness binding*, bagian kedua yang diminta anggota keempat D1.
**Sumber aturannya:** `factory/LAW.md` bagian 2 sampai 7 dan bagian 9. Berkas ini menjelaskan
**mengapa** ikatannya berbentuk begitu; yang mengikat tetap berkas hukumnya.

## Apa itu harness di sini

Harness adalah seluruh bagian yang mengelilingi model dan menentukan apa yang boleh ia lakukan:
cara ia dipanggil, konteks yang masuk ke dalamnya, dan pemeriksa yang menahan keluarannya. Modelnya
sendiri cuma satu komponen di dalamnya, dan bukan komponen yang memutuskan.

Tiga hal di bawah adalah ikatannya. Ketiganya sengaja berbentuk berkas di repo, bukan pengaturan di
kepala operator, karena pengaturan di kepala hilang begitu orangnya berganti.

## 1. Cara agen dipanggil

| Ikatan | Bentuknya | Kenapa begitu |
|---|---|---|
| Satu lane = satu sesi terikat satu topic | 9 lane, satu topic per lane (id ditetapkan Telegram, jadi tidak berurutan) | Lane tidak saling menulis berkas yang sama, dan topic memisahkan percakapannya |
| Brief dikirim **ke sesi lane**, bukan diposting di grup | pesan langsung ke sesi | Grup untuk owner mengawasi dan mengarsipkan. Brief yang diposting di grup mengerjakan nol pekerjaan untuk worker-nya, dan lebih buruk lagi terlihat seperti sudah dikerjakan |
| Sesi lane lahir dari pesan **masuk** di topic-nya | pesan bot dibuang di handler | Konsekuensinya keras: topic yang belum pernah menerima pesan belum punya sesi, dan brief ke sana mengerjakan nol. Karena itu ada `cek_lane.py` yang memeriksanya, bukan `cek_lane.py` yang menebaknya |
| Pemicu bangun sesi tanpa model | `pacemaker.py`, sinyal lewat `gh` | Sesi yang menunggu tidak bangun sendiri. Tanpa sinyal, satu token pun tidak dibayar |
| Jadwalnya di crontab pengguna, bukan cron OpenCrabs | satu baris `*/20 * * * *` | Satu tick cron OpenCrabs membayar ulang system prompt dan brain file; pacemaker yang bangun tiap 20 menit untuk melaporkan "tidak ada apa-apa" itu mahal |

## 2. Konteks yang diterima agen

| Yang masuk | Isinya | Kenapa dibatasi begitu |
|---|---|---|
| Brief | 5 isi minimum: nomor issue, cakupan, kriteria selesai yang bisa dijalankan, worktree dan branch, batas | Brief tanpa kriteria selesai bukan brief, itu harapan |
| Brain file agent | **satu baris penunjuk** ke `factory/LAW.md`, bukan salinannya | Brain file dimuat setiap sesi, termasuk sesi yang tidak berhubungan dengan proyek ini. Aturan proyek yang menumpuk di sana terbaca sebagai aturan global |
| Berkas repo | `docs/CONTRIBUTING.md` untuk perintah dan pemeriksa, `docs/ARCHITECTURE.md` dan `docs/CODE-MAP.md` untuk peta kode | Sumber kebenaran perintah tetap satu tempat, bukan disalin ke banyak |
| State lintas sesi | issue di papan tugas, `factory/ledger.jsonl`, `factory/receipts/<issue>.json` | Sesi berganti dan konteksnya hilang. Yang bertahan cuma yang berbentuk berkas, bukan yang berbentuk percakapan |

Baris terakhir itu yang paling sering dilupakan orang. Nomor issue ditulis di judul commit dan di
laporan penutupan bukan supaya rapi, tapi karena sesi berikutnya tidak punya cara lain menemukan
apa yang sudah dikerjakan.

## 3. Yang menahan keluaran agen

| Penahan | Menolak kalau |
|---|---|
| `audit_consistency.py` | satu sisi berubah, sisi lain tidak: op, handler, tabel, id |
| `verifikasi_dokumen.py` | angka di dokumen tidak cocok kode, atau berkas yang disebut tidak ada |
| `cek_versi.py` | nomor versi berbeda antar berkas |
| `sync_skill.py --check` | salinan `SKILL.md` yang dibaca agen berbeda dari `LAW.md` |
| `gate_law_fresh.py` | isi `LAW.md` berubah tanpa nomor versi naik, atau baseline belum disahkan ulang |
| `gate_commit_paths.py` | lane menyentuh berkas di luar cakupannya, atau menyentuh path eskalasi tanpa izin |
| `gate_pr_link.py` | judul atau badan PR tidak menyebut nomor issue |
| `gate_receipt.py` | commit tidak ada, ada perintah yang keluar bukan 0, worktree kotor, atau komentar issue tidak ada |
| `gate_ledger.py` | penulis bukan `HQ`, waktu mundur, entri dobel, atau commit tidak ada |
| `gate_ontology.py` | sinonim terlarang dari `ONTOLOGY.md` muncul di prosa |
| `gate_plugin_lint.py` | skill tanpa frontmatter, masih memuat konvensi plugin upstream, SHA sumbernya beda dari pin, atau berkasnya ada di disk tapi tidak ter-track |
| `sync_plugins.py --check` | salinan skill yang dibaca agen melenceng dari sumbernya |
| `uji_gate_mandiri.py` | ada gate yang tidak punya kasus negatif |
| `dotnet test PMS.sln -c Release` | ada test gagal |

Dua belas penahan pertama dijalankan tanpa model. Yang ketiga belas menjalankan kode. Tidak ada satu
pun di antaranya yang meminta pendapat model soal apakah pekerjaannya sudah benar.

Satu hal yang wajib disebut terus terang: **hijau di CI bukan pengganti pemeriksa lokal.** CI cuma
membuktikan apa yang dijalankannya, dan `dotnet test` yang lulus tidak membuktikan modul yang tidak
punya test itu benar. Karena itu definisi selesai di `factory/LAW.md` bagian 5 menuntut kriteria
issue dijalankan dan keluarannya ditempel, bukan sekadar badge hijau.

## 4. Kalau keluarannya melenceng

| Kejadian | Yang dilakukan harness |
|---|---|
| Kriteria selesai tidak bisa dipenuhi dengan cakupan yang diberikan | Naik ke owner: yang dibutuhkan keputusan cakupan, bukan kerja lebih keras |
| Dua pemeriksa saling bertentangan | Berhenti menyetel nilai. Itu mekanismenya yang salah, bukan angkanya |
| Satu tujuan gagal tiga kali dengan protokol yang benar | Targetnya didefinisikan ulang, bukan dikerjakan dengan model yang lebih besar |
| Perubahan menyentuh rilis atau produksi | Naik dulu; blast radius-nya di luar repo |
| Unit kerja baru selesai sebagian | Dilaporkan sebagian, apa adanya. Laporan setengah jadi yang jujur lebih berharga daripada laporan selesai yang salah |

## 5. Batas yang diketahui, dan yang belum terpasang

Ditulis di sini supaya tidak terbaca sebagai sudah beres:

1. **Lane `sync` belum punya sesi terikat topic.** Enam lane lain sudah terikat; `cek_lane.py` bisa
   mendeteksinya, dan pacemaker sengaja diam kalau lane-nya belum terikat. Lane yang belum terikat
   belum bisa dibrief sama sekali, jadi dispatch untuk lane itu masih menunggu topic-nya menerima pesan.
2. **Receipt masih nol.** Alat penutupannya ada dan gate-nya jalan, tapi belum ada satu pun unit
   kerja yang menutup lewat jalur itu, jadi alatnya belum pernah diuji oleh pemakaian nyata.
3. **`trigger_cmd` dan `trigger_on` tidak dieksekusi** pada job berprofil `default` di build yang
   dipakai. Karena itu pemicu yang sebenarnya dipakai ada di bash dan crontab pengguna, bukan di
   jalur cron OpenCrabs.
4. **Snapshot skor bertanggal masih prosa.** `factory/SKOR.md` memuat angka terakhir, dan belum ada
   yang menolak kalau angka itu tidak diperbarui saat bergerak.
