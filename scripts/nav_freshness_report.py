#!/usr/bin/env python3
"""Generate an explicit NAV freshness/provenance report without changing NAV data."""
from __future__ import annotations
import json, os
from datetime import date
from pathlib import Path
import requests
BASE=os.environ["SUPABASE_URL"].rstrip("/"); KEY=os.environ["SUPABASE_SERVICE_KEY"]
H={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
def get(path,**params):
    r=requests.get(f"{BASE}/rest/v1/{path}",headers=H,params=params,timeout=30); r.raise_for_status(); return r.json()
def host(url):
    return url.split('/')[2].replace('www.','') if url and '://' in url else ''
def main():
    funds=get('funds',select='fund_id,canonical_name,management_company,price_update_url',active='eq.true',limit='1000')
    nav=get('nav_official',select='fund_id,nav,as_of_date,source_id,verified_at,updated_at',limit='5000')
    by={x['fund_id']:x for x in nav}; today=date.today().isoformat(); rows=[]
    for f in funds:
        n=by.get(f['fund_id']) or {}; d=n.get('as_of_date'); rows.append({**f,'host':host(f.get('price_update_url') or ''),'nav':n.get('nav'),'as_of_date':d,'source_id':n.get('source_id'),'verified_at':n.get('verified_at'),'updated_at':n.get('updated_at'),'freshness_status':'NO_NAV' if n.get('nav') is None else ('CURRENT' if d==today else ('STALE' if d else 'NO_DATE'))})
    out={'check_date':today,'funds':len(rows),'current':sum(x['freshness_status']=='CURRENT' for x in rows),'stale':sum(x['freshness_status']=='STALE' for x in rows),'no_nav':sum(x['freshness_status']=='NO_NAV' for x in rows),'no_date':sum(x['freshness_status']=='NO_DATE' for x in rows),'rows':rows}
    p=Path('web/data/nav_freshness.json'); p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(out,ensure_ascii=False,indent=2)); print(json.dumps({k:out[k] for k in out if k!='rows'},ensure_ascii=False))
if __name__=='__main__': main()
