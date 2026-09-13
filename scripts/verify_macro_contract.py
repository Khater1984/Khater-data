#!/usr/bin/env python3
"""Static contract: Macro domain owns data access and financial derivations; screen only renders."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
service=(ROOT/'web/js/data/macro-service.js').read_text(encoding='utf-8')
screen=(ROOT/'web/js/macro-screen-v2.js').read_text(encoding='utf-8')
html=(ROOT/'web/macro.html').read_text(encoding='utf-8')
for token in ['getSeries','getAll','buildView','deriveSeries','keysForMode','public.macro_series']:
    if token not in service: raise SystemExit(f'Macro contract failed: service missing {token}')
for token in ['svc.getAll()','svc.buildView(state.data,state.mode)','svc.rangeText']:
    if token not in screen: raise SystemExit(f'Macro contract failed: controller missing {token}')
for forbidden in ['/rest/v1/','window.KHATER_DATA.supabase','macro_series?','index100(','purchasingPower(']:
    if forbidden in screen: raise SystemExit(f'Macro contract failed: screen owns domain/data logic: {forbidden}')
for token in ['js/data/supabase-client.js','js/data/macro-service.js','js/macro-screen-v2.js']:
    if token not in html: raise SystemExit(f'Macro contract failed: macro.html missing {token}')
print('Macro contract checks passed')
