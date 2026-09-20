#!/usr/bin/env python3
"""Generate an explicit NAV freshness/provenance report without changing NAV data."""
from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path

import requests

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
FUTURE_MAX_DAYS = 7


def get(path, **params):
    r = requests.get(f"{BASE}/rest/v1/{path}", headers=H, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def host(url):
    return url.split("/")[2].replace("www.", "") if url and "://" in url else ""


def classify_freshness(nav, as_of_date, today=None):
    """Classify NAV freshness using the same bounded-future contract as ingest."""
    if nav is None:
        return "NO_NAV"
    if not as_of_date:
        return "NO_DATE"

    today = today or date.today()
    try:
        d = date.fromisoformat(as_of_date)
    except ValueError:
        return "INVALID_DATE"

    delta = (d - today).days
    if delta == 0:
        return "CURRENT"
    if 0 < delta <= FUTURE_MAX_DAYS:
        return "CURRENT_BOUNDED_FUTURE"
    if delta > FUTURE_MAX_DAYS:
        return "FUTURE_OUTSIDE_WINDOW"
    return "STALE"



def classify_source(source_id):
    if source_id == "src_snduk":
        return "third_party_snduk"
    if source_id == "src_eima_weekly_tw":
        return "official_industry_weekly"
    if source_id and source_id.startswith("src_"):
        return "manager_or_registered_source"
    return "unknown"


def main():
    funds = get(
        "funds",
        select="fund_id,canonical_name,management_company,price_update_url",
        active="eq.true",
        limit="1000",
    )
    nav = get(
        "nav_official",
        select="fund_id,nav,as_of_date,source_id,verified_at,updated_at",
        limit="5000",
    )

    by = {x["fund_id"]: x for x in nav}
    today = date.today()
    today_iso = today.isoformat()
    rows = []

    for f in funds:
        n = by.get(f["fund_id"]) or {}
        d = n.get("as_of_date")
        status = classify_freshness(n.get("nav"), d, today)
        future_days = None
        if d:
            try:
                future_days = (date.fromisoformat(d) - today).days
            except ValueError:
                future_days = None

        age_days = None
        if d:
            try:
                age_days = (today - date.fromisoformat(d)).days
            except ValueError:
                age_days = None

        rows.append({
            **f,
            "host": host(f.get("price_update_url") or ""),
            "nav": n.get("nav"),
            "as_of_date": d,
            "source_id": n.get("source_id"),
            "source_role": classify_source(n.get("source_id")),
            "verified_at": n.get("verified_at"),
            "updated_at": n.get("updated_at"),
            "freshness_status": status,
            "future_days": future_days,
            "age_days": age_days,
        })

    out = {
        "check_date": today_iso,
        "future_date_policy": {
            "max_days": FUTURE_MAX_DAYS,
            "accepted_status": "CURRENT_BOUNDED_FUTURE",
            "meaning": "source-published bounded future date",
        },
        "funds": len(rows),
        "current": sum(x["freshness_status"] == "CURRENT" for x in rows),
        "current_bounded_future": sum(
            x["freshness_status"] == "CURRENT_BOUNDED_FUTURE" for x in rows
        ),
        "stale": sum(x["freshness_status"] == "STALE" for x in rows),
        "future_outside_window": sum(
            x["freshness_status"] == "FUTURE_OUTSIDE_WINDOW" for x in rows
        ),
        "invalid_date": sum(x["freshness_status"] == "INVALID_DATE" for x in rows),
        "no_nav": sum(x["freshness_status"] == "NO_NAV" for x in rows),
        "no_date": sum(x["freshness_status"] == "NO_DATE" for x in rows),
        "rows": rows,
    }

    p = Path("web/data/nav_freshness.json")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(json.dumps({k: out[k] for k in out if k != "rows"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
