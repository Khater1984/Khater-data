#!/usr/bin/env python3
"""Repair only provable NAV integrity issues before public export.

Uses retained nav_staging history to prevent an older candidate from replacing
a newer official NAV. It never invents NAV values or source dates.
"""
from __future__ import annotations
import os, sys
from datetime import date, datetime, timezone
import requests
BASE=os.environ["SUPABASE_URL"].rstrip("/"); KEY=os.environ["SUPABASE_SERVICE_KEY"]
H={"apikey":KEY,"Authorization":f"Bearer {KEY}","Content-Type":"application/json"}
def get(path,**params):
    r=requests.get(f"{BASE}/rest/v1/{path}",headers=H,params=params,timeout=30); r.raise_for_status(); return r.json()
def patch(fid,payload):
    r=requests.patch(f"{BASE}/rest/v1/nav_official?fund_id=eq.{fid}",headers={**H,"Prefer":"return=minimal"},json=payload,timeout=30); r.raise_for_status()
def main():
    official=get('nav_official',select='fund_id,nav,as_of_date,source_id,source_url',limit='5000')
    staging=get('nav_staging',select='fund_id,nav,as_of_date,source_id,source_url,verification_status',fund_id='not.is.null',limit='20000')
    latest={}
    for r in staging:
        d=r.get('as_of_date')
        if not d or d>date.today().isoformat() or r.get('nav') is None: continue
        fid=r.get('fund_id')
        if not fid: continue
        if fid not in latest or d>latest[fid].get('as_of_date',''):
            latest[fid]=r
    repaired=0; future=0
    for o in official:
        d=o.get('as_of_date')
        if d and d>date.today().isoformat():
            future+=1
            continue
        n=latest.get(o['fund_id'])
        if n and n.get('as_of_date') and (not d or n['as_of_date']>d):
            patch(o['fund_id'],{'nav':n['nav'],'as_of_date':n['as_of_date'],'source_id':n.get('source_id'),'source_url':n.get('source_url'),'verified_at':datetime.now(timezone.utc).isoformat()})
            repaired+=1
    print(f'NAV integrity: repaired_older_official={repaired} future_official={future}')
    if future: sys.exit(1)
if __name__=='__main__': main()
