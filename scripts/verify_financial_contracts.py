#!/usr/bin/env python3
"""Static guards for the fund-profile financial data contract."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = (ROOT / "web/js/fund-core.js").read_text(encoding="utf-8")
PERF = (ROOT / "web/js/fund-performance.js").read_text(encoding="utf-8")

REQUIRED = {
    "core uses official performance table": "fund_performance_history",
    "core filters future observations": "isCurrentOrPast",
    "core groups official rows by horizon": "byHorizon[horizon]",
    "performance selects requested horizon": "String(r.horizon) === horizon",
    "chart plots official return_pct": "r.return_pct",
    "performance identifies official source": "fund_performance_history",
    "NAV is explicitly separate": "LATEST NAV · منفصل",
}

missing = [name for name, token in REQUIRED.items() if token not in (CORE + "\n" + PERF)]
if missing:
    raise SystemExit("Financial contract failed:\n- " + "\n- ".join(missing))

# These are deliberately simple source-level invariants: they prevent a future
# refactor from silently switching the official performance chart to NAV data.
if "seriesReturn(" in PERF:
    raise SystemExit("Financial contract failed: performance UI must not calculate official return from NAV")

print("Financial contract checks passed")
