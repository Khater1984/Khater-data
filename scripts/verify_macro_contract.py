#!/usr/bin/env python3
"""Static contract: Macro domain owns data access and financial derivations; screen only renders."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
service = (ROOT / "web/js/data/macro-service.js").read_text(encoding="utf-8")
screen = (ROOT / "web/js/macro-screen.js").read_text(encoding="utf-8")
html = (ROOT / "web/macro.html").read_text(encoding="utf-8")

for token in ["getSeries", "getAll", "buildView", "deriveSeries", "keysForMode", "annualizedInflation", "monthlyChanges", "readout", "/rest/v1/macro_series?"]:
    if token not in service:
        raise SystemExit(f"Macro contract failed: service missing {token}")

for token in ["svc.getAll()", "svc.readout(data)", "svc.monthlySnapshots", "svc.monthlyChanges", "svc.rangeText"]:
    if token not in screen:
        raise SystemExit(f"Macro contract failed: controller missing {token}")

for forbidden in ["/rest/v1/", "window.KHATER_DATA.supabase", "macro_series?", "index100(", "purchasingPower(", "annualizedInflation("]:
    if forbidden in screen:
        raise SystemExit(f"Macro contract failed: screen owns domain/data logic: {forbidden}")

for token in [
    "js/data/supabase-client.js",
    "js/data/macro-service.js",
    "js/macro-screen.js",
]:
    if token not in html:
        raise SystemExit(f"Macro contract failed: macro.html missing {token}")

for legacy in [
    "macro-screen-v2.js",
    "macro-intelligence.js",
    "macro-intelligence.css",
    "macro-intelligence-boot.js",
]:
    if legacy in html:
        raise SystemExit(f"Macro contract failed: legacy macro asset still referenced: {legacy}")
    for root in [ROOT / "web/js", ROOT / "web/css"]:
        if (root / legacy).exists():
            raise SystemExit(f"Macro contract failed: legacy macro asset still present: {legacy}")

print("Macro contract checks passed")
print(" - service: canonical macro read model + derivations")
print(" - screen: economic intelligence rendering only")
print(" - legacy macro controller/intelligence layer: removed")
