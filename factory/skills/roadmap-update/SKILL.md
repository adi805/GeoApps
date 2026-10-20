---
name: {{slug}}-roadmap-update
description: Perbarui, buat, atau urutkan ulang peta jalan produk {{proyek}}. Pakai saat menambah inisiatif baru dan memutuskan apa yang digeser, mengubah prioritas setelah ada informasi baru, menggeser jadwal karena ketergantungan, atau menyusun tampilan Sekarang/Berikutnya/Nanti.
---

<!-- Sumber: product-management/skills/roadmap-update @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Peta Jalan Produk

Perbarui, buat, atau urutkan ulang peta jalan {{proyek}}.

## Alur kerja

### 1. Pahami keadaan sekarang

Tarik item peta jalan dari papan tugas: `gh issue list --repo {{repo}} --state all`. Tandai
yang lewat tenggat, berisiko, atau baru selesai. Kalau tidak ada sumbernya, minta uraiannya.

### 2. Tentukan operasinya

- **Tambah item**: nama, uraian, prioritas, perkiraan usaha, perkiraan waktu, lane, ketergantungan
- **Ubah status**: belum mulai / berjalan / berisiko / tertahan / selesai / dipotong
- **Urutkan ulang**: tanyakan apa yang berubah (informasi baru, perubahan arah, masukan pengguna)
- **Geser jadwal**: tanyakan kenapa, lalu telusuri dampaknya ke item yang bergantung
- **Buat baru**: tentukan rentang waktu dan formatnya

### 3. Susun ringkasannya

Ikhtisar status (berapa berjalan, berapa selesai, berapa berisiko), daftar item (nama, status,
perkiraan waktu, lane, ketergantungan), risiko dan ketergantungan, lalu apa yang berubah sejak
pembaruan terakhir.

## Format peta jalan

### Sekarang / Berikutnya / Nanti

Paling sederhana, dan paling sering paling berguna:

| Kolom | Arti |
|---|---|
| Sekarang | pekerjaan yang dikomitmenkan, keyakinan tinggi soal lingkup dan waktu |
| Berikutnya | 1-3 bulan ke depan, yakin soal "apa", kurang yakin soal "kapan" |
| Nanti | 3-6 bulan ke atas, arah dan taruhan strategis, lingkup dan waktu lentur |

Kelebihannya: menghindari presisi tanggal yang palsu saat dibagikan ke luar.

### Tema per periode

Susun 2-3 tema per periode, tiap tema berisi inisiatif yang direncanakan. Bagus untuk menunjukkan
keselarasan strategi dan menjelaskan **kenapa** sesuatu dikerjakan.

### Selaras hasil kunci

Petakan tiap inisiatif ke hasil kunci yang digerakkannya, dan sebutkan perkiraan dampaknya.

## Kerangka prioritas

| Kerangka | Rumus | Kapan dipakai |
|---|---|---|
| RICE | (Jangkauan x Dampak x Keyakinan) / Usaha | perlu urutan kuantitatif yang bisa dipertahankan |
| ICE | Dampak x Keyakinan x Kemudahan | urutan cepat saat data masih tipis |
| MoSCoW | Wajib / Sebaiknya / Boleh / Tidak sekarang | membatasi lingkup satu rilis |
| Nilai vs Usaha | matriks 2x2 | sesi perencanaan bersama, biar trade-off terlihat |

Jangan paksakan angka presisi kalau datanya tipis. Sebut tingkat keyakinannya.

## Ketergantungan

Cari ketergantungan lintas: teknis, lane lain, luar (vendor/pihak ketiga), pengetahuan (butuh riset
dulu), dan berurutan (A harus jalan sebelum B). Tiap ketergantungan: sebut pemiliknya dan tanggal
"dibutuhkan sebelum". Ketergantungan adalah risiko terbesar di peta jalan mana pun.

## Kapasitas

Kapasitas di sini dibatasi **rantai kerja per pohon**, bukan jumlah orang. Satu rantai `npm run ci`/build per pohon; joyboy cuma satu rantai berat pada satu waktu (lihat `factory/LAW.md` bagian
9). Kalau peta jalan lebih banyak daripada kapasitas, yang dikurangi adalah lingkupnya, bukan
asumsinya bahwa mesinnya bisa lebih cepat.

**Saat menambah item, selalu tanyakan: apa yang keluar?** Peta jalan itu zero-sum terhadap kapasitas.

## Tips

1. Peta jalan itu alat komunikasi, bukan rencana proyek. Jaga di ketinggian tema dan hasil, bukan tugas.
2. Saat mengubah prioritas, selalu tanyakan apa yang berubah. Pergeseran harus didorong informasi baru.
3. Tandai masalah kapasitas lebih awal.
4. Tiap item wajib punya nomor issue.
5. Jangan mengubah peta jalan untuk tiap informasi baru: tetapkan ambang, dan perbarui pada irama alami.
