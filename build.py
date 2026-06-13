#!/usr/bin/env python3
"""
build.py — Bundle src/ into index.html (the single-file distributable)

Usage:
    python build.py

What it does:
  1. Reads src/index.html
  2. Inlines <link rel="stylesheet" href="..."> → <style>...</style>
  3. Collects all <script src="js/..."> tags in order, concatenates them into
     one <script> block with "use strict" at the top
  4. Writes the result to index.html (served by GitHub Pages + downloadable)

Development workflow:
  - Edit files in src/
  - Open src/index.html directly in a browser for live dev (no build needed)
  - Run `python build.py` before sharing / committing
"""

import re
from pathlib import Path

ROOT = Path(__file__).parent
SRC  = ROOT / "src"
OUT  = ROOT / "index.html"


def inline_css(m):
    path = SRC / m.group(1)
    return f"<style>\n{path.read_text(encoding='utf-8')}\n</style>"


def build():
    html = (SRC / "index.html").read_text(encoding="utf-8")

    # 1. Inline CSS link tags
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)

    # 2. Collect all <script src="js/..."> tags in document order
    js_srcs = re.findall(r'<script src="(js/[^"]+)"></script>', html)
    if js_srcs:
        parts = ['"use strict";']
        for src in js_srcs:
            p = SRC / src
            parts.append(f"\n\n/* ── {p.name} ── */\n")
            parts.append(p.read_text(encoding="utf-8"))
        js_block = "<script>\n" + "".join(parts) + "\n</script>"

        # Use a lambda to avoid backslashes in js_block being treated as regex escapes
        replacement = js_block + "\n"
        html = re.sub(
            r'(<script src="js/[^"]+"></script>\s*)+',
            lambda _: replacement,
            html
        )

    OUT.write_text(html, encoding="utf-8")
    kb = OUT.stat().st_size // 1024
    print(f"Built {OUT.name}  ({kb} kb)")


if __name__ == "__main__":
    build()
