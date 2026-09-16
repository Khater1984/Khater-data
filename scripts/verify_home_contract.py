#!/usr/bin/env python3
"""NOW experience contract — read-model driven; data boundary only."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / "web/index.html").read_text(encoding="utf-8")
controller = (ROOT / "web/js/now-page.js").read_text(encoding="utf-8")
service = (ROOT / "web/js/data/now-service.js").read_text(encoding="utf-8")

required = [
    "js/data/supabase-client.js",
    "js/data/macro-service.js",
    "js/data/now-service.js",
    "js/now-page.js",
]
for token in required:
    if token not in html:
        raise SystemExit(f"NOW contract failed: missing {token}")

if "<script>" in html and "getSeries(" in html:
    raise SystemExit("NOW contract failed: inline data orchestration detected")

for forbidden in [
    "fund_performance_history",
    "fund_price_history",
    "/rest/v1/",
    "window.KHATER_DATA.supabase",
    "./data/",
    "../data/",
    "web/data/",
]:
    if forbidden in controller:
        raise SystemExit(f"NOW contract failed: controller bypasses canonical services via {forbidden}")

if "window.KHATER_DATA.now" not in controller:
    raise SystemExit("NOW contract failed: controller must consume the NOW read model")

if "macro.getSeries" not in service:
    raise SystemExit("NOW contract failed: NOW service must consume macro-service")

for forbidden in ["home-page.js", "market-intelligence-charts.js", "brief-page.css"]:
    if forbidden in html:
        raise SystemExit(f"NOW contract failed: legacy asset still loaded: {forbidden}")

print("NOW contract checks passed")
print(" - page consumes KHATER_DATA.now.snapshot()")
print(" - macro access stays inside now-service")
print(" - legacy home renderer/assets are removed from the page")
