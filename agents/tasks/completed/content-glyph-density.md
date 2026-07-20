# Task — Content glyph density (narrow-viewport grid)

**Status:** Done (2026-07-20)  
**Plan:** [adaptive-performance.md](../../plans/adaptive-performance.md)  
**Priority:** P0 — first efficiency slice (layout cell count)  
**Depends on:** layout Grid/TextLine/attach (shipped)

## Goal

Cut DOM cell count on **narrow viewports** so rain is cheaper, while **all
card text still fits**. Drive COLS/ROWS from content + mono cell aspect (not
density packing). This is a layout / fit policy (short side ≤ 768), not a
GPU-quality gate — slow wide desktops keep desktop density and use other
plan slices (cheap glow, dirty paint, …).

## Do

1. Shared homepage copy constants (`ROLE_SPECS`, email, quote) for sizing + scene.
2. Narrow detect: `min(viewW, viewH) ≤ 768` (`IS_MOBILE` in config).
3. Pads narrow: side 1; top/bottom 1; blank row between roles and email.
4. **Portrait / square:** COLS from longest line + margin (+ pads); ROWS from aspect (`advanceEm`/`heightEm`), ≥ content stack including email L (vertical arm).
5. **Landscape narrow:** ROWS first = `1 + rolesH + 1 + 1 + 1`; COLS from aspect (≥ content width); horizontal email only (no vertical arm).
6. Quote: word-wrap to narrow `COLS − 2` or desktop `min(40, COLS − 2×pad)`.
7. `paintFromLogical`: toggle `m-link` from logical `href` (shared col-1 quote/email).

## Done when

- [x] Phone portrait ~30×26–30 (~780–900 cells) vs prior ~1.5–2k
- [x] Phone landscape ~40×10 band with 1 blank row between roles and email
- [x] Roles + email + quote fit without OOB; build green
- [x] Quote col-1 no longer stuck at link brightness after tip leaves

## Session note

Files: `src/js/Configuration.mjs`, `src/js/DomManager.mjs` (link paint).  
Renamed from `mobile-glyph-density.md` when the plan became device-agnostic.  
Next plan slice: [cheap-glow.md](cheap-glow.md) (done).
