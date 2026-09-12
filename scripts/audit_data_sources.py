#!/usr/bin/env python3
"""Inventory browser references to generated JSON snapshots.

This is intentionally an audit, not an immediate ban: some snapshots are still
used by legacy/fallback flows while pages migrate to the canonical data layer.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'web'
refs: list[tuple[str, str]] = []
pattern = re.compile(r'[\"\'](?:\./)?data/([^\"\']+\.json)[\"\']')
for path in list(WEB.glob('*.html')) + list((WEB / 'js').rglob('*.js')):
    text = path.read_text(encoding='utf-8', errors='ignore')
    for name in pattern.findall(text):
        refs.append((str(path.relative_to(ROOT)), name))

for page, name in sorted(set(refs)):
    print(f'{page}: web/data/{name}')
print(f'generated_snapshot_references={len(set(refs))}')
