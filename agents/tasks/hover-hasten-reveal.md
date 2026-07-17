# Task — Hover hastens reveal; hide re-reveals

**Status:** Ready  
**Plan:** standalone (interaction polish)  
**Priority:** P1 — clickable links during hide; snappy reveal UX  
**Depends on:** DropScene modes, ScenePlayer play, DomManager link handlers

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

## Design sketch (implementer fills in)

1. **Detect mode** for the content group under the pointer (roles / email /
   quote reveal+hide pair, or shared card hide points).
2. **If revealing / incomplete:** hasten — reveal remaining points for that
   line or whole group (prefer SceneManager / DropScene APIs over fake drops
   if possible; keep paint ownership).
3. **If hiding:**
   - Abort or reset the hide scene: full text back to revealed/logical
   - Restart hide from scratch (`enterMode("hiding")` reset of
     `columnsSelected`, storm again, timeline-friendly with ScenePlayer)
   - Practical bar: user can click a link before hide wins again
4. **Do not** speed up column coverage or force-clear cells on hover while
   hiding.
5. Wire from DomManager link handlers or a small interaction helper; avoid
   fighting ScenePlayer cue chains (may need a “user interrupt” path).

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

(not started — next session)

**Prior session left:** settled glow crisp fix shipped in `src/style.css`
(non-link black `1px`+`2px` + color-mix halo; links unchanged). Start here.
