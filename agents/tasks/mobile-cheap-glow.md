# Task — Cheap glow CSS on mobile (next)

**Status:** Ready  
**Plan:** [mobile-performance.md](../plans/mobile-performance.md)  
**Priority:** P0 — largest remaining mobile efficiency gain  
**Depends on:** [mobile-glyph-density.md](completed/mobile-glyph-density.md) (done)

## Goal

Cut GPU/compositor cost of rain trails and settled text on mobile by
**simplifying or removing multi-layer `text-shadow`**, without ruining the
desktop “neon matrix” look.

## Why first

After cell-count reduction, the hot path still restyles ~trail-length cells
per live drop every frame with large-radius multi-shadow stacks (and
`color-mix` on settled body/links). On old phones that alone can exceed the
~90ms frame budget.

## Do

1. Detect mobile (reuse `state.config.IS_MOBILE` or a CSS class on `html`/`#matrix`).
2. Mobile quality rules (pick a tight set; eyeball):
   - Trails (`.m-drop`): **0–1** small shadow or solid color only.
   - Tip (`.m-drop-tip`): one short blur or bright fill only.
   - Settled body/link: drop multi `color-mix` shadows or precompute hex; optional single soft glow.
3. Prefer a single class toggle (e.g. `html.m-mobile`) over per-cell style hacks.
4. Keep desktop CSS as-is (or shared tokens with mobile overrides).
5. Build + short eyeball: phone portrait rain + card reveal + quote.

## Out of scope

- Dirty paint / alloc fixes (slices 3–4 of the plan).
- Canvas rain layer.

## Done when

- [ ] Mobile trail/settled glow is cheaper (visibly fewer or smaller blurs)
- [ ] Desktop look unchanged without the mobile class
- [ ] No stuck-bright / wrong settled colors on quote/card
- [ ] `scripts/build.sh` green

## Handoff notes

- Glow lives in `src/style.css` (`.m-drop`, `.m-drop-tip`, `.m-static.m-revealed*`).
- `Configuration` already sets `IS_MOBILE`; stamp a class in construct or config CSS vars if needed.
- After this: dirty DomManager paint ([plan](../plans/mobile-performance.md) slice 3).
