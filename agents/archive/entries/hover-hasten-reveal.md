# Hover hasten / re-reveal

**Date:** 2026-07-17  
**Task:** [plans/interactive-play/completed/hover-hasten-reveal.md](../../plans/interactive-play/completed/hover-hasten-reveal.md)

## What

Pointer over card/quote cells hastens incomplete reveal, extends hold
timers, and mid-hide **re-reveals** full text then restarts hide + storm —
without advancing the parent thread early.

## Choices

| Choice | Why |
| --- | --- |
| Policies on units (`onHover` / `handleHover`) | DomManager stays paint + link CSS |
| `bindHover` cell map | Hit-test only; no mode logic in DOM layer |
| Reveal = `hasten` same gen | One `completed`; parent advances once |
| Hide = `softLeaveActive` then restart | Abort must **not** emit `completed` |
| `forceStableRevealed` | Shared points + logical grid + repaint |
| Hold full re-arm | Lean default vs remaining-time math |

## Files

- `src/js/play/hover.mjs`, `homepage.mjs`, `runtime.mjs`
- `src/js/ScenePlayer.mjs` (`softLeaveActive`, `forceStableRevealed`)
- `src/js/DomManager.mjs` (tip-force removed)
