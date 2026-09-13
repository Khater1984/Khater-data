#!/usr/bin/env python3
"""Enforce the frontend's data-boundary rules without guessing about legacy files."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"

violations = []
notes = []

# Financial pages may not bypass canonical data services with direct Supabase REST calls.
for path in WEB.rglob("*.js"):
    text = path.read_text(encoding="utf-8", errors="ignore")
    rel = path.relative_to(ROOT).as_posix()
    if "/js/data/" not in rel and "/rest/v1/" in text:
        violations.append(f"{rel}: direct Supabase REST access outside web/js/data")

# Financial UI must not consume repository JSON snapshots as a runtime source of truth.
for path in list(WEB.rglob("*.html")) + list(WEB.rglob("*.js")):
    text = path.read_text(encoding="utf-8", errors="ignore")
    rel = path.relative_to(ROOT).as_posix()
    for pattern in (r"(?:\.\./|/)?data/[^\"'` ]+\.json", r"web/data/[^\"'` ]+\.json"):
        if re.search(pattern, text):
            violations.append(f"{rel}: runtime reference to repository JSON snapshot")

# Inline CSS/JS are reported, not failed, because a few legacy/bootstrap surfaces still
# require deliberate extraction. This keeps the audit evidence-based and non-destructive.
for path in WEB.glob("*.html"):
    text = path.read_text(encoding="utf-8", errors="ignore")
    rel = path.relative_to(ROOT).as_posix()
    if re.search(r"<style(?:\s[^>]*)?>", text, re.I):
        notes.append(f"{rel}: inline <style> remains; candidate for CSS extraction")
    if re.search(r"<script(?:\s[^>]*)?>\s*(?!</script>)", text, re.I) and re.search(r"<script(?:\s[^>]*)?>\s*\(?(?:async\s*)?function|<script(?:\s[^>]*)?>\s*['\"]use strict", text, re.I):
        notes.append(f"{rel}: inline controller/bootstrap remains; candidate for JS extraction")

if violations:
    print("FRONTEND BOUNDARY CHECK FAILED")
    for item in violations:
        print(" -", item)
    raise SystemExit(1)

print("FRONTEND BOUNDARY CHECK PASSED")
if notes:
    print("CONSOLIDATION NOTES")
    for item in notes:
        print(" -", item)
