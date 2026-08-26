# Task — Alignment B: env, anchors, attach + layout solve

**Status:** Done  
**Plan:** [alignment-anchors.md](../../completed/alignment-anchors.md)  
**Depends on:** A  
**Next:** C (TextLine; depends on A only); D needs B+C

## Goal

Runtime **env** flags; **Anchor** resolution (number | function |
object with `.canonical`); **attach** + **solve** + cycle detection.

## Do

1. Add `src/js/env.mjs`: `MODE`, `errorOnCycles` (dev true / prod false);
   detection order per plan (override → hostname → default prod).
2. Add `layout/Anchor.mjs` (or similar):
   - `resolveComponent(comp, ctx) → number`
   - `resolvePoint(point, ctx) → [row, col]`
   - small readable helpers (`Anchors.topLeft(p)`, `.plus(n)`, etc.)
   - Anchor **objects** preferred in authoring API; bare functions OK
3. Add `layout/attach.mjs`:
   - one attachment per positionable
   - `solveLayout(roots)` roots → leaves
   - if `env.errorOnCycles`, detect directed cycles (and double-static if
     straightforward); throw with path
4. Tests: static pin; mixed `[number, Anchor]`; simple parent/child;
   cycle throws when flag on.

## Done when

- [x] `env.errorOnCycles` behaves per mode
- [x] Mixed point components resolve
- [x] Attachment equality sets child origin correctly for top-left this
- [x] Cycle check gated by env
- [x] Session note updated

## Out of scope

TextLine, stacks, Configuration content. Rain first-pass / Storm naming
→ [rain-storm-column-coverage.md](../../../tasks/rain-storm-column-coverage.md) (parallel).

## Session note

**Shipped (2026-07-15):**

| Path | Role |
| --- | --- |
| `src/js/env.mjs` | Frozen `MODE`, `errorOnCycles`; `resolveMode` / `envFromMode` for tests |
| `src/js/layout/Anchor.mjs` | `Anchor`, `PointAnchor`, `Anchors.*`, `resolveComponent` / `resolvePoint`, `collectSources` |
| `src/js/layout/attach.mjs` | `attach`, `solveLayout`, cycle detect |
| `src/js/layout/Positionable.mjs` | `.attachment`, `.attach({ this, that })`, optional `.name` |

### env

- Order: `globalThis.__MATRIX_ENV__` → `?env=` query → localhost hostname → `production`
- `errorOnCycles`: `true` only when `MODE === "dev"`
- Node (no `location`): defaults production / false
- Override before import: `globalThis.__MATRIX_ENV__ = "dev"` or `?env=dev`

### Anchors

```js
import { Anchors, resolveComponent, resolvePoint } from "./layout/Anchor.mjs";

Anchors.top/left/bottom/right/middle/center(p)  // scalar + .plus(n)/.minus(n)
Anchors.topLeft/topRight/bottomLeft/bottomRight/middleCenter(p)  // point
// Resolve: number | (ctx)=>n | { canonical(ctx) } | { resolve(ctx) }
// Points: PointAnchor | [rowComp, colComp] mixed
```

### attach / solve

```js
import { solveLayout, attach } from "./layout/attach.mjs";

line.attach({
  this: Anchors.topLeft(line),
  that: [2, Anchors.right(grid).minus(3)],
});
// Pass **all** items (roots + children). Order is topo roots→leaves.
solveLayout([grid, parent, child]);
// Cycle: throws `layout cycle: …` when env.errorOnCycles (or options.errorOnCycles)
solveLayout(items, { errorOnCycles: true }); // test override
// Solver: origin so this-point == that-point (eval this at origin [0,0] for offset)
```

### Tests

Node smoke: env resolve; mixed `[number, Anchor]`; static pin; parent/child stack;
bottom-left this offset; cycle throw on / silent off; plan API example. All passed.
`npm run build` OK.

**Not wired:** Configuration / TextLine (C, E). DomGrid / rain untouched.
