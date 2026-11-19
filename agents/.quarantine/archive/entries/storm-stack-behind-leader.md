# Storm stack-behind-leader

**Date:** 2026-07-17  
**Task:** [tasks/completed/storm-stack-behind-leader.md](../../tasks/completed/storm-stack-behind-leader.md)

## What

Storms can place a second drop on an occupied `columnsSelected` column so
coverage is not blocked by a pre-activation (or other non-covering) squatter.
Follower speed is capped so it stays ≥1 glyph behind when the leader tip
reaches the final row.

## Choices

| Choice | Why |
| --- | --- |
| `byCol` map of live drops | Free = empty col; trail clear only when last drop finishes |
| Free selected before stack | Prefer real free coverage; stack is the fallback |
| `maxSafeStackSpeed` end-constraint | Tightest no-overtake cap under constant speeds |
| Skip stack if head start &lt; 1 row | Cannot stay one-behind if already co-located |
| Stack overrides last-3 blind max | Blind max would overtake the leader |
| Dom union trail per col | Multi-tip stacks must not thrash CSS per-drop |
| Cap 2 live drops/col | Re-activation while a stack pair lives was piling 3+ by cycle 3 |

## Files

- `src/js/DropManager.mjs` (`maxSafeStackSpeed`, multi-drop, speed rules, cap)
- `src/js/DropScene.mjs` (`pickColumns` free-then-stack)
- `src/js/DomManager.mjs` (per-col union trail paint)
