#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
service=(ROOT/'web/js/data/funds-service.js').read_text(encoding='utf-8')
screen=(ROOT/'web/js/funds-screen-v2.js').read_text(encoding='utf-8')
html=(ROOT/'web/funds.html').read_text(encoding='utf-8')
for token in ['getUniverse','getPerformanceSnapshot','getBenchmarks','evaluateBenchmarks','fund.canonicalPerformance','fund.evaluateBenchmarks','fund.getBenchmarks']:
    if token not in service: raise SystemExit(f'Funds contract failed: service missing {token}')
for token in ['F.getUniverse()','F.getPerformanceSnapshot(h)','B.getBatch(h)','benchmarkMatrix=evaluate(base,keys)','fund.html?id=']:
    if token not in screen: raise SystemExit(f'Funds contract failed: screen missing {token}')
for token in ['fund-service.js','funds-service.js','benchmark-service.js','funds-screen-v2.js']:
    if token not in html: raise SystemExit(f'Funds contract failed: funds.html missing {token}')
for forbidden in ['fund_performance_history','fund_price_history','/rest/v1/','window.KHATER_DATA.supabase','./data/','../data/','web/data/']:
    if forbidden in screen: raise SystemExit(f'Funds contract failed: UI bypasses canonical services via {forbidden}')
if 'seriesReturn(' in screen or 'nav /' in screen: raise SystemExit('Funds contract failed: browser-side financial return calculation detected')
print('Funds contract checks passed')
