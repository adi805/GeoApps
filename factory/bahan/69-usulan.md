# #69: dua usulan yang harus diambil lane HQ

**Punya:** lane `ui`, issue #69.
**Kenapa berkas ini ada:** dua usulan di bawah ditulis lewat `tools/factory/usulan.py catat` dan mendarat di `factory/usulan-ui.jsonl`. Berkas jejak itu milik lane HQ, jadi lane `ui` tidak boleh meng-commit-nya, dan meninggalkannya sebagai perubahan di worktree membuat `git status` kotor sehingga `gate_receipt.py` menolak closing. Isinya disalin apa adanya di sini supaya tidak hilang, dan `factory/usulan-ui.jsonl` dikembalikan ke HEAD.

## Cara HQ mengambil

Tambahkan dua baris di bawah ke `factory/usulan-ui.jsonl` (atau tulis ulang lewat `usulan.py catat` dengan isi yang sama), lalu commit di bawah lane HQ.

```jsonl
{"event": "usulan", "id": "u-ui-0c825d", "ts": "2026-10-20T21:40:18+07:00", "lane": "ui", "ringkas": "Berkas measure.ts di packages/plugins/src/plugins/components/ tidak dimiliki lane mana pun, jadi komposisi lapangan-ukur tidak bisa dipindah", "opsi": ["Perluas glob lane geo-pdf jadi packages/plugins/src/plugins/**", "Beri lane baru plugins-ui untuk packages/plugins/src/plugins/components/**", "Biarkan measure di lane geofence bersama berkas plugin lapangan lain"], "rekomendasi": 1, "dampak_tunda": "Empat komposisi lapangan-ukur tetap hanya ada di galeri visual, layar ukur nyata tidak pernah mengikuti hierarki komposisi", "issue": 69, "status": "menunggu"}
{"event": "usulan", "id": "u-ui-c84c87", "ts": "2026-10-20T21:40:24+07:00", "lane": "ui", "ringkas": "Komposisi geofence hanya bisa dipindah lewat lane geofence, bukan lane ui", "opsi": ["Buka unit geofence khusus untuk memindahkan empat komposisi geofence ke maplibre-geofence.ts dan gps-averaging.ts", "Serahkan ke lane geofence pada siklus berikutnya tanpa unit khusus", "Pindahkan maplibre-geofence.ts ke lane ui"], "rekomendasi": 1, "dampak_tunda": "Empat komposisi geofence tetap di galeri visual; panel geofence nyata tidak pernah memakai kartu, chip, dan target 48 px komposisi", "issue": 69, "status": "menunggu"}
```

## Bukti kenapa dua jalur itu bukan milik lane `ui`

| Jalur | Hasil `gate_commit_paths.py --lane ui` | Sebab |
|---|---|---|
| `packages/plugins/src/plugins/components/measure.ts` | GAGAL, di luar cakupan | glob lane `geo-pdf` hanya `packages/plugins/src/plugins/*.ts`, satu tingkat, jadi `plugins/components/**` tidak dimiliki lane mana pun |
| `packages/plugins/src/plugins/maplibre-geofence.ts` | GAGAL, di luar cakupan | dimiliki lane `geofence` |

## Usulan uji yang ikut

Tidak ada usulan uji baru di unit ini. Usulan `u-offline-2ac447` (lane offline) sudah mencakup pokok yang sama dengan temuan bahwa `apps/**/src/**/*.test.ts` tidak pernah dijalankan CI, jadi tidak diduplikasi di sini.
