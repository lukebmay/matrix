#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_NAME="matrix"

if ! monorepo="$(cd "$SCRIPT_DIR/../../.." 2>/dev/null && pwd)"; then
  echo "${PROJECT_NAME} deploy.sh needs the lukemay.com monorepo." >&2
  exit 1
fi
COMMON="${monorepo}/scripts/common.sh"
if [[ ! -f "$COMMON" ]]; then
  echo "${PROJECT_NAME} deploy.sh needs the lukemay.com monorepo (missing ${COMMON})." >&2
  exit 1
fi
# shellcheck source-path=SCRIPTDIR/../../..
# shellcheck source=scripts/common.sh
source "$COMMON"

usage() {
  cat <<EOF
Usage: scripts/deploy.sh [live|dry-run|plan] [--skip-build]

Build dist/, then rsync it to luke@lukemay.com:/home/luke/www/${PROJECT_NAME}.
--delete applies only to that remote directory.

  live (default)  run the rsync
  dry-run         same rsync with --dry-run (still contacts the host)
  plan            print the live rsync and exit 0; no build and no rsync

--skip-build rsyncs the existing dist/ and does not rebuild.
A direct run with no --skip-build builds first. plan never builds.

From this directory:
  npm run deploy
  npm run deploy plan

From the lukemay.com repo root:
  npm run matrix deploy
  npm run matrix deploy plan

Npm swallows a dashed flag unless -- sits between the verb and that flag.
  npm run matrix -- deploy --skip-build
  npm run deploy -- --skip-build
Positional locations (live, dry-run, plan) need no --.
EOF
}

if ps_wants_help "$@"; then
  usage
  exit 0
fi
if ps_wants_version "$@"; then
  ps_print_version "$PROJECT_NAME" deploy
  exit 0
fi

ps_parse_deploy no "$@"
ps_finish_deploy "$PROJECT_DIR" "$PROJECT_NAME" yes
