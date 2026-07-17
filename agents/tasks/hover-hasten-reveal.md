# Task — Hover hastens reveal; hide re-reveals

**Status:** Ready (next)  
**Plan:** [plans/interactive-play.md](../plans/interactive-play.md)  
**Priority:** P1 — next after Unit/Thread runtime  
**Depends on:** [interactive-play_runtime.md](../plans/interactive-play/completed/interactive-play_runtime.md)
(Unit/Thread + homepage migrate — done)

## Goal

Make **hover** a practical interaction with the business-card text:

| Context | Hover behavior |
| --- | --- |
| **Revealing** (or incomplete reveal) | **Hasten** reveal for the hovered line / group — complete unrevealed points quickly so the user can read/click sooner |
| **Hiding** | **Do not** hasten hide. Instead **re-reveal the entire text** (so links are clickable), **reset hide from scratch**, and **re-call storm** (and any other hide kickoff) so hide restarts after the re-reveal |
| **Revealed** (stable) | Keep current link hover styling; no need to re-run weather |

## Why

Today link `mouseover` in `DomManager` force-applies tip resolve for the line
when `!layer.isComplete`, which is a partial “finish reveal” hack. It does
**not**:

- Coordinate with ScenePlayer hide phases
- Reset hide / storm when the user is mid-hide
- Clearly separate “hasten reveal” vs “never hasten hide”

Without re-reveal on hide, users can lose a link mid-click as glyphs vanish.

## Design sketch (unit APIs — no DomManager policy)

See [plans/interactive-play.md](../plans/interactive-play.md).

1. **Binder:** pointer over group cells → unit `hover` (DomManager hit-test
   only; policies live on units).
2. **Revealing:** `hasten` / force settle same gen → one `completed` (prefer
   group default; line optional).
3. **Hiding:** force reveal sibling content; `hideUnit.restart()` (no
   `completed` on abort); re-storm via unit `onStart`.
4. **Hold:** optional `onHover: "extend"` re-arms hold timer.
5. **Never** hasten hide coverage; never leave zombie waits (runtime gen).

## Do

1. Map current hover path (`DomManager` `onMouseOver` / `onMouseOut`).
2. Implement reveal-hasten without breaking logical grid ownership.
3. Implement hide → full re-reveal + hide+storm reset.
4. Smoke / browser eyeball: hover mid-reveal; hover mid-hide; click link.
5. Session note + mark done when acceptance passes.

## Done when

- [ ] Hover during reveal finishes (or clearly hastens) that text for interaction
- [ ] Hover during hide **never** hastens hide coverage
- [ ] Hover during hide re-reveals full text and restarts hide + storm from scratch
- [ ] Links remain clickable after a hide-context hover
- [ ] Paint still owned by logical grid + Dom paint path
- [ ] Build / smokes green

## Session note

(not started)

**Blocked on:** [interactive-play_runtime.md](interactive-play_runtime.md).
Do not implement DomManager tip-force as the product solution.
