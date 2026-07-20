# Paint-before-kill tip flush

**Date:** 2026-07-20  
**Kind:** bugfix (standalone)

## What

Hide/reveal glyphs sometimes survived a storm and only cleared when ambient
rain randomly re-hit the column. Same root class as occupation≠coverage:
**claim without a tip pass**.

## Why

Frame order was advance → kill completed → spawn → paint. On a long frame a
drop could jump past `ROWS`, mark complete, and be removed **before**
DomManager flushed tip rows. Selection had already drained on spawn, so the
storm stopped; residual points waited for rain.

## Fix

| Piece | Change |
| --- | --- |
| `DropManager.advanceDrops` | Motion only |
| `DropManager.settleDrops` | Kill + spawn (after paint) |
| `Matrix` loop | advance → `updateDom` → settle |
| Smoke | Large-dt hide still settles when paint runs while completed drops live |

Completed drops stay in the live set for one paint so `from..min(row,ROWS-1)`
tip resolve still runs.

## Files

- `src/js/DropManager.mjs`
- `src/js/Matrix.mjs`
- `docs/DESIGN.md` (war story)
