# Task — Persistent text glow (settled + links)

**Status:** Done (2026-07-15)  
**Plan:** standalone (polish)  
**Priority:** P1 — visual polish for job-search homepage  
**Depends on:** SceneManager paint + `m-revealed` settled path (shipped)

## Goal

Restore a **persistent** glow on settled revealed text without the old
triple-layer link glow that tanked performance.

| Surface | Glow target |
| --- | --- |
| Settled revealed (non-link) | ~**2/3** of drop-tip brightness |
| Settled revealed **link** | **Same as** drop tip (not more) |
| Drop tip / link hover | Keep current tip-bright pulse |

Reference tip stack (`.m-drop-tip`):

```css
text-shadow:
  0 0 25px var(--col-hi),
  0 0 25px var(--col-hi),
  0 0 5px var(--col-med);
```

## Why

During SceneManager paint ownership, settled text was dialed to a calm
12px/4px stack and links lost tip-parity glow. Plain revealed text had
little persistent presence; links no longer read as interactive at rest.

## Do

1. Tune `.m-static.m-revealed` to ~2/3 tip (two medium blurs + tight core).
2. Tune `.m-static.m-revealed.m-link` to full tip stack with link colors.
3. Leave tip-on-cell and `.m-link-hover` as the bright pulse.
4. Avoid a third 25px layer (old `.m-link` was too heavy).
5. Build / smoke; optional eyeball.

## Done when

- [x] Settled non-link text has a clear persistent glow (~2/3 tip)
- [x] Settled links match tip glow strength (link hue)
- [x] No third full 25px layer on settled states
- [x] `scripts/build.sh` green

## Session note (2026-07-17)

Non-link settled glow was outer-only and looked smudged: mid-green
`#119922` blends with its halo, while bright link `#aaffff` still reads
crisp. Fix: keep outer `10px`/`18px` color-mix halo, add tight black
`1px`+`2px` under the glyph for edge definition. Links unchanged.
