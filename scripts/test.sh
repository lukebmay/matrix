#!/usr/bin/env bash

shopt -s extglob
set -euo pipefail

APP_NAME="matrix-html"
VERSION="0.1.0"

RESET='\e[0m'
RED='\e[31m'
GREEN='\e[32m'
YELLOW='\e[33m'
BLUE='\e[34m'
MAGENTA='\e[35m'

usage() {
  cat <<'EOF'
Usage: scripts/test.sh

No tests are defined. The script says so and exits 0.

From this directory:
  npm test
  npm run test -- --help

From the lukemay.com repo root:
  npm run matrix test
  npm run matrix -- test --help

Npm swallows a dashed flag unless -- sits between the verb and that flag.
Positional locations (live, dry-run, plan) need no --.
EOF
}

for arg in "$@"; do
  case "$arg" in
  --help | -h)
    usage
    exit 0
    ;;
  --version | -V)
    echo "matrix test ${VERSION}"
    exit 0
    ;;
  *)
    echo -e "${RED}Unknown argument: ${arg}${RESET}" >&2
    exit 2
    ;;
  esac
done

echo -e "${BLUE}=== Testing ${MAGENTA}${APP_NAME}${BLUE} ===${RESET}"

echo -e "${YELLOW}No tests defined. Skipping.${RESET}"

echo -e "${GREEN}✅ ${APP_NAME} passed all tests!${RESET}"
