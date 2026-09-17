#!/usr/bin/env python3
"""Repair NAV sources whose values live in JSON/RSC payloads.

Sources covered here:
- Azimut: official JSON API, last_nav.nav + last_nav.date
- Snduk: official fund detail pages, currentPrice + lastPriceUpdate

Safety rules:
- no source date => do not promote
- future source dates => reject
- never replace a newer official NAV with an older candidate
- every promoted candidate is also retained in nav_staging
"""
from __future__ import annotations

import json
import os
import re
from datetime import date, datetime, timezone
from difflib import SequenceMatcher

import requests
from bs4 import BeautifulSoup

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
UA = {"User-Agent": "Mozilla/5.0 (compatible; KhaterNAV/1.0; +https://github.com/Khater1984/Khater-data)"}
RUN_ID = "repair_dynamic_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
TODAY = date.today().isoformat()

AZIMUT_ID = {
    1: "Bank ABC Fund I", 2: "Ebank Fund II", 3: "*Maashy", 4: "Ataa", 5: "Edkhar",
    6: "AZ Foras", 8: "Ebank Fund (El Khabeer)", 10: "Azimut Target Maturity Fund-Target 2027 USD",
    11: "Bank Nxt Fund III (Sanady)", 12: "Menthum", 14: "AZ Naser", 15: "AZ Value",
    16: "AZ Gold", 17: "AZ Halan", 18: "AZ-Foras Shariah",
    19: "Azimut Target Maturity Fund-Target 2029 USD", 21: "AZ Thndr",
    22: "Azimut Target Maturity Fund-Target 2030 USD", 23: "AZ-LV",
}


def get(path, **params):
    r = requests.get(f"{BASE}/rest/v1/{path}", headers=H, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def post(path, payload):
    r = requests.post(f"{BASE}/rest/v1/{path}", headers={**H, "Prefer": "return=minimal"}, json=payload, timeout=30)
    r.raise_for_status()


def patch_official(fid, payload):
    r = requests.patch(
        f"{BASE}/rest/v1/nav_official?fund_id=eq.{fid}",
        headers={**H, "Prefer": "return=minimal"}, json=payload, timeout=30,
    )
    r.raise_for_status()


def norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", (s or "").lower())).strip()


def match_name(name, funds):
    n = norm(name)
    best, score = None, 0.0
    for f in funds:
        c = norm(f["canonical_name"])
        sc = 1.0 if n == c else SequenceMatcher(None, n, c).ratio()
        if n in c or c in n:
            sc = max(sc, 0.84)
        if sc > score:
            best, score = f, sc
    return (best, score) if score >= 0.84 else (None, score)


def promote(fid, name, nav, asof, source_id, source_url, raw):
    if not asof or asof > TODAY:
        return "rejected_future_or_no_date"
    existing = next((x for x in OFFICIAL if x["fund_id"] == fid), None)
    old = existing.get("as_of_date") if existing else None
    if old and old > asof:
        return "rejected_older"

    staging = {
        "run_id": RUN_ID, "extracted_name": name, "nav": nav, "currency": "EGP",
        "as_of_date": asof, "source_url": source_url, "source_id": source_id,
        "fund_id": fid, "canonical_name": next((x["canonical_name"] for x in FUNDS if x["fund_id"] == fid), name),
        "match_status": "matched", "match_score": 1, "verification_status": "verified",
        "raw": raw,
    }
    post("nav_staging", staging)
    patch_official(fid, {
        "nav": nav, "currency": "EGP", "as_of_date": asof, "source_id": source_id,
        "source_url": source_url, "verified_at": datetime.now(timezone.utc).isoformat(),
    })
    return "promoted"


def repair_azimut():
    url = "https://app.azimut.eg/api/fund/list?size=100&web=true"
    r = requests.get(url, headers={**UA, "Accept": "application/json"}, timeout=40)
    r.raise_for_status()
    payload = r.json()
    items = ((payload.get("response") or {}).get("funds") or {}).get("dataList") or []
    done = {"seen": 0, "promoted": 0, "older": 0, "future": 0, "nodate": 0}
    for item in items:
        done["seen"] += 1
        fid_num = item.get("id")
        last = item.get("last_nav") or {}
        nav = last.get("nav")
        asof = str(last.get("date") or "")[:10] or None
        if nav is None or not asof:
            done["nodate"] += 1
            continue
        if asof > TODAY:
            done["future"] += 1
            continue
        label = AZIMUT_ID.get(fid_num) or item.get("name") or item.get("fund_name") or str(fid_num)
        fund = next((f for f in FUNDS if f["canonical_name"] == label), None)
        score = 1.0 if fund else 0.0
        if not fund:
            fund, score = match_name(label, FUNDS)
        if not fund or score < 0.90:
            continue
        status = promote(fund["fund_id"], label, float(nav), asof, "src_azimut_funds", "https://azimut.eg/funds", {"api_id": fid_num, "last_nav": last})
        if status == "promoted": done["promoted"] += 1
        elif status == "rejected_older": done["older"] += 1
    return done


def repair_snduk():
    funds = [f for f in FUNDS if "snduk.com" in (f.get("price_update_url") or "")]
    done = {"seen": 0, "promoted": 0, "older": 0, "future": 0, "nodate": 0, "failed": 0}
    for f in funds:
        done["seen"] += 1
        url = f["price_update_url"]
        try:
            html = requests.get(url, headers=UA, timeout=40).text
            m_nav = re.search(r'currentPrice(?:\\"|\")\s*:\s*(?:\\"|\")([0-9]+(?:\.[0-9]+)?)', html)
            m_date = re.search(r'lastPriceUpdate(?:\\"|\")\s*:\s*(?:\\"|\")([0-9]{4}-[0-9]{2}-[0-9]{2})', html)
            if not m_nav:
                m_nav = re.search(r'currentPrice\\?":\\?"([0-9]+(?:\.[0-9]+)?)', html)
            if not m_date:
                m_date = re.search(r'lastPriceUpdate\\?":\\?"([0-9]{4}-[0-9]{2}-[0-9]{2})', html)
            if not m_nav or not m_date:
                done["nodate"] += 1
                continue
            nav = float(m_nav.group(1)); asof = m_date.group(1)
            if asof > TODAY:
                done["future"] += 1
                continue
            status = promote(f["fund_id"], f["canonical_name"], nav, asof, f.get("source_id") or "src_snduk", url, {"parser": "snduk_rsc", "currentPrice": nav, "lastPriceUpdate": asof})
            if status == "promoted": done["promoted"] += 1
            elif status == "rejected_older": done["older"] += 1
        except Exception:
            done["failed"] += 1
    return done


FUNDS = get("funds", select="fund_id,canonical_name,price_update_url,source_id", active="eq.true", limit="1000")
OFFICIAL = get("nav_official", select="fund_id,as_of_date", limit="5000")

if __name__ == "__main__":
    print("Azimut:", repair_azimut())
    print("Snduk:", repair_snduk())
