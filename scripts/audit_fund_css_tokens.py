#!/usr/bin/env python3
"""Audit repeated Fund Detail design values without rewriting CSS."""
from collections import Counter
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "web/css/fund.css",
    ROOT / "web/css/fund-chart.css",
    ROOT / "web/css/fund-price.css",
    ROOT / "web/css/fund-profile.css",
]

text = "\n".join(p.read_text(encoding="utf-8") for p in FILES if p.exists())

CHECKS = {
    "border-radius": r"border-radius:\s*([^;}{]+)",
    "spacing": r"(?:padding|margin|gap):\s*([^;}{]+)",
}

# Values that are intentionally broad are reported, not failed. This keeps the
# gate informational while the architecture/ownership checks remain strict.
print("FUND DETAIL CSS TOKEN AUDIT")
for name, pattern in CHECKS.items():
    counts = Counter(v.strip() for v in re.findall(pattern, text))
    repeated = [(value, count) for value, count in counts.most_common() if count >= 3]
    print(f"{name}: {len(repeated)} repeated values")
    for value, count in repeated[:12]:
        print(f"  {count}x {value}")

print("Audit-only: no CSS was rewritten by this check.")
