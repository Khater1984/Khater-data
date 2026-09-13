# Frontend Consolidation Map

Status: audit completed against `main` on 2026-09-13. This document records the canonical implementation before destructive cleanup.

## Source-of-truth rule

Supabase is authoritative for live financial data. `web/js/data/*` is the canonical browser data layer. Repository JSON files under `data/` are snapshots/audit artifacts and must not be used as a competing source for current financial displays.

## Canonical page map

| Page | Canonical data layer | Canonical screen/module | Decision |
|---|---|---|---|
| `web/index.html` | shared data layer / page-specific composition | existing page implementation | KEEP; audit imports next |
| `web/macro.html` | `macro-service.js` | `macro-screen-v2.js` | KEEP |
| `web/categories.html` | `categories-service.js` | `categories-screen-v2.js` | KEEP; CSS extraction is next |
| `web/funds.html` | `fund-service.js`, `funds-service.js`, `benchmark-service.js` | `funds-screen-v2.js` | KEEP |
| `web/fund.html` | `fund-service.js` | `fund-core.js` + tab modules | KEEP |
| `web/map.html` | `macro-service.js` through `live.js` compatibility adapter | existing map module | KEEP for now; migrate compatibility boundary later |
| `web/heatmap.html` | `categories.html?view=heat` | redirect only | KEEP as compatibility route |
| `web/why.html` | static | static | KEEP |

## Fund detail canonical modules

`web/fund.html` currently loads one shared Supabase client and one canonical `fund-service.js`, then mounts these responsibility-specific modules:

- `fund-core.js` — identity/page shell
- `fund-performance.js` — performance
- `fund-risk.js` — risk
- `fund-benchmark.js` — benchmark context
- `fund-smartscore.js` — stored SmartScore presentation
- `fund-evidence.js` — evidence/method
- `fund-profile.js` — profile/documents

This is the canonical Fund Detail composition. `fund-performance-v3.js` is **not loaded by the production Fund Detail page** and must not become a second implementation.

## Funds screen

`funds.html` loads:

- `supabase-client.js`
- `fund-service.js`
- `funds-service.js`
- `benchmark-service.js`
- `funds-screen-v2.js`
- `funds-terminal-polish.js`

Therefore `funds-screen-v2.js` is the current canonical screen implementation. Older `funds-screen.js` and `funds-screen-fixes.js` are candidates for deprecation, but deletion requires a repository-wide reference check first.

## Categories / heatmap

`categories.html` loads `supabase-client.js`, `categories-service.js`, and `categories-screen-v2.js`. `heatmap.html` is already a compatibility redirect into the categories heatmap view. No separate heatmap implementation should be created.

The categories page still carries a large inline style block. This is a confirmed CSS consolidation target; extract it into a page stylesheet before deleting or merging any shared selectors.

## Macro / map

`macro.html` already uses the canonical `macro-service.js` directly.

`map.html` uses the `live.js` compatibility adapter. `live.js` itself reads from `macro-service.js` and explicitly disables JSON fallback. This is transitional rather than a competing data source. It should be migrated only after equivalent behavior is covered by the shared macro screen/service layer.

## JSON snapshot policy

The repository contains generated/audit JSON under `data/`, including `engine_data.json`, `fund_profiles.json`, `funds_dna.json`, `benchmarks.json`, `management_companies.json`, `metadata_coverage.json`, and `unified_enrichment_audit.json`.

These files are **not to be deleted as part of this consolidation** until every reference is audited. They are not the target runtime source of truth. Current page architecture is already using Supabase-backed services for the main financial pages.

## CSS consolidation targets

Current CSS is split across page/component files including `fund.css`, `fund-profile.css`, `fund-chart.css`, `fund-price.css`, `page-funds.css`, `page-macro.css`, `page-map.css`, `funds-terminal-polish.css`, `accordion.css`, and `header.css`.

Rules for cleanup:

1. Preserve visual behavior first.
2. Extract page-local inline CSS before merging shared selectors.
3. Do not delete a stylesheet solely because its name contains `polish`, `v2`, or `fixes`.
4. Remove a selector/file only after reference and behavior checks.

## First safe consolidation pass

1. Treat the current V2/shared-service pages as canonical.
2. Keep legacy modules isolated until repository-wide references are verified.
3. Extract categories inline CSS into `page-categories.css` in a dedicated change.
4. Add reference checks before deleting old JS/CSS.
5. Keep financial logic, NAV ingestion, SmartScore methodology, and Supabase schema untouched.

## Non-negotiables

- Do not modify `scripts/ingest_nav.py`.
- Do not change SmartScore methodology or stored score semantics.
- Do not replace official performance history with NAV-derived returns.
- Do not introduce JSON fallback for current financial values.
- Do not change Supabase schema as part of frontend consolidation.
