# Frontend Consolidation Map

Status: verified consolidation pass + architecture guardrails, 2026-09-13.

## Source-of-truth rule

Supabase is authoritative for live financial data. `web/js/data/*` is the canonical browser data layer. Repository JSON files under `web/data/` are snapshots/audit artifacts and must not be used as a competing source for current financial displays.

## Canonical page map

| Page | Canonical data layer | Canonical screen/module | Decision |
|---|---|---|---|
| `web/index.html` | `macro-service.js`, `funds-service.js` | `home-page.js` | KEEP; controller extracted |
| `web/macro.html` | `macro-service.js` | `macro-screen-v2.js` | KEEP |
| `web/categories.html` | `categories-service.js` | `categories-screen-v2.js` | KEEP; CSS extraction remains |
| `web/funds.html` | `fund-service.js`, `funds-service.js`, `benchmark-service.js` | `funds-screen-v2.js` | KEEP |
| `web/fund.html` | `fund-service.js` | `fund-core.js` + tab modules + `fund-tabs.js` | KEEP |
| `web/map.html` | `macro-service.js` through `live.js` compatibility boundary | `map-page.js` | KEEP; boundary reduction remains |
| `web/heatmap.html` | `categories.html?view=heat` | redirect only | KEEP as compatibility route |
| `web/why.html` | static | static | KEEP |

## Fund detail canonical modules

`web/fund.html` loads one shared Supabase client and one canonical `fund-service.js`, then mounts:

- `fund-core.js` — identity/page shell and compatibility facade
- `fund-performance.js` — official performance
- `fund-risk.js` — risk
- `fund-benchmark.js` — benchmark context
- `fund-smartscore.js` — stored SmartScore presentation
- `fund-evidence.js` — evidence/method
- `fund-profile.js` — profile/documents
- `fund-tabs.js` — tab orchestration/cache boundary

`fund-performance.js` is the canonical production performance module. No alternate performance implementation should be introduced without a reference audit.

## Funds screen

`funds.html` loads the canonical Supabase client, fund service, funds service, benchmark service, `funds-screen-v2.js`, and the terminal presentation layer. `funds-screen-v2.js` remains the canonical screen implementation.

The Funds architecture contract explicitly prevents the screen from querying financial tables directly or calculating official returns from browser-side NAV math.

## Categories / heatmap

`categories.html` loads `supabase-client.js`, `categories-service.js`, and `categories-screen-v2.js`. `heatmap.html` is a compatibility redirect into the unified categories heatmap view. No separate heatmap implementation should be created.

`page-categories.css` exists as the target stylesheet. The remaining inline CSS in `categories.html` must be extracted only as a controlled, behavior-preserving CSS migration; no visual rewrite is permitted during that step.

## Macro / map

`macro.html` uses `macro-service.js` directly.

`map.html` is now a thin HTML shell loading `map-page.js` and `page-map.css`. `map-page.js` still uses `engine.js`, `accordion.js`, and the `live.js` compatibility boundary. This is a real modular page, but the domain-calculation boundary is not yet fully consolidated. `engine.js` therefore remains intentionally retained until equivalent logic is owned by the canonical macro domain layer and covered by QA.

## Home

`index.html` is now a thin composition page. `home-page.js` owns the small amount of page orchestration and obtains live USD/EGP, EGX30, and fund-universe data through canonical services. It must not become a second financial calculation layer.

## JSON snapshot policy

The repository contains generated/audit JSON under `web/data/`, including `engine_data.json`, `fund_profiles.json`, `funds_dna.json`, `benchmarks.json`, `management_companies.json`, `metadata_coverage.json`, and `unified_enrichment_audit.json`.

These files are **not deleted merely for cleanup**. They require a reference audit before removal because some are useful QA/export artifacts even when they are not runtime sources. Current production financial pages are protected against using these snapshots as competing live financial sources.

## CSS consolidation targets

Current CSS is split across page/component files including `fund.css`, `fund-profile.css`, `fund-chart.css`, `fund-price.css`, `page-funds.css`, `page-macro.css`, `page-map.css`, `funds-terminal-polish.css`, `accordion.css`, and `header.css`.

Rules:

1. Preserve visual behavior first.
2. Extract page-local inline CSS before merging shared selectors.
3. Do not delete a stylesheet solely because its name contains `polish`, `v2`, or `fixes`.
4. Remove a selector/file only after reference and behavior checks.
5. A file becomes a deletion candidate only after repository-wide reference analysis and runtime/QA confirmation.

## Quality architecture

Global CI now includes page-specific contracts for Fund Detail, Funds, Categories, Macro, Map, and Home, plus a repository-wide frontend reference audit. The reference audit fails on broken local assets and reports unreferenced JS/CSS as candidates rather than deleting them automatically.

## Next consolidation pass

1. Extract categories inline CSS into `page-categories.css` with zero behavior change.
2. Review the orphan-candidate report and classify each candidate KEEP / MERGE / DEPRECATE / DELETE.
3. Move Map's remaining domain calculations out of `engine.js` only after parity tests exist in the macro domain layer.
4. Audit snapshot JSON references and classify runtime vs QA/export artifacts.
5. Run the full browser/financial QA suite before any functional merge.

## Non-negotiables

- Do not modify `scripts/ingest_nav.py`.
- Do not change SmartScore methodology or stored score semantics.
- Do not replace official performance history with NAV-derived returns.
- Do not introduce JSON fallback for current financial values.
- Do not change Supabase schema as part of frontend consolidation.
