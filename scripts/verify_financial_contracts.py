#!/usr/bin/env python3
"""Static guards for the fund-profile financial data contract."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = (ROOT / "web/js/fund-core.js").read_text(encoding="utf-8")
PERF = (ROOT / "web/js/fund-performance.js").read_text(encoding="utf-8")
SERVICE = (ROOT / "web/js/data/fund-service.js").read_text(encoding="utf-8")
EVIDENCE = (ROOT / "web/js/fund-evidence.js").read_text(encoding="utf-8")
ALL = CORE + "\n" + PERF + "\n" + SERVICE + "\n" + EVIDENCE

REQUIRED = {
    "canonical service exists": "getFundBundle",
    "official performance table": "fund_performance_history",
    "future observations rejected": "currentOrPast",
    "official rows grouped by horizon": "officialSeriesByHorizon",
    "performance service filters requested horizon": "performanceSeries(rows, horizon)",
    "performance selects requested horizon": "performanceSeries(F.performance || [], horizon)",
    "chart plots official return_pct": "r.return_pct",
    "performance identifies official source": "fund_performance_history",
    "NAV is explicitly separate": "LATEST NAV · منفصل",
    "NAV is a separate table": "fund_price_history",
    "canonical bundle includes evidence": "evidence:results[4][0]||null",
    "evidence UI consumes bundle": "const e=F.evidence",
}

missing = [name for name, token in REQUIRED.items() if token not in ALL]
if missing:
    raise SystemExit("Financial contract failed:\n- " + "\n- ".join(missing))

if "seriesReturn(" in PERF:
    raise SystemExit("Financial contract failed: performance UI must not calculate official return from NAV")

if "smartscore_evaluations?" in EVIDENCE or "smartscore_evaluations?" in CORE:
    raise SystemExit("Financial contract failed: Fund Profile UI must not query smartscore_evaluations directly")

print("Financial contract checks passed")
