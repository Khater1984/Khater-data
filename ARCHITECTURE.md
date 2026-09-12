# Market Radar Architecture

## Target architecture

Supabase is the authoritative source for live financial data. Browser pages consume shared domain data services rather than creating independent Supabase clients or inventing fallback calculations.

```text
External sources
      ↓
Ingestion / validation
      ↓
Supabase source of truth
      ↓
Shared data transport
      ↓
Domain services
      ↓
Canonical data contracts
      ↓
Shared UI modules
      ↓
Pages
      ↓
Financial QA → Quality Gate → Pages deploy
```

## Source policy

- `fund_performance_history`: official EIMA rolling-performance records and the source for official performance displays.
- `fund_price_history`: observed NAV history; never substitute it for an official rolling return.
- `fund_smartscore_latest`: persisted SmartScore output; the frontend does not silently recompute the score.
- `macro_series` and related reference tables: authoritative macro/reference data.
- `web/data/*.json`: generated snapshots are transitional artifacts for export/fallback workflows. They must not become a competing source of truth for current financial values.

## Domain contract

For a selected fund and horizon, one canonical performance dataset drives:

- Official Return
- chart points
- tooltip
- performance table
- record count
- displayed date range

A future-dated observation is invalid for public display and must be rejected upstream and filtered defensively in the client.

## Migration rule

This is an incremental re-architecture, not a visual rewrite. Existing pages remain operational while data access and shared components are migrated page by page. No SmartScore methodology or intended financial result is changed as part of the foundation migration.

## Completion criteria

The foundation is considered complete when all major pages use the shared data layer, no current financial display reads a competing snapshot, critical browser journeys are tested, ingestion uses verified TLS, and Pages deployment is gated by the full quality suite.
