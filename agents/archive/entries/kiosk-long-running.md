# Kiosk mode + long-running safety

**Date:** 2026-07-17  
**Tags:** kiosk, wall, autopause, visibility, routes

## What

Unattended wall mode for the Matrix card site, plus earlier watchdog/soft-reload
hardens.

## Why

Portfolio wants polite pause (10 min idle, click, tab hide). A wall Pi wants
the opposite. Prefer a real `/kiosk` path so a tablet home button can open one
URL forever, without remembering query strings.

## Choices

- **Path-first activation** (`/kiosk`, `/matrix/kiosk`) with query/hash/global
  fallbacks — static shells, no SPA router.
- **Root shell** when matrix is homepage (`projects/root/kiosk/`) so
  `lukemay.com/kiosk` works; matrix always has `lukemay.com/matrix/kiosk`.
- **Links still navigate** in kiosk (not inert); click-to-pause only is gated.
- **Visibility ignored** in kiosk (keep-alive); portfolio unchanged.
- Soft reload remains opt-in (`SOFT_RELOAD_MS` default 0).

## Key paths

- `src/js/kiosk.mjs` — `resolveKiosk`
- `Configuration.KIOSK` / `AUTOPAUSE_TIME`
- `Application` click + visibility gates
- `src/kiosk/index.html`, monorepo `projects/root/kiosk/`
