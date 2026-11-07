---
document_type: project-progress
project: "GeoApps"
prd: "PRD.md"
status: draft
current_milestone: 0
total_milestones: 3
last_updated: "2026-11-07 20:35"
---

# GeoApps Progress

Live state for this target only. The PRD owns milestone outcomes, Done When, and FR/NFR/AC coverage; reference them rather than copying the specification. Generation leaves implementation unstarted.

## Resume Packet (a fresh session reads this first)

| Field | Value |
|---|---|
| Active milestone | None - spesifikasi saja, belum ada implementasi dari PRD ini |
| Next exact command | `node ~/.opencrabs/skills/prd-maker/scripts/resume.mjs factory/docs/PRD.md` |
| Bootstrap command | `npm ci` lalu `npm run build:embed` lalu `npm run dev` |
| Smoke check | `npm run typecheck:fast` keluar 0, lalu `curl -sf http://127.0.0.1:5173/` balik 200 |
| Last passing check | `node ~/.opencrabs/skills/prd-maker/scripts/validate-prd.mjs factory/docs/PRD.md` lulus 2026-11-07 20:35 WIB, blockers=0 errors=0 warnings=0 |
| Open blockers | Tidak ada blocker dokumen. Yang belum terbukti: impor bundel di perangkat Android, dan seluruh bukti AC-001 sampai AC-017 belum dihasilkan |

## Current State

- PRD version: 0.1.0
- Execution mode: native, sesi pembangun mengerjakan langsung di checkout `~/g98/GeoApps-main` pada branch `feat/offline-basemap-wiring`
- Build authority: belum ada permintaan build; PRD ini baru spesifikasi
- Active milestone / next action: belum mulai; langkah berikutnya memilih Milestone 1 dan menjalankan probe `factory/docs/bukti/offline-start-20x.json`
- Required unresolved input: tidak ada yang menahan Milestone 1

## Milestones And Evidence

| # | PRD milestone reference | Status | Current evidence / remaining gap |
|---|---|---|---|
| 1 | Milestone 1 Peta offline yang terbukti hidup | ⬜ Not Started | belum ada bukti; probe 20 peluncuran belum dijalankan |
| 2 | Milestone 2 PDF bergeoreferensi dan render berubin | ⬜ Not Started | belum ada berkas uji georeferensi maupun catatan profiler RAM |
| 3 | Milestone 3 Alat lapangan dan bundel proyek | ⬜ Not Started | drill arsip bundel 2026-11-07 identik 3 berkas, tetapi impor lewat aplikasi belum diuji |

Statuses: ⬜ Not Started, 🔄 In Progress, ✅ Verified, ✅ Approved. Verified means required checks passed; Approved requires an actual owner verdict.

## Resume And Changes

- 2026-11-07 20:35 WIB: PRD dibuat dari template Full toolkit 4.4.0, lulus validator dengan 0 blocker.
- 2026-11-07 20:35 WIB: drill restore arsip bundel dijalankan di laptop, `factory/docs/bukti-restore/drill-restore-071126-2035.md`, 3 berkas sha256 identik sebelum dan sesudah unzip. Cakupan: arsip saja, bukan impor di perangkat.
- 2026-11-07: bundel contoh `factory/docs/contoh-proyek/bundel-proyek.zip` (748 byte) dipakai sebagai seed dan bahan drill.
