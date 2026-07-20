# Color theme cycle

**Date:** 2026-07-20  
**Tags:** themes, rain, css, play, coverage  
**Task:** [tasks/completed/color-themes-cycle.md](../../tasks/completed/color-themes-cycle.md)

## What

Multi-palette Matrix rain (green → blue → purple → red → orange → yellow →
green, then random). Themes change during **quote hide** as weather: new-color
drops mix in, then dominate; settled CSS commits for the next card.

## Why

A global CSS snap looked broken. Color should feel like climate changing —
one foreign tip at a time, residual glyphs keep their last drop’s hue until
touched again.

## Design choices

| Choice | Rationale |
| --- | --- |
| `ThemeDirector` (not DropScene) | Spawn/palette policy, not reveal geometry |
| Drop bakes `theme` at spawn | Mid-air trails never recolor mid-fall |
| Per-cell `--res-low` | Residual text only changes after a drop visits |
| Ambient `--col-low` fade | Unstamped default eases over ~3s on commit |
| Coverage pool = rain firstPass | Theme-filtered without-replacement re-walk after change |
| Drain storm after card storms | 1s pool finish once roles+email storms really started |
| `stopStorm` silent if idle | clearView no longer fake-fires coverage drain |

## Major problems

1. **Early all-column storm** — `clearView` → `stopStorm` always emitted
   `stormStop`, arming drain before roles/email. Fixed: emit only when storm
   was enabled; drain requires real stormStart→stormStop (or email hover).
2. **Brightest whites too pure** — dialed hue back into hi/link.
3. **Static = tails** — added `body` slightly whiter than `med`.

## Key paths

- `src/js/themes.mjs` — palettes, director, lerp fade
- `src/js/Rain.mjs` — coverage pool + drain storm
- `src/js/play/homepage.mjs` — blend beat, drain arm, timing
- `src/js/DomManager.mjs` — per-drop / residual CSS vars
- `docs/DESIGN.md` — color themes + coverage sections
