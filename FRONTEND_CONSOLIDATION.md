# Frontend Consolidation Map

Canonical surfaces on `main`. Identity lives only in `platform-shell.css`. Data lives only in `web/js/data/*`.

## Pages

| Route | Controller | Data | CSS |
|-------|------------|------|-----|
| `index.html` | `now-page.js` | `now-service` + `macro-service` | `now.css` |
| `wealth.html` | `wealth-page.js` | `wealth-service` + `macro-service` | `page-wealth.css` |
| `macro.html` | `macro-screen.js` | `macro-service` | `page-macro.css` |
| `categories.html` | `categories-screen-v2.js` | `categories-service` | `page-categories.css` |
| `funds.html` | `funds-experience.js` → `funds-screen-v2.js` + `opportunity-layer.js` | `funds-service` + `benchmark-service` | `page-funds.css` |
| `fund.html` | `fund-detail-boot.js` + tab modules | `fund-service` | `fund-detail.css` |
| `map.html` | none | none | redirect to `wealth.html` |
| `why.html` | none | none | methodology reference |

Every production page loads `header.css` then `platform-shell.css`.

## Retired permanently

- Heatmap route and styles
- Map engine stack: `engine.js`, `live.js`, `map-page.js`, `page-map.css`
- Identity stubs: `app.css`, `khater-design-system.css`

## JSON snapshot policy

`web/data/*.json` are pipeline/export artifacts written by Actions. Browser pages must not read them.

## Quality

Quality Gate + Pages quality job must stay green. Financial methodology, NAV ingest, SmartScore, and schema are out of scope for consolidation.

## Non-negotiables

- Do not modify `scripts/ingest_nav.py`.
- Do not change SmartScore methodology or stored score semantics.
- Do not add a second visual identity file.
