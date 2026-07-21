# Task — Color theme cycle (card + saying)

**Status:** Done (2026-07-20)  
**Plan:** standalone (visual try)  
**Priority:** P2 — job-search polish / eyeball  
**Depends on:** homepage Unit/Thread loop

## Goal

Multiple rain/text palettes with a **per-drop blend** into the next theme
during saying hide — not a jarring global CSS flip.

Each theme:

| Role | Use |
| --- | --- |
| low | Dark residual / bg text |
| med | Tails |
| body | Settled non-link (slightly whiter than med) |
| hi | Bright drop tip (on-hue, bright) |
| link / linkHover | Settled links (brighter; still tinted) |

## Do

1. [x] `themes.mjs` — palettes + `ThemeDirector` (ramp / full / commit / low fade)
2. [x] Drop bakes `theme` at spawn; Dom paints `--drop-*` + residual `--res-low`
3. [x] Homepage: blend on saying hide; wait idle; coverage drain after card storms
4. [x] Intro order then random; body vs med; residual per-cell; ambient low fade
5. [x] Timing polish: card hold 4s; rolesAt 1s; drain not before card

## Session note (final)

Shipped multi-theme rain/text with weather-style blend (not CSS flash).
`ThemeDirector` + per-drop paint + residual stamps + coverage pool drain.
Orange/yellow still in intro for eyeball; easy to drop from `THEME_INTRO` /
`THEME_POOL`. Next product priority remains saying playlist.
