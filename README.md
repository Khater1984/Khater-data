# Khater-data

Daily Egyptian mutual-fund NAV + macro reference ingest into Supabase.

## Schedule

- `daily-nav.yml` — **16:00 Egypt** (`cron: 0 13 * * *` UTC while Cairo is UTC+3)
  - `scripts/ingest_nav.py` → `nav_staging` / `nav_official`
  - `scripts/ingest_macro.py` → `macro_series` (EGX30, USD/EGP, SPY, QQQ, BTC, gold, silver + EGP conversions)
- `monthly-macro.yml` — 8th of each month 09:00 Egypt
  - prints last CPI / deposit / T-bill observation (pages are not reliably parseable)

Manual run: Actions → Run workflow.

## Secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Do not commit keys.

## Macro conversion rule

`*_egp = *_usd × usd_egp_mid` on the same date, else last known mid (forward fill).
