# Khater-data

Daily Egyptian mutual-fund NAV ingest into Supabase.

## Schedule

GitHub Action `daily-nav.yml` runs at **16:00 Egypt time** (`cron: 0 13 * * *` UTC while Cairo is UTC+3).

Manual run: Actions → Daily NAV ingest → Run workflow.

## Secrets (repo Settings → Secrets)

- `SUPABASE_URL` — `https://jlaqotegkeszuyqzdham.supabase.co`
- `SUPABASE_SERVICE_KEY` — service role / secret key

Do not commit keys.

## Flow

Manager pages / APIs → `nav_staging` → matched rows → `nav_official` (upsert by `fund_id`).
