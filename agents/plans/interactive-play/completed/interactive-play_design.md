# Task — Interactive play authoring design lock

**Status:** Active (discussion)  
**Plan:** [plans/interactive-play.md](../../interactive-play.md)  
**Priority:** P1 design — unblocks clean hover + future playlist/portrait  
**Depends on:** ScenePlayer play context (shipped)

## Goal

Lock how we **stitch scenes** in a **dev-friendly** way when the show is not
a pure animation — it must support **hover interrupts**, **segment restart**,
and later **quote/portrait playlists**.

No product code in this task unless a tiny spike is explicitly requested.

## Why

Shipped Style C (`play/homepage.mjs`) is a single linear chain. Full
`loop` / `loopFrom` force-hides **all** context scenes. Hide-hover needs
**local** re-reveal + hold/hide restart without advancing to the next major
beat. DomManager’s tip force-finish is not enough.

See plan for options A/B/C, hover matrix, and content slot shape.

## Do

1. Read [plans/interactive-play.md](../../interactive-play.md) + current
   `ScenePlayer.mjs` / `play/homepage.mjs` / hover task.
2. Discuss with Luke: jump vs units vs hybrid; hover scope; hold timer.
3. Record **locked decisions** in the plan (table + rejected alternatives).
4. Update [hover-hasten-reveal.md](hover-hasten-reveal.md) design sketch so
   implementer has a clear interrupt API target (even if interim).
5. Name follow-up implement tasks (segments, playlist, portrait) only after
   lock — do not start them here.

## Done when

- [x] Jump / restart model: **units + threads + gen cancel** (not pure seek)
- [x] Event substrate + sugar-with-desugar; no primary `completedOn`
- [x] Promise stance: cancel work/subscriptions, not Promise-as-value
- [x] Minimal surface: Unit start/stop/restart/completed/hover; Thread run/delay/loop
- [ ] Hover scope default (group vs line) — product detail, can default group
- [ ] Hover task acceptance pointed at unit interrupt surface
- [x] Playlist/portrait = later interlude unit
- [ ] Luke confirm solidify → move this task to plan `completed/`

## Out of scope

- Implementing hover, segments, playlist, or portrait
- Visual timeline editor
- Frame-dt clock

## Session note

**2026-07-17 — Waiter lifetime + build order**

Documented gen/dispose for waits on restart/stop/discard (plan). Build order:
**Unit/Thread runtime first**, hover second — no DomManager policy shortcut.
Await Luke OK on waiter rules → lock design → implement runtime task.
