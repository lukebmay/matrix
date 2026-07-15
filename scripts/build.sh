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

echo -e "${GREEN}${APP_NAME} built successfully!${RESET}"
