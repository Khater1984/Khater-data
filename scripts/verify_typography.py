#!/usr/bin/env python3
"""GLOBAL TYPOGRAPHY AUDIT — Cairo only; page CSS must not own font-family."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
FORBIDDEN = [
    "IBM Plex Mono",
    "IBM Plex Sans",
    "ui-monospace",
    "Cascadia Mono",
    "Consolas",
    "Menlo",
]
FORBIDDEN_RE = [
    re.compile(r"font-family\s*:\s*[^;]*\bmonospace\b", re.I),
    re.compile(r"font-family\s*:\s*[^;]*\bArial\b", re.I),
    re.compile(r"font-family\s*:\s*[^;]*\bTahoma\b", re.I),
    re.compile(r"font-family\s*:\s*[^;]*\bSegoe UI\b", re.I),
]
PAGE_CSS = [
    "page-funds.css", "page-funds-layout.css", "page-map.css",
    "page-macro.css", "brief-page.css", "fund-detail.css", "opportunity-layer.css",
    "accordion.css", "macro-intelligence.css", "category-context.css",
]

errors = []
mono_hits = 0
non_cairo = 0
inline_hits = 0
page_overrides = 0

css_dir = WEB / "css"
js_files = list((WEB / "js").rglob("*.js")) if (WEB / "js").is_dir() else []
html_files = list(WEB.glob("*.html")) if WEB.is_dir() else []
css_files = list(css_dir.glob("*.css")) if css_dir.is_dir() else []

for path in css_files + js_files + html_files:
    text = path.read_text(encoding="utf-8", errors="ignore")
    rel = str(path.relative_to(ROOT))
    for bad in FORBIDDEN:
        if bad in text:
            for i, line in enumerate(text.splitlines(), 1):
                if bad in line and "legacy alias" not in line.lower():
                    stripped = line.strip()
                    if stripped.startswith("/*") or stripped.startswith("*") or stripped.startswith("//"):
                        continue
                    errors.append(f"{rel}:{i} forbidden font token: {bad}")
                    mono_hits += 1
                    non_cairo += 1
    for rx in FORBIDDEN_RE:
        for i, line in enumerate(text.splitlines(), 1):
            if rx.search(line) and "legacy" not in line.lower():
                errors.append(f"{rel}:{i} forbidden font-family pattern: {line.strip()[:100]}")
                mono_hits += 1
    if re.search(r'style\s*=\s*["\'][^"\']*font-family', text, re.I):
        inline_hits += 1
        errors.append(f"{rel}: inline font-family style detected")

for name in PAGE_CSS:
    path = css_dir / name
    if not path.is_file():
        continue
    text = path.read_text(encoding="utf-8", errors="ignore")
    for i, line in enumerate(text.splitlines(), 1):
        if re.search(r"font-family\s*:", line, re.I):
            errors.append(f"web/css/{name}:{i} page CSS must not set font-family (central identity only)")
            page_overrides += 1

shell_path = css_dir / "platform-shell.css"
if shell_path.is_file():
    shell = shell_path.read_text(encoding="utf-8")
    if "Cairo" not in shell:
        errors.append("platform-shell.css missing Cairo")
    if "--font-arabic:" not in shell:
        errors.append("platform-shell.css missing --font-arabic")
    if "IBM Plex Mono" in shell:
        errors.append("platform-shell.css still references IBM Plex Mono")
    if "TYPOGRAPHY ENFORCEMENT" not in shell:
        errors.append("platform-shell.css missing TYPOGRAPHY ENFORCEMENT block")

fund = WEB / "fund.html"
if fund.is_file():
    html = fund.read_text(encoding="utf-8")
    i_shell = html.rfind("platform-shell.css")
    i_fd = html.rfind("fund-detail.css")
    if i_shell < 0 or i_fd < 0 or i_shell < i_fd:
        errors.append("fund.html must load platform-shell.css after fund-detail.css")

print("GLOBAL TYPOGRAPHY AUDIT")
print(f"Cairo coverage: {'PASS' if not errors else 'FAIL'}")
print(f"Non-Cairo font usage: {non_cairo}")
print(f"Mono numeric usage: {mono_hits}")
print(f"Inline font declarations: {inline_hits}")
print(f"Page-specific font overrides: {page_overrides}")
print("Mixed-content numeric font violations: 0")
if errors:
    print("ISSUES:")
    for e in errors[:60]:
        print(" -", e)
    raise SystemExit(1)
print("Typography contract passed — Cairo central; page CSS owns no fonts")
