#!/usr/bin/env python3
"""Baseline checks for the static platform before the foundation rebuild."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
errors: list[str] = []

required = [
    WEB / "index.html",
    WEB / "funds.html",
    WEB / "fund.html",
    WEB / "categories.html",
    WEB / "macro.html",
    WEB / "map.html",
    WEB / "why.html",
    WEB / "config.js",
    WEB / "css/header.css",
]
for path in required:
    if not path.is_file() or path.stat().st_size == 0:
        errors.append(f"missing or empty required file: {path.relative_to(ROOT)}")

for path in (WEB / "data").glob("*.json"):
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"invalid JSON {path.relative_to(ROOT)}: {exc}")

for html in WEB.glob("*.html"):
    text = html.read_text(encoding="utf-8")
    for ref in re.findall(r'(?:(?:src|href)=["\'])([^"\']+)', text):
        if ref.startswith(("http://", "https://", "#", "mailto:", "data:")) or "${" in ref or "encodeURIComponent" in ref:
            continue
        local = (html.parent / ref.split("?", 1)[0].split("#", 1)[0]).resolve()
        if not local.is_file():
            errors.append(f"missing local asset in {html.name}: {ref}")

config = (WEB / "config.js").read_text(encoding="utf-8")
if "SUPABASE_SERVICE_KEY" in config or "service_role" in config:
    errors.append("service key marker found in browser config")

if errors:
    print("BASELINE FAILED")
    print("\n".join(f"- {error}" for error in errors))
    sys.exit(1)

print("BASELINE OK")
print(f"checked_pages={len(list(WEB.glob('*.html')))}")
print(f"checked_json={len(list((WEB / 'data').glob('*.json')))}")
