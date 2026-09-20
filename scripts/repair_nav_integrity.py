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
        select="fund_id,nav,currency,as_of_date,source_id,source_url",
        limit="5000",
    )
    staging = get(
        "nav_staging",
        select="id,fund_id,nav,currency,as_of_date,source_id,source_url,verification_status,match_status,created_at",
        fund_id="not.is.null",
        limit="20000",
        order="created_at.desc",
    )
    funds = {
        x["fund_id"]: x
        for x in get(
            "funds",
            select="fund_id,currency,management_company,price_update_url",
            active="eq.true",
            limit="1000",
        )
    }
    source_registry = {
        x["source_id"]: {
            "management_company_scope": x.get("management_company_scope"),
            "source_url": x.get("source_url") or "",
            "source_kind": x.get("source_kind") or "",
        }
        for x in get(
            "sources",
            select="source_id,management_company_scope,source_url,source_kind",
            limit="1000",
        )
    }

    latest = {}
    def host(value):
        if not value or "://" not in str(value):
            return ""
        return str(value).split("/")[2].lower().replace("www.", "")

    def source_allowed(row, fund):
        source_id = row.get("source_id") or ""
        raw = row.get("raw") if isinstance(row.get("raw"), dict) else {}
        if source_id == "src_snduk":
            return (
                raw.get("identity_match") == "explicit_alias"
                or (
                    str(row.get("source_url") or "").rstrip("/") == str(fund.get("price_update_url") or "").rstrip("/")
                    and host(row.get("source_url")) == "snduk.com"
                )
            )
        if source_id == "src_eima_weekly_tw":
            return raw.get("identity_match") == "exact_fund_id"
        if source_id == "src_eima_performance_integrated":
            return raw.get("identity_match") == "exact_fund_id"
        meta = source_registry.get(source_id) or {}
        scope = meta.get("management_company_scope")
        if scope:
            return str(scope).strip().lower() == str(fund.get("management_company") or "").strip().lower()
        if meta.get("source_kind") == "management_company_page":
            return bool(host(meta.get("source_url")) and host(meta.get("source_url")) == host(fund.get("price_update_url")))
        return False

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
        fund = funds.get(fid)
        if not fund:
            rejected_bad += 1
            continue
        if str(r.get("currency") or "").strip().upper() != str(fund.get("currency") or "").strip().upper():
            rejected_bad += 1
            continue
        if not source_allowed(r, fund):
            rejected_bad += 1
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
            # This secondary repair path must not bypass the central outlier guard.
            prior_nav = o.get("nav")
            new_nav = n.get("nav")
            if prior_nav is not None and new_nav is not None and prior_nav != 0:
                if abs(float(new_nav) / float(prior_nav) - 1.0) >= 0.50:
                    rejected_bad += 1
                    continue
            patch(o["fund_id"], {
                "nav": n["nav"],
                "currency": n.get("currency"),
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
