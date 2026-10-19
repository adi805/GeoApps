---
name: {{slug}}-deploy-checklist
description: Daftar periksa sebelum rilis {{proyek}}. Pakai saat akan merilis versi, memasang perubahan yang menyentuh migrasi basis data atau installer, memeriksa status CI sebelum MSI dipublikasikan, atau mencatat pemicu rollback sebelum rilis jalan.
---

<!-- Sumber: engineering/skills/deploy-checklist @ ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1 | anthropics/knowledge-work-plugins | Apache-2.0 | ditulis ulang untuk {{proyek}} -->

# Daftar Periksa Rilis

Susun daftar periksa sebelum sebuah rilis {{proyek}} dipublikasikan.

## Keluaran

```markdown
## Daftar Periksa Rilis: [versi]
**Tanggal:** [tanggal] | **Perilis:** [nama]

### Sebelum rilis
- [ ] Semua test hijau di CI
- [ ] Kode sudah ditinjau dan disetujui
- [ ] Tidak ada bug kritis yang diketahui di rentang rilis
- [ ] Migrasi basis data diuji (kalau ada)
- [ ] Perubahan skema D1 punya jalur mundur
- [ ] Rencana rollback tercatat
- [ ] Perubahan yang menyentuh `installer.iss`, `build_msi.py`, `scripts/build_rilis.sh`,
      `cloudflare/`, atau `certs/` sudah naik ke owner
- [ ] Perubahan yang menyentuh `.github/workflows/` atau `.gitlab-ci.yml` sudah dilabeli
      `eskalasi` di PR dan dicatat sebagai entri ledger `ruling` oleh agent

### Saat rilis
- [ ] MSI dibangun dari commit yang benar, bukan dari pohon yang kotor
- [ ] Versi di seluruh berkas seragam (`python3 tools/cek_versi.py`)
- [ ] Aset diunggah ke rilis GitHub
- [ ] `SHA256SUMS` dibuat ulang dari berkas yang benar, lalu diunggah
- [ ] Seluruh aset diunduh balik dan `sha256sum -c` hijau

### Sesudah rilis
- [ ] Catatan rilis diperbarui
- [ ] Stakeholder diberi tahu
- [ ] Issue terkait ditutup dengan hash commit dan bukti

### Pemicu rollback
- Pemasangan MSI gagal di lebih dari satu mesin
- `sha256sum -c` tidak cocok untuk aset yang diunduh
- Alur sinkron berhenti bekerja untuk pengguna yang sudah ada
```

## Aturan yang tidak boleh dilewat

1. **Manifest checksum itu satu-satunya alat verifikasi.** Pengemas tidak deterministik: aset yang
   diunduh tidak bisa diperiksa dengan membangun ulang lalu membandingkan hash. Kalau satu aset
   diganti, manifest wajib dibuat ulang dan diverifikasi dengan mengunduh balik.
2. **Identitas artefak build bukan sha-nya.** Dua MSI dari sumber yang sama bisa beda byte. Yang
   dipakai sebagai identitas: sertifikat, versi, dan berkas yang tidak berubah.
3. **Tag rilis menempel di riwayat.** Merge rilis pakai merge commit, jangan rebase atau squash,
   lihat `factory/LAW.md` bagian 6.

## Tips

1. **Jalankan tiap kali rilis** — termasuk yang rutin. Daftar periksa mencegah "lupa ...".
2. **Tentukan pemicu rollback sebelum rilis** — bukan saat panik di tengah jalan.
3. **Rilis itu blast radius-nya di luar repo** — kalau ragu, naik ke owner dulu.
