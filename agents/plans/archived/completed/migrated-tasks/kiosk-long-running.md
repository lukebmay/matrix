# Task — Kiosk mode + long-running safety

**Status:** Done  
**Plan:** standalone (wall display / 24-7)  
**Priority:** P1  
**Depends on:** Matrix autopause, Application click/visibility, ScenePlayer loops

## Goal

Ship a **kiosk / wall mode** so the homepage can run unattended for hours or
days on a simple always-on display, without portfolio-tab safeguards freezing
the show. Also harden the few long-running risks that are not memory leaks.

## Why

Portfolio browsing wants:

- **Autopause** after ~10 minutes (`AUTOPAUSE_TIME`)
- **Click** to toggle pause
- **visibilitychange** stop when the tab is hidden

A wall box wants the opposite: never auto-pause, ignore casual clicks, and
prefer staying alive even when the OS/browser is flaky.

## Do

1. ~~Watchdog for stuck ScenePlayer / DropScene completion.~~
2. ~~Optional reload interval (config + doc).~~
3. ~~Smokes + DESIGN.md long-running section.~~
4. ~~Kiosk detect + config surface.~~
5. ~~Gate autopause and click-pause (and visibility keep-alive).~~
6. ~~DESIGN.md kiosk activation section + acceptance.~~
7. Session note; mark done when kiosk ships.

## Done when

- [x] Kiosk mode disables autopause
- [x] Kiosk mode disables click-to-pause (links policy documented)
- [x] Portfolio default still auto-pauses / click-pauses as today
- [x] Stuck-scene / hung-chain path recovers within watchdog window
- [x] Optional reload documented (on or off with clear default)
- [x] DESIGN.md records long-running + kiosk decisions
- [x] Build / relevant smokes green

## Session note

**2026-07-17 — kiosk activation shipped**

| Piece | Notes |
| --- | --- |
| `src/js/kiosk.mjs` | `resolveKiosk`: path `/kiosk`, query, hash, `__MATRIX_KIOSK__` |
| `Configuration.KIOSK` | Sets `AUTOPAUSE_TIME = 0` when true |
| `Matrix.start` | Skips autopause arm when `AUTOPAUSE_TIME <= 0` |
| `Application` | No click-pause; ignore visibility stop/start in kiosk |
| `src/kiosk/index.html` | `/matrix/kiosk/` shell → parent assets |
| monorepo `root/kiosk/` | `/kiosk/` when matrix is homepage (root deploy lists `kiosk`) |
| Links | Still navigate in kiosk (document only; not inert) |

**Next:** hover-hasten-reveal; deploy root+matrix so live URLs work.
