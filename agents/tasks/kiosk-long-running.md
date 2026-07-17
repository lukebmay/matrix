# Task — Kiosk mode + long-running safety

**Status:** Partial — long-running hardens shipped; kiosk activation still Ready  
**Plan:** standalone (wall display / 24-7)  
**Priority:** P1 — kiosk slice left for a simple agent  
**Depends on:** Matrix autopause, Application click/visibility, ScenePlayer loops

## Goal

Ship a **kiosk / wall mode** so the homepage can run unattended for hours or
days on a simple always-on display, without portfolio-tab safeguards freezing
the show. Also harden the few long-running risks that are not memory leaks.

**Long-running hardens are done** (watchdog, soft-reload config, smokes).
Remaining work is **kiosk detect + gate autopause/click/visibility only**.

## Why

Portfolio browsing wants:

- **Autopause** after ~10 minutes (`AUTOPAUSE_TIME`)
- **Click** to toggle pause
- **visibilitychange** stop when the tab is hidden

A wall box wants the opposite: never auto-pause, ignore casual clicks, and
prefer staying alive even when the OS/browser is flaky. Drop/DOM state is
already bounded; the play chain can still **hang** if a scene never emits
`completed`.

## Design sketch (implementer fills in)

### Activation

Prefer one obvious switch (implementer picks, document in DESIGN.md):

| Option | Example |
| --- | --- |
| Query | `?kiosk=1` / `?wall=1` |
| Hash | `#kiosk` |
| Config | `Configuration.KIOSK` / env-ish flag at build |
| Combo | query overrides default portfolio mode |

Kiosk on ⇒ all portfolio “polite pause” features off.

### Must disable in kiosk

1. **Autopause** — do not arm `AUTOPAUSE_TIME` (or set remaining to Infinity).
2. **Click-to-pause** — ignore window click pause (links still navigate if
   desired; wall may want links inert — decide and document).
3. Document that **visibility stop** is environment-dependent: keep stop on
   hide if useful for laptop lids; for pure wall, either leave as-is (tab
   always visible) or optional `kioskKeepAlive` that ignores hide.

### Long-running hardens — DONE

1. **Play-chain watchdog** — `completionWatchdogMs` (default 60s) on play-context
   waits for scene `completed`; `DropScene.forceSettle` + `forceSettleActive`
   (logical apply/clear + repaint) so the loop cannot hang forever.
2. **Optional soft reload** — `Configuration.SOFT_RELOAD_MS` (default `0`);
   `Application.run` arms `location.reload()` when &gt; 0. Documented in DESIGN.md.
3. Smokes: DropScene forceSettle, SceneManager applyLogicalForScene, ScenePlayer
   watchdog + disabled path; occupancy checklist in DESIGN.md.

### Out of scope (unless cheap)

- Custom kiosk browser flags / OS autologin scripts (doc only is fine)
- OLED burn-in mitigation beyond existing motion
- Service worker / offline packaging

## Do

1. ~~Watchdog for stuck ScenePlayer / DropScene completion.~~
2. ~~Optional reload interval (config + doc).~~
3. ~~Smokes + DESIGN.md long-running section.~~
4. **Remaining:** Kiosk detect + config surface.
5. **Remaining:** Gate autopause and click-pause (and optional visibility policy).
6. **Remaining:** DESIGN.md kiosk activation section + acceptance; browser eyeball.
7. Session note; mark done when kiosk ships.

## Done when

- [ ] Kiosk mode disables autopause
- [ ] Kiosk mode disables click-to-pause (links policy documented)
- [ ] Portfolio default still auto-pauses / click-pauses as today
- [x] Stuck-scene / hung-chain path recovers within watchdog window
- [x] Optional reload documented (on or off with clear default)
- [x] DESIGN.md records long-running decisions (kiosk switch still open)
- [x] Build / relevant smokes green

## Session note

**2026-07-17 — long-running only (kiosk deferred)**

Shipped completion watchdog + soft-reload hook; left kiosk activation for a
simpler agent.

| API / path | Notes |
| --- | --- |
| `DropScene.forceSettle()` | Active → stable + `completed` (`forced: true`) |
| `forceSettleActive` (ScenePlayer) | Logical apply/clear + forceSettle + repaint |
| `SceneManager.applyLogicalForScene` | Force-reveal logical write |
| context `completionWatchdogMs` | Default 60s; `0` off; Config `COMPLETION_WATCHDOG_MS` |
| `SOFT_RELOAD_MS` | Default 0; Application one-shot reload when &gt; 0 |

**Next agent (kiosk only):** detect `?kiosk=1` / `#kiosk` / config; gate
`Matrix` autopause + `Application` click (and optional visibility); leave
watchdog/reload alone unless wiring a kiosk default for soft reload.
