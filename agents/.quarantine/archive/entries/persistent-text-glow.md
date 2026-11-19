# Persistent text glow

**Date:** 2026-07-15 (crisp fix 2026-07-17)  
**Task:** [tasks/completed/persistent-text-glow.md](../../tasks/completed/persistent-text-glow.md)

## What

Restored persistent `text-shadow` on settled revealed glyphs after the
SceneManager paint pass had dialed settled styles too calm and links lost
tip-level glow. Tuned again so mid-green body text stays crisp.

## Choices

| Choice | Why |
| --- | --- |
| Outer halo via `color-mix(… 90%, white)` | Readable rest glow without tip-pulse layers |
| Non-link: `1px`+`2px` black + `10px`/`18px` halo | Mid-green `#119922` smudges with outer-only; black tightens edges |
| Link: outer-only `14px`/`24px` link hue | Bright `#aaffff` already reads sharp; no black needed |
| No third full `25px` layer on settled | Old triple-25px link stack was a perf hit |
| CSS only | Paint path already sets `m-revealed` / `m-link` |

## Files

- `src/style.css` (`.m-static.m-revealed`, `.m-static.m-revealed.m-link`)
