#!/usr/bin/env python3
"""Recover PFI NAVs from the manager's current rendered funds page."""
from __future__ import annotations
import os,re
from datetime import datetime, timezone
import requests
from bs4 import BeautifulSoup
from scripts import ingest_nav_safe as safe_nav
BASE=os.environ["SUPABASE_URL"].rstrip("/"); KEY=os.environ["SUPABASE_SERVICE_KEY"]
H={"apikey":KEY,"Authorization":f"Bearer {KEY}","Content-Type":"application/json"}
URL="https://pfi-am.com.eg/funds/"; SID="src_pfi_funds"
MAP={'gig money market fund':'GIG Insurance','gig equity fund':'GIG Insurance - Egypt Fund I','mawared money market fund':'Housing & Development Bank (Mawared)','pfi cashi money market fund':'PFI Cashi'}
def get(path,**params):
 r=requests.get(f"{BASE}/rest/v1/{path}",headers=H,params=params,timeout=30); r.raise_for_status(); return r.json()
def post(path,payload,prefer='return=minimal'):
 r=requests.post(f"{BASE}/rest/v1/{path}",headers={**H,"Prefer":prefer},json=payload,timeout=30)
 if r.status_code>=400:
  raise requests.HTTPError(f"{r.status_code} {path}: {r.text[:500]}",response=r)
def main():
 html=requests.get(URL,headers={'User-Agent':'Mozilla/5.0'},timeout=40).text
 text=re.sub(r'\s+',' ',BeautifulSoup(html,'lxml').get_text(' ',strip=True))
 funds=get('funds',select='fund_id,canonical_name',active='eq.true',limit='1000'); by={f['canonical_name']:f for f in funds}
 existing={x['fund_id']:x for x in get('nav_official',select='fund_id,as_of_date',limit='5000')}; rows=[]
 for label,canon in MAP.items():
  m=re.search(re.escape(label)+r'.{0,1200}?NAV Per Certificate\s+([0-9,]+(?:\.[0-9]+)?)\s*\|\s*(\d{2}-\d{2}-\d{4})',text,re.I)
  if not m: continue
  nav=float(m.group(1).replace(',','')); dt=datetime.strptime(m.group(2),'%d-%m-%Y').date().isoformat(); f=by.get(canon)
  if not f: continue
  if (existing.get(f['fund_id']) or {}).get('as_of_date','') >= dt: continue
  rows.append({'run_id':'repair_'+datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S'),'extracted_name':label,'nav':nav,'currency':'EGP','as_of_date':dt,'source_url':URL,'source_id':SID,'fund_id':f['fund_id'],'canonical_name':canon,'match_status':'matched','match_score':1.0,'verification_status':'pending','raw':{'repair':'pfi_rendered_page'}})
 for r in rows:
  try:
   staged=post('nav_staging',r,'return=representation').json()
   if isinstance(staged,list) and staged:
    r['id']=staged[0].get('id')
   safe_nav.safe_upsert_official([r])
  except Exception as e:
   print('PFI promote FAIL', r.get('canonical_name'), getattr(e, 'response', None) and getattr(e.response, 'text', '')[:300] or e)
 print(f'PFI repair: {len(rows)} newer NAVs promoted from official source')
if __name__=='__main__': main()
