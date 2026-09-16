# Frontend Deprecation Program

Status: **active — dead frontend layers removed**  
Updated: 2026-09-16  
Authority: `platform-shell.css` (visual) · `web/js/data/*` (data) · page contracts (CI)

## Rules

1. **No permanent compatibility graveyard.** Compatibility stubs must have an owner, a reason, and a removal condition.
2. **Zero-reference assets are deleted in the same pass** once a reference audit confirms they are not loaded dynamically.
3. **Rename is not dual-system.** `*-v2.js` names are historical labels for the *canonical* implementation, not parallel stacks.
4. **JSON under `web/data/`** is export/pipeline only — never a live financial source.
5. **Do not touch** Supabase schema, NAV ingest, SmartScore methodology, or official return calculations as part of deprecation.

## DELETE (executed)

| Asset | Reason |
|-------|--------|
| `web/js/engine.js` | Map/wealth engine; wealth page owns the live experience |
| `web/js/live.js` | Compatibility boundary for the retired map engine |
| `web/js/map-page.js` | Old map controller; `map.html` is now a wealth redirect |
| `web/css/page-map.css` | Styles for the retired map surface |
| `web/css/app.css` | One-line re-export of `platform-shell.css` |
| `web/css/khater-design-system.css` | Duplicate identity stub |
| `web/heatmap.html`, `heatmap.css`, `heatmap-redirect.js` | Heatmap retired permanently |
| `web/qa` keep/manifest leftovers | Not part of production or Quality Gate |

## KEEP (canonical)

| Asset | Role |
|-------|------|
| `web/css/platform-shell.css` | Single visual identity source |
| `web/css/header.css` | Shared chrome |
| `web/css/page-*.css`, `fund-detail.css`, `opportunity-layer.css`, `now.css` | Layout / structure only |
| `web/js/data/*` | Canonical data layer |
| `web/js/*-screen-v2.js`, `now-page.js`, `wealth-page.js`, `macro-screen.js`, fund-* modules | Canonical screens |
| `web/js/funds-experience.js` | Funds composition entrypoint |
| `web/map.html` | Compatibility **redirect** to `wealth.html` only |
| `web/categories.html` | Simplified fund-category atlas |

## SNAPSHOT / PIPELINE (KEEP)

| Asset | Class |
|-------|-------|
| `web/data/*.json` | Written by `export_public.py` / NAV coverage jobs. Not a runtime source. |

## Anti-patterns (forbidden)

- Adding `*-final.js`, `*-fix2.css`, `*-backup.html`, `*-copy.css`
- New visual tokens outside `platform-shell.css`
- New `font-family` in page CSS
- Reintroducing `engine.js`, `live.js`, `map-page.js`, heatmap, or identity stubs
