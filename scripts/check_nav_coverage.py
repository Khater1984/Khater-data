#!/usr/bin/env python3
"""Validate NAV coverage and distinguish current-run extraction from source lag.

The gate never invents a source date and never uses updated_at as as_of_date.
A source that publishes NAV without a date is reported as NO_DATE, not as a
pipeline failure. Structural failures (missing NAV/future dates) still fail.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date
from pathlib import Path

import requests

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
SUPPORTED = {
    "efgholding.com", "cicapital.com", "primeholdingco.com", "aaim.com.eg",
    "beltoneholding.com", "azimut.eg", "nicapital.com.eg", "hc-si.com",
    "pfi-am.com.eg", "granite.eg", "snduk.com", "w1.abkegypt.com",
    "zaldi-capital.com", "afim.com.eg", "nbk.com",
}


def host_of(url):
    if not url or "://" not in url:
        return ""
    return url.split("/")[2].replace("www.", "")


def get(path, **params):
    r = requests.get(f"{BASE}/rest/v1/{path}", headers=H, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def latest_ingest_run(staging):
    runs = sorted({
        r.get("run_id") for r in staging
        if isinstance(r.get("run_id"), str) and r["run_id"].startswith("run_")
    })
    return runs[-1] if runs else None


def main():
    today = date.today().isoformat()
    funds = get("funds", select="fund_id,canonical_name,price_update_url,source_id", active="eq.true", limit="1000")
    official = get("nav_official", select="fund_id,nav,as_of_date,source_id,source_url,verified_at,updated_at", limit="5000")
    staging = get(
        "nav_staging",
        select="id,run_id,fund_id,nav,as_of_date,source_id,source_url,match_status,verification_status,fetched_at,created_at",
        fund_id="not.is.null", limit="50000", order="created_at.desc",
    )

    run_id = latest_ingest_run(staging)
    current_rows = [r for r in staging if r.get("run_id") == run_id]
    current_by_fund = {}
    for r in current_rows:
        if r.get("fund_id") and r.get("match_status") == "matched":
            current_by_fund.setdefault(r["fund_id"], []).append(r)

    by_official = {r["fund_id"]: r for r in official}
    rows = []
    hard_failures = []

    for f in funds:
        fid = f["fund_id"]
        host = host_of(f.get("price_update_url") or "")
        off = by_official.get(fid) or {}
        nav = off.get("nav")
        d = off.get("as_of_date")
        candidates = current_by_fund.get(fid, [])
        candidate_dates = sorted({r.get("as_of_date") for r in candidates if r.get("as_of_date")})
        candidate_date = candidate_dates[-1] if candidate_dates else None

        if host not in SUPPORTED:
            status = "UNSUPPORTED_HOST" if nav is None else "OK_UNSUPPORTED_HOST"
        elif nav is None:
            status = "FAIL_NO_NAV"
            hard_failures.append(f"{f['canonical_name']} [{host}] no official NAV")
        elif not d:
            status = "NO_DATE"
        elif d > today:
            status = "FAIL_FUTURE_DATE"
            hard_failures.append(f"{f['canonical_name']} [{host}] as_of={d} > {today}")
        elif candidates:
            if candidate_date and candidate_date > today:
                status = "FAIL_FUTURE_CANDIDATE"
                hard_failures.append(f"{f['canonical_name']} [{host}] current-run candidate as_of={candidate_date} > {today}")
            elif candidate_date and candidate_date < d:
                status = "PROMOTION_FAILED_OLDER_CANDIDATE"
            elif candidate_date == d:
                status = "CURRENT_RUN"
            else:
                status = "CURRENT_RUN_NO_DATE"
        elif d == today:
            status = "CURRENT_OFFICIAL_NOT_RUN"
        else:
            status = "STALE_NOT_EXTRACTED"

        rows.append({
            "fund_id": fid, "name": f.get("canonical_name"), "host": host,
            "status": status, "nav": nav, "as_of_date": d,
            "current_run_id": run_id, "current_run_candidate_date": candidate_date,
            "current_run_candidate_count": len(candidates),
            "source_id": off.get("source_id") or f.get("source_id"),
            "verified_at": off.get("verified_at"), "updated_at": off.get("updated_at"),
        })

    counts = {}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1

    out = {
        "as_of_check_date": today,
        "current_run_id": run_id,
        "current_run_rows": len(current_rows),
        "funds": len(funds),
        "counts": counts,
        "rows": rows,
    }
    p = Path("web/data/nav_coverage_gate.json")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print("coverage " + " ".join(f"{k}={v}" for k, v in sorted(counts.items())) + f" run={run_id or 'NONE'}")
    for msg in hard_failures:
        print("FAIL", msg)
    if hard_failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
