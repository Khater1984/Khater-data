#!/usr/bin/env python3
"""Repair NAV sources whose values live in JSON/RSC payloads.

Sources covered:
- Azimut official JSON API: last_nav.nav + last_nav.date
- Snduk official fund detail pages: currentPrice + lastPriceUpdate

Safety: no date => no promotion; source-published future dates are accepted
only inside the Phase 2 7-day window; older candidates never replace newer
official NAVs. Staging rows match the ingest_nav_safe contract (pending,
float match_score, compact raw) so a schema/enum mismatch cannot abort the
pipeline before the coverage gate.
"""
from __future__ import annotations

import os
import re
import sys
from datetime import date, datetime, timezone

import requests

from scripts import ingest_nav_safe as safe_nav

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
UA = {"User-Agent": "Mozilla/5.0 (compatible; KhaterNAV/1.0; +https://github.com/Khater1984/Khater-data)"}
RUN_ID = os.getenv("NAV_RUN_ID") or ("repair_dynamic_" + datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S"))
TODAY = date.today()
FUTURE_MAX_DAYS = 7

AZIMUT_ID = {
    1: "Bank ABC Fund I", 2: "Ebank Fund II", 3: "*Maashy", 4: "Ataa", 5: "Edkhar", 6: "AZ Foras",
    8: "Ebank Fund (El Khabeer)", 10: "Azimut Target Maturity Fund-Target 2027 USD", 11: "Bank Nxt Fund III (Sanady)",
    12: "Menthum", 14: "AZ Naser", 15: "AZ Value", 16: "AZ Gold", 17: "AZ Halan", 18: "AZ-Foras Shariah",
    19: "Azimut Target Maturity Fund-Target 2029 USD", 21: "AZ Thndr", 22: "Azimut Target Maturity Fund-Target 2030 USD", 23: "AZ-LV",
}


def get(path, **params):
    r = requests.get(f"{BASE}/rest/v1/{path}", headers=H, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def post(path, payload, prefer="return=minimal"):
    r = requests.post(f"{BASE}/rest/v1/{path}", headers={**H, "Prefer": prefer}, json=payload, timeout=30)
    if r.status_code >= 400:
        raise requests.HTTPError(f"{r.status_code} {path}: {r.text[:500]}", response=r)
    return r


def future_status(asof: str):
    if not asof:
        return False, "no_date"
    try:
        d = date.fromisoformat(asof)
    except ValueError:
        return False, "invalid_date"
    delta = (d - TODAY).days
    if delta <= 0:
        return True, "current_or_past"
    if delta <= FUTURE_MAX_DAYS:
        return True, "bounded_future"
    return False, "future_outside_window"


def staging_row(fid, name, nav, asof, source_id, source_url, canonical, raw, currency="EGP"):
    """Staging payload identical in contract to ingest_nav_safe.safe_row."""
    accepted, policy = future_status(asof)
    payload_raw = dict(raw or {})
    payload_raw.setdefault("phase2_date_policy", policy)
    payload_raw.setdefault("repair", True)
    return {
        "run_id": RUN_ID,
        "extracted_name": name,
        "nav": float(nav),
        "currency": currency or "EGP",
        "as_of_date": asof if accepted else (asof or None),
        "source_url": source_url,
        "source_id": source_id,
        "fund_id": fid,
        "canonical_name": canonical,
        "match_status": "matched",
        "match_score": 1.0,
        "verification_status": "pending",
        "raw": payload_raw,
    }, accepted, policy


def promote(fid, name, nav, asof, source_id, source_url, raw, funds, official, currency="EGP"):
    accepted, policy = future_status(asof)
    if not accepted:
        return "rejected_no_date" if policy == "no_date" else "rejected_future"
    existing = next((x for x in official if x["fund_id"] == fid), None)
    old = existing.get("as_of_date") if existing else None
    if old and old > asof:
        return "rejected_older"

    canonical = next((x["canonical_name"] for x in funds if x["fund_id"] == fid), name)
    staging, _, _ = staging_row(
        fid, name, nav, asof, source_id, source_url, canonical, raw, currency
    )
    try:
        staged_response = post("nav_staging", staging, prefer="return=representation")
        staged_response.raise_for_status()
        staged = staged_response.json()
        if isinstance(staged, list) and staged:
            staging["id"] = staged[0].get("id")
        ok, n = safe_nav.safe_upsert_official([staging])
        return "promoted" if ok and n else "failed"
    except requests.HTTPError as exc:
        print(f"promote FAIL {canonical} as_of={asof} nav={nav}: {exc}")
        return "failed"

def repair_azimut(funds, official):
    url = "https://app.azimut.eg/api/fund/list?size=100&web=true"
    r = requests.get(url, headers={**UA, "Accept": "application/json"}, timeout=40)
    r.raise_for_status()
    payload = r.json()
    items = ((payload.get("response") or {}).get("funds") or {}).get("dataList") or []
    by_name = {f["canonical_name"]: f for f in funds}
    done = {"seen": 0, "promoted": 0, "older": 0, "future": 0, "nodate": 0, "skipped": 0, "failed": 0}
    for item in items:
        done["seen"] += 1
        fid_num = item.get("id")
        last = item.get("last_nav") or {}
        nav = last.get("nav")
        asof = str(last.get("date") or "")[:10] or None
        if nav is None or not asof:
            done["nodate"] += 1
            continue
        accepted, policy = future_status(asof)
        if not accepted:
            if policy == "future_outside_window":
                done["future"] += 1
            else:
                done["nodate"] += 1
            continue
        label = AZIMUT_ID.get(fid_num)
        if not label:
            done["skipped"] += 1
            continue
        fund = by_name.get(label)
        if not fund:
            done["skipped"] += 1
            continue
        currency = (item.get("currency") or {}).get("symbol") or fund.get("currency") or "EGP"
        status = promote(
            fund["fund_id"], label, float(nav), asof, "src_azimut_funds", "https://azimut.eg/funds",
            {"api_id": fid_num, "nav": float(nav), "as_of_date": asof},
            funds, official, currency=currency,
        )
        if status == "promoted":
            done["promoted"] += 1
        elif status == "rejected_older":
            done["older"] += 1
        elif status == "rejected_future":
            done["future"] += 1
        elif status == "failed":
            done["failed"] += 1
    return done


def repair_snduk(funds, official):
    snduk_funds = [f for f in funds if "snduk.com" in (f.get("price_update_url") or "")]
    done = {"seen": 0, "promoted": 0, "older": 0, "future": 0, "nodate": 0, "failed": 0}
    for f in snduk_funds:
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
            nav = float(m_nav.group(1))
            asof = m_date.group(1)
            accepted, policy = future_status(asof)
            if not accepted:
                if policy == "future_outside_window":
                    done["future"] += 1
                else:
                    done["nodate"] += 1
                continue
            status = promote(
                f["fund_id"], f["canonical_name"], nav, asof,
                f.get("source_id") or "src_snduk", url,
                {"parser": "snduk_rsc", "currentPrice": nav, "lastPriceUpdate": asof},
                funds, official, currency=(f.get("currency") or "EGP"),
            )
            if status == "promoted":
                done["promoted"] += 1
            elif status == "rejected_older":
                done["older"] += 1
            elif status == "failed":
                done["failed"] += 1
        except Exception as exc:
            print(f"snduk FAIL {f.get('canonical_name')}: {type(exc).__name__}: {exc}")
            done["failed"] += 1
    return done


def main():
    funds = get("funds", select="fund_id,canonical_name,price_update_url,source_id,currency", active="eq.true", limit="1000")
    official = get("nav_official", select="fund_id,as_of_date", limit="5000")
    azimut_error = None
    snduk_error = None
    try:
        azimut = repair_azimut(funds, official)
        print("Azimut:", azimut)
    except Exception as exc:
        azimut_error = exc
        print(f"Azimut ERROR {type(exc).__name__}: {exc}")
        azimut = {"failed": 1}
    try:
        snduk = repair_snduk(funds, official)
        print("Snduk:", snduk)
    except Exception as exc:
        snduk_error = exc
        print(f"Snduk ERROR {type(exc).__name__}: {exc}")
        snduk = {"failed": 1}
    # Row-level HTTP failures are logged; they must not skip the coverage gate.
    # Only abort when a repair family could not run at all.
    if azimut_error and snduk_error:
        sys.exit(1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
