# Task — Cheap glow CSS (adaptive quality)

**Status:** Done (2026-07-20)  
**Plan:** [adaptive-performance.md](../../plans/completed/adaptive-performance.md)  
**Priority:** P0 — largest remaining paint efficiency gain  
**Depends on:** [content-glyph-density.md](content-glyph-density.md) (done)

## Goal

Cut GPU/compositor cost of rain trails and settled text on **any device that
cannot afford full neon**, by simplifying or removing multi-layer
`text-shadow`. Machines that can render the better-looking CSS keep it.

## Why first

After cell-count reduction on narrow viewports, the hot path still restyles
~trail-length cells per live drop every frame with large-radius multi-shadow
stacks (and `color-mix` on settled body/links). On old phones **and** weak
desktops that alone can exceed the ~90ms frame budget.

## Do

1. Quality gate separate from layout: `IS_CHEAP_GLOW` + `html.m-cheap-glow`.
2. Turn cheap glow **on** when:
   - narrow viewport (`IS_MOBILE`), or
   - static low-power heuristic (`deviceMemory` ≤ 4, ≤2 cores,
     `prefers-reduced-motion`, `saveData`), or
   - runtime ratchet: several consecutive frames with work ≥ ~55% of
     `FRAME_DELAY`.
3. Quality CSS (when class is present):
   - Trails (`.m-drop`): **0** shadow (solid fill only).
   - Tip (`.m-drop-tip`): one short blur.
   - Settled body/link: one soft glow; no multi `color-mix` stacks.
4. Prefer a single class toggle over per-cell style hacks.
5. Keep full neon CSS as the default without the class; ratchet only escalates.
6. Build + eyeball: slow/narrow rain + card reveal + saying; capable desktop
   stays neon until/unless work spikes.

## Out of scope

- Dirty paint / alloc fixes (slices 3–4 of the plan).
- Canvas rain layer.

## Done when

- [x] Trail/settled glow is cheaper when the quality class is on
- [x] Full neon look without the class (capable devices)
- [x] Slow desktops covered via heuristic and/or frame ratchet
- [x] No stuck-bright / wrong settled colors on saying/card
- [x] `scripts/build.sh` green

## Session note (2026-07-20)

- Class is quality-scoped: `html.m-cheap-glow` from `IS_CHEAP_GLOW`.
- On at config: narrow viewport **or** low-power heuristic.
- Runtime: Matrix measures frame work; ~8 consecutive frames ≥ ~55% of
  `FRAME_DELAY` ratchets the class on (never off mid-session).
- CSS: trails `text-shadow: none`; tip / settled / link one short blur; no `color-mix`.
- Files: `Configuration.mjs`, `Matrix.mjs`, `style.css`, `docs/DESIGN.md`.
- Renamed from `mobile-cheap-glow.md` when the plan became device-agnostic.

## Fix note (2026-07-20)

- **Bug:** `Object.freeze(Configuration)` made `cfg.IS_CHEAP_GLOW = true` throw in
  strict modules — class never applied; frame loop could die after 8 slow frames.
- **Fix:** ratchet uses a Matrix-local `cheapGlowOn` flag + `classList.add` only.
- Also count inter-frame wall gap (`≥ FRAME_DELAY + slowWorkMs`) so main-thread
  stalls after JS still escalate quality.
