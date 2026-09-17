#!/usr/bin/env python3
"""Remove fabricated source dates for publishers that do not publish NAV dates.

Current confirmed sources without a NAV date in the published table/page:
- Prime Asset Management (src_prime_am)
- Zaldi Capital homepage (src_zaldi_capital when URL is zaldi-capital.com)

The NAV value is retained. Only as_of_date is cleared. This prevents the
legacy ingest fallback from turning ingestion time into a fake source date.
"""
from __future__ import annotations

import os
import requests

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}


def patch(path, query, payload):
    r = requests.patch(
        f"{BASE}/rest/v1/{path}?{query}",
        headers={**H, "Prefer": "return=minimal"},
        json=payload,
        timeout=30,
    )
    r.raise_for_status()


def get(path, **params):
    r = requests.get(f"{BASE}/rest/v1/{path}", headers=H, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def main():
    funds = get("funds", select="fund_id,source_id,price_update_url", active="eq.true", limit="1000")
    prime_ids = [f["fund_id"] for f in funds if f.get("source_id") == "src_prime_am"]
    zaldi_home_ids = [
        f["fund_id"] for f in funds
        if f.get("source_id") == "src_zaldi_capital"
        and (f.get("price_update_url") or "").rstrip("/") == "https://zaldi-capital.com"
    ]

    cleared_staging = 0
    cleared_official = 0
    for fid in prime_ids + zaldi_home_ids:
        # Only staging rows are affected; the NAV itself is never changed.
        r = requests.patch(
            f"{BASE}/rest/v1/nav_staging?fund_id=eq.{fid}&as_of_date=not.is.null",
            headers={**H, "Prefer": "return=minimal"},
            json={"as_of_date": None}, timeout=30,
        )
        r.raise_for_status()
        cleared_staging += 1
        r = requests.patch(
            f"{BASE}/rest/v1/nav_official?fund_id=eq.{fid}",
            headers={**H, "Prefer": "return=minimal"},
            json={"as_of_date": None}, timeout=30,
        )
        r.raise_for_status()
        cleared_official += 1

    print(f"optional-date sanitizer: funds={len(prime_ids)+len(zaldi_home_ids)} staging_targets={cleared_staging} official_targets={cleared_official}")


if __name__ == "__main__":
    main()
