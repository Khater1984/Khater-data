#!/usr/bin/env python3
"""Guard: one visual identity source — platform-shell.css."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
PAGES = ["index.html", "wealth.html", "macro.html", "categories.html", "funds.html", "fund.html"]
DEVICE_PAGES = PAGES + ["map.html", "why.html"]

FORBIDDEN_LINKS = [
    "nile-page-overrides.css",
    "khater-platform-identity.css",
    "page-funds-final.css",
    "heatmap.css",
]

PRIMARY_NAV = [
    'href="./index.html"',
    'href="./wealth.html"',
    'href="./macro.html"',
    'href="./categories.html"',
    'href="./funds.html"',
]

RETIRED_ROUTES = ["heatmap.html"]

for name in PAGES:
    path = WEB / name
    html = path.read_text(encoding="utf-8")
    if "css/header.css" not in html:
        raise SystemExit(f"Platform identity failed: {name} missing shared header stylesheet")
    for href in PRIMARY_NAV:
        if href not in html:
            raise SystemExit(f"Platform identity failed: {name} missing primary navigation route {href}")
    for retired in RETIRED_ROUTES:
        if retired in html:
            raise SystemExit(f"Platform identity failed: {name} still references retired route {retired}")
    for bad in FORBIDDEN_LINKS:
        if bad in html:
            raise SystemExit(f"Platform identity failed: {name} still links retired stylesheet {bad}")

header = (WEB / "css/header.css").read_text(encoding="utf-8")
if "platform-shell.css" not in header:
    raise SystemExit("Platform identity failed: header.css is not bound to platform-shell.css")
if "categories.html" not in header or "فئات الصناديق" not in header:
    raise SystemExit("Platform identity failed: header.css must expose the Fund Categories route")
if "heatmap.html" in header:
    raise SystemExit("Platform identity failed: header.css still exposes retired heatmap route")
if "safe-area-inset-top" not in header:
    raise SystemExit("Platform identity failed: header.css missing safe-area inset on product chrome")

shell = (WEB / "css/platform-shell.css").read_text(encoding="utf-8")
required_tokens = [
    "--shell-bg:", "--shell-surface:", "--shell-green:", "--shell-red:",
    "--shell-content:", "font-variant-numeric:tabular-nums", "@media(max-width:760px)",
    "--text-hero:", "--text-lede:", "--text-num:", "--text-num-lg:", "--text-nav:",
    "--space-1:", "--radius-sm:", "--shell-warning:",
    "--focus:", "--header-h:", "--nile-max:", "--kh-h1:",
    "--safe-top:", "--safe-bottom:", "--safe-left:", "--safe-right:",
    "safe-area-inset-top", "-webkit-tap-highlight-color", "overscroll-behavior",
    "@media print", "prefers-contrast",
]
for token in required_tokens:
    if token not in shell:
        raise SystemExit(f"Platform identity failed: platform-shell.css missing {token}")

bg_match = re.search(r"--shell-bg:\s*(#[0-9A-Fa-f]{3,8})", shell)
if not bg_match:
    raise SystemExit("Platform identity failed: --shell-bg hex missing")
shell_bg = bg_match.group(1).lower()

for name in DEVICE_PAGES:
    html = (WEB / name).read_text(encoding="utf-8")
    if "viewport-fit=cover" not in html:
        raise SystemExit(f"Platform identity failed: {name} missing viewport-fit=cover")
    html_l = html.lower()
    if "theme-color" not in html_l or f'content="{shell_bg}"' not in html_l:
        raise SystemExit(
            f"Platform identity failed: {name} theme-color must match --shell-bg {shell_bg}"
        )

for stub_name in ("app.css", "khater-design-system.css"):
    stub_path = WEB / "css" / stub_name
    if stub_path.is_file():
        raise SystemExit(f"Platform identity failed: retired identity stub still present: {stub_name}")

# Cascade lock: platform-shell.css must be the last application stylesheet on every device page
for name in DEVICE_PAGES:
    path = WEB / name
    if not path.exists():
        continue
    html = path.read_text(encoding="utf-8")
    hrefs = re.findall(r'href=["\'](css/[^"\']+)["\']', html)
    app = [h for h in hrefs if h.startswith("css/")]
    if not app:
        raise SystemExit(f"Platform identity failed: {name} has no css links")
    last = app[-1].split("?")[0]
    if not last.endswith("platform-shell.css"):
        raise SystemExit(
            f"Platform identity failed: {name} must load platform-shell.css last (got {last})"
        )

print("Platform identity contract passed")
print(" - device environment: viewport-fit, theme-color, safe-area, tap, print")
print(" - cascade: platform-shell.css is last stylesheet on device pages")
