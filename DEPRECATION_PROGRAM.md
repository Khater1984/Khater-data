# Frontend Deprecation Program

Status: **active program** (not a paper policy)  
Started: 2026-09-16  
Authority: `platform-shell.css` (visual) · `web/js/data/*` (data) · page contracts (CI)

This document turns KEEP / MERGE / DEPRECATE / DELETE from documentation into an
executable program. A file does **not** stay forever because its name contains
`v2`, `polish`, `compat`, or `legacy`.

## Rules

1. **No permanent compatibility graveyard.** Compatibility stubs must have an
   owner, a reason, and a removal condition.
2. **Zero-reference assets are deleted in the same pass** once a reference audit
   confirms they are not loaded dynamically.
3. **Rename is not dual-system.** `*-v2.js` names are historical labels for the
   *canonical* implementation, not parallel stacks.
4. **JSON under `web/data/`** is QA/export only — never a live financial source.
5. **Do not touch** Supabase schema, NAV ingest, SmartScore methodology, or
   official return calculations as part of deprecation.

## Classification (2026-09-16 audit)

### DELETE (executed this pass)

| Asset | Reason |
|-------|--------|
| `web/js/platform-core.js` | 0 references; superseded by `supabase-client.js` + services |
| `web/js/viz.js` | 0 references; palette/charts live in `platform-theme.js` / screens |
| `web/js/score.js` | 0 references; SmartScore presentation is `fund-smartscore.js` |
| `web/data/yearbook.json` | 0 references; snapshot not used by runtime or scripts |
| `web/js/funds-terminal-polish.js` | **MERGE→DELETE** inlined into `funds-screen-v2.js` |
| `web/js/funds-responsive-ui.js` | **MERGE→DELETE** inlined into `funds-screen-v2.js` |
| `web/js/home-redesign.js` | **MERGE→DELETE** into `home-page.js` (earlier pass) |

### KEEP (canonical)

| Asset | Role |
|-------|------|
| `web/css/platform-shell.css` | Single visual identity source |
| `web/css/header.css` | Shared chrome (imports shell) |
| `web/css/page-*.css`, `fund-detail.css`, `opportunity-layer.css`, `accordion.css`, `macro-intelligence.css`, `brief-page.css` | Layout / structure only |
| `web/js/data/*-service.js`, `supabase-client.js` | Canonical data layer |
| `web/js/*-screen-v2.js`, `home-page.js`, `map-page.js`, fund-* modules | Canonical screens |
| `web/js/funds-experience.js` | Funds composition entrypoint (screen + opportunity) |
| `web/heatmap.html` + `heatmap-redirect.js` | Compatibility **route** only |

### KEEP — DEPRECATE (stub, do not edit)

| Asset | Why it still exists | Removal condition |
|-------|---------------------|-------------------|
| `web/css/app.css` | Contracts + every page still link it | All HTML + verify_* drop `app.css` requirement; then delete |
| `web/css/khater-design-system.css` | `verify_platform_identity` expects path | Gate updated to shell-only; then delete |

Both files are **one-line re-exports** of `platform-shell.css`. They are not a
second design system.

### MERGE (remaining)

| Asset | Merge into | Condition before merge |
|-------|------------|------------------------|
| `web/js/macro-intelligence.js` + boot | `macro-screen-v2.js` | After parity check on macro page |

### DEPRECATE name only (canonical code)

| Name | Reality |
|------|---------|
| `funds-screen-v2.js` | Canonical funds screen (+ former polish/responsive) |
| `macro-screen-v2.js` | Canonical macro screen |
| `categories-screen-v2.js` | Canonical categories screen |

Do not create `v3` / `final` / `fix` parallel files. Change the canonical file.

### SNAPSHOT / QA (KEEP until reference audit says otherwise)

| Asset | Class |
|-------|-------|
| `web/data/engine_data.json` | QA / export artifact |
| `web/data/funds_dna.json` | QA / export artifact |
| `web/data/fund_profiles.json` | QA / export artifact |
| `web/data/benchmarks.json` | QA / export artifact |
| `web/data/management_companies.json` | QA / export artifact |
| `web/qa/*` | Manual QA notes |

Production pages must not read these for live financial values
(`verify_frontend_boundaries` / production contracts).

## Anti-patterns (forbidden)

- Adding `*-final.js`, `*-fix2.css`, `*-backup.html`, `*-copy.css`
- New visual tokens outside `platform-shell.css`
- New `font-family` in page CSS
- Leaving orphan candidates listed by `audit_frontend_references.py` without
  a KEEP/MERGE/DEPRECATE/DELETE decision in this file within one consolidation pass

## Program cadence

Every consolidation pass:

1. Run `python scripts/audit_frontend_references.py`
2. For each `ORPHAN CANDIDATE`, record decision in the table above
3. Execute DELETE for zero-ref dead code in the same PR when safe
4. Execute at most one MERGE track per pass
5. Update this file’s dates and tables

## Relation to FRONTEND_CONSOLIDATION.md

`FRONTEND_CONSOLIDATION.md` remains the **map** (what is canonical).  
`DEPRECATION_PROGRAM.md` is the **execution log** (what dies, what waits, why).
