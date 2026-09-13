from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "web/fund.html"
ENTRY = ROOT / "web/css/fund-detail.css"

required_imports = [
    "./fund.css",
    "./fund-chart.css",
    "./fund-price.css",
    "./fund-profile.css",
]
legacy_css = [
    "css/fund.css",
    "css/fund-chart.css",
    "css/fund-price.css",
    "css/fund-profile.css",
]

html = HTML.read_text(encoding="utf-8")
entry = ENTRY.read_text(encoding="utf-8")
errors = []

if 'href="css/fund-detail.css"' not in html:
    errors.append("fund.html must load css/fund-detail.css as its canonical Fund Detail stylesheet")

for css in legacy_css:
    if css in html:
        errors.append(f"fund.html must not load legacy Fund Detail stylesheet directly: {css}")

imports = re.findall(r"@import\s+url\(['\"]([^'\"]+)['\"]\)", entry)
if imports != required_imports:
    errors.append(
        "fund-detail.css import order must remain: "
        + " → ".join(required_imports)
    )

if errors:
    print("FUND DETAIL CSS ARCHITECTURE CHECK FAILED")
    for error in errors:
        print(f" - {error}")
    raise SystemExit(1)

print("FUND DETAIL CSS ARCHITECTURE CHECK PASSED")
print(" - canonical entrypoint: css/fund-detail.css")
print(" - legacy modules remain encapsulated behind the canonical entrypoint")
print(" - module order is locked")
