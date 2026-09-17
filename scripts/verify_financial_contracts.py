#!/usr/bin/env python3
"""Static guards for the canonical Fund Detail and Funds financial-data contract."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "html": ROOT / "web/fund.html",
    "core": ROOT / "web/js/fund-core.js",
    "performance": ROOT / "web/js/fund-performance.js",
    "risk": ROOT / "web/js/fund-risk.js",
    "benchmark": ROOT / "web/js/fund-benchmark.js",
    "smartscore": ROOT / "web/js/fund-smartscore.js",
    "evidence": ROOT / "web/js/fund-evidence.js",
    "profile": ROOT / "web/js/fund-profile.js",
    "tabs": ROOT / "web/js/fund-tabs.js",
    "service": ROOT / "web/js/data/fund-service.js",
    "funds_service": ROOT / "web/js/data/funds-service.js",
}
TEXT = {k: p.read_text(encoding="utf-8") for k, p in FILES.items()}

REQUIRED = {
    "canonical service exists": ("getFundBundle", "service"),
    "official performance table": ("fund_performance_history", "service"),
    "future observations rejected": ("currentOrPast", "service"),
    "official rows grouped by horizon": ("officialSeriesByHorizon", "service"),
    "performance filters requested horizon": ("performanceSeries", "performance"),
    "performance uses canonical official series": ("service().performanceSeries(F.performance || [], horizon)", "performance"),
    "chart plots official return_pct": ("r.return_pct", "performance"),
    "NAV is explicitly separate": ("LATEST NAV · منفصل", "performance"),
    "NAV is a separate table": ("fund_price_history", "service"),
    "canonical bundle includes evidence": ("evidence", "service"),
    "evidence UI consumes bundle": ("const e=F.evidence", "evidence"),
    "SmartScore methodology target remains explicit": ("SMARTSCORE_V3", "service"),
    "Data Quality outside score": ("data_quality_in_score: false", "service"),
    "SmartScore version comes from stored evaluation": ("s.methodology_version||e.methodology_version", "smartscore"),
    "SmartScore stored weights are consumed": ("e.effective_weights", "smartscore"),
    "V3 inflation component is explicit": ("c.inflation", "smartscore"),
    "V3 track factor is visible": ("Track Factor", "smartscore"),
    "Data Quality is not a sixth score": ("Data Quality ·", "smartscore"),
    "funds screen selects fund id": ("fund_id,report_date,return_pct,horizon", "funds_service"),
    "funds screen maps return per fund": ("latestByFund", "funds_service"),
}
missing = [name for name, (token, source) in REQUIRED.items() if token not in TEXT[source]]
if missing:
    raise SystemExit("Financial contract failed:\n- " + "\n- ".join(missing))

for name in ("core", "performance", "risk", "benchmark", "smartscore", "evidence", "profile", "tabs"):
    source = TEXT[name]
    forbidden = ["window.KHATER_DATA.supabase", "/rest/v1/", "supabase.from(", "./data/", "../data/", "web/data/"]
    hits = [token for token in forbidden if token in source]
    if hits:
        raise SystemExit(f"Financial contract failed: {name} bypasses canonical data layer: {', '.join(hits)}")

if "seriesReturn(" in TEXT["performance"]:
    raise SystemExit("Financial contract failed: performance UI must not calculate official return from NAV")

html = TEXT["html"]
required_order = [
    "js/data/supabase-client.js",
    "js/data/benchmark-registry.js",
    "js/data/benchmark-service.js",
    "js/data/fund-service.js",
    "js/data/macro-service.js",
    "js/fund-core.js",
    "js/fund-performance.js",
    "js/fund-risk.js",
    "js/fund-benchmark.js",
    "js/fund-smartscore.js",
    "js/fund-evidence.js",
    "js/fund-profile.js",
    "js/fund-tabs.js",
]
positions = [html.find(token) for token in required_order]
if any(pos < 0 for pos in positions) or positions != sorted(positions):
    raise SystemExit("Financial contract failed: Fund Detail script/data-layer order is invalid")

print("Financial contract checks passed")
