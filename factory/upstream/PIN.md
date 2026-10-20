# PIN upstream: anthropics/knowledge-work-plugins

| Item | Nilai |
|---|---|
| Upstream | https://github.com/anthropics/knowledge-work-plugins |
| SHA dipin | `ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1` |
| Lisensi | Apache-2.0 (berkas `LICENSE` di root) |
| Tanggal pin | 2026-10-09 |
| Isi | 1.285 berkas, 252 `SKILL.md`, 20 MB |
| Cache lokal | `~/.opencrabs/projects/geoapps/upstream/knowledge-work-plugins` |
| Pin ulang | `git -C <cache> fetch origin && git -C <cache> checkout <sha>` |

Berkas ini adalah prasyarat legal dan peta kerja. Apache-2.0 mewajibkan penyimpanan notice
dan pernyataan perubahan, jadi SHA upstream harus tercatat sebelum ada satu baris pun
diturunkan dari sana.

## Kenapa diambil, dan kenapa bukan seluruhnya

Plugin upstream adalah playbook peran kerja generik (cara menyusun spec, cara menulis runbook,
cara memeriksa data). Yang dibutuhkan lane proyek ini adalah prosedur yang sudah dipetakan ke
modul {{proyek}} (impor GeoPDF, geofence, peta offline, shell Android), jadi yang masuk
`factory/skills/` adalah hasil tulis ulang, bukan salinan. Berkas yang tidak punya padanan di
proyek ini tidak dipaksa masuk.

Batas yang jelas: **skill upstream bukan hukum proses.** Hukum proses ada di `factory/LAW.md`.
Skill adalah isi yang dikerjakan lane, bukan aturan yang mengikat lane.

## Cara adopsi

1. Setiap berkas yang masuk `factory/skills/` **ditulis ulang**, tidak disalin verbatim.
   Perubahan dinyatakan di header berkas (`Sumber: <plugin>/skills/<nama> @ <sha>`).
2. Rujukan konvensi Cowork dibuang: `CONNECTORS.md`, `$ARGUMENTS`, `~~nama-tool`,
   `allowed-tools`. Lint: `tools/factory/gate_plugin_lint.py`.
3. Konektor MCP upstream tidak dipakai. Di box ini tidak ada satu pun MCP server terpasang,
   jadi nilai yang diambil adalah alur kerjanya, bukan konektornya.
4. Isi yang ditulis untuk pasar US ditulis ulang ke konteks {{proyek}}, bukan diterjemahkan
   kata per kata. Contoh yang paling kentara: perintah build dan uji diganti dari rantai
   `dotnet` ke `npm run ci` + `cargo`, karena produk ini Tauri/TypeScript/Rust.

## Peta lane ke skill

### HQ (topic 12)

| Skill upstream | Berkas | Vonis |
|---|---|---|
| write-spec | `product-management/skills/write-spec` | pakai, adaptasi ringan |
| sprint-planning | `product-management/skills/sprint-planning` | pakai, adaptasi ringan |
| stakeholder-update | `product-management/skills/stakeholder-update` | pakai, adaptasi ringan |
| roadmap-update | `product-management/skills/roadmap-update` | pakai, adaptasi ringan |
| metrics-review | `product-management/skills/metrics-review` | pakai, adaptasi ringan |
| synthesize-research | `product-management/skills/synthesize-research` | pakai, adaptasi ringan |
| competitive-brief | `product-management/skills/competitive-brief` | tunda, belum ada kebutuhan |
| product-brainstorming | `product-management/skills/product-brainstorming` | tunda, belum ada kebutuhan |
| brainstorm (command) | `product-management/commands/brainstorm.md` | tunda |

### android (topic 13)

| Skill upstream | Berkas | Vonis |
|---|---|---|
| deploy-checklist | `engineering/skills/deploy-checklist` | pakai, adaptasi ringan |
| testing-strategy | `engineering/skills/testing-strategy` | pakai, adaptasi ringan |

### geo-pdf (topic 15)

| Skill upstream | Berkas | Vonis |
|---|---|---|
| explore-data | `data/skills/explore-data` | pakai, adaptasi ringan |
| validate-data | `data/skills/validate-data` | pakai, adaptasi ringan |

### geofence (topic 16)

| Skill upstream | Berkas | Vonis |
|---|---|---|
| validate-data | `data/skills/validate-data` | pakai, adaptasi ringan |

### offline (topic 17)

Belum ada skill upstream yang cocok. Alur unduh region, MBTiles, dan cache tile ditulis
sebagai dokumentasi lane di `factory/LAW.md`, bukan diadopsi dari plugin ini.

### ui (topic 19)

Belum ada skill upstream yang cocok. Plugin `design` sengaja tidak dipakai (lihat bagian
"Yang tidak dipakai").

### gh-ops (topic 20)

| Skill upstream | Berkas | Vonis |
|---|---|---|
| write-query | `data/skills/write-query` | pakai, adaptasi ringan |
| validate-data | `data/skills/validate-data` | pakai, adaptasi ringan |
| explore-data | `data/skills/explore-data` | pakai, adaptasi ringan |
| analyze | `data/skills/analyze` | pakai, adaptasi ringan |
| statistical-analysis | `data/skills/statistical-analysis` | tunda |
| sql-queries | `data/skills/sql-queries` | tunda |
| data-visualization | `data/skills/data-visualization` | tunda |
| create-viz | `data/skills/create-viz` | tunda |
| build-dashboard | `data/skills/build-dashboard` | tunda |
| data-context-extractor | `data/skills/data-context-extractor` | tunda |

### uji (topic 21)

| Skill upstream | Berkas | Vonis |
|---|---|---|
| testing-strategy | `engineering/skills/testing-strategy` | pakai, adaptasi ringan |
| debug | `engineering/skills/debug` | pakai, adaptasi ringan |
| code-review | `engineering/skills/code-review` | pakai, adaptasi ringan |

### Lintas lane

| Skill upstream | Berkas | Vonis |
|---|---|---|
| architecture | `engineering/skills/architecture` | pakai, adaptasi ringan |
| system-design | `engineering/skills/system-design` | pakai, adaptasi ringan |
| documentation | `engineering/skills/documentation` | pakai, adaptasi ringan |
| tech-debt | `engineering/skills/tech-debt` | pakai, adaptasi ringan |
| standup | `engineering/skills/standup` | pakai, adaptasi ringan |
| incident-response | `engineering/skills/incident-response` | pakai, adaptasi ringan |
| runbook | `operations/skills/runbook` | pakai, adaptasi ringan |
| status-report | `operations/skills/status-report` | pakai, adaptasi ringan |
| process-doc | `operations/skills/process-doc` | pakai, adaptasi ringan |
| change-request | `operations/skills/change-request` | pakai, adaptasi ringan |
| process-optimization | `operations/skills/process-optimization` | tunda |
| risk-assessment | `operations/skills/risk-assessment` | tunda |
| capacity-plan | `operations/skills/capacity-plan` | tunda |
| compliance-tracking | `operations/skills/compliance-tracking` | tunda |
| vendor-review | `operations/skills/vendor-review` | tunda |

## Yang dibuang di port ini

Skill yang sudah masuk `factory/skills/` lalu **dihapus** saat mesin ini dipindah ke {{proyek}},
karena proyek ini tidak punya lane keuangan, akuntansi, payroll, atau gudang:

| Skill | Plugin upstream | Alasan |
|---|---|---|
| payroll-prep | `small-business/skills/payroll-prep` | tidak ada lane payroll |
| plan-payroll | `small-business/skills/plan-payroll` | tidak ada lane payroll |
| reconciliation | `finance/skills/reconciliation` | tidak ada lane akuntansi |
| journal-entry | `finance/skills/journal-entry` | tidak ada lane akuntansi |
| journal-entry-prep | `finance/skills/journal-entry-prep` | tidak ada lane akuntansi |
| close-management | `finance/skills/close-management` | tidak ada tutup buku |
| close-month | `small-business/skills/close-month` | tidak ada tutup buku |
| month-end-prep | `small-business/skills/month-end-prep` | tidak ada tutup buku |
| financial-statements | `finance/skills/financial-statements` | tidak ada laporan keuangan |
| variance-analysis | `finance/skills/variance-analysis` | tidak ada anggaran vs realisasi |
| audit-support | `finance/skills/audit-support` | tidak ada audit eksternal |
| cash-flow-snapshot | `small-business/skills/cash-flow-snapshot` | tidak ada arus kas |
| inventory-planner | `small-business/skills/inventory-planner` | tidak ada gudang |
| restock | `small-business/skills/restock` | tidak ada gudang |

Kalau nanti {{proyek}} butuh salah satunya, kembalikan dari SHA di atas, bukan dari salinan
lama: salinan lama memuat konvensi produk sebelumnya dan akan lolos lint tanpa terasa.

## Yang tidak dipakai

| Plugin | Alasan |
|---|---|
| `finance`, `small-business` (bagian akuntansi/payroll/gudang) | tidak ada lane-nya di proyek ini |
| `sales`, `marketing`, `legal`, `customer-support`, `human-resources` | tidak ada lane-nya di proyek ini |
| `bio-research`, `enterprise-search`, `design`, `pdf-viewer` | di luar lingkup proyek |
| `productivity` | tumpang tindih dengan cron dan brain file yang sudah jalan |
| `cowork-plugin-management` | khusus ekosistem Cowork |
| `partner-built/*` | plugin vendor (Zoom, Apollo, Slack, Common Room), bukan alur kerja kita |

## Batas putaran ini

Putaran F6 mengerjakan berkas yang ditandai `pakai` dan `tulis ulang`. Yang ditandai `tunda`
tetap tercatat di sini supaya keputusannya bisa dibuka lagi tanpa membaca ulang upstream.
