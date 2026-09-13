#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'web/map.html').read_text(encoding='utf-8')
page=(ROOT/'web/js/map-page.js').read_text(encoding='utf-8')
live=(ROOT/'web/js/live.js').read_text(encoding='utf-8')
for token in ['css/page-map.css','js/map-page.js']:
    if token not in html: raise SystemExit(f'Map contract failed: map.html missing {token}')
for token in ['loadEngine','mountPurchasingAccordion','toLine','rebase','LightweightCharts']:
    if token not in page: raise SystemExit(f'Map contract failed: map-page.js missing {token}')
for token in ['macro-service.js','window.KHATER_DATA.macro','loadEngine']:
    if token not in live: raise SystemExit(f'Map contract failed: live compatibility boundary missing {token}')
for forbidden in ['window.KHATER_DATA.supabase','supabase.from(','/rest/v1/','./data/','../data/','web/data/']:
    if forbidden in page: raise SystemExit(f'Map contract failed: page bypasses canonical data layer via {forbidden}')
if '<style>' in html or '<script>' in html and 'toLine(' in html: raise SystemExit('Map contract failed: page contains inline presentation/domain logic')
print('Map contract checks passed')
