#!/usr/bin/env python3
"""Static contract: Macro domain owns data access and financial derivations; screen only renders."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
service = (ROOT / "web/js/data/macro-service.js").read_text(encoding="utf-8")
screen = (ROOT / "web/js/macro-screen-v2.js").read_text(encoding="utf-8")
html = (ROOT / "web/macro.html").read_text(encoding="utf-8")
intel = (ROOT / "web/js/macro-intelligence.js").read_text(encoding="utf-8")

for token in ["getSeries", "getAll", "buildView", "deriveSeries", "keysForMode", "/rest/v1/macro_series?"]:
    if token not in service:
        raise SystemExit(f"Macro contract failed: service missing {token}")

for token in ["svc.getAll()", "svc.buildView(state.data,state.mode)", "svc.rangeText"]:
    if token not in screen:
        raise SystemExit(f"Macro contract failed: controller missing {token}")

# Boot merged into screen
if "renderMacroIntelligence" not in screen:
    raise SystemExit("Macro contract failed: screen must call renderMacroIntelligence after data load")

for forbidden in ["/rest/v1/", "window.KHATER_DATA.supabase", "macro_series?", "index100(", "purchasingPower("]:
    if forbidden in screen:
        raise SystemExit(f"Macro contract failed: screen owns domain/data logic: {forbidden}")

for token in [
    "js/data/supabase-client.js",
    "js/data/macro-service.js",
    "js/macro-screen-v2.js",
    "js/macro-intelligence.js",
]:
    if token not in html:
        raise SystemExit(f"Macro contract failed: macro.html missing {token}")

if "macro-intelligence-boot.js" in html:
    raise SystemExit("Macro contract failed: macro-intelligence-boot.js must not be loaded")
boot_path = ROOT / "web/js/macro-intelligence-boot.js"
if boot_path.exists():
    raise SystemExit("Macro contract failed: deprecated macro-intelligence-boot.js still present")

if "macroIntelligence" not in intel:
    raise SystemExit("Macro contract failed: macro-intelligence must export macroIntelligence")

print("Macro contract checks passed")
print(" - service: getAll / buildView / derive")
print(" - screen: render + merged intelligence boot")
print(" - shared interpretation: macro-intelligence.js")
