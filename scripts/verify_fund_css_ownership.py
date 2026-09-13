#!/usr/bin/env python3
"""Guard the Fund Detail CSS ownership contract.

This check is intentionally conservative: it verifies the canonical surface
contract exists in fund-detail.css and that the protected legacy module import
order remains intact. It does not attempt heuristic CSS rewrites.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
ENTRY = ROOT / "web/css/fund-detail.css"

text = ENTRY.read_text(encoding="utf-8")

required = [
    "--fd-line:",
    "--fd-radius-card:",
    "--fd-card-gradient:",
    ".metric,",
    ".card {",
]
missing = [item for item in required if item not in text]
if missing:
    raise SystemExit(
        "FUND DETAIL CSS OWNERSHIP CHECK FAILED\n - missing canonical contract: "
        + ", ".join(missing)
    )

imports = re.findall(r"@import\\s+url\\('([^']+)'\\);", text)
expected = [
    "./fund.css",
    "./fund-chart.css",
    "./fund-price.css",
    "./fund-profile.css",
]
if imports[:4] != expected:
    raise SystemExit(
        "FUND DETAIL CSS OWNERSHIP CHECK FAILED\n"
        f" - protected module order changed: {imports[:4]}"
    )

print("FUND DETAIL CSS OWNERSHIP CHECK PASSED")
