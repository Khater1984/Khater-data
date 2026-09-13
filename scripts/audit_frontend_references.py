#!/usr/bin/env python3
"""Repository-wide frontend reference audit.

Fails only on broken local references. Reports unreferenced JS/CSS candidates so
legacy files can be removed only after a deliberate review; dynamic imports and
runtime stylesheet URLs are included in the reference scan.
"""
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"

class RefParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ("src", "href"):
            value = attrs.get(key)
            if value:
                self.refs.append(value)

refs = set()
errors = []

for html in WEB.glob("*.html"):
    parser = RefParser()
    parser.feed(html.read_text(encoding="utf-8"))
    for ref in parser.refs:
        if ref.startswith(("http://", "https://", "#", "mailto:", "data:")):
            continue
        if "${" in ref or "encodeURIComponent" in ref:
            continue
        target = (html.parent / ref.split("?", 1)[0].split("#", 1)[0]).resolve()
        if not target.is_file():
            errors.append(f"{html.relative_to(ROOT)} -> {ref}")
        else:
            refs.add(target)

# Track local JS imports and runtime stylesheet references as well.
for js in (WEB / "js").rglob("*.js"):
    text = js.read_text(encoding="utf-8")
    for ref in re.findall(r'''(?:from\s*["']|import\s*\(\s*["']|(?:href|src)\s*=\s*["'])([^"']+)''', text):
        if ref.startswith(("http://", "https://")):
            continue
        target = (js.parent / ref.split("?", 1)[0].split("#", 1)[0]).resolve()
        if target.is_file():
            refs.add(target)

for asset in [*(WEB / "js").rglob("*.js"), *(WEB / "css").rglob("*.css")]:
    if asset not in refs:
        print(f"ORPHAN CANDIDATE: {asset.relative_to(ROOT)}")

if errors:
    print("FRONTEND REFERENCE AUDIT FAILED")
    print("\n".join(f"- {x}" for x in errors))
    sys.exit(1)

print("FRONTEND REFERENCE AUDIT OK")
