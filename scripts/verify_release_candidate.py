#!/usr/bin/env python3
"""Release-candidate audit for the static Market Radar frontend.

This is intentionally stricter than the individual page contracts: it checks the
whole browser surface as one product while leaving financial calculations and
Supabase schema untouched.
"""
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
PAGES = sorted(WEB.glob("*.html"))
errors: list[str] = []

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids: list[str] = []
        self.inline_script = False
        self.inline_css = False
        self.scripts: list[str] = []
        self.styles: list[str] = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs and attrs["id"]:
            self.ids.append(attrs["id"])
        if tag == "script":
            self.inline_script = not bool(attrs.get("src"))
        if tag == "style":
            self.inline_css = True
    def handle_data(self, data):
        if self.inline_script:
            self.scripts.append(data)
        if self.inline_css:
            self.styles.append(data)
    def handle_endtag(self, tag):
        if tag == "script":
            self.inline_script = False
        if tag == "style":
            self.inline_css = False

for page in PAGES:
    text = page.read_text(encoding="utf-8", errors="ignore")
    rel = page.relative_to(ROOT).as_posix()
    parser = PageParser()
    parser.feed(text)

    if not re.search(r'<html[^>]+lang=', text, re.I):
        errors.append(f"{rel}: missing html lang")
    if not re.search(r'<html[^>]+dir=', text, re.I):
        errors.append(f"{rel}: missing html dir")
    if "css/header.css" not in text:
        errors.append(f"{rel}: shared header.css missing")
    if len(re.findall(r'<main(?:\s|>)', text, re.I)) != 1:
        errors.append(f"{rel}: expected exactly one main landmark")
    if parser.inline_script and any(x.strip() for x in parser.scripts):
        errors.append(f"{rel}: inline JavaScript remains")
    if parser.styles and any(x.strip() for x in parser.styles):
        errors.append(f"{rel}: inline CSS remains")
    duplicates = sorted({x for x in parser.ids if parser.ids.count(x) > 1})
    for item in duplicates:
        errors.append(f"{rel}: duplicate id={item}")
    if re.search(r'\son[a-z]+\s*=', text, re.I):
        errors.append(f"{rel}: inline event handler attribute remains")
    if re.search(r'href\s*=\s*["\']\s*javascript:', text, re.I):
        errors.append(f"{rel}: javascript: URL remains")

    # Validate local script and stylesheet references at the page boundary.
    for ref in re.findall(r'(?:src|href)=["\']([^"\']+)', text, re.I):
        if ref.startswith(("http://", "https://", "#", "mailto:", "data:")):
            continue
        clean = ref.split("?", 1)[0].split("#", 1)[0]
        if not clean or "${" in clean:
            continue
        target = (page.parent / clean).resolve()
        if not target.is_file():
            errors.append(f"{rel}: broken local reference {ref}")

# No browser code outside the canonical data layer may talk to Supabase REST directly.
for path in WEB.rglob("*.js"):
    rel = path.relative_to(ROOT).as_posix()
    text = path.read_text(encoding="utf-8", errors="ignore")
    if "/js/data/" not in rel and "/rest/v1/" in text:
        errors.append(f"{rel}: direct Supabase REST outside web/js/data")

# Browser config must never contain a service-role credential marker.
config = WEB / "config.js"
if config.is_file():
    text = config.read_text(encoding="utf-8", errors="ignore")
    if re.search(r"service[_-]?role|SUPABASE_SERVICE_KEY", text, re.I):
        errors.append("web/config.js: service-role credential marker found")

required = [
    "web/js/data/supabase-client.js",
    "web/js/data/fund-service.js",
    "web/js/data/macro-service.js",
    "web/js/data/categories-service.js",
    "web/css/header.css",
    "web/css/fund-detail.css",
    "scripts/verify_frontend_boundaries.py",
    "scripts/verify_frontend_production_contract.py",
]
for item in required:
    if not (ROOT / item).is_file():
        errors.append(f"missing production anchor: {item}")

if errors:
    print("RELEASE CANDIDATE AUDIT FAILED")
    for error in errors:
        print(" -", error)
    raise SystemExit(1)

print("RELEASE CANDIDATE AUDIT PASSED")
print(f"pages={len(PAGES)}")
print("accessibility shell: checked")
print("local asset integrity: checked")
print("inline CSS/JS: absent")
print("event-handler attributes: absent")
print("duplicate ids: absent")
print("Supabase boundary: enforced")
print("browser credential safety: checked")
print("canonical anchors: present")
