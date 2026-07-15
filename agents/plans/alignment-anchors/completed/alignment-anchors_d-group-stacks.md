# Task — Alignment D: Group + stack utilities

**Status:** Done  
**Plan:** [alignment-anchors.md](../../alignment-anchors.md)  
**Depends on:** B, C  
**Next:** [alignment-anchors_e-wire-configuration.md](../../../tasks/alignment-anchors_e-wire-configuration.md)

## Goal

**Group** positionable + **stackVertical** / **stackHorizontal** with
`offsetRow` / `offsetCol` (defaults per plan). Readable helpers, not
opaque FP pipelines.

## Do

1. `layout/Group.mjs` — abstract positionable; children list; size after
   layout of children.
2. `stackVertical(items, { align: 'left'|'center'|'right', offsetRow,
   offsetCol })` — defaults offsetRow=1, offsetCol=0.
3. `stackHorizontal(...)` — defaults offsetRow=0, offsetCol=1.
4. Document chosen strategy (group slots vs sibling chain) in code
   comments briefly + session note.
5. Unit test: three lines left-aligned share `left()`; widths differ.

## Done when

- [x] Both stack helpers work with default offsets
- [x] Both offsets overridable (static or function)
- [x] Group size is a correct bounding box for default stacks
- [x] Session note updated

## Out of scope

Live Configuration card copy (E).

## Session note

**Shipped (2026-07-15):**

| Path | Role |
| --- | --- |
| `src/js/layout/Group.mjs` | Abstract Positionable; children; `cells`/`points`/`materialize`; `fitToChildren` |
| `src/js/layout/stack.mjs` | `stackVertical` / `stackHorizontal` |

### Strategy (hybrid)

- **First child** pins to the **group** (group slot).
- **Packing axis** is a **sibling chain** (`next` after `prev` + offset).
- **Align axis** pins **each** child to the **group** edge/center so mixed
  widths share one left/center/right (or top/middle/bottom).
- Offsets evaluated at **wire time**: `number` or `(index, prev, item) => number`.
- Inclusive edges: `offset=1` is adjacent (no empty cell). Bounding span =
  `sum(sizes) + sum(offset - 1)` per gap.

### API

```js
import Group from "./layout/Group.mjs";
import { stackVertical, stackHorizontal } from "./layout/stack.mjs";
import { solveLayout } from "./layout/attach.mjs";
import { Anchors } from "./layout/Anchor.mjs";
import TextLine from "./layout/TextLine.mjs";

const lines = [
  TextLine({ text: "Software Engineer", name: "r0" }),
  TextLine({ text: " luke@…", name: "r1" }), // spaces count in size
];
const card = stackVertical(lines, { align: "left", name: "roles" });
// card.width = max line widths; card.height = packed inclusive span
// optional: { group, offsetRow, offsetCol, name }
// align vertical: left|center|right; horizontal: top|middle|bottom

card.attach({
  this: Anchors.topRight(card),
  that: [Anchors.top(grid).plus(2), Anchors.right(grid).minus(3)],
});
solveLayout([grid, card, ...lines]); // all participants

card.cells(); // aggregates child TextLine.cells() for DropScene
```

```js
stackHorizontal(items, {
  align: "top", // top|middle|bottom
  offsetRow: 0,
  offsetCol: 1,
  group, // optional existing Group
  name,
});
```

### Tests

Node smoke: three left-aligned lines share `left()` with different widths;
default vertical/horizontal packing; static + function offsets; center/right/
middle align; `Group.cells` aggregate; `fitToChildren` matches stack size;
empty stack; reuse provided group. All passed. `npm run build` OK.

### Handoff E

- Build card: `TextLine`s → `stackVertical(..., { align: "left" })` → pin group
  to coordinate `Grid` with character pads → `solveLayout([grid, group, ...lines])`.
- Email block: separate group/stack, pin left ~3 cols, lower area.
- Pass **group + every child** into `solveLayout` (topo needs all).
- `group.cells()` / `points()` → content layers / DropScene (F); do not use origin-only.
- DomGrid / DisplayText still old path until you replace Configuration wiring.
