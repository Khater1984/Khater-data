from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "web/fund.html"

REQUIRED_CSS = [
    "css/header.css",
    "css/fund-detail.css",
    "css/platform-shell.css",
]
REQUIRED_JS = [
    "js/platform-theme.js",
    "js/data/supabase-client.js",
    "js/data/fund-service.js",
    "js/fund-core.js",
    "js/fund-performance.js",
    "js/fund-risk.js",
    "js/fund-benchmark.js",
    "js/fund-smartscore.js",
    "js/fund-evidence.js",
    "js/fund-profile.js",
    "js/fund-tabs.js",
    "js/fund-detail-controller.js",
]
LEGACY_PATTERNS = [
    r"fund-performance-v2\.js",
    r"fund-performance-v3\.js",
    r"fund-core-v\d+\.js",
]

text = PAGE.read_text(encoding="utf-8")
errors = []

for asset in REQUIRED_CSS + REQUIRED_JS:
    if asset not in text:
        errors.append(f"fund.html missing canonical dependency: {asset}")

for pattern in LEGACY_PATTERNS:
    if re.search(pattern, text):
        errors.append(f"fund.html references legacy dependency: {pattern}")

service_pos = text.find('js/data/fund-service.js')
core_pos = text.find('js/fund-core.js')
if service_pos == -1 or core_pos == -1 or service_pos > core_pos:
    errors.append("fund.html must load fund-service.js before fund-core.js")

if "supabase.from(" in text or "supabase.rpc(" in text or ".from('" in text:
    errors.append("fund.html contains direct Supabase query code; use the data/service layer")

if errors:
    print("FUND DETAIL CONTRACT CHECK FAILED")
    for error in errors:
        print(f" - {error}")
    raise SystemExit(1)

print("FUND DETAIL CONTRACT CHECK PASSED")
print(f" - canonical CSS dependencies: {len(REQUIRED_CSS)}")
print(f" - canonical JS dependencies: {len(REQUIRED_JS)}")
print(" - no legacy performance/core dependency references")
print(" - data service precedes fund facade")
print(" - canonical stylesheet owns Fund Detail styling")
