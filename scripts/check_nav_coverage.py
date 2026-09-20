#!/usr/bin/env python3
"""Validate NAV coverage and distinguish current-run extraction from source lag.

The gate never invents a source date and never uses updated_at as as_of_date.
A source that publishes NAV without a date is reported as NO_DATE. A bounded
source-published future date (<= 7 days) is accepted because some funds publish
weekly valuation dates ahead of the pipeline run. Future dates outside that
window remain structural failures.
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
FUTURE_MAX_DAYS = 7
SOURCE_TO_HOSTS = {
    "hermes": {"efgholding.com"},
    "ci": {"cicapital.com"},
    "prime": {"primeholdingco.com"},
    "aaim": {"aaim.com.eg"},
    "beltone": {"beltoneholding.com"},
    "azimut": {"azimut.eg"},
    "ni": {"nicapital.com.eg"},
    "hc": {"hc-si.com"},
    "pfi": {"pfi-am.com.eg"},
    "granite": {"granite.eg"},
    "snduk": {"snduk.com"},
    "abk": {"w1.abkegypt.com"},
    "zaldi": {"zaldi-capital.com"},
    "afim": {"afim.com.eg"},
}


BELTONE_HOST = "beltoneholding.com"
BELTONE_SOURCE = "src_beltone_funds"
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


def future_status(asof, today):
    if not asof:
        return "no_date"
    try:
        delta = (date.fromisoformat(asof) - date.fromisoformat(today)).days
    except ValueError:
        return "invalid_date"
    if delta <= 0:
        return "current_or_past"
    if delta <= FUTURE_MAX_DAYS:
        return "bounded_future"
    return "future_outside_window"


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

    run_meta = {}
    if run_id:
        run_rows = get(
            "ingest_runs",
            select="run_id,status,sources_attempted,meta,finished_at",
            run_id=f"eq.{run_id}",
            limit="1",
        )
        if run_rows:
            run_meta = run_rows[0].get("meta") or {}

    attempted_sources = set(run_meta.get("attempted_sources") or [])
    fallback_scan_attempted = bool(run_meta.get("fallback_scan_attempted"))
    attempted_source_hosts = {
        host
        for source_name in attempted_sources
        for host in SOURCE_TO_HOSTS.get(source_name, set())
    }

    current_run_funds = {
        r["fund_id"] for r in current_rows
        if r.get("fund_id") and r.get("match_status") == "matched"
    }
    current_by_fund = {}
    for r in current_rows:
        if r.get("fund_id") and r.get("match_status") == "matched":
            current_by_fund.setdefault(r["fund_id"], []).append(r)
    beltone_ran = any(
        (r.get("source_id") == BELTONE_SOURCE or host_of(r.get("source_url") or "") == BELTONE_HOST)
        and r.get("match_status") == "matched"
        for r in current_rows
    )

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
        off_future = future_status(d, today)
        candidate_future = future_status(candidate_date, today)

        manager_attempted = host in attempted_source_hosts
        pipeline_attempted = manager_attempted or fallback_scan_attempted
        if not pipeline_attempted:
            status = "FAIL_NOT_ATTEMPTED"
            hard_failures.append(
                f"{f['canonical_name']} [{host or 'no-host'}] was not attempted by manager or fallback in current run"
            )
        elif host not in SUPPORTED and nav is None:
            status = "UNSUPPORTED_HOST"
        elif host not in SUPPORTED and nav is not None and not candidates:
            status = "OK_UNSUPPORTED_HOST"
        elif not candidates:
            status = "ATTEMPTED_NO_CURRENT_ROW"
        elif host not in SUPPORTED:
            status = "OK_UNSUPPORTED_HOST"
        elif nav is None:
            status = "FAIL_NO_NAV"
            hard_failures.append(f"{f['canonical_name']} [{host}] no official NAV")
        elif not d:
            status = "NO_DATE"
        elif off_future == "future_outside_window":
            status = "FAIL_FUTURE_DATE"
            hard_failures.append(f"{f['canonical_name']} [{host}] as_of={d} > {today}+{FUTURE_MAX_DAYS}d")
        elif candidates:
            if candidate_future == "future_outside_window":
                status = "FAIL_FUTURE_CANDIDATE"
                hard_failures.append(f"{f['canonical_name']} [{host}] current-run candidate as_of={candidate_date} > {today}+{FUTURE_MAX_DAYS}d")
            elif candidate_date and d and candidate_date < d:
                status = "PROMOTION_FAILED_OLDER_CANDIDATE"
            elif candidate_date == d:
                status = "CURRENT_RUN_BOUNDED_FUTURE" if candidate_future == "bounded_future" else "CURRENT_RUN"
            elif candidate_future == "bounded_future":
                status = "CURRENT_RUN_BOUNDED_FUTURE"
            else:
                status = "CURRENT_RUN_NO_DATE"
        elif d == today:
            status = "CURRENT_OFFICIAL_NOT_RUN"
        elif off_future == "bounded_future":
            status = "BOUNDED_FUTURE_OFFICIAL"
        elif beltone_ran and host == BELTONE_HOST and fid not in current_by_fund:
            status = "FAIL_FAMILY_MISS"
            hard_failures.append(
                f"{f['canonical_name']} [{host}] Beltone page ran this cycle but this fund was not extracted (official as_of={d})"
            )
        else:
            status = "STALE_NOT_EXTRACTED"

        rows.append({
            "fund_id": fid, "name": f.get("canonical_name"), "host": host,
            "status": status, "nav": nav, "as_of_date": d,
            "future_date_status": off_future,
            "current_run_id": run_id, "current_run_candidate_date": candidate_date,
            "current_run_candidate_future_status": candidate_future,
            "current_run_candidate_count": len(candidates),
            "source_id": off.get("source_id") or f.get("source_id"),
            "verified_at": off.get("verified_at"), "updated_at": off.get("updated_at"),
        })

    counts = {}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1

    out = {
        "as_of_check_date": today,
        "future_date_policy": {"max_days": FUTURE_MAX_DAYS, "meaning": "source-published bounded future date"},
        "current_run_id": run_id,
        "current_run_rows": len(current_rows),
        "current_run_unique_funds": len(current_run_funds),
        "funds": len(funds),
        "attempt_coverage": {
            "current_run_data_funds": len(current_run_funds),
            "funds": len(funds),
            "manager_source_attempted_hosts": sorted(attempted_source_hosts),
            "fallback_scan_attempted": fallback_scan_attempted,
            "pipeline_attempted_estimate": sum(
                1
                for f in funds
                if (
                    host_of(f.get("price_update_url") or "") in attempted_source_hosts
                    or fallback_scan_attempted
                )
            ),
            "not_attempted_estimate": sum(
                1
                for f in funds
                if (
                    host_of(f.get("price_update_url") or "") not in attempted_source_hosts
                    and not fallback_scan_attempted
                )
            ),
        },
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
