# Plan — Mobile performance (smooth rain on old phones)

**Status:** In progress — glyph density shipped  
**Project:** `projects/matrix`  
**Related analysis:** frame = advance → paint → settle; DOM rain + multi-shadow
glow is the bottleneck (not drop math).

## Goal

Smooth Matrix rain on older mobile hardware (and fine on desktop). Prefer
**cheaper frames** over higher FPS if both are not free.

## Diagnosis (summary)

| Cost | Why it hurts on mobile |
| --- | --- |
| Multi-layer `text-shadow` | Large blur on hundreds of trail cells / frame |
| Full-trail DOM restyle | Every live column rewrites class + CSS vars every frame |
| Grid density | ~1.5–2k cells on phones before mobile sizing |
| Per-frame allocs | `Array.from(drops)`, Maps, `"r,c"` keys |
| `setTimeout(90)` loop | No vsync; overrun feels sticky |
| Fonts / mix glyph faces | Secondary |

## Slices (priority = largest efficiency gain first)

| # | Slice | Status | Est. gain | Notes |
| --- | --- | --- | --- | --- |
| 1 | **Fewer glyphs (content grid)** | **Done** | High | Content COLS/ROWS; portrait/landscape; quote wrap; link paint |
| 2 | **Cheap glow CSS (mobile)** | **Next** | Highest remaining | Cap/remove multi-blur shadows; drop `color-mix` in hot shadows |
| 3 | **Dirty DomManager paint** | Pending | High | Only restyle tip enter / trail leave / role flip; cache theme vars |
| 4 | **Hot-path allocations** | Pending | Medium | Reuse maps; skip `getDrops()` Array; pre-split rain glyph pools |
| 5 | **Mobile weather scale** | Pending | Medium | Lower rain peak / shorter tails / no storm stack on mobile |
| 6 | **Frame scheduler** | Pending | Medium | rAF + adaptive quality when `dt` spikes |
| 7 | **Canvas rain layer** (optional) | Later | Structural | Rain bitmap under DOM links/card — biggest architecture win |

## Slice 1 — Fewer glyphs (complete)

**Task:** [tasks/completed/mobile-glyph-density.md](../tasks/completed/mobile-glyph-density.md)

- Mobile = short side ≤ 768 (orientation-invariant).
- **Portrait / square:** COLS from roles+email (+ margin, pad 1); ROWS from mono cell aspect, floored to content stack (email L-shape).
- **Landscape:** ROWS = pad1 + roles + gap1 + emailH(1) + pad1; COLS from aspect (min content width); **horizontal email only**.
- Quote: `wrapWords` to COLS−2 (mobile) or max 40 (desktop).
- Shared cells: logical `href` drives `m-link` (quote vs email col 1).

Rough cell counts: phone portrait ~780–900; landscape ~380–460; desktop density unchanged.

## Slice 2 — Cheap glow (next)

**Task (ready):** [tasks/mobile-cheap-glow.md](../tasks/mobile-cheap-glow.md)

Largest remaining win: CSS paint/composite on trails and settled text.

## Out of scope (this plan)

- Quote playlist / interactive-play content (separate plan).
- Deploy / job-search copy polish.
- Theme cull (orange/yellow) unless tied to a paint pass.

## Done when (plan)

- [x] Mobile glyph density + layout fit (slice 1)
- [ ] Mobile profile feels smooth on a mid/old phone during rain + card reveal
- [ ] Desktop look largely unchanged (or intentional mobile-only quality gates)
- [ ] Build green; no layout OOB for card/quote on phone portrait/landscape
