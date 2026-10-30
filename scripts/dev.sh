#!/usr/bin/env bash

shopt -s extglob
set -euo pipefail

APP_NAME="matrix-html"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VERSION="0.1.0"
PORT="3000"
EXTRA=()

RESET='\e[0m'
RED='\e[31m'
BLUE='\e[34m'
MAGENTA='\e[35m'

usage() {
  cat <<'EOF'
Usage: scripts/dev.sh [--port N | --port=N] [extra server args]

Serve src/ with npx serve on port 3000. Stays in the foreground.
Extra arguments after the known flags are passed to serve.

From this directory:
  npm run dev
  npm run dev -- --port 9000

From the lukemay.com repo root:
  npm run matrix dev
  npm run matrix -- dev --port 9000

Npm swallows a dashed flag unless -- sits between the verb and that flag.
Positional locations (live, dry-run, plan) need no --.

--help and --version exit without starting the server.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
  --help | -h)
    usage
    exit 0
    ;;
  --version | -V)
    echo "matrix dev ${VERSION}"
    exit 0
    ;;
  --port)
    if [[ $# -lt 2 ]]; then
      echo -e "${RED}--port needs a number${RESET}" >&2
      exit 2
    fi
    PORT="$2"
    shift 2
    ;;
  --port=*)
    PORT="${1#--port=}"
    shift
    ;;
  --)
    shift
    if [[ $# -gt 0 ]]; then
      EXTRA+=("$@")
    fi
    break
    ;;
  *)
    EXTRA+=("$1")
    shift
    ;;
  esac
done

if [[ ! "$PORT" =~ ^[0-9]+$ ]] || ((10#$PORT < 1 || 10#$PORT > 65535)); then
  echo -e "${RED}port must be a number from 1 to 65535 (got ${PORT})${RESET}" >&2
  exit 2
fi

if ! command -v npx >/dev/null 2>&1; then
  echo -e "${RED}Missing npx. Install Node.js.${RESET}" >&2
  exit 127
fi

echo -e "${BLUE}=== Running ${MAGENTA}${APP_NAME}${BLUE} (dev mode) ===${RESET}"

exec npx --yes serve --listen "$PORT" "${PROJECT_DIR}/src" "${EXTRA[@]}"
