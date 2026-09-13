#!/usr/bin/env python3
"""Monthly CPI / deposits / T-bills ingest.

Retry Supabase 504s. Parse CBE T-bill multi-column results so each tenor
keeps its own auction date. Do not invent deposit rates.
"""
from __future__ import annotations

import os, re, sys, time
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
MONTHS = {"january":1,"february":2,"march":3,"april":4,"may":5,"june":6,"july":7,"august":8,"september":9,"october":10,"november":11,"december":12}
TENOR_KEY = {91: "tbill_91_avg_yield_pct", 364: "tbill_364_avg_yield_pct"}

def sb_get(path, **params):
    last_err = None
    for attempt in range(4):
        try:
            r = requests.get(f"{BASE}/rest/v1/{path}", headers=H, params=params, timeout=30)
            if r.status_code == 504:
                time.sleep(1.5 * (attempt + 1)); last_err = r; continue
            r.raise_for_status(); return r.json()
        except requests.RequestException as exc:
            last_err = exc; time.sleep(1.5 * (attempt + 1))
    if hasattr(last_err, "raise_for_status"): last_err.raise_for_status()
    raise last_err

def upsert(rows):
    if not rows: return 0
    r = requests.post(f"{BASE}/rest/v1/macro_series", headers={**H, "Prefer": "resolution=merge-duplicates,return=minimal"}, params={"on_conflict": "series_key,ts_date"}, json=rows, timeout=60)
    if r.status_code not in (200, 201):
        print("upsert error", r.status_code, r.text[:400]); return 0
    return len(rows)

def last(key):
    rows = sb_get("macro_series", series_key=f"eq.{key}", order="ts_date.desc", limit=1)
    return rows[0] if rows else None

def fetch(url):
    try:
        r = requests.get(url, headers=UA, timeout=40)
    except requests.RequestException as exc:
        print("GET failed", url, repr(exc)); return ""
    print(f"GET {url} -> {r.status_code} bytes={len(r.text)}")
    if r.status_code != 200 or len(r.text) < 800 or "Request Rejected" in r.text: return ""
    return r.text

def clean_text(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+", " ", html or ""))

def parse_cpi(html):
    if not html: return []
    text = clean_text(html)
    month = None
    for name, num in MONTHS.items():
        year_m = re.search(rf"\b{name}\b[^\.\d]{{0,40}}(20\d{{2}})", text, re.I)
        if year_m:
            month = date(int(year_m.group(1)), num, 1); break
    headline_mom = core_mom = None
    block = re.search(r"Headline\s*\(m/m\).*?([+-]?\d+\.\d+)\s*%.*?Core\s*\(m/m\).*?([+-]?\d+\.\d+)\s*%", text, re.I)
    if block: headline_mom, core_mom = float(block.group(1)), float(block.group(2))
    if month is None or headline_mom is None:
        print("CPI parse failed"); return []
    print(f"parsed CPI {month} headline_mom={headline_mom} core_mom={core_mom}")
    rows = [{"series_key":"cpi_headline_mom_pct","ts_date":month.isoformat(),"value":headline_mom,"unit":"pct_mom","source_id":"src_cpi_egypt_capmas_cbe","raw":{"source_url":CPI_URL}}]
    if core_mom is not None:
        rows.append({"series_key":"cpi_core_mom_pct","ts_date":month.isoformat(),"value":core_mom,"unit":"pct_mom","source_id":"src_cpi_egypt_capmas_cbe","raw":{"source_url":CPI_URL}})
    return rows

def _parse_date(s):
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try: return datetime.strptime(s.strip(), fmt).date().isoformat()
        except ValueError: pass
    return None

def parse_tbills(html):
    if not html: return []
    text = clean_text(html)
    header = re.search(r"Tenor\s*\(days\)\s*((?:\d+\s+){1,6})", text, re.I)
    dates_m = re.search(r"(?:Auction Date|Session Date|تاريخ الجلسة)\s*((?:\d{2}/\d{2}/\d{4}\s*){1,6})", text, re.I)
    acc = re.search(r"Accepted Bids(.{0,900}?)(?:View Historical|Announcement|$)", text, re.I)
    yields = []
    if acc:
        wa = list(re.finditer(r"Weighted Avg(?:erage)?\.?\s*(?:Yield|Rate)?\s*\(%\)\s*((?:\d+(?:\.\d+)?\s*){1,6})", acc.group(1), re.I))
        if wa: yields = [float(x) for x in re.findall(r"\d+(?:\.\d+)?", wa[-1].group(1))]
    if not header or not dates_m or not yields:
        print("T-bill parse incomplete", bool(header), bool(dates_m), yields); return []
    tenors = [int(x) for x in re.findall(r"\d+", header.group(1))]
    dates = [_parse_date(x) for x in re.findall(r"\d{2}/\d{2}/\d{4}", dates_m.group(1))]
    n = min(len(tenors), len(dates), len(yields))
    rows = []
    for i in range(n):
        key = TENOR_KEY.get(tenors[i])
        if not key or not dates[i]: continue
        rows.append({"series_key":key,"ts_date":dates[i],"value":yields[i],"unit":"pct_annual_weighted_avg_yield","source_id":"src_egp_tbills_auctions","raw":{"tenor_days":tenors[i],"auction_date":dates[i],"source_url":TBILL_URL}})
    print("parsed T-bills", [(r["series_key"], r["ts_date"], r["value"]) for r in rows])
    return rows

def parse_deposit_rates(html, source_url):
    if not html: return []
    text = clean_text(html).replace("&gt;", ">").replace("&lt;", "<").replace("&amp;", "&")
    m = re.search(r"(?:Weighted Average Interest Rates for|interest rates for)\s+([A-Za-z]{3,9})\s*[-–]\s*(20\d{2})", text, re.I)
    if not m:
        m = re.search(r"Weighted Average Interest Rates for\s+([A-Za-z]{3,9})\s+(20\d{2})", text, re.I)
    if not m: return []
    mon = MONTHS.get(m.group(1).lower())
    if not mon: return []
    ref_month = date(int(m.group(2)), mon, 1)
    patterns = [
        ("bank_deposit_1_3m_avg_pct", r">?\s*1\s*Month\s*<=\s*3\s*Months\s*\|?\s*([0-9]+(?:\.[0-9]+)?)\s*%"),
        ("bank_deposit_3_6m_avg_pct", r">?\s*3\s*Months\s*<=\s*6\s*Months\s*\|?\s*([0-9]+(?:\.[0-9]+)?)\s*%"),
        ("bank_deposit_6_12m_avg_pct", r">?\s*6\s*Months\s*<=\s*1\s*Year\s*\|?\s*([0-9]+(?:\.[0-9]+)?)\s*%"),
    ]
    found = []
    for key, pat in patterns:
        mm = re.search(pat, text, re.I)
        if mm: found.append((key, float(mm.group(1))))
    if len(found) != 3:
        print("deposit parse incomplete", ref_month, found); return []
    print("parsed CBE deposits", ref_month, found)
    return [{"series_key":key,"ts_date":ref_month.isoformat(),"value":value,"unit":"pct_monthly_weighted_average","source_id":"src_cbe_monthly_interest_rates","raw":{"reference_month":ref_month.strftime("%Y-%m"),"source_url":source_url,"method":"official_cbe"}} for key, value in found]

def expected_cpi_month(today):
    if today.day >= 12:
        y, m = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
        return date(y, m, 1)
    if today.month == 1: return date(today.year - 1, 11, 1)
    if today.month == 2: return date(today.year - 1, 12, 1)
    return date(today.year, today.month - 2, 1)

def main():
    today = datetime.now(timezone.utc).date()
    print("monthly macro ingest", datetime.now(timezone.utc).isoformat())
    for key in ("cpi_headline_mom_pct","cpi_core_mom_pct","bank_deposit_1_3m_avg_pct","bank_deposit_3_6m_avg_pct","bank_deposit_6_12m_avg_pct","tbill_91_avg_yield_pct","tbill_364_avg_yield_pct"):
        try:
            row = last(key)
            print(f"BEFORE {key} last={row['ts_date'] if row else None} value={row['value'] if row else None}")
        except Exception as exc:
            print(f"BEFORE {key} lookup failed {exc!r}")
    print("CPI upserted", upsert(parse_cpi(fetch(CPI_URL))))
    print("T-bill upserted", upsert(parse_tbills(fetch(TBILL_URL))))
    rates_html = fetch(RATES_URL)
    deposit_rows = parse_deposit_rates(rates_html, RATES_URL)
    if not deposit_rows:
        print("Primary CBE monthly page unavailable; trying Search Results fallback")
        deposit_rows = parse_deposit_rates(fetch(RATES_SEARCH_URL), RATES_SEARCH_URL)
    print("Deposit rates upserted", upsert(deposit_rows))
    headline = last("cpi_headline_mom_pct")
    need = expected_cpi_month(today)
    if not headline or headline["ts_date"] < need.isoformat():
        print(f"FAIL: CPI series stale. Need {need.isoformat()} or later"); sys.exit(1)
    print("monthly macro ingest done")

if __name__ == "__main__":
    main()
