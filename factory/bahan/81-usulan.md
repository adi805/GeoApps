# Usulan lane uji untuk HQ (#81)

Sumber: `factory/usulan-uji.jsonl`, ditulis lewat `tools/factory/usulan.py catat`.
Berkas itu tidak ada di repo dan di luar glob lane `uji` (lane uji hanya menulis `factory/bahan/**` dan `factory/receipts/**`), jadi isinya disalin apa adanya di sini untuk diambil HQ, dan jsonl-nya tidak ditinggal sebagai perubahan pada worktree.

```json
{"event": "usulan", "id": "u-uji-eb6fb2", "ts": "2026-10-20T22:16:10+07:00", "lane": "uji", "ringkas": "e2e/offline-reopen.spec.ts hanya berjalan di jalur nightly e2e-full.yml (--project=features), tidak di gate tiap PR, karena playwright.config.ts ada di akar repo dan tidak masuk glob lane uji", "opsi": ["biarkan nightly saja", "masukkan ke CORE_SPECS lewat unit HQ: offline-reopen.spec.ts diukur tiap PR"], "rekomendasi": 2, "dampak_tunda": "kriteria 2 issue #11 tetap tidak terukur di PR mana pun sampai HQ mengubah playwright.config.ts", "issue": 81, "status": "menunggu"}
```
