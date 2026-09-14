#!/usr/bin/env python3
"""Deep release-readiness audit for the Market Radar browser product.

Checks the complete static browser surface without changing financial logic or
Supabase contracts. This complements the existing RC architecture audit with
navigation, accessibility, asset, dependency, and security consistency checks.
"""
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
errors: list[str] = []
warnings: list[str] = []

class AuditParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags: list[str] = []
        self.ids: list[str] = []
        self.mains = 0
        self.h1s = 0
        self.buttons = 0
        self.inputs = 0
        self.links = 0
        self.scripts: list[dict[str, str]] = []
        self.stylesheets: list[str] = []
        self.inline_script = False
        self.inline_style = False
        self.inline_script_data = ""
        self.inline_style_data = ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.append(tag)
        if a.get("id"):
            self.ids.append(a["id"])
        if tag == "main": self.mains += 1
        if tag == "h1": self.h1s += 1
        if tag == "button": self.buttons += 1
        if tag == "input": self.inputs += 1
        if tag == "a": self.links += 1
        if tag == "script":
            self.inline_script = not bool(a.get("src"))
            if a.get("src"): self.scripts.append(a)
        if tag == "style": self.inline_style = True
        if tag == "link" and a.get("rel", "").lower() == "stylesheet" and a.get("href"):
            self.stylesheets.append(a["href"])

    def handle_data(self, data):
        if self.inline_script: self.inline_script_data += data
        if self.inline_style: self.inline_style_data += data

    def handle_endtag(self, tag):
        if tag == "script": self.inline_script = False
        if tag == "style": self.inline_style = False

pages = sorted(WEB.glob("*.html"))
if not pages:
    errors.append("no web HTML pages found")

# Product shell and accessibility contract.
for page in pages:
    rel = page.relative_to(ROOT).as_posix()
    text = page.read_text(encoding="utf-8", errors="ignore")
    p = AuditParser(); p.feed(text)

    html = re.search(r"<html\b([^>]*)>", text, re.I)
    if not html or not re.search(r"\blang\s*=", html.group(1), re.I): errors.append(f"{rel}: html lang missing")
    if not html or not re.search(r"\bdir\s*=", html.group(1), re.I): errors.append(f"{rel}: html dir missing")
    if p.mains != 1: errors.append(f"{rel}: expected one main landmark, found {p.mains}")
    if p.h1s != 1: errors.append(f"{rel}: expected one primary h1, found {p.h1s}")
    if "css/header.css" not in text: errors.append(f"{rel}: shared header.css missing")
    if p.inline_script_data.strip(): errors.append(f"{rel}: inline JavaScript remains")
    if p.inline_style_data.strip(): errors.append(f"{rel}: inline CSS remains")
    if re.search(r"\son[a-z]+\s*=", text, re.I): errors.append(f"{rel}: inline event handler remains")
    if re.search(r"href\s*=\s*['\"]\s*javascript:", text, re.I): errors.append(f"{rel}: javascript URL remains")
    dup = sorted({x for x in p.ids if p.ids.count(x) > 1})
    for x in dup: errors.append(f"{rel}: duplicate id={x}")

    # Local references must resolve from the page directory.
    for ref in re.findall(r"(?:src|href)=[\"']([^\"']+)", text, re.I):
        if ref.startswith(("http://", "https://", "#", "mailto:", "data:", "tel:")): continue
        clean = ref.split("?",1)[0].split("#",1)[0]
        if not clean or "${" in clean: continue
        if not (page.parent / clean).resolve().is_file(): errors.append(f"{rel}: broken local reference {ref}")

# Browser code must remain inside the canonical service/data boundary.
for path in WEB.rglob("*.js"):
    rel = path.relative_to(ROOT).as_posix()
    text = path.read_text(encoding="utf-8", errors="ignore")
    if "/js/data/" not in rel and re.search(r"/rest/v1/|createClient\s*\(", text):
        errors.append(f"{rel}: direct Supabase access outside web/js/data")
    if re.search(r"service[_-]?role|SUPABASE_SERVICE_KEY|sb_secret_", text, re.I):
        errors.append(f"{rel}: service-role credential marker in browser code")
    if re.search(r"(?:api[_-]?key|secret)\s*[:=]\s*['\"][A-Za-z0-9_-]{32,}", text, re.I):
        warnings.append(f"{rel}: possible hard-coded credential-like value")

# Required architecture anchors.
required = [
    "web/config.js", "web/css/header.css", "web/js/data/supabase-client.js",
    "web/js/data/fund-service.js", "web/js/data/macro-service.js",
    "web/js/data/categories-service.js", "web/css/fund-detail.css",
    "scripts/verify_release_candidate.py", ".github/workflows/quality-gate.yml",
]
for item in required:
    if not (ROOT / item).is_file(): errors.append(f"missing release anchor: {item}")

# Navigation coherence: each major surface should be represented somewhere in the browser shell.
all_html = "\n".join(p.read_text(encoding="utf-8", errors="ignore") for p in pages)
for marker in ("index.html", "macro.html", "categories.html", "funds.html", "fund.html"):
    if marker not in all_html: warnings.append(f"navigation marker not found globally: {marker}")

# No accidental debug artifacts in production browser code.
for path in WEB.rglob("*.js"):
    text = path.read_text(encoding="utf-8", errors="ignore")
    rel = path.relative_to(ROOT).as_posix()
    if re.search(r"console\.log\s*\(", text) and not re.search(r"console\.log\s*\(\s*['\"](?:error|warn)", text, re.I):
        warnings.append(f"{rel}: console.log remains")

if errors:
    print("RELEASE READINESS AUDIT FAILED")
    for x in errors: print(" -", x)
    if warnings:
        print("WARNINGS")
        for x in warnings: print(" -", x)
    sys.exit(1)

print("RELEASE READINESS AUDIT PASSED")
print(f"pages={len(pages)}")
print("shell/accessibility: checked")
print("local assets: checked")
print("browser data boundary: checked")
print("credential safety: checked")
print("navigation coherence: checked")
print("debug-artifact scan: checked")
if warnings:
    print(f"non-blocking warnings={len(warnings)}")
    for x in warnings: print(" -", x)
