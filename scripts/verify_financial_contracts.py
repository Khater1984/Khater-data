#!/usr/bin/env python3
"""Static guards for the fund-profile financial data contract."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = (ROOT / "web/js/fund-core.js").read_text(encoding="utf-8")
PERF = (ROOT / "web/js/fund-performance.js").read_text(encoding="utf-8")
SERVICE = (ROOT / "web/js/data/fund-service.js").read_text(encoding="utf-8")

REQUIRED = {
    "canonical service exists": "getFundBundle",
    "official performance table": "fund_performance_history",
    "future observations rejected": "currentOrPast",
    "official rows grouped by horizon": "officialSeriesByHorizon",
    "performance selects requested horizon": "String(r.horizon) === horizon",
    "chart plots official return_pct": "r.return_pct",
    "performance identifies official source": "fund_performance_history",
    "NAV is explicitly separate": "LATEST NAV · منفصل",
    "NAV is a separate table": "fund_price_history",
}

missing = [name for name, token in REQUIRED.items() if token not in (CORE + "\n" + PERF + "\n" + SERVICE)]
if missing:
    raise SystemExit("Financial contract failed:\n- " + "\n- ".join(missing))

if "seriesReturn(" in PERF:
    raise SystemExit("Financial contract failed: performance UI must not calculate official return from NAV")

print("Financial contract checks passed")
