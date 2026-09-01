#!/usr/bin/env python3
"""Monthly CPI / deposit-rate reminder ingest.

Official CBE pages are JS-heavy. This job records a source ping and
prints the last stored observation so a human can paste a new month
without guessing. When a parseable HTML table appears, extend here.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

import requests

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
}


def last(key):
    r = requests.get(
        f"{BASE}/rest/v1/macro_series",
        headers=H,
        params={"series_key": f"eq.{key}", "order": "ts_date.desc", "limit": 1},
        timeout=20,
    )
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def main():
    print("monthly macro check", datetime.now(timezone.utc).isoformat())
    for key in (
        "cpi_headline_mom_pct",
        "cpi_core_mom_pct",
        "bank_deposit_1_3m_avg_pct",
        "bank_deposit_3_6m_avg_pct",
        "bank_deposit_6_12m_avg_pct",
        "tbill_91_avg_yield_pct",
        "tbill_364_avg_yield_pct",
    ):
        row = last(key)
        if row:
            print(f"{key} last={row['ts_date']} value={row['value']}")
        else:
            print(f"{key} EMPTY")
    print("CPI page https://www.cbe.org.eg/en/economic-research/statistics/inflation-rates")
    print("T-bills https://www.cbe.org.eg/en/economic-research/statistics/t-bills")
    print("Rates https://www.cbe.org.eg/en/economic-research/statistics/interest-rates")


if __name__ == "__main__":
    main()
