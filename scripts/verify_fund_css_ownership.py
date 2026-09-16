#!/usr/bin/env python3
"""Guard the Fund Detail CSS ownership contract.

Canonical surface lives only in fund-detail.css (no separate fund-*.css modules).
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENTRY = ROOT / "web/css/fund-detail.css"
LEGACY_MODULES = [
    ROOT / "web/css/fund.css",
    ROOT / "web/css/fund-chart.css",
    ROOT / "web/css/fund-price.css",
    ROOT / "web/css/fund-profile.css",
]

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

if "@import" in text and "fund.css" in text:
    raise SystemExit(
        "FUND DETAIL CSS OWNERSHIP CHECK FAILED\n"
        " - fund-detail.css must not @import split fund modules; inline ownership only"
    )

for path in LEGACY_MODULES:
    if path.exists():
        raise SystemExit(
            "FUND DETAIL CSS OWNERSHIP CHECK FAILED\n"
            f" - retired module still present: {path.relative_to(ROOT)}"
        )

print("FUND DETAIL CSS OWNERSHIP CHECK PASSED")
