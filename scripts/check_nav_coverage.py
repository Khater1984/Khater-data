#!/usr/bin/env python3
"""Validate NAV coverage without confusing historical data with freshness."""
from __future__ import annotations
import json, os, sys
from datetime import date
from pathlib import Path
import requests
BASE=os.environ["SUPABASE_URL"].rstrip("/"); KEY=os.environ["SUPABASE_SERVICE_KEY"]
H={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
SUPPORTED={"efgholding.com","cicapital.com","primeholdingco.com","aaim.com.eg","beltoneholding.com","azimut.eg","nicapital.com.eg","hc-si.com","pfi-am.com.eg","granite.eg","snduk.com","w1.abkegypt.com","zaldi-capital.com","afim.com.eg","nbk.com"}
def host_of(url):
    if not url or "://" not in url: return ""
    return url.split("/")[2].replace("www.","")
def get(path,**params):
    r=requests.get(f"{BASE}/rest/v1/{path}",headers=H,params=params,timeout=30); r.raise_for_status(); return r.json()
def main():
    funds=get("funds",select="fund_id,canonical_name,price_update_url",active="eq.true",limit="1000")
    official=get("nav_official",select="fund_id,nav,as_of_date,source_id,verified_at,updated_at",limit="5000")
    by={r["fund_id"]:r for r in official}; today=date.today().isoformat(); rows=[]; fail=[]
    for f in funds:
        host=host_of(f.get("price_update_url") or ""); off=by.get(f["fund_id"]) or {}; nav=off.get("nav"); d=off.get("as_of_date")
        if host not in SUPPORTED: status="UNSUPPORTED_HOST" if nav is None else "OK_UNSUPPORTED_HOST"
        elif nav is None: status="FAIL_NO_NAV"; fail.append(f"{f['canonical_name']} [{host}] no nav")
        elif not d: status="FAIL_NO_DATE"; fail.append(f"{f['canonical_name']} [{host}] nav without as_of_date")
        elif d > today: status="FAIL_FUTURE_DATE"; fail.append(f"{f['canonical_name']} [{host}] as_of={d} > {today}")
        elif d < today: status="STALE"
        else: status="CURRENT"
        rows.append({"fund_id":f["fund_id"],"name":f.get("canonical_name"),"host":host,"status":status,"nav":nav,"as_of_date":d,"source_id":off.get("source_id"),"verified_at":off.get("verified_at"),"updated_at":off.get("updated_at")})
    out={"as_of_check_date":today,"funds":len(funds),"current":sum(x["status"]=="CURRENT" for x in rows),"stale":sum(x["status"]=="STALE" for x in rows),"fail":len(fail),"unsupported":sum(x["status"]=="UNSUPPORTED_HOST" for x in rows),"rows":rows}
    p=Path("web/data/nav_coverage_gate.json"); p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(out,ensure_ascii=False,indent=2))
    print(f"coverage current={out['current']} stale={out['stale']} fail={out['fail']} unsupported={out['unsupported']}")
    for x in fail: print("FAIL",x)
    if fail: sys.exit(1)
if __name__=="__main__": main()
