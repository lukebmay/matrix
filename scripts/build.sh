#!/usr/bin/env bash

shopt -s extglob
set -euo pipefail

APP_NAME="matrix-html"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

RESET='\e[0m'
GREEN='\e[32m'
BLUE='\e[34m'
MAGENTA='\e[35m'

echo -e "${BLUE}=== Building ${MAGENTA}${APP_NAME}${BLUE} ===${RESET}"

rm -rf "$PROJECT_DIR/dist"
mkdir -p "$PROJECT_DIR/dist"

rsync -a \
  --exclude='.*' \
  "$PROJECT_DIR/src/" \
  "$PROJECT_DIR/dist/"

# Post-process dist for production browsers (esp. DDG iOS / WebKit):
#  1) Drop Node smoke tests (no node: imports in the shipped graph).
#  2) Content-hash cache-bust every relative .mjs import so sticky mobile
#     caches cannot keep a pre-fix module while HTML is fresh.
#  3) Version boot.mjs / app entry references in HTML.
python3 - "$PROJECT_DIR/dist" <<'PY'
import hashlib
import re
import sys
from pathlib import Path

dist = Path(sys.argv[1])

# --- 1) strip trailing smoke / Tests blocks ---
smoke_start = re.compile(
    r"\n// ={10,}\s*\n// (?:Smoke|Tests|--- smoke).*\n(?://.*\n)*// ={10,}\s*\n[\s\S]*\Z",
    re.IGNORECASE,
)
smoke_tail = re.compile(
    r"\n// (?:Smoke|--- smoke).*\n[\s\S]*\Z",
    re.IGNORECASE,
)

mjs_files = sorted(dist.rglob("*.mjs"))
for path in mjs_files:
    text = path.read_text(encoding="utf-8")
    stripped = smoke_start.sub("\n", text)
    if stripped == text:
        stripped = smoke_tail.sub("\n", text)
    if stripped != text:
        path.write_text(stripped, encoding="utf-8")

# --- 2) build id from shipped sources ---
h = hashlib.sha256()
for path in sorted(dist.rglob("*")):
    if not path.is_file():
        continue
    if path.suffix not in {".mjs", ".css", ".html", ".ttf", ".ico", ".js"}:
        continue
    h.update(path.relative_to(dist).as_posix().encode())
    h.update(path.read_bytes())
build_id = h.hexdigest()[:12]
(dist / "BUILD_ID").write_text(build_id + "\n", encoding="utf-8")

# --- 3) rewrite relative .mjs imports / dynamic imports ---
import_pat = re.compile(
    r"(?P<pre>(?:export\s+[^'\";\n]*\sfrom\s+|import\s+[^'\";\n]*\sfrom\s+|import\s*\(\s*))"
    r"(?P<q>['\"])(?P<path>\.{1,2}/[^'\"]+\.mjs)(?:\?[^'\"]*)?(?P=q)"
)

def bust(text: str) -> str:
    def repl(m: re.Match) -> str:
        return f"{m.group('pre')}{m.group('q')}{m.group('path')}?v={build_id}{m.group('q')}"

    return import_pat.sub(repl, text)

for path in mjs_files:
    text = path.read_text(encoding="utf-8")
    path.write_text(bust(text), encoding="utf-8")

# --- 4) HTML: version boot.mjs module entry ---
boot_src_re = re.compile(
    r"""(?P<pre><script\s+type=["']module["']\s+src=["'])"""
    r"""(?P<path>[^"']*boot\.mjs)(?:\?[^"']*)?"""
    r"""(?P<post>["']\s*>\s*</script>)""",
    re.IGNORECASE,
)

def bust_html(text: str) -> str:
    def repl(m: re.Match) -> str:
        return f"{m.group('pre')}{m.group('path')}?v={build_id}{m.group('post')}"

    return boot_src_re.sub(repl, text)

for path in sorted(dist.rglob("*.html")):
    text = path.read_text(encoding="utf-8")
    new = bust_html(text)
    if new != text:
        path.write_text(new, encoding="utf-8")

print(f"build id {build_id} ({len(mjs_files)} modules)")
PY

echo -e "${GREEN}${APP_NAME} built successfully!${RESET}"
