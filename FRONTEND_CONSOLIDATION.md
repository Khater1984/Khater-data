# Frontend Consolidation Map

Status: verified audit + first safe consolidation pass, 2026-09-13.

## Source-of-truth rule

Supabase is authoritative for live financial data. `web/js/data/*` is the canonical browser data layer. Repository JSON files under `data/` are snapshots/audit artifacts and must not be used as a competing source for current financial displays.

## Canonical page map

| Page | Canonical data layer | Canonical screen/module | Decision |
|---|---|---|---|
| `web/index.html` | shared data layer | inline page composition | KEEP; shared UI extraction later |
| `web/macro.html` | `macro-service.js` | `macro-screen-v2.js` | KEEP |
| `web/categories.html` | `categories-service.js` | `categories-screen-v2.js` | KEEP; CSS extraction next |
| `web/funds.html` | `fund-service.js`, `funds-service.js`, `benchmark-service.js` | `funds-screen-v2.js` | KEEP |
| `web/fund.html` | `fund-service.js` | `fund-core.js` + tab modules | KEEP |
| `web/map.html` | `macro-service.js` through `live.js` compatibility adapter | existing map module | KEEP for now; migrate boundary later |
| `web/heatmap.html` | `categories.html?view=heat` | redirect only | KEEP as compatibility route |
| `web/why.html` | static | static | KEEP |

## Fund detail canonical modules

`web/fund.html` loads one shared Supabase client and one canonical `fund-service.js`, then mounts:

- `fund-core.js` — identity/page shell
- `fund-performance.js` — performance
- `fund-risk.js` — risk
- `fund-benchmark.js` — benchmark context
- `fund-smartscore.js` — stored SmartScore presentation
- `fund-evidence.js` — evidence/method
- `fund-profile.js` — profile/documents

`fund-performance-v3.js` was verified as unreferenced by the production Fund Detail page and has been removed in this consolidation pass. `fund-performance.js` is the canonical performance module.

## Funds screen

`funds.html` loads:

- `supabase-client.js`
- `fund-service.js`
- `funds-service.js`
- `benchmark-service.js`
- `funds-screen-v2.js`
- `funds-terminal-polish.js`

Therefore `funds-screen-v2.js` is the current canonical screen implementation. The older direct-Supabase `funds-screen.js` and presentation patch `funds-screen-fixes.js` were verified as unreferenced by the current page and removed in this consolidation pass.

## Categories / heatmap

`categories.html` loads `supabase-client.js`, `categories-service.js`, and `categories-screen-v2.js`. `heatmap.html` is already a compatibility redirect into the categories heatmap view. No separate heatmap implementation should be created.

The categories page still carries a large inline style block. This is the next confirmed CSS consolidation target: extract it into `page-categories.css` without changing visual behavior.

## Macro / map

`macro.html` already uses the canonical `macro-service.js` directly.

`map.html` uses the `live.js` compatibility adapter. `live.js` reads from `macro-service.js` and explicitly disables JSON fallback. This is transitional rather than a competing financial data source. It should be migrated only after equivalent behavior is covered by the shared macro layer.

## JSON snapshot policy

The repository contains generated/audit JSON under `data/`, including `engine_data.json`, `fund_profiles.json`, `funds_dna.json`, `benchmarks.json`, `management_companies.json`, `metadata_coverage.json`, and `unified_enrichment_audit.json`.

These files are **not deleted in this pass**. They require a reference audit before any removal because some are useful QA/export artifacts even when they are not runtime sources. Current production financial pages use Supabase-backed services.

## CSS consolidation targets

Current CSS is split across page/component files including `fund.css`, `fund-profile.css`, `fund-chart.css`, `fund-price.css`, `page-funds.css`, `page-macro.css`, `page-map.css`, `funds-terminal-polish.css`, `accordion.css`, and `header.css`.

Rules:

1. Preserve visual behavior first.
2. Extract page-local inline CSS before merging shared selectors.
3. Do not delete a stylesheet solely because its name contains `polish`, `v2`, or `fixes`.
4. Remove a selector/file only after reference and behavior checks.

## Next consolidation pass

1. Extract categories inline CSS into `page-categories.css`.
2. Audit all CSS references and unused selectors.
3. Audit repository-wide references to snapshot JSON.
4. Reduce the `live.js` compatibility boundary once map behavior is covered by shared services.
5. Run the full browser/financial QA suite before merging functional changes.

## Non-negotiables

- Do not modify `scripts/ingest_nav.py`.
- Do not change SmartScore methodology or stored score semantics.
- Do not replace official performance history with NAV-derived returns.
- Do not introduce JSON fallback for current financial values.
- Do not change Supabase schema as part of frontend consolidation.
