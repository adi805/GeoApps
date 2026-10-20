# ONTOLOGY.md: Kosakata Terkendali

**Versi:** 1
**Punya:** istilah baku proyek ini, dan sinonim yang **dilarang** dipakai di berkas yang jadi
cakupan pemeriksa.
**Pemeriksa:** `tools/factory/gate_ontology.py`, Python stdlib, tanpa LLM. Dijalankan CI di job
`factory-gate`.
**Dirujuk oleh:** `factory/LAW.md` bagian 8.1 dan 8.2, rubrik D1 dan L2 di rubrik skor.

> **Berkas ini template.** Tabel di bawah memuat contoh, bukan kosakata proyek ini. Ganti
> isinya dengan istilah proyek Anda sebelum aturan ini dipakai. Selama masih contoh, gate-nya
> jalan tapi tidak menjaga apa pun yang berarti.

## Kenapa berkas ini ada

Satu hal yang sama boleh ditulis dengan tiga nama berbeda, dan tidak ada satu pun pemeriksa yang
menolaknya. Compiler tidak peduli, linter tidak peduli, dan test suite tidak peduli. Drift nama
seperti itu tidak pernah memunculkan error; ia cuma membuat dua dokumen yang seharusnya sepakat jadi
tidak bisa dibandingkan mesin, dan membuat pemeriksa dokumen kehilangan pegangan saat mencari angka
di dalamnya.

Berkas ini bukan kamus. Ia daftar **keputusan**: untuk tiap konsep, satu istilah yang dipakai, dan
nama-nama lain yang sengaja ditolak. Yang ditolak bukan karena salah bahasa, tapi karena satu konsep
dengan dua nama membuat pemeriksa tidak bisa mencarinya.

## Cara membaca tabel ini

| Kolom | Arti |
|---|---|
| `istilah` | bentuk baku. Ini yang boleh dipakai di berkas dalam cakupan |
| `dipakai` | di mana istilah itu hidup: modul, dokumen, atau lapisan mana |
| `dilarang` | sinonim yang ditolak. Boleh lebih dari satu, dipisah koma. `-` berarti tidak ada |

## Istilah baku dan sinonim terlarang

| istilah | dipakai | dilarang |
|---|---|---|
| berkas | nama berkas, jalur, dan tabel di dokumen proses | fail |
| pemeriksa | gate, skrip pemeriksa, dan job CI | verifikator |
| kosakata | daftar istilah baku dan sinonimnya | glosarium |

## Pengecualian, dan alasan tiap-tiapnya

Berkas yang dikecualikan tidak diperiksa. Daftarnya sengaja pendek dan tiap barisnya beralasan,
karena pengecualian tanpa alasan sama saja dengan menghapus aturannya.

| dikecualikan | alasan |
|---|---|
| `ONTOLOGY.md` | berkas ini mendefinisikan daftar terlarangnya sendiri, jadi kata-katanya ada di sini dengan sengaja |
| `factory/upstream/**` | mencatat path dan nama berkas upstream apa adanya; menulis ulang nama itu membuat catatannya bohong |
| `docs/**` | dokumentasi produk GeoLibre upstream (bahasa Inggris), bukan prosa proses factory; menulis ulang istilahnya membuat dokumen itu menyimpang dari upstream |

## Yang sengaja TIDAK masuk daftar, dan kenapa

Dua kelas kata sering dikira kandidat, dan dua-duanya justru akan membuat aturan ini salah:

1. **Pengenal kode.** `warehouse_doc`, `EmployeeService.cs`, `save_payslip_component` adalah nama
   yang harus ditulis persis. Nama tabel, kelas, dan fungsi tidak boleh "diperbaiki" ke bahasa lain.
   Pemeriksa mencocokkan **kata utuh**, dan potongan kode (fence ```` ``` ```` dan span `` `...` ``)
   dilewati, jadi pengenal tidak ikut diperiksa. Aturannya berlaku pada prosa, bukan pada kode.
2. **Istilah yang memang berdiri sendiri.** Sebuah kata yang mirip sinonim belum tentu sinonim:
   kalau kata itu nama akun, nama dokumen resmi, atau istilah yang dipakai di lapangan,
   menerjemahkannya justru memutus rujukan ke dokumen fisik yang dipakai orang. Yang masuk daftar
   terlarang cuma kata yang benar-benar bisa ditukar tanpa mengubah arti.

Mencatat yang **tidak** dilarang sama pentingnya dengan mencatat yang dilarang. Tanpa bagian ini,
daftar terlarang akan diperluas tiap kali ada yang merasa ada kata asing, dan aturan yang melebar
tanpa alasan berhenti dipakai orang.

## Cakupan pemeriksa

Pemeriksa menyisir `factory/**` dan `docs/**` (bisa diubah lewat `--cakupan`), dengan pengecualian di
tabel atas. Pencocokan **peka besar-kecil**: `Pemeriksa` sama saja dengan `pemeriksa`, dan itu
disengaja, karena drift nama tidak berhenti di awal kalimat.

## Cara pakai

```
python3 tools/factory/gate_ontology.py                    # periksa pohon ini
python3 tools/factory/gate_ontology.py --rinci            # cetak tiap istilah dan cakupannya
python3 tools/factory/gate_ontology.py --uji-mandiri      # uji gate-nya sendiri
```

## Cara menambah istilah

1. Tambahkan barisnya di tabel di atas. Satu istilah baku, satu daftar sinonim yang ditolak.
2. Jalankan gate-nya. Kalau ada berkas yang melanggar, perbaiki berkasnya, bukan tabelnya.
3. Kalau satu kata terpaksa tetap dipakai, masukkan **berkasnya** ke tabel pengecualian beserta
   alasannya. Jangan mencabut katanya dari daftar terlarang: itu membuat aturannya tidak lagi
   bisa diperiksa.
