# Inti Metodologi Factory

**Punya:** bagaimana factory ini memakai model bahasa, dan apa yang menahannya.
**Rubrik:** anggota keempat D1 (*subject matter specification*) di `factory/SKOR.md`. Rubriknya
mengizinkan tiap factory mendeklarasikan di mana anggota ini tinggal, dan yang dideklarasikan di
sini adalah `docs/methodology/*.md`.

Berkas di direktori ini **bukan** pengganti dokumen lain. Perintah dan pemeriksa tetap milik
`docs/CONTRIBUTING.md`; cara factory berjalan tetap milik `factory/LAW.md`. Berkas di sini cuma
menjawab satu pertanyaan yang tidak dijawab dua dokumen itu: **bagian mana dari kerja ini yang
boleh dipercayakan ke model, dan apa yang menggantikannya.**

| Berkas | Isinya |
|---|---|
| `01-penghitung-kelemahan-llm.md` | bagian mana dari kerja ini yang tidak boleh dipercayakan ke model, dan apa penggantinya |
| `02-ikatan-harness.md` | bagaimana agen dipanggil, konteks apa yang diterimanya, dan apa yang menahan keluarannya |

## Satu kalimat yang merangkum dua berkas itu

> Model dipakai untuk memutuskan hal yang **tidak bisa diuji mesin**, dan tidak dipakai untuk
> memutuskan hal yang **bisa diuji mesin**.

Konsekuensinya keras dan sengaja: vonis lulus atau tolak bukan milik model. Kalau sebuah keputusan
bisa ditulis sebagai perintah yang keluar 0 atau 1, keputusan itu dipindahkan ke perintah, dan model
tidak lagi punya suara di situ. Yang tersisa untuk model adalah pekerjaan yang jawabannya tidak bisa
diperiksa mesin: menulis kode, menyusun brief, dan mengusulkan perubahan hukum proses.

## Keadaan yang diukur, bukan yang diharapkan

Angka di bawah diambil dari pohon ini pada 2026-10-18:

| Yang dihitung | Angka | Cara menghitungnya |
|---|---|---|
| Gate mekanis di `tools/factory/` | 9 | `ls tools/factory/gate_*.py \| wc -l` |
| Skill lane di repo | 24 | `ls factory/skills \| wc -l` |
| Salinan skill yang dibaca agen | 25 | `ls -d ~/.opencrabs/skills/geoapps-* \| wc -l` |
| Receipt unit kerja | 0 | `ls factory/receipts \| wc -l` |
| Baris ledger | 0 | `wc -l < factory/ledger.jsonl` (berkasnya belum ada) |

Dua baris terakhir sengaja ditulis apa adanya. Receipt masih nol dan ledger belum punya satu baris pun:
itu bukan keberhasilan yang dibulatkan, itu keadaan yang belum bergerak. Angka yang jelek lebih
berguna daripada angka yang hilang.
