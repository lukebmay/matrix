# Plan — Adaptive performance (smooth rain on slower devices)

**Status:** Complete (archived 2026-07-20) — core slices 1–6 shipped  
**Optional later:** slice 7 canvas rain layer (not blocking product)  
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
| Sticky `setTimeout(90)` loop | No vsync; delay-after-work stacked overruns (fixed: rAF + adaptive) |
| Fonts / mix glyph faces | Secondary |

## Slices (priority = largest efficiency gain first)

| # | Slice | Status | Est. gain | Notes |
| --- | --- | --- | --- | --- |
| 1 | **Fewer glyphs (content grid)** | **Done** | High | Narrow viewport COLS/ROWS; portrait/landscape; quote wrap; link paint |
| 2 | **Cheap glow CSS (adaptive)** | **Done** | Highest remaining | Cap/remove multi-blur; no `color-mix`; static + runtime ratchet (DOM class; no frozen-cfg mutate) |
| 3 | **Dirty DomManager paint** | **Done** | High | Only restyle tip enter / trail leave / role flip; cache theme vars |
| 4 | **Hot-path allocations** | **Done** | Medium | Reuse maps; `forEachColumnDrops`; pre-split rain glyph pools; thrift random |
| 5 | **Weather scale (constrained)** | **Done** | Medium | Lower rain peak / shorter tails / no storm stack when quality is low or viewport is tight |
| 6 | **Frame scheduler** | **Done** | Medium | rAF throttle + adaptive interval + dt clamp; quality ratchet on live target |
| 7 | **Canvas rain layer** (optional) | Later | Structural | Rain bitmap under DOM links/card — biggest architecture win |

## Slice 1 — Fewer glyphs (complete)

**Task:** [tasks/completed/content-glyph-density.md](../../tasks/completed/content-glyph-density.md)

- Narrow / “mobile” layout = short side ≤ 768 (orientation-invariant).
- **Portrait / square:** COLS from roles+email (+ margin, pad 1); ROWS from mono cell aspect, floored to content stack (email L-shape).
- **Landscape:** ROWS = pad1 + roles + gap1 + emailH(1) + pad1; COLS from aspect (min content width); **horizontal email only**.
- Quote: `wrapWords` to COLS−2 (narrow) or max 40 (wide).
- Shared cells: logical `href` drives `m-link` (quote vs email col 1).

Rough cell counts: phone portrait ~780–900; landscape ~380–460; wide desktop density unchanged.

## Slice 2 — Cheap glow (complete)

**Task:** [tasks/completed/cheap-glow.md](../../tasks/completed/cheap-glow.md)

- `html.m-cheap-glow` from `IS_CHEAP_GLOW`: narrow viewport **or** low-power
  heuristic (`deviceMemory` ≤ 4, ≤2 cores, reduced-motion, saveData), **or**
  Matrix frame ratchet (~8 heavy frames: JS work **or** wall-gap overrun).
- Ratchet mutates DOM class + Matrix-local flag only (config is frozen).
- Trails: no `text-shadow` (fill color only).
- Tip / settled body / link / hover: one short blur; no `color-mix`.
- Full neon unchanged without the class; ratchet only escalates (any device).

## Slice 3 — Dirty DomManager paint (complete)

**Task:** [tasks/completed/dirty-dom-paint.md](../../tasks/completed/dirty-dom-paint.md)

- Per-cell `trailRole` + `trailTheme`; skip class / CSS-var writes when clean.
- Tip enter still resolves + paints glyph for newly covered rows only.
- Trail leave clears drop chrome; re-sync settled content if revealed.
- Steady mid-trail rows are free (no per-frame restyle).

## Slice 4 — Hot-path allocations (complete)

**Task:** [tasks/completed/hot-path-allocations.md](../../tasks/completed/hot-path-allocations.md)

- Pre-split rain glyph pools (`RainGlyphs`); `randomChar` caches code-point arrays;
  `randomChoice(Set)` walks without `Array.from`.
- `DropManager.forEachColumnDrops` / `isColumnLive`; free-col list reused + swap-pop.
- DomManager reuses `rowPaint` Map; body trail fills the length band only.
- Cheap-glow ratchet fix (same session): escalate via DOM class + local flag only
  (Configuration is frozen); also count wall-gap overruns.

## Slice 5 — Weather scale (complete)

**Task:** [tasks/completed/weather-scale.md](../../tasks/completed/weather-scale.md)

- Same static gate as cheap glow (`WEATHER_SCALE = IS_CHEAP_GLOW`): narrow or
  low-power heuristic.
- Rain soft-square **peak** × 0.65; trough floored (~1.25/s, not zero);
  `DROP_LENGTH_*` × 0.6 with min length 5 (tip+4); `ALLOW_STORM_STACK = false`;
  storm duration × 2 on top of doubled homepage bases; ambient rain paused during storms.
- Runtime ratchet (with cheap glow): `state.weatherScale` +
  `state.allowStormStack`; thin ambient rain / shorten new drops if config was
  full quality. Never mutate frozen Configuration.
- Storm rates unchanged (refund still honest); free selected cols still spawn.

## Slice 6 — Frame scheduler (complete)

**Task:** [tasks/completed/frame-scheduler.md](../../tasks/completed/frame-scheduler.md)

- `requestAnimationFrame` arm; throttle to base `FRAME_DELAY` (~90ms).
- Tick clock from last tick (`performance.now` / rAF time) — not
  delay-after-work — so overrun is not sticky.
- Adaptive target: stretch toward `FRAME_DELAY_MAX` (~180ms) when work is
  heavy; ease back when light. Prefer fewer frames over thrash.
- Cap sim dt (`FRAME_DT_MAX_MS` ≈ 250) for hitch recovery.
- Quality ratchet budgets use the **live** target interval.
- Pause / visibility still cancel the arm; unpause restores residual gap.

## Out of scope (this plan)

- Quote playlist / interactive-play content (separate plan).
- Deploy / job-search copy polish.
- Theme cull (orange/yellow) unless tied to a paint pass.

## Done when (plan)

- [x] Content glyph density + layout fit on narrow viewports (slice 1)
- [x] Adaptive cheap glow (slice 2) — trails none; tip/settled single short blur; slow desktops covered
- [x] Dirty DomManager paint (slice 3) — tip enter / trail leave / role flip only
- [x] Hot-path allocations (slice 4) — glyph pools, drop iteration, free-col reuse
- [x] Weather scale (slice 5) — lower rain peak, shorter tails, no storm stack
- [x] Frame scheduler (slice 6) — rAF + adaptive interval + dt clamp
- [x] Slow devices: cheaper path via density / glow / weather / fewer frames
- [x] Capable devices keep full neon without the quality class (until ratchet)
- [x] Build green; no layout OOB for card/quote on phone portrait/landscape

## Session note (2026-07-20)

- Slice 6: `Matrix.mjs` rAF throttle + adaptive `targetInterval`; config
  `FRAME_DELAY_MAX` / `FRAME_DT_MAX_MS`; DESIGN + project next-queue update.
- Plan archived complete: slices 1–6 done. Optional remaining: canvas rain
  (slice 7). Product next: quote playlist interlude / deploy polish.

**2026-07-20 — Flat glow second tier + settled neon policy**

- `html.m-cheap-glow`: thrift **rain only** (trails none; tips short blur).
- `html.m-flat-glow`: no rain tip/trail `text-shadow` (after cheap).
- Settled static + links keep **full** multi-blur neon at both thrift tiers
  (once-on-reveal paint). Tip/trail over settled reasserts settled neon
  under cheap/flat so rain thrift never dims card text.
- Matrix escalate-only path: full rain → cheap rain (+ weather) → flat rain.
- High inter-render gap / stretched interval / heavy work feed both tiers.
- Drop-budget **ladder** uses a shorter streak so early samples favor thrifty
  rain CSS and higher sustainable concurrent drops.
- Files: `style.css`, `Matrix.mjs`, `docs/DESIGN.md`.
