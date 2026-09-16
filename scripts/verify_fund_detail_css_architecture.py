from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "web/fund.html"
ENTRY = ROOT / "web/css/fund-detail.css"

legacy_css = [
    "css/fund.css",
    "css/fund-chart.css",
    "css/fund-price.css",
    "css/fund-profile.css",
]

html = HTML.read_text(encoding="utf-8")
entry = ENTRY.read_text(encoding="utf-8")
errors = []

canonical_href = re.search(
    r'<link\s+[^>]*href=["\']css/fund-detail\.css(?:\?[^"\']*)?["\'][^>]*>',
    html,
    flags=re.IGNORECASE,
)
if not canonical_href:
    errors.append("fund.html must load css/fund-detail.css as its canonical Fund Detail stylesheet")

for css in legacy_css:
    if re.search(rf'<link\s+[^>]*href=["\']{re.escape(css)}(?:\?[^"\']*)?["\'][^>]*>', html, flags=re.IGNORECASE):
        errors.append(f"fund.html must not load legacy Fund Detail stylesheet directly: {css}")
    if (ROOT / "web" / css).exists():
        errors.append(f"retired Fund Detail stylesheet still on disk: {css}")

for token in ["--fd-line:", "--fd-radius-card:", ".metric,", ".card {"]:
    if token not in entry:
        errors.append(f"fund-detail.css missing ownership token: {token}")

if errors:
    print("FUND DETAIL CSS ARCHITECTURE CHECK FAILED")
    for e in errors:
        print(" -", e)
    raise SystemExit(1)

print("FUND DETAIL CSS ARCHITECTURE CHECK PASSED")
