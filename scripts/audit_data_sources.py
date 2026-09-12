#!/usr/bin/env python3
"""Fail if browser runtime still consumes generated JSON financial snapshots.

Supabase is the sole runtime source of financial data. JSON files under web/data/
may remain as historical/build artifacts, but browser HTML/JS must not fetch,
import, or silently fall back to them.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"

# Detect explicit runtime references such as fetch("data/x.json"), imports,
# dynamic URLs, and the older ./data/x.json form.
patterns = [
    re.compile(r"[\"'](?:\./)?data/[^\"']+\.json[\"']", re.I),
    re.compile(r"fetch\s*\(\s*[`\"'][^`\"']+\.json", re.I),
    re.compile(r"import\s+[^;]*from\s*[\"'][^\"']+\.json[\"']", re.I),
]

refs: list[tuple[str, int, str]] = []
for path in list(WEB.glob("*.html")) + list((WEB / "js").rglob("*.js")):
    text = path.read_text(encoding="utf-8", errors="ignore")
    for lineno, line in enumerate(text.splitlines(), 1):
        if any(p.search(line) for p in patterns):
            refs.append((str(path.relative_to(ROOT)), lineno, line.strip()))

if refs:
    print("ERROR: browser runtime still references generated JSON snapshots:")
    for page, lineno, line in refs:
        print(f"  {page}:{lineno}: {line}")
    print("Migrate the consumer to web/js/data/* before deployment.")
    sys.exit(1)

print("generated_snapshot_runtime_references=0")
print("PASS: browser financial data is routed through the canonical data layer.")
