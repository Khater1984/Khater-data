#!/usr/bin/env python3
"""Monthly CPI / deposits / T-bills ingest.

Deposit rates use the official CBE Monthly Interest Rates page as primary source,
with the CBE official Search Results index as a fallback when the JS-heavy page
is WAF-blocked. No bank-site scraping, interpolation, or guessed values.
"""
from __future__ import annotations

import os
import re
import sys
from datetime import date, datetime, timezone

import requests

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36", "Accept-Language": "en-US,en;q=0.9"}

CPI_URL = "https://www.cbe.org.eg/en/economic-research/statistics/inflation-rates"
TBILL_URL = "https://www.cbe.org.eg/en/auctions/egp-t-bills"
RATES_URL = "https://www.cbe.org.eg/en/economic-research/statistics/monthly-interest-rates"
RATES_SEARCH_URL = "https://www.cbe.org.eg/en/Search-Results?query=Monthly%20Interest%20Rates"

MONTHS = {"january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6, "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12}


def sb_get(path, **params):
    r = requests.get(f"{BASE}/rest/v1/{path}", headers=H, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def upsert(rows):
    if not rows:
        return 0
    r = requests.post(f"{BASE}/rest/v1/macro_series", headers={**H, "Prefer": "resolution=merge-duplicates,return=minimal"}, params={"on_conflict": "series_key,ts_date"}, json=rows, timeout=60)
    if r.status_code not in (200, 201):
        print("upsert error", r.status_code, r.text[:400])
        return 0
    return len(rows)


def last(key):
    rows = sb_get("macro_series", series_key=f"eq.{key}", order="ts_date.desc", limit=1)
    return rows[0] if rows else None


def fetch(url):
    try:
        r = requests.get(url, headers=UA, timeout=40)
    except requests.RequestException as exc:
        print("GET failed", url, repr(exc))
        return ""
    print(f"GET {url} -> {r.status_code} bytes={len(r.text)}")
    if r.status_code != 200 or len(r.text) < 800 or "Request Rejected" in r.text:
        return ""
    return r.text


def clean_text(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or ""))


def parse_cpi(html):
    if not html:
        return []
    text = clean_text(html)
    month = None
    for name, num in MONTHS.items():
        year_m = re.search(rf"\b{name}\b[^\.\d]{{0,40}}(20\d{{2}})", text, re.I)
        if year_m:
            month = date(int(year_m.group(1)), num, 1)
            break
    headline_mom = core_mom = None
    block = re.search(r"Headline\s*\(m/m\).*?([+-]?\d+\.\d+)\s*%.*?Core\s*\(m/m\).*?([+-]?\d+\.\d+)\s*%", text, re.I)
    if block:
        headline_mom, core_mom = float(block.group(1)), float(block.group(2))
    if month is None or headline_mom is None:
        return []
    rows = [{"series_key":"cpi_headline_mom_pct","ts_date":month.isoformat(),"value":headline_mom,"unit":"pct_mom","source_id":"src_cpi_egypt_capmas_cbe","raw":{"source_url":CPI_URL}}]
    if core_mom is not None:
        rows.append({"series_key":"cpi_core_mom_pct","ts_date":month.isoformat(),"value":core_mom,"unit":"pct_mom","source_id":"src_cpi_egypt_capmas_cbe","raw":{"source_url":CPI_URL}})
    return rows


def _parse_date(s):
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(s.strip(), fmt).date().isoformat()
        except ValueError:
            pass
    return None


def parse_tbills(html):
    if not html:
        return []
    text = clean_text(html)
    m = re.search(r"(?:Auction Date|Session Date|تاريخ الجلسة)\s*[:|]?\s*(\d{2}/\d{2}/\d{4})", text, re.I)
    auction = _parse_date(m.group(1)) if m else None
    if not auction:
        return []
    rows = []
    for tenor, key in ((364, "tbill_364_avg_yield_pct"), (91, "tbill_91_avg_yield_pct")):
        mm = re.search(rf"\b{tenor}\b.{{0,240}}Weighted Avg(?:erage)?\.? Yield \(%\)\s*([0-9]+(?:\.[0-9]+)?)", text, re.I)
        if mm:
            rows.append({"series_key":key,"ts_date":auction,"value":float(mm.group(1)),"unit":"pct_annual_weighted_avg_yield","source_id":"src_egp_tbills_auctions","raw":{"tenor_days":tenor,"auction_date":auction,"source_url":TBILL_URL}})
    return rows


def parse_deposit_rates(html, source_url):
    """Parse the three official CBE EGP deposit tenors from rendered or indexed text."""
    if not html:
        return []
    text = clean_text(html)
    # Accept both rendered labels and HTML-escaped search snippets.
    text = (text.replace("&gt;", ">").replace("&lt;", "<").replace("&amp;", "&"))
    m = re.search(r"(?:Weighted Average Interest Rates for|interest rates for)\s+([A-Za-z]{3,9})\s*[-–]\s*(20\d{2})", text, re.I)
    if not m:
        m = re.search(r"Weighted Average Interest Rates for\s+([A-Za-z]{3,9})\s+(20\d{4})", text, re.I)
    if not m:
        return []
    mon = MONTHS.get(m.group(1).lower())
    if not mon:
        return []
    year = int(m.group(2))
    ref_month = date(year, mon, 1)

    patterns = [
        ("bank_deposit_1_3m_avg_pct", r">?\s*1\s*Month\s*<=\s*3\s*Months\s*\|?\s*([0-9]+(?:\.[0-9]+)?)\s*%"),
        ("bank_deposit_3_6m_avg_pct", r">?\s*3\s*Months\s*<=\s*6\s*Months\s*\|?\s*([0-9]+(?:\.[0-9]+)?)\s*%"),
        ("bank_deposit_6_12m_avg_pct", r">?\s*6\s*Months\s*<=\s*1\s*Year\s*\|?\s*([0-9]+(?:\.[0-9]+)?)\s*%"),
    ]
    found = []
    for key, pat in patterns:
        mm = re.search(pat, text, re.I)
        if mm:
            found.append((key, float(mm.group(1))))
    if len(found) != 3:
        print("deposit parse incomplete", ref_month, found)
        return []
    print("parsed CBE deposits", ref_month, found)
    return [{"series_key":key,"ts_date":ref_month.isoformat(),"value":value,"unit":"pct_monthly_weighted_average","source_id":"src_cbe_monthly_interest_rates","raw":{"reference_month":ref_month.strftime("%Y-%m"),"source_url":source_url,"source_name":"Central Bank of Egypt — Monthly Interest Rates","method":"official_cbe"}} for key, value in found]


def expected_cpi_month(today):
    if today.day >= 12:
        y, m = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
        return date(y, m, 1)
    if today.month == 1:
        return date(today.year - 1, 11, 1)
    if today.month == 2:
        return date(today.year - 1, 12, 1)
    return date(today.year, today.month - 2, 1)


def main():
    today = datetime.now(timezone.utc).date()
    print("monthly macro ingest", datetime.now(timezone.utc).isoformat())
    for key in ("cpi_headline_mom_pct","cpi_core_mom_pct","bank_deposit_1_3m_avg_pct","bank_deposit_3_6m_avg_pct","bank_deposit_6_12m_avg_pct","tbill_91_avg_yield_pct","tbill_364_avg_yield_pct"):
        row = last(key)
        print(f"BEFORE {key} last={row['ts_date'] if row else None} value={row['value'] if row else None}")

    cpi_rows = parse_cpi(fetch(CPI_URL))
    print("CPI upserted", upsert(cpi_rows))
    tbill_rows = parse_tbills(fetch(TBILL_URL))
    print("T-bill upserted", upsert(tbill_rows))

    rates_html = fetch(RATES_URL)
    deposit_rows = parse_deposit_rates(rates_html, RATES_URL)
    if not deposit_rows:
        print("Primary CBE monthly page unavailable/unparseable; trying official CBE Search Results fallback")
        rates_html = fetch(RATES_SEARCH_URL)
        deposit_rows = parse_deposit_rates(rates_html, RATES_SEARCH_URL)
    print("Deposit rates upserted", upsert(deposit_rows))
    if not deposit_rows:
        print("Deposit rates: no official CBE value parsed this run; existing series left untouched")

    # Guard against accidental stale/partial writes: all three tenors must share one reference month.
    latest = [last(k) for k in ("bank_deposit_1_3m_avg_pct","bank_deposit_3_6m_avg_pct","bank_deposit_6_12m_avg_pct")]
    if latest and all(latest) and len({r["ts_date"] for r in latest}) == 1:
        print("DEPOSIT SERIES OK", latest[0]["ts_date"], [r["value"] for r in latest])
    else:
        print("DEPOSIT SERIES WARNING: tenors are not synchronized; no guessing performed")

    headline = last("cpi_headline_mom_pct")
    need = expected_cpi_month(today)
    if not headline or headline["ts_date"] < need.isoformat():
        print(f"FAIL: CPI series stale. Need {need.isoformat()} or later")
        sys.exit(1)
    print("monthly macro ingest done")

if __name__ == "__main__":
    main()
