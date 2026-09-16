#!/usr/bin/env python3
"""Guard: one visual identity source — platform-shell.css."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
PAGES = ["index.html", "wealth.html", "macro.html", "categories.html", "funds.html", "fund.html"]

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

shell = (WEB / "css/platform-shell.css").read_text(encoding="utf-8")
required_tokens = [
    "--shell-bg:", "--shell-surface:", "--shell-green:", "--shell-red:",
    "--shell-content:", "font-variant-numeric:tabular-nums", "@media(max-width:760px)",
    "--text-hero:", "--space-1:", "--radius-sm:", "--shell-warning:",
    "--focus:", "--header-h:", "--nile-max:", "--kh-h1:",
]
for token in required_tokens:
    if token not in shell:
        raise SystemExit(f"Platform identity failed: platform-shell.css missing {token}")

for stub_name in ("app.css", "khater-design-system.css"):
    stub_path = WEB / "css" / stub_name
    if stub_path.is_file():
        text = stub_path.read_text(encoding="utf-8")
        if "platform-shell.css" not in text:
            raise SystemExit(f"Platform identity failed: {stub_name} must import platform-shell.css")

print("Platform identity contract passed")
