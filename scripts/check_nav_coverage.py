#!/usr/bin/env python3
"""Fail the daily job if a supported-host fund still has no official NAV."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import requests

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}

SUPPORTED = {
    "efgholding.com",
    "cicapital.com",
    "primeholdingco.com",
    "aaim.com.eg",
    "beltoneholding.com",
    "azimut.eg",
    "nicapital.com.eg",
    "hc-si.com",
    "pfi-am.com.eg",
    "granite.eg",
    "snduk.com",
    "w1.abkegypt.com",
    "zaldi-capital.com",
    "afim.com.eg",
}


def host_of(url):
    if not url or "://" not in url:
        return ""
    return url.split("/")[2].replace("www.", "")


def get(path, **params):
    r = requests.get(f"{BASE}/rest/v1/{path}", headers=H, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def main():
    funds = get("funds", select="fund_id,canonical_name,price_update_url", limit="1000")
    official = {r["fund_id"]: r for r in get("nav_official", select="fund_id,nav,as_of_date", limit="1000")}
    fail = []
    for f in funds:
        host = host_of(f.get("price_update_url") or "")
        if host not in SUPPORTED:
            continue
        off = official.get(f["fund_id"]) or {}
        if off.get("nav") is None:
            fail.append(f"{f['canonical_name']} [{host}] no nav")
    print(f"supported funds checked; failures={len(fail)}")
    for line in fail:
        print("FAIL", line)
    dest = Path("web/data/nav_coverage_gate.json")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps({"fail": fail, "count": len(fail)}, ensure_ascii=False, indent=2))
    if fail:
        sys.exit(1)


if __name__ == "__main__":
    main()
