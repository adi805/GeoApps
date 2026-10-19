# PIN upstream: anthropics/knowledge-work-plugins

| Item | Nilai |
|---|---|
| Upstream | https://github.com/anthropics/knowledge-work-plugins |
| SHA dipin | `ae1513ea94dcb74a7f1505ddcf3b0ec3fab327f1` |
| Lisensi | Apache-2.0 (berkas `LICENSE` di root) |
| Tanggal pin | 2026-10-09 |
| Isi | 1.285 berkas, 252 `SKILL.md`, 20 MB |
| Cache lokal | `~/.opencrabs/projects/pms-tsj/upstream/knowledge-work-plugins` |
| Pin ulang | `git -C <cache> fetch origin && git -C <cache> checkout <sha>` |

Berkas ini adalah prasyarat legal dan peta kerja. Apache-2.0 mewajibkan penyimpanan notice
dan pernyataan perubahan, jadi SHA upstream harus tercatat sebelum ada satu baris pun
diturunkan dari sana.

## Kenapa diambil, dan kenapa bukan seluruhnya

Plugin upstream adalah playbook peran kerja generik (cara melakukan rekonsiliasi bank, cara
menyusun spec, cara menulis runbook). Yang dibutuhkan lane proyek ini adalah prosedur yang
sudah dipetakan ke modul PMS, jadi yang masuk `factory/skills/` adalah hasil tulis ulang,
bukan salinan. Berkas yang tidak punya padanan di proyek ini tidak dipaksa masuk.

Batas yang jelas: **skill upstream bukan hukum proses.** Hukum proses ada di `factory/LAW.md`.
Skill adalah isi yang dikerjakan lane, bukan aturan yang mengikat lane.

## Cara adopsi

1. Setiap berkas yang masuk `factory/skills/` **ditulis ulang**, tidak disalin verbatim.
   Perubahan dinyatakan di header berkas (`Sumber: <plugin>/skills/<nama> @ <sha>`).
2. Rujukan konvensi Cowork dibuang: `CONNECTORS.md`, `$ARGUMENTS`, `~~nama-tool`,
   `allowed-tools`. Lint: `tools/factory/gate_plugin_lint.py`.
3. Konektor MCP upstream tidak dipakai. Di box ini tidak ada satu pun MCP server terpasang,
   jadi nilai yang diambil adalah alur kerjanya, bukan konektornya.
4. Isi yang ditulis untuk pasar US ditulis ulang ke konteks Indonesia dan modul PMS,
   bukan diterjemahkan kata per kata.

## Peta lane ke skill

### HQ (topic 23)

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

### payroll (topic 22)

| Skill upstream | Berkas | Vonis |
|---|---|---|
| payroll-prep | `small-business/skills/payroll-prep` | tulis ulang total |
| plan-payroll | `small-business/skills/plan-payroll` | tulis ulang total |

Dua berkas ini ditulis untuk payroll US: `Gusto` 17 kemunculan, `QuickBooks` 7, `IRS` 6,
`FICA` 3, `1099` 1. Padanannya di sini PPh 21, BPJS, THR, dan slip gaji modul PMS.

### kas-bank (topic 21)

| Skill upstream | Berkas | Vonis |
|---|---|---|
| reconciliation | `finance/skills/reconciliation` | tulis ulang (GAAP ke PSAK) |
| journal-entry | `finance/skills/journal-entry` | tulis ulang (GAAP ke PSAK) |
| journal-entry-prep | `finance/skills/journal-entry-prep` | tulis ulang (GAAP ke PSAK) |
| close-management | `finance/skills/close-management` | tulis ulang, adaptasi tutup buku PMS |
| variance-analysis | `finance/skills/variance-analysis` | pakai, adaptasi ringan |
| financial-statements | `finance/skills/financial-statements` | tulis ulang (format laporan PMS) |
| audit-support | `finance/skills/audit-support` | pakai, adaptasi ringan |
| sox-testing | `finance/skills/sox-testing` | tidak dipakai, SOX itu rezim hukum US |
| cash-flow-snapshot | `small-business/skills/cash-flow-snapshot` | pakai, adaptasi ringan |
| month-end-prep | `small-business/skills/month-end-prep` | tulis ulang (QuickBooks ke PMS) |
| close-month | `small-business/skills/close-month` | tulis ulang |
| ap-processor | `small-business/skills/ap-processor` | tunda |
| pay-the-bills | `small-business/skills/pay-the-bills` | tunda |
| report-builder | `small-business/skills/report-builder` | tunda |
| report-pack | `small-business/skills/report-pack` | tunda |
| business-pulse | `small-business/skills/business-pulse` | tunda |
| growth-pulse | `small-business/skills/growth-pulse` | tidak dipakai, itu metrik pertumbuhan bisnis |
| tax-prep | `small-business/skills/tax-prep` | tidak dipakai, rezim pajak US |
| tax-season-organizer | `small-business/skills/tax-season-organizer` | tidak dipakai, rezim pajak US |

### gudang (topic 25)

| Skill upstream | Berkas | Vonis |
|---|---|---|
| inventory-planner | `small-business/skills/inventory-planner` | tulis ulang (Shopify/Square ke gudang PMS) |
| restock | `small-business/skills/restock` | tulis ulang (ke alur PO PMS) |

### vps-verify (topic 24)

| Skill upstream | Berkas | Vonis |
|---|---|---|
| deploy-checklist | `engineering/skills/deploy-checklist` | pakai, adaptasi ringan |
| incident-response | `engineering/skills/incident-response` | pakai, adaptasi ringan |
| testing-strategy | `engineering/skills/testing-strategy` | pakai, adaptasi ringan |
| debug | `engineering/skills/debug` | pakai, adaptasi ringan |
| code-review | `engineering/skills/code-review` | pakai, adaptasi ringan |
| architecture | `engineering/skills/architecture` | pakai, adaptasi ringan |
| system-design | `engineering/skills/system-design` | pakai, adaptasi ringan |
| documentation | `engineering/skills/documentation` | pakai, adaptasi ringan |
| tech-debt | `engineering/skills/tech-debt` | pakai, adaptasi ringan |
| standup | `engineering/skills/standup` | pakai, adaptasi ringan |

### gh-ops (topic 26)

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

### Lintas lane

| Skill upstream | Berkas | Vonis |
|---|---|---|
| runbook | `operations/skills/runbook` | pakai, adaptasi ringan |
| status-report | `operations/skills/status-report` | pakai, adaptasi ringan |
| process-doc | `operations/skills/process-doc` | pakai, adaptasi ringan |
| change-request | `operations/skills/change-request` | pakai, adaptasi ringan |
| process-optimization | `operations/skills/process-optimization` | tunda |
| risk-assessment | `operations/skills/risk-assessment` | tunda |
| capacity-plan | `operations/skills/capacity-plan` | tunda |
| compliance-tracking | `operations/skills/compliance-tracking` | tunda |
| vendor-review | `operations/skills/vendor-review` | tunda |

## Yang tidak dipakai

| Plugin | Alasan |
|---|---|
| `sales`, `marketing`, `legal`, `customer-support`, `human-resources` | tidak ada lane-nya di proyek ini |
| `bio-research`, `enterprise-search`, `design`, `pdf-viewer` | di luar lingkup proyek |
| `productivity` | tumpang tindih dengan cron dan brain file yang sudah jalan |
| `cowork-plugin-management` | khusus ekosistem Cowork |
| `partner-built/*` | plugin vendor (Zoom, Apollo, Slack, Common Room), bukan alur kerja kita |

## Batas putaran ini

Putaran F6 mengerjakan berkas yang ditandai `pakai` dan `tulis ulang`. Yang ditandai `tunda`
tetap tercatat di sini supaya keputusannya bisa dibuka lagi tanpa membaca ulang upstream.
