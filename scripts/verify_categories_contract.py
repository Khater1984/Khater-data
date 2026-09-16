#!/usr/bin/env python3
"""Guard the simplified Categories/Fund Atlas screen."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "web/categories.html"
SERVICE = ROOT / "web/js/data/categories-service.js"
CONTROLLER = ROOT / "web/js/categories-screen-v2.js"
CSS = ROOT / "web/css/page-categories.css"

for path in (HTML, SERVICE, CONTROLLER, CSS):
    if not path.is_file():
        raise SystemExit(f"Categories contract failed: missing {path.relative_to(ROOT)}")

html = HTML.read_text(encoding="utf-8")
service = SERVICE.read_text(encoding="utf-8")
controller = CONTROLLER.read_text(encoding="utf-8")

required_service_tokens = (
    "window.KHATER_DATA.categories",
    "getUniverse",
    "source: 'Supabase'",
    "fund_smartscore_latest",
)
missing = [token for token in required_service_tokens if token not in service]
if missing:
    raise SystemExit("Categories contract failed in service: " + ", ".join(missing))

if "window.KHATER_DATA.categories" not in controller:
    raise SystemExit("Categories contract failed: screen controller does not consume categories service")

forbidden = ("supabase.from(", "/rest/v1/", "window.KHATER_DATA.supabase", "./data/", "../data/", "web/data/")
hits = [token for token in forbidden if token in controller]
if hits:
    raise SystemExit("Categories contract failed: controller bypasses canonical service: " + ", ".join(hits))

if "heatmap" in html.lower() or "treemap" in controller.lower() or "treemap" in html.lower():
    raise SystemExit("Categories contract failed: heatmap/treemap must stay out of the simplified atlas")

if "css/page-categories.css" not in html:
    raise SystemExit("Categories contract failed: canonical page stylesheet is not referenced")

if "css/header.css" not in html:
    raise SystemExit("Categories contract failed: shared header stylesheet is missing")

print("Categories financial/UI contract passed")
