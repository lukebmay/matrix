# Plan — Adaptive performance (smooth rain on slower devices)

**Status:** In progress — density + cheap glow + dirty paint + hot-path allocs shipped  
**Project:** `projects/matrix`  
**Related analysis:** frame = advance → paint → settle; DOM rain + multi-shadow
glow is the bottleneck (not drop math).

## Goal

Smooth Matrix rain on **any** device that struggles — old phones, weak
laptops, thrifty VMs — while keeping the full neon look on machines that can
afford it.

**Rule:** render the better CSS when free; **downgrade for speed** when
static hints or measured frame work say the budget is blown. Prefer cheaper
frames over higher FPS when both are not free.

Quality gates (CSS / weather / paint thrift) are **capability-scoped**.
Narrow-viewport **layout** (fewer cells so the card still fits) stays a
separate short-side / orientation policy — not the same as “slow.”

## Diagnosis (summary)

| Cost | Why it hurts on slower devices |
| --- | --- |
| Multi-layer `text-shadow` | Large blur on hundreds of trail cells / frame |
| Full-trail DOM restyle | Every live column rewrites class + CSS vars every frame |
| Grid density | ~1.5–2k cells on small viewports before content sizing |
| Per-frame allocs | `Array.from(drops)`, Maps, `"r,c"` keys |
| `setTimeout(90)` loop | No vsync; overrun feels sticky |
| Fonts / mix glyph faces | Secondary |

## Slices (priority = largest efficiency gain first)

| # | Slice | Status | Est. gain | Notes |
| --- | --- | --- | --- | --- |
| 1 | **Fewer glyphs (content grid)** | **Done** | High | Narrow viewport COLS/ROWS; portrait/landscape; quote wrap; link paint |
| 2 | **Cheap glow CSS (adaptive)** | **Done** | Highest remaining | Cap/remove multi-blur; no `color-mix`; static + runtime ratchet (DOM class; no frozen-cfg mutate) |
| 3 | **Dirty DomManager paint** | **Done** | High | Only restyle tip enter / trail leave / role flip; cache theme vars |
| 4 | **Hot-path allocations** | **Done** | Medium | Reuse maps; `forEachColumnDrops`; pre-split rain glyph pools; thrift random |
| 5 | **Weather scale (constrained)** | **Next** | Medium | Lower rain peak / shorter tails / no storm stack when quality is low or viewport is tight |
| 6 | **Frame scheduler** | Pending | Medium | rAF + further adaptive quality when `dt` / work spikes |
| 7 | **Canvas rain layer** (optional) | Later | Structural | Rain bitmap under DOM links/card — biggest architecture win |

## Slice 1 — Fewer glyphs (complete)

**Task:** [tasks/completed/content-glyph-density.md](../tasks/completed/content-glyph-density.md)

- Narrow / “mobile” layout = short side ≤ 768 (orientation-invariant).
- **Portrait / square:** COLS from roles+email (+ margin, pad 1); ROWS from mono cell aspect, floored to content stack (email L-shape).
- **Landscape:** ROWS = pad1 + roles + gap1 + emailH(1) + pad1; COLS from aspect (min content width); **horizontal email only**.
- Quote: `wrapWords` to COLS−2 (narrow) or max 40 (wide).
- Shared cells: logical `href` drives `m-link` (quote vs email col 1).

Rough cell counts: phone portrait ~780–900; landscape ~380–460; wide desktop density unchanged.

## Slice 2 — Cheap glow (complete)

**Task:** [tasks/completed/cheap-glow.md](../tasks/completed/cheap-glow.md)

- `html.m-cheap-glow` from `IS_CHEAP_GLOW`: narrow viewport **or** low-power
  heuristic (`deviceMemory` ≤ 4, ≤2 cores, reduced-motion, saveData), **or**
  Matrix frame ratchet (~8 heavy frames: JS work **or** wall-gap overrun).
- Ratchet mutates DOM class + Matrix-local flag only (config is frozen).
- Trails: no `text-shadow` (fill color only).
- Tip / settled body / link / hover: one short blur; no `color-mix`.
- Full neon unchanged without the class; ratchet only escalates (any device).

## Slice 3 — Dirty DomManager paint (complete)

**Task:** [tasks/completed/dirty-dom-paint.md](../tasks/completed/dirty-dom-paint.md)

- Per-cell `trailRole` + `trailTheme`; skip class / CSS-var writes when clean.
- Tip enter still resolves + paints glyph for newly covered rows only.
- Trail leave clears drop chrome; re-sync settled content if revealed.
- Steady mid-trail rows are free (no per-frame restyle).

## Slice 4 — Hot-path allocations (complete)

**Task:** [tasks/completed/hot-path-allocations.md](../tasks/completed/hot-path-allocations.md)

- Pre-split rain glyph pools (`RainGlyphs`); `randomChar` caches code-point arrays;
  `randomChoice(Set)` walks without `Array.from`.
- `DropManager.forEachColumnDrops` / `isColumnLive`; free-col list reused + swap-pop.
- DomManager reuses `rowPaint` Map; body trail fills the length band only.
- Cheap-glow ratchet fix (same session): escalate via DOM class + local flag only
  (Configuration is frozen); also count wall-gap overruns.

## Out of scope (this plan)

- Quote playlist / interactive-play content (separate plan).
- Deploy / job-search copy polish.
- Theme cull (orange/yellow) unless tied to a paint pass.

## Done when (plan)

- [x] Content glyph density + layout fit on narrow viewports (slice 1)
- [x] Adaptive cheap glow (slice 2) — trails none; tip/settled single short blur; slow desktops covered
- [x] Dirty DomManager paint (slice 3) — tip enter / trail leave / role flip only
- [x] Hot-path allocations (slice 4) — glyph pools, drop iteration, free-col reuse
- [ ] Slow devices feel smooth during rain + card reveal (phone **and** weak desktop)
- [ ] Capable devices keep full neon without the quality class
- [ ] Build green; no layout OOB for card/quote on phone portrait/landscape
