#!/usr/bin/env python3
"""Final production contract for the static frontend architecture."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
PAGES = sorted(WEB.glob("*.html"))

if not PAGES:
    raise SystemExit("Frontend production contract failed: no HTML pages found")

violations = []
RETIRED = ("heatmap.html", "heatmap-redirect.js", "heatmap.css")

for page in PAGES:
    text = page.read_text(encoding="utf-8", errors="ignore")
    rel = page.relative_to(ROOT).as_posix()
    if "css/header.css" not in text:
        violations.append(f"{rel}: missing shared css/header.css")
    if "/rest/v1/" in text:
        violations.append(f"{rel}: direct Supabase REST access in HTML")
    if re.search(r"<script[^>]*>[^<]+", text, re.I):
        for match in re.finditer(r"<script(?:\s[^>]*)?>(.*?)</script>", text, re.I | re.S):
            body = match.group(1).strip()
            if body and not body.startswith("<!--"):
                violations.append(f"{rel}: inline JavaScript remains in page")
                break
    for retired in RETIRED:
        if retired in text:
            violations.append(f"{rel}: retired surface reference remains: {retired}")

for path in WEB.rglob("*.js"):
    rel = path.relative_to(ROOT).as_posix()
    text = path.read_text(encoding="utf-8", errors="ignore")
    if "/js/data/" not in rel and "/rest/v1/" in text:
        violations.append(f"{rel}: direct Supabase REST outside web/js/data")

required = [
    "web/js/data/supabase-client.js",
    "web/js/data/funds-service.js",
    "web/js/data/macro-service.js",
    "web/js/data/categories-service.js",
    "web/css/fund-detail.css",
    "web/categories.html",
    "scripts/verify_frontend_boundaries.py",
]
for item in required:
    if not (ROOT / item).is_file():
        violations.append(f"missing canonical architecture anchor: {item}")

for item in (
    "web/heatmap.html",
    "web/css/heatmap.css",
    "web/js/heatmap-redirect.js",
    "web/js/category-context.js",
    "web/js/engine.js",
    "web/js/live.js",
    "web/js/map-page.js",
    "web/css/page-map.css",
    "web/css/app.css",
    "web/css/khater-design-system.css",
):
    if (ROOT / item).is_file():
        violations.append(f"retired surface still present: {item}")

if violations:
    print("FRONTEND PRODUCTION CONTRACT FAILED")
    for item in violations:
        print(" -", item)
    raise SystemExit(1)

print("FRONTEND PRODUCTION CONTRACT PASSED")
print(f"Pages checked: {len(PAGES)}")
print("Data boundary: enforced")
print("Shared navigation: enforced")
print("Inline JavaScript: absent")
print("Simplified Areas atlas: present")
print("Retired Heatmap surface: absent")
print("Canonical architecture anchors: present")
