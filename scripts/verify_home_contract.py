#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'web/index.html').read_text(encoding='utf-8')
controller=(ROOT/'web/js/home-page.js').read_text(encoding='utf-8')
required=['js/data/supabase-client.js','js/data/macro-service.js','js/data/funds-service.js','js/home-page.js']
for token in required:
    if token not in html: raise SystemExit(f'Home contract failed: missing {token}')
if '<script>' in html and 'getSeries(' in html: raise SystemExit('Home contract failed: inline data orchestration detected')
for forbidden in ['fund_performance_history','fund_price_history','/rest/v1/','window.KHATER_DATA.supabase','./data/','../data/','web/data/']:
    if forbidden in controller: raise SystemExit(f'Home contract failed: controller bypasses canonical services via {forbidden}')
for token in ["window.KHATER_DATA.macro.getSeries('usd_egp_mid')","window.KHATER_DATA.macro.getSeries('egx30_close')","window.KHATER_DATA.funds.getUniverse()"]:
    if token not in controller: raise SystemExit(f'Home contract failed: controller missing {token}')
print('Home contract checks passed')
