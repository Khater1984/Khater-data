#!/usr/bin/env python3
"""map.html is a compatibility redirect to wealth.html. Engine/heatmap layer is retired."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / "web/map.html").read_text(encoding="utf-8")

if "wealth.html" not in html:
    raise SystemExit("Map contract failed: map.html must redirect to wealth.html")
if "css/header.css" not in html:
    raise SystemExit("Map contract failed: map.html missing shared header.css")
if "css/platform-shell.css" not in html:
    raise SystemExit("Map contract failed: map.html missing platform-shell.css")

for token in ["js/live.js", "js/map-page.js", "js/engine.js", "css/page-map.css", "heatmap.html", "heatmap.css"]:
    if token in html:
        raise SystemExit(f"Map contract failed: retired map/heatmap asset still referenced: {token}")

print("Map contract checks passed")
print(" - map.html is a wealth redirect")
print(" - live pages do not load the retired map engine")
