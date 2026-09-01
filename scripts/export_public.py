#!/usr/bin/env python3
"""Export public snapshots for GitHub Pages from Supabase (service key in Actions)."""
from __future__ import annotations

import json
import os
from collections import defaultdict
from pathlib import Path

import requests

BASE = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
OUT = Path("web/data")
OUT.mkdir(parents=True, exist_ok=True)


def get(path, **params):
    rows, offset = [], 0
    while True:
        r = requests.get(
            f"{BASE}/rest/v1/{path}",
            headers=H,
            params={**params, "offset": offset, "limit": 1000},
            timeout=60,
        )
        r.raise_for_status()
        chunk = r.json()
        rows.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    return rows


def export_engine():
    keys = [
        "egx30_close",
        "usd_egp_mid",
        "btc_usd",
        "btc_egp",
        "spy_usd",
        "spy_egp",
        "qqq_usd",
        "qqq_egp",
        "gold_usd_oz",
        "gold_egp_oz",
        "silver_usd_oz",
        "silver_egp_oz",
        "cpi_headline_mom_pct",
        "cpi_core_mom_pct",
        "bank_deposit_1_3m_avg_pct",
        "tbill_91_avg_yield_pct",
        "tbill_364_avg_yield_pct",
    ]
    series = {}
    for key in keys:
        rows = get(
            "macro_series",
            select="ts_date,value",
            series_key=f"eq.{key}",
            ts_date="gte.2016-01-01",
            order="ts_date.asc",
        )
        series[key] = [[r["ts_date"], float(r["value"])] for r in rows]
        print(key, len(rows))
    funds = get("funds", select="fund_id,canonical_name,management_company,category,currency")
    nav = {n["fund_id"]: n for n in get("nav_official", select="fund_id,nav,currency,as_of_date")}
    out_funds = []
    for f in funds:
        n = nav.get(f["fund_id"])
        out_funds.append(
            {
                "id": f["fund_id"],
                "name": f["canonical_name"],
                "manager": f.get("management_company"),
                "category": f.get("category"),
                "currency": (n or f).get("currency"),
                "nav": None if not n else n["nav"],
                "as_of": None if not n else n["as_of_date"],
            }
        )
    payload = {"series": series, "funds": out_funds}
    (OUT / "engine_data.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def export_dna():
    funds = get(
        "funds",
        select="fund_id,canonical_name,management_company,category,currency,inception_date,metadata,price_update_url",
    )
    nav = {n["fund_id"]: n for n in get("nav_official", select="fund_id,nav,currency,as_of_date,source_url")}
    latest = get("fund_performance_history", select="report_date", order="report_date.desc")
    asof = latest[0]["report_date"] if latest else None
    perf_rows = (
        get(
            "fund_performance_history",
            select="fund_id,horizon,return_pct,nav_value,rank,report_date",
            report_date=f"eq.{asof}",
        )
        if asof
        else []
    )
    pmap = defaultdict(dict)
    for x in perf_rows:
        pmap[x["fund_id"]][x["horizon"]] = {"ret": x["return_pct"], "rank": x["rank"], "nav": x["nav_value"]}
        pmap[x["fund_id"]]["_asof"] = x["report_date"]
    out = []
    for f in funds:
        n = nav.get(f["fund_id"])
        p = pmap.get(f["fund_id"], {})
        meta = f.get("metadata") or {}
        out.append(
            {
                "id": f["fund_id"],
                "name": f["canonical_name"],
                "manager": f.get("management_company"),
                "category": f.get("category"),
                "currency": (n or {}).get("currency") or f.get("currency"),
                "inception": f.get("inception_date") or meta.get("inception_raw"),
                "initial": meta.get("initial_value"),
                "nav": None if not n else n["nav"],
                "nav_asof": None if not n else n["as_of_date"],
                "url": (n or {}).get("source_url") or f.get("price_update_url"),
                "eima": {k: v for k, v in p.items() if not str(k).startswith("_")},
                "eima_asof": p.get("_asof"),
            }
        )
    (OUT / "funds_dna.json").write_text(
        json.dumps({"as_of": asof, "funds": out}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print("dna", len(out), "eima", sum(1 for x in out if x["eima"]))


if __name__ == "__main__":
    export_engine()
    export_dna()
    print("exported")
