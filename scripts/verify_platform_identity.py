#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
PAGES = ["index.html", "map.html", "categories.html", "funds.html", "fund.html"]

for name in PAGES:
    path = WEB / name
    html = path.read_text(encoding="utf-8")
    if 'css/header.css' not in html:
        raise SystemExit(f"Platform identity failed: {name} missing shared header stylesheet")
    for href in ['href=\"./index.html\"', 'href=\"./map.html\"', 'href=\"./categories.html\"', 'href=\"./funds.html\"']:
        if href not in html:
            raise SystemExit(f"Platform identity failed: {name} missing primary navigation route {href}")

header = (WEB / "css/header.css").read_text(encoding="utf-8")
if "platform-shell.css" not in header:
    raise SystemExit("Platform identity failed: header.css is not bound to platform-shell.css")

shell = (WEB / "css/platform-shell.css").read_text(encoding="utf-8")
required_tokens = [
    "--shell-bg:", "--shell-surface:", "--shell-green:", "--shell-red:",
    "--shell-content:", "font-variant-numeric:tabular-nums", "@media(max-width:760px)",
]
for token in required_tokens:
    if token not in shell:
        raise SystemExit(f"Platform identity failed: platform-shell.css missing {token}")

legacy = (WEB / "css/khater-platform-visual.css").read_text(encoding="utf-8")
if "@import url('./platform-shell.css" not in legacy:
    raise SystemExit("Platform identity failed: legacy visual entrypoint is not delegated to platform-shell.css")

print("Platform identity contract passed")
