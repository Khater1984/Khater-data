#!/usr/bin/env python3
"""Monthly CPI / deposits / T-bills ingest.

This job MUST write new observations when official pages are parseable.
It is not a reminder printer.

CPI convention in this project:
  cpi_headline_mom_pct = CBE urban headline month-on-month %
  cpi_core_mom_pct     = CBE core month-on-month %
  ts_date              = first day of the reference month

T-bills:
  tbill_91_avg_yield_pct / tbill_364_avg_yield_pct
  ts_date = auction session date
  value   = accepted weighted-average yield %

Deposit rates are published with a longer lag on JS-heavy CBE pages.
If they cannot be parsed, the job warns and still succeeds when CPI was written.
After the 12th of a month, missing previous-month CPI fails the job.
"""
from __future__ import annotations

import os
import re
import sys
from datetime import date, datetime, timezone

import requests

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}
UA = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

CPI_URL = "https://www.cbe.org.eg/en/economic-research/statistics/inflation-rates"
TBILL_URL = "https://www.cbe.org.eg/en/auctions/egp-t-bills"
RATES_URL = "https://www.cbe.org.eg/en/economic-research/statistics/interest-rates"

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}


def sb_get(path, **params):
    r = requests.get(f"{BASE}/rest/v1/{path}", headers=H, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def upsert(rows):
    if not rows:
        return 0
    r = requests.post(
        f"{BASE}/rest/v1/macro_series",
        headers={**H, "Prefer": "resolution=merge-duplicates,return=minimal"},
        params={"on_conflict": "series_key,ts_date"},
        json=rows,
        timeout=60,
    )
    if r.status_code not in (200, 201):
        print("upsert error", r.status_code, r.text[:400])
        return 0
    return len(rows)


def last(key):
    rows = sb_get("macro_series", series_key=f"eq.{key}", order="ts_date.desc", limit=1)
    return rows[0] if rows else None


def fetch(url):
    r = requests.get(url, headers=UA, timeout=40)
    print(f"GET {url} -> {r.status_code} bytes={len(r.text)}")
    if r.status_code != 200 or len(r.text) < 800:
        return ""
    if "Request Rejected" in r.text:
        print("WAF rejected", url)
        return ""
    return r.text


def parse_cpi(html):
    if not html:
        return []
    text = re.sub(r"\s+", " ", html)
    month = None
    for name, num in MONTHS.items():
        year_m = re.search(rf"\b{name}\b[^\.]{{0,40}}(20\d{{2}})", text, re.I)
        if year_m:
            month = date(int(year_m.group(1)), num, 1)
            break
    headline_mom = None
    core_mom = None
    block = re.search(
        r"Headline\s*\(m/m\)[^\d]{0,40}Core\s*\(m/m\).*?([+-]?\d+\.\d+)\s*%[^\d]{0,20}([+-]?\d+\.\d+)\s*%",
        text,
        re.I,
    )
    if block:
        headline_mom = float(block.group(1))
        core_mom = float(block.group(2))
    else:
        chunk = re.search(r"Headline\s*\(m/m\)(.{0,400})", text, re.I)
        if chunk:
            nums = [float(x) for x in re.findall(r"([+-]?\d+\.\d+)\s*%", chunk.group(1))]
            if len(nums) >= 2:
                headline_mom, core_mom = nums[0], nums[1]
    if month is None or headline_mom is None:
        print("CPI parse failed", "month", month, "headline", headline_mom)
        return []
    print(f"parsed CPI {month.isoformat()} headline_mom={headline_mom} core_mom={core_mom}")
    rows = [
        {
            "series_key": "cpi_headline_mom_pct",
            "ts_date": month.isoformat(),
            "value": headline_mom,
            "unit": "pct_mom",
            "source_id": "src_cpi_egypt_capmas_cbe",
            "raw": {
                "month_en": month.strftime("%B %Y"),
                "measure": "urban_headline_mom",
                "source_url": CPI_URL,
                "source_name": "Central Bank of Egypt — Inflation Rates",
            },
        }
    ]
    if core_mom is not None:
        rows.append(
            {
                "series_key": "cpi_core_mom_pct",
                "ts_date": month.isoformat(),
                "value": core_mom,
                "unit": "pct_mom",
                "source_id": "src_cpi_egypt_capmas_cbe",
                "raw": {
                    "month_en": month.strftime("%B %Y"),
                    "measure": "cbe_core_mom",
                    "source_url": CPI_URL,
                    "source_name": "Central Bank of Egypt — Inflation Rates",
                },
            }
        )
    return rows


def _parse_date(s):
    s = s.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_tbills(html):
    if not html:
        return []
    text = re.sub(r"\s+", " ", html)
    auction = None
    m = re.search(r"(Auction Date|Session Date|تاريخ الجلسة)\s*[:|]?\s*(\d{2}/\d{2}/\d{4})", text, re.I)
    if m:
        auction = _parse_date(m.group(2))
    rows = []
    for tenor, key in ((364, "tbill_364_avg_yield_pct"), (91, "tbill_91_avg_yield_pct")):
        pat = rf"\b{tenor}\b.{{0,240}}Weighted Avg(?:erage)?\.? Yield \(%\)\s*([0-9]+(?:\.[0-9]+)?)"
        mm = re.search(pat, text, re.I)
        if mm:
            val = float(mm.group(1))
        else:
            continue
        if not auction:
            continue
        isin_m = re.search(rf"(EGT[0-9A-Z]{{10,}}).{{0,80}}\b{tenor}\b", text)
        rows.append(
            {
                "series_key": key,
                "ts_date": auction,
                "value": val,
                "unit": "pct_annual_weighted_avg_yield",
                "source_id": "src_egp_tbills_auctions",
                "raw": {
                    "tenor_days": tenor,
                    "auction_date": auction,
                    "isin": isin_m.group(1) if isin_m else None,
                    "source_url": TBILL_URL,
                    "source_name": "CBE EGP T-Bills auction results",
                },
            }
        )
    print("parsed T-bills", [(r["series_key"], r["ts_date"], r["value"]) for r in rows])
    return rows


def expected_cpi_month(today: date) -> date:
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
    for key in (
        "cpi_headline_mom_pct",
        "cpi_core_mom_pct",
        "bank_deposit_1_3m_avg_pct",
        "bank_deposit_3_6m_avg_pct",
        "bank_deposit_6_12m_avg_pct",
        "tbill_91_avg_yield_pct",
        "tbill_364_avg_yield_pct",
    ):
        row = last(key)
        if row:
            print(f"BEFORE {key} last={row['ts_date']} value={row['value']}")
        else:
            print(f"BEFORE {key} EMPTY")

    cpi_rows = parse_cpi(fetch(CPI_URL))
    print("CPI upserted", upsert(cpi_rows))

    tbill_rows = parse_tbills(fetch(TBILL_URL))
    print("T-bill upserted", upsert(tbill_rows))

    rates_html = fetch(RATES_URL)
    if rates_html and re.search(r"weighted average.{0,40}deposit", rates_html, re.I):
        print("deposit table present — parser not yet mapped; leaving existing series untouched")
    else:
        print("deposit rates: official page not parseable this run — no invented values")

    headline = last("cpi_headline_mom_pct")
    need = expected_cpi_month(today)
    print(f"AFTER cpi_headline last={headline['ts_date'] if headline else None} need>={need.isoformat()}")
    if not headline or headline["ts_date"] < need.isoformat():
        print(
            "FAIL: CPI series is stale. "
            f"Need observation for {need.isoformat()} or later. "
            "CBE page likely blocked or unparsed."
        )
        sys.exit(1)
    print("monthly macro ingest done")


if __name__ == "__main__":
    main()
