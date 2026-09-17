#!/usr/bin/env python3
"""Repair only provable NAV integrity issues before public export.

Uses retained nav_staging history to prevent an older candidate from replacing
newer official NAV. It never invents NAV values or source dates. Phase 2 allows
source-published future dates only inside the same bounded 7-day window used by
the ingest and coverage gate.
"""
from __future__ import annotations

import os
import sys
from datetime import date, datetime, timedelta, timezone

import requests

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
FUTURE_MAX_DAYS = 7


def get(path, **params):
    r = requests.get(f"{BASE}/rest/v1/{path}", headers=H, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def patch(fid, payload):
    r = requests.patch(
        f"{BASE}/rest/v1/nav_official?fund_id=eq.{fid}",
        headers={**H, "Prefer": "return=minimal"},
        json=payload,
        timeout=30,
    )
    r.raise_for_status()


def allowed_date(value):
    if not value:
        return False
    try:
        d = date.fromisoformat(value)
    except ValueError:
        return False
    return d <= date.today() + timedelta(days=FUTURE_MAX_DAYS)


def main():
    today = date.today()
    official = get(
        "nav_official",
        select="fund_id,nav,as_of_date,source_id,source_url",
        limit="5000",
    )
    staging = get(
        "nav_staging",
        select="id,fund_id,nav,as_of_date,source_id,source_url,verification_status,match_status,created_at",
        fund_id="not.is.null",
        limit="20000",
        order="created_at.desc",
    )

    latest = {}
    rejected_future = 0
    rejected_bad = 0
    for r in staging:
        d = r.get("as_of_date")
        if not d or not allowed_date(d) or r.get("nav") is None:
            if d and not allowed_date(d):
                rejected_future += 1
            continue
        if r.get("match_status") != "matched":
            rejected_bad += 1
            continue
        fid = r.get("fund_id")
        if not fid:
            continue
        if fid not in latest or d > latest[fid].get("as_of_date", ""):
            latest[fid] = r

    repaired = 0
    bounded_future = 0
    for o in official:
        d = o.get("as_of_date")
        if d:
            try:
                if date.fromisoformat(d) > today:
                    if allowed_date(d):
                        bounded_future += 1
                    else:
                        rejected_future += 1
                    continue
            except ValueError:
                rejected_bad += 1
                continue
        n = latest.get(o["fund_id"])
        if n and n.get("as_of_date") and (not d or n["as_of_date"] > d):
            patch(o["fund_id"], {
                "nav": n["nav"],
                "as_of_date": n["as_of_date"],
                "source_id": n.get("source_id"),
                "source_url": n.get("source_url"),
                "staging_id": n.get("id"),
                "verified_at": datetime.now(timezone.utc).isoformat(),
            })
            repaired += 1

    print(
        "NAV integrity: "
        f"repaired_older_official={repaired} "
        f"bounded_future_official={bounded_future} "
        f"rejected_future_candidates={rejected_future} "
        f"rejected_bad_candidates={rejected_bad}"
    )
    if rejected_future:
        sys.exit(1)


if __name__ == "__main__":
    main()
