#!/usr/bin/env python3
"""Daily macro reference ingest into public.macro_series.

Does not rewrite history: upserts only by (series_key, ts_date).
USD-denominated series are converted to EGP with usd_egp_mid (same date,
else last known mid).
"""
from __future__ import annotations

import os
import re
import time
from datetime import datetime, timezone

import requests

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
}
UA = {
    "User-Agent": "Mozilla/5.0 (compatible; KhaterMacro/1.0; +https://github.com/Khater1984/Khater-data)"
}


def sb_get(path, **params):
    r = requests.get(f"{BASE}/rest/v1/{path}", headers=H, params=params, timeout=30)
    r.raise_for_status()
    return r.json()


def upsert_rows(rows):
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
        print("upsert error", r.status_code, r.text[:300])
        return 0
    return len(rows)


def last_mid():
    rows = sb_get(
        "macro_series",
        series_key="eq.usd_egp_mid",
        order="ts_date.desc",
        limit=1,
    )
    if not rows:
        return None, None
    return rows[0]["ts_date"], float(rows[0]["value"])


def yahoo_daily(symbol, n=8, range_days=10):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
    r = requests.get(
        url,
        headers=UA,
        params={"interval": "1d", "range": f"{range_days}d"},
        timeout=30,
    )
    r.raise_for_status()
    result = r.json()["chart"]["result"][0]
    ts = result["timestamp"]
    closes = result["indicators"]["quote"][0]["close"]
    out = []
    for t, c in zip(ts, closes):
        if c is None:
            continue
        day = datetime.fromtimestamp(t, tz=timezone.utc).date().isoformat()
        out.append((day, float(c)))
    return out[-n:]


def parse_cbe_mid(html):
    # Buy/Sell table: US Dollar first
    m = re.search(
        r"US Dollar.*?([\d.]+).*?([\d.]+)",
        re.sub(r"\s+", " ", html),
        re.I,
    )
    if not m:
        return None
    buy, sell = float(m.group(1)), float(m.group(2))
    return (buy + sell) / 2.0, buy, sell


def fetch_cbe():
    urls = [
        "https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates",
        "https://www.cbe.org.eg/en/economic-research/statistics/exchange-rates",
    ]
    for url in urls:
        try:
            r = requests.get(url, headers=UA, timeout=30)
            if r.status_code != 200 or len(r.text) < 500:
                continue
            parsed = parse_cbe_mid(r.text)
            if parsed:
                mid, buy, sell = parsed
                today = datetime.now(timezone.utc).date().isoformat()
                return [
                    {
                        "series_key": "usd_egp_mid",
                        "ts_date": today,
                        "value": round(mid, 4),
                        "unit": "EGP_per_USD",
                        "source_id": "src_usd_egp_cbe_style",
                        "raw": {"buy": buy, "sell": sell, "url": url},
                    }
                ]
        except Exception as e:
            print("cbe", type(e).__name__, e)
    return []


def fetch_egp_yahoo_fallback():
    try:
        pts = yahoo_daily("EGP=X")
    except Exception as e:
        print("EGP=X", type(e).__name__, e)
        return []
    return [
        {
            "series_key": "usd_egp_mid",
            "ts_date": d,
            "value": round(v, 4),
            "unit": "EGP_per_USD",
            "source_id": "src_usd_egp_cbe_style",
            "raw": {"yahoo": "EGP=X", "note": "fallback if CBE page blocked"},
        }
        for d, v in pts
    ]


def fetch_egx30():
    """Fetch EGX30 daily closes from Yahoo Finance (^CASE30), with EGX official fallback."""
    try:
        pts = yahoo_daily("^CASE30", n=15, range_days=30)
        if pts:
            return [
                {
                    "series_key": "egx30_close",
                    "ts_date": d,
                    "value": float(v),
                    "unit": "index_points",
                    "source_id": "src_egx30_yahoo_case30",
                    "raw": {"yahoo": "^CASE30", "note": "EGX30 Price Return Index; daily close"},
                }
                for d, v in pts
            ]
    except Exception as e:
        print("egx yahoo", type(e).__name__, e)

    # Fallback to the Egyptian Exchange page if Yahoo is unavailable.
    url = "https://www.egx.com.eg/en/indexdata.aspx?type=1"
    try:
        r = requests.get(url, headers=UA, timeout=40)
        html = r.text
        pairs = re.findall(
            r"(\d{2}/\d{2}/\d{4})\s+([\d,]+\.\d+)",
            html,
        )
        rows = []
        seen = set()
        for ds, vs in pairs[:15]:
            d = datetime.strptime(ds, "%d/%m/%Y").date().isoformat()
            if d in seen:
                continue
            seen.add(d)
            rows.append(
                {
                    "series_key": "egx30_close",
                    "ts_date": d,
                    "value": float(vs.replace(",", "")),
                    "unit": "index_points",
                    "source_id": "src_egx30_reference",
                    "raw": {"url": url, "note": "EGX official fallback"},
                }
            )
        if rows:
            return rows
    except Exception as e:
        print("egx official", type(e).__name__, e)
    return []


USD_MAP = [
    ("SPY", "spy_usd", "src_spy_usd_yahoo", "USD"),
    ("QQQ", "qqq_usd", "src_qqq_usd_yahoo", "USD"),
    ("BTC-USD", "btc_usd", "src_btc_usd_cbbtcusd", "USD"),
    ("GC=F", "gold_usd_oz", "src_gold_usd_worldbank_datahub", "USD_per_oz"),
    ("SI=F", "silver_usd_oz", "src_silver_usd_yahoo_sif", "USD_per_oz"),
]

EGP_MAP = {
    "spy_usd": ("spy_egp", "src_spy_egp_derived"),
    "qqq_usd": ("qqq_egp", "src_qqq_egp_derived"),
    "btc_usd": ("btc_egp", "src_btc_egp_derived"),
    "gold_usd_oz": ("gold_egp_oz", "src_gold_egp_derived"),
    "silver_usd_oz": ("silver_egp_oz", "src_silver_egp_derived"),
}


def mid_on(date, cache, last):
    if date in cache:
        return cache[date]
    return last


def main():
    print("macro ingest start")
    fx = fetch_cbe()
    if not fx:
        print("CBE page unavailable — Yahoo EGP=X fallback")
        fx = fetch_egp_yahoo_fallback()
    n = upsert_rows(fx)
    print("usd_egp_mid rows", n)

    egx = fetch_egx30()
    print("egx30 rows", upsert_rows(egx))

    usd_rows = []
    for symbol, key, sid, unit in USD_MAP:
        try:
            pts = yahoo_daily(symbol)
            print(symbol, len(pts))
            for d, v in pts:
                usd_rows.append(
                    {
                        "series_key": key,
                        "ts_date": d,
                        "value": float(v),
                        "unit": unit,
                        "source_id": sid,
                        "raw": {"yahoo": symbol},
                    }
                )
            time.sleep(0.4)
        except Exception as e:
            print(symbol, "ERROR", type(e).__name__, e)
    print("usd series", upsert_rows(usd_rows))

    mid_rows = sb_get(
        "macro_series",
        series_key="eq.usd_egp_mid",
        order="ts_date.desc",
        limit=30,
    )
    mid_cache = {r["ts_date"]: float(r["value"]) for r in mid_rows}
    _, last = last_mid()
    egp_rows = []
    for row in usd_rows:
        pair = EGP_MAP.get(row["series_key"])
        if not pair:
            continue
        ekey, esid = pair
        mid = mid_on(row["ts_date"], mid_cache, last)
        if mid is None:
            continue
        egp_rows.append(
            {
                "series_key": ekey,
                "ts_date": row["ts_date"],
                "value": float(row["value"]) * mid,
                "unit": "EGP",
                "source_id": esid,
                "raw": {"usd": row["value"], "usd_egp_mid": mid, "fx_date": row["ts_date"] if row["ts_date"] in mid_cache else "ffill"},
            }
        )
    print("egp derived", upsert_rows(egp_rows))
    print("macro ingest done")


if __name__ == "__main__":
    main()
