# 01: Penghitung Kelemahan Model Bahasa

**Punya:** bagian mana dari kerja factory ini yang tidak boleh dipercayakan ke model, dan apa yang
menggantikannya.
**Rubrik:** *LLM weakness accounting*, anggota keempat D1. Yang diminta rubriknya bukan pendapat
soal model, tapi **hitungan**: tiap bagian kerja dinilai, dan yang tidak layak diserahkan harus
punya pengganti yang bisa ditunjuk.

## Kenapa ini perlu dihitung, bukan dirasakan

Model bahasa tidak gagal dengan cara yang sama seperti program. Program yang salah berhenti; model
yang salah **menjawab dengan lancar**. Karena itu kelemahannya tidak bisa dideteksi dari
keyakinannya sendiri, dan pertanyaan "apakah ini bisa dipercayakan ke model" harus dijawab dari
bentuk pekerjaannya, bukan dari mutu jawabannya.

Aturan yang dipakai di sini karena itu berbentuk pertanyaan yang bisa dijawab sebelum kerja dimulai:

1. **Apakah hasilnya bisa diperiksa mesin?** Kalau ya (exit code, skema, diff, jumlah baris),
   pemeriksa itu yang memutuskan, bukan model. Model boleh mengerjakan, tapi tidak boleh menilai.
2. **Kalau tidak bisa diperiksa mesin, apakah akibatnya bisa dibatalkan?** Kalau bisa (commit di
   branch, berkas baru, PR), model boleh jalan. Kalau tidak bisa (push ke `main`, terbitkan rilis,
   hapus data pelanggan, kirim ke pihak luar), naik ke owner dulu.
3. **Kalau tidak bisa diperiksa mesin dan tidak bisa dibatalkan**, pekerjaan itu tidak diserahkan,
   dan yang mengerjakan adalah manusia dengan pemeriksa manual.

Ketiga pertanyaan itu menghasilkan pembagian di tabel berikut. Tabel ini yang dimaksud rubriknya
dengan "penghitung": bukan daftar niat, tapi daftar keputusan.

## Pembagiannya

| Pekerjaan | Diserahkan ke model? | Penggantinya | Di mana |
|---|---|---|---|
| Vonis lulus atau tolak sebuah unit kerja | **Tidak** | exit code gate | 7 gate di `tools/factory/gate_*.py` |
| Skor kesehatan factory | **Tidak** | hitungan dari keadaan repo | `tools/factory/skor.py` |
| Pemicu bangun sesi lane | **Tidak** | sinyal dari `gh`, tanpa token | `tools/factory/pacemaker.py` |
| Batas cakupan lane | **Tidak** | glob per lane + `git merge-base` | `gate_commit_paths.py`, `factory/lanes.json` |
| Penulisan catatan lintas lane | **Tidak** | satu penulis `HQ`, skema divalidasi | `ledger.py`, `gate_ledger.py` |
| Bukti penutupan unit kerja | **Tidak** | diverifikasi ulang dari repo | `gate_receipt.py` |
| Pilihan kata dan istilah baku | **Tidak** | daftar terlarang + pemeriksa | `ONTOLOGY.md`, `gate_ontology.py` |
| Menulis kode modul | **Ya**, terbatas | test, `audit_consistency.py`, `verifikasi_dokumen.py` | `docs/CONTRIBUTING.md` bagian 2 |
| Menyusun brief dari issue | **Ya**, terbatas | kriteria selesai yang bisa dijalankan | `factory/LAW.md` bagian 3 |
| Mengusulkan perubahan hukum proses | **Ya**, sebagai usul | owner yang memutuskan, lalu versi dan baseline | `factory/LAW.md`, `gate_law_fresh.py` |
| Memutuskan cakupan, dan eskalasi tingkat owner | **Tidak** | owner | `factory/LAW.md` bagian 7 |
| Memutuskan eskalasi tingkat agent (workflow, VPS non-produksi) | **Ya**, terbatas | label `eskalasi` di PR + entri ledger `ruling` oleh agent | `factory/LAW.md` 7.2 |

Perhatikan polanya: yang diserahkan ke model selalu **menghasilkan sesuatu** (kode, brief, usul),
dan yang tidak diserahkan selalu **memutuskan sesuatu** (lulus, tolak, boleh, tidak). Factory ini
memisahkan dua hal itu dengan sengaja, karena model yang menghasilkan dan menilai pekerjaannya
sendiri tidak punya cara memberi tahu bahwa ia salah.

## Empat kelemahan yang sudah terbukti di pohon ini

Rubriknya minta hitungan, dan hitungan yang jujur memakai kejadian nyata, bukan dugaan. Empat di
bawah semuanya pernah lolos dari pembacaan manusia dan baru ketahuan karena ada pemeriksa mesin:

| Kejadian | Kelemahan yang terbukti | Yang menangkapnya |
|---|---|---|
| Pola `.gitignore` dari template Visual Studio (`[Dd]ebug/`) menelan `factory/skills/debug/SKILL.md`: berkasnya ada di disk, git tidak pernah melihatnya, nol error. 18 berkas di disk, 17 yang ke-commit | Model membaca daftar berkas dan menganggap yang tidak terlihat itu tidak ada. Ketiadaan tidak berbunyi | negasi `!factory/**` + pemeriksaan `git ls-files` di `gate_plugin_lint.py` |
| `gate_receipt` di CI memeriksa nol berkas dan mencetak `receipt diperiksa: 0` | Laporan kosong terbaca seperti hijau. Model yang membaca keluaran itu menyimpulkan "bersih" | jumlah diperiksa dicetak terus terang, bukan disimpulkan |
| `gate_commit_paths` memakai `git diff base head`, jadi 8 berkas milik lane lain dilaporkan sebagai pelanggaran cakupan `HQ` | Model mempercayai perintah yang keluarannya masuk akal. Perintah yang salah bentuk tetap keluar 0 | pangkalnya diganti `git merge-base` |
| `skor.py` melaporkan dirinya sendiri sebagai penulis kedua ledger, karena berkas itu **memuat pola tulis ledger sebagai teks** | Pencocokan teks menangkap alat ukurnya sendiri, dan model tidak bisa membedakan "menyebut" dari "melakukan" | pengecualian eksplisit + kasus negatif di uji mandiri |

Pelajaran yang sama muncul empat kali dalam bentuk berbeda: **yang berbahaya bukan model yang
menjawab salah, tapi model yang tidak punya cara tahu bahwa dirinya salah.** Karena itu tiap
kejadian di atas diselesaikan dengan menambah pemeriksa, bukan dengan mengingatkan model supaya
lebih hati-hati. Ingatan tidak bisa diuji mesin.

## Yang tidak boleh dipercayakan, dan siapa yang memutuskan

Tiga hal ini sengaja tidak pernah diserahkan, sekalipun modelnya mampu:

1. **Menilai pekerjaannya sendiri.** Penilaian dan pengerjaan dipisah. Lane mengerjakan, gate yang
   menilai, dan gate itu bukan model. Kalau tidak ada gate yang bisa menilai, itu dilaporkan
   sebagai belum selesai, bukan dibulatkan menjadi selesai.
2. **Menghapus dan menimpa.** Aksi yang tidak bisa dibatalkan naik ke owner lebih dulu. Lane boleh
   commit, buka PR, dan tulis berkas; lane tidak boleh push ke `main`, menghapus, atau menerbitkan
   rilis atas keputusannya sendiri.
3. **Menetapkan aturannya sendiri.** Model boleh mengusulkan perubahan `factory/LAW.md`, tapi
   usulan itu baru berlaku setelah versinya naik dan baseline-nya disahkan, dan yang memutuskan
   adalah owner lewat `ruling` di ledger. Usul yang belum disahkan tidak mengikat siapa pun.

## Cara memakai berkas ini saat ada pekerjaan baru

Sebelum menyerahkan pekerjaan apa pun ke lane, jawab tiga pertanyaan di bagian atas. Kalau
jawabannya "tidak bisa diperiksa mesin" dan "tidak bisa dibatalkan", pekerjaan itu belum boleh
dikirim: yang kurang bukan model yang lebih pintar, tapi pemeriksa yang belum ada. Menambah
pemeriksa lebih murah daripada mengawasi jawaban satu per satu.
