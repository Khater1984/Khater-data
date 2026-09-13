#!/usr/bin/env python3
"""Audit repeated Fund Detail design values without rewriting CSS.

This is intentionally an audit-only guard: it reports high-frequency visual
literals so consolidation can be done deliberately instead of heuristically.
"""
from collections import Counter
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT / "web/css/fund.css", ROOT / "web/css/fund-chart.css", ROOT / "web/css/fund-price.css", ROOT / "web/css/fund-profile.css"]

text = "\n".join(p.read_text(encoding="utf-8") for p in FILES if p.exists())

checks = {
    "border-radius": r"border-radius:\s*([^;}{]+)",
    "spacing": r"(?:padding|margin|gap):\s*([^;}{]+)",
}

print("FUND DETAIL CSS TOKEN AUDIT")
for name, pattern in checks.items():
    counts = Counter(v.strip() for v in re.findall(pattern, text))
    repeated = [(v, n) for v, n in counts.most_common() if n >= 3]
    print(f"{name}: {len(repeated)} repeated values")
    for value, count in repeated[:12]:
        print(f"  {count}x {value}")

print("Audit-only: no CSS was rewritten by this check.")
