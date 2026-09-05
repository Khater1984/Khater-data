#!/usr/bin/env python3
"""Extract and syntax-check inline JavaScript blocks from static HTML pages."""
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

class ScriptParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inline = False
        self.buffer: list[str] = []
        self.blocks: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag != "script":
            return
        attrs = dict(attrs)
        self.inline = not attrs.get("src")
        self.buffer = []

    def handle_data(self, data):
        if self.inline:
            self.buffer.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.inline:
            self.blocks.append("".join(self.buffer))
            self.inline = False
            self.buffer = []

failures: list[str] = []
for html in sorted((ROOT / "web").glob("*.html")):
    parser = ScriptParser()
    parser.feed(html.read_text(encoding="utf-8"))
    for index, block in enumerate(parser.blocks, 1):
        if not block.strip():
            continue
        temp = ROOT / ".inline-check.js"
        temp.write_text(block, encoding="utf-8")
        result = subprocess.run(["node", "--check", str(temp)], capture_output=True, text=True)
        if result.returncode:
            failures.append(f"{html.relative_to(ROOT)} inline block {index}: {result.stderr.strip()}")
        temp.unlink(missing_ok=True)

if failures:
    print("INLINE JAVASCRIPT CHECK FAILED")
    print("\n".join(failures))
    sys.exit(1)
print("INLINE JAVASCRIPT OK")
