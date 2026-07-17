# Task — Kiosk mode + long-running safety

**Status:** Ready  
**Plan:** standalone (wall display / 24-7)  
**Priority:** P1 — next after storm stack; portfolio tab vs wall diverge  
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

### Long-running hardens

1. **Play-chain watchdog** — if a DropScene stays `revealing`/`hiding` with
   empty `columnsSelected` (or no progress) longer than N seconds (e.g. 30–60s),
   force settle / `forceStableHidden` / restart play chain so the loop cannot
   wait forever on `completed`.
2. **Optional soft reload** — periodic `location.reload()` (e.g. daily) as
   insurance against browser heap creep; off by default or long interval;
   document for wall operators.
3. Smoke or comment checklist: drops still capped (rain 1/col, storm ≤2/col);
   no new unbounded structures.

### Out of scope (unless cheap)

- Custom kiosk browser flags / OS autologin scripts (doc only is fine)
- OLED burn-in mitigation beyond existing motion
- Service worker / offline packaging

## Do

1. Kiosk detect + config surface.
2. Gate autopause and click-pause (and optional visibility policy).
3. Watchdog for stuck ScenePlayer / DropScene completion.
4. Optional reload interval (config + doc).
5. Update [docs/DESIGN.md](../../docs/DESIGN.md) kiosk section + acceptance.
6. Smokes if pure-node testable; browser eyeball kiosk query.
7. Session note; mark done.

## Done when

- [ ] Kiosk mode disables autopause
- [ ] Kiosk mode disables click-to-pause (links policy documented)
- [ ] Portfolio default still auto-pauses / click-pauses as today
- [ ] Stuck-scene / hung-chain path recovers within watchdog window
- [ ] Optional reload documented (on or off with clear default)
- [ ] DESIGN.md records the decisions
- [ ] Build / relevant smokes green

## Session note

(not started — next session)

Start from `Matrix.mjs` autopause + `Application.mjs` click/visibility; add
watchdog near ScenePlayer / homepage chain completion waits.
