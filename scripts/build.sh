#!/usr/bin/env bash

shopt -s extglob  # extended glob patterns
set -euo pipefail # any failed command stops the script

APP_NAME="matrix-html"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ABSOLUTE_PATH="${SCRIPT_DIR}/$(basename "${BASH_SOURCE[0]}")"

# ANSI colors
RESET='\e[0m'
RED='\e[31m'
GREEN='\e[32m'
YELLOW='\e[33m'
BLUE='\e[34m'
MAGENTA='\e[35m'
CYAN='\e[36m'

echo -e "${BLUE}=== Building ${MAGENTA}${APP_NAME}${BLUE} ===${RESET}"

# Remove old dist and recreate it
rm -rf "$PROJECT_DIR/dist"
mkdir -p "$PROJECT_DIR/dist"

# Copy everything except the things we don't want in the final build
rsync -av --delete \
  --exclude="dist" \
  --exclude="scripts" \
  --exclude="node_modules" \
  --exclude="package.json" \
  --exclude="package-lock.json" \
  --exclude=".git" \
  "$PROJECT_DIR/" \
  "$PROJECT_DIR/dist/"

echo -e "${GREEN}✅ ${APP_NAME} built successfully!${RESET}"
