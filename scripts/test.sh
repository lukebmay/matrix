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

echo -e "${BLUE}=== Testing ${MAGENTA}${APP_NAME}${BLUE} ===${RESET}"

# Tests
echo -e "${YELLOW}No tests defined. Skipping.${RESET}"

# Results
echo -e "${GREEN}✅ ${APP_NAME} passed all tests!${RESET}"
