# Task — Mobile glyph density (content-driven grid)

**Status:** Done (2026-07-20)  
**Plan:** [mobile-performance.md](../../plans/mobile-performance.md)  
**Priority:** P0 — first mobile efficiency slice  
**Depends on:** layout Grid/TextLine/attach (shipped)

## Goal

Cut DOM cell count on mobile so rain is cheaper, while **all card text still
fits**. Drive COLS/ROWS from content + mono cell aspect (not density packing).

## Do

1. Shared homepage copy constants (`ROLE_SPECS`, email, quote) for sizing + scene.
2. Mobile detect: `min(viewW, viewH) ≤ 768`.
3. Pads mobile: side 1; top/bottom 1; blank row between roles and email.
4. **Portrait / square mobile:** COLS from longest line + margin (+ pads); ROWS from aspect (`advanceEm`/`heightEm`), ≥ content stack including email L (vertical arm).
5. **Landscape mobile:** ROWS first = `1 + rolesH + 1 + 1 + 1`; COLS from aspect (≥ content width); horizontal email only (no vertical arm).
6. Quote: word-wrap to mobile `COLS − 2` or desktop `min(40, COLS − 2×pad)`.
7. `paintFromLogical`: toggle `m-link` from logical `href` (shared col-1 quote/email).

## Done when

- [x] Phone portrait ~30×26–30 (~780–900 cells) vs prior ~1.5–2k
- [x] Phone landscape ~40×10 band with 1 blank row between roles and email
- [x] Roles + email + quote fit without OOB; build green
- [x] Quote col-1 no longer stuck at link brightness after tip leaves

## Session note

Files: `src/js/Configuration.mjs`, `src/js/DomManager.mjs` (link paint).  
Next plan slice: [mobile-cheap-glow.md](../mobile-cheap-glow.md).
