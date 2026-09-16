# Frontend Consolidation Map

Status: verified consolidation pass + architecture guardrails, 2026-09-16.

**Execution of KEEP / MERGE / DEPRECATE / DELETE lives in [`DEPRECATION_PROGRAM.md`](./DEPRECATION_PROGRAM.md).**  
This file is the canonical **map**. The deprecation program is the **action log**. Compatibility layers must not become permanent architecture.

## Source-of-truth rule

Supabase is authoritative for live financial data. `web/js/data/*` is the canonical browser data layer. Repository JSON files under `web/data/` are snapshots/audit artifacts and must not be used as a competing source for current financial displays.

## Canonical page map

| Page | Canonical data layer | Canonical screen/module | Decision |
|---|---|---|---|
| `web/index.html` | `macro-service.js`, `funds-service.js` | `home-page.js` | KEEP; controller extracted |
| `web/macro.html` | `macro-service.js` | `macro-screen-v2.js` | KEEP (name is historical; implementation is canonical) |
| `web/categories.html` | `categories-service.js` | `categories-screen-v2.js` | KEEP |
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

`funds.html` loads the canonical Supabase client, fund service, funds service, benchmark service, `funds-screen-v2.js`, and presentation helpers. `funds-screen-v2.js` remains the canonical screen implementation.

The Funds architecture contract explicitly prevents the screen from querying financial tables directly or calculating official returns from browser-side NAV math.

## Categories / heatmap

`categories.html` loads `supabase-client.js`, `categories-service.js`, and `categories-screen-v2.js`. `heatmap.html` is a compatibility redirect into the unified categories heatmap view. No separate heatmap implementation should be created.

## Macro / map

`macro.html` uses `macro-service.js` directly.

`map.html` is a thin HTML shell loading `map-page.js` and `page-map.css`. `map-page.js` still uses `engine.js`, `accordion.js`, and the `live.js` compatibility boundary. `engine.js` remains until equivalent logic is owned by the canonical macro domain layer and covered by QA.

## Home

`index.html` is a thin composition page. `home-page.js` owns page orchestration and obtains live data through canonical services. It must not become a second financial calculation layer. `home-redesign.js` is scheduled MERGE into `home-page.js` (see deprecation program).

## JSON snapshot policy

Files under `web/data/` are QA/export artifacts, not live financial sources. Classification and any DELETE decisions are recorded in `DEPRECATION_PROGRAM.md` after reference audit.

## CSS architecture

| Layer | Files | Owns |
|-------|-------|------|
| Identity | `platform-shell.css` | Colors, type, components |
| Stubs (deprecate) | `app.css`, `khater-design-system.css` | Re-export shell only |
| Chrome | `header.css` | Navigation |
| Layout | `page-*.css`, `fund-detail.css`, `opportunity-layer.css`, `accordion.css`, `brief-page.css`, `macro-intelligence.css` | Structure only — no competing identity |

Rules:

1. Preserve visual behavior first.
2. Page CSS must not set `font-family` or invent color tokens.
3. Do not create `polish` / `v2` / `final` / `fix` parallel stylesheets.
4. DELETE only after reference audit + decision in `DEPRECATION_PROGRAM.md`.

## Quality architecture

Global CI includes page contracts, platform identity, typography, and `scripts/audit_frontend_references.py`. Orphan candidates must receive KEEP / MERGE / DEPRECATE / DELETE in the deprecation program within the same consolidation pass — not left as permanent debt.

## Next consolidation pass

1. Execute next MERGE track: `home-redesign.js` → `home-page.js` **or** funds polish helpers → `funds-screen-v2.js`.
2. Reduce Map `engine.js` / `live.js` boundary after parity coverage.
3. Remove `app.css` / `khater-design-system.css` stubs once contracts no longer require them.
4. Re-run reference audit; update `DEPRECATION_PROGRAM.md` tables.

## Non-negotiables

- Do not modify `scripts/ingest_nav.py`.
- Do not change SmartScore methodology or stored score semantics.
- Do not replace official performance history with NAV-derived returns.
- Do not introduce JSON fallback for current financial values.
- Do not change Supabase schema as part of frontend consolidation.
