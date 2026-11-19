# Task — Alignment C: TextLine + materialize cells

**Status:** Done  
**Plan:** [alignment-anchors.md](../../completed/alignment-anchors.md)  
**Depends on:** A (geometry)  
**Next:** D (with B)

## Goal

**TextLine** positionable: size from string/orientation; materialize
glyph cells for DomManager/reveal (spaces in size, not in solid paint).

## Do

1. `layout/TextLine.mjs` (or fold into DisplayText carefully):
   - horizontal: h=1, w=length; vertical: w=1, h=length
   - optional per-line `href`
2. `materialize()` / **`cells()`** / **`points()`** →
   `{ r, c, char, href, lineId? }` for non-space glyphs using solved
   origin. (Name for DropScene binding — avoid overloading
   `canonical()` if that means origin only.)
3. Group should expose aggregated `cells()` for DropScene.from(group).
4. Keep DomManager able to consume the same position shape.

## Done when

- [x] Sizes include spaces
- [x] Spaces do not create static solid cells
- [x] href per line available on positions
- [x] `cells()`/`points()` suitable for DropScene
- [x] Session note updated

## Out of scope

Stack utilities, full Configuration rewrite (E).

## Session note

**Shipped (2026-07-15):**

| Path | Role |
| --- | --- |
| `src/js/layout/TextLine.mjs` | Positionable line; size from text; `cells`/`points`/`materialize` |

### API

```js
import TextLine from "./layout/TextLine.mjs";

const line = TextLine({
  text: "Hi there",
  orientation: "horizontal", // or "vertical"
  origin: [0, 0],            // optional; often set by attach/solve
  href: "mailto:…",          // optional; on every non-space cell
  lineId: 0,                 // optional; included on cells when set
  name: "roles-0",           // optional Positionable name
});
// H: width = text.length, height = 1
// V: width = 1, height = text.length
// Spaces count in size; omitted from cells()

line.cells();       // [{ r, c, char, href, lineId? }, …] non-spaces @ origin
line.points();      // alias → DropScene
line.materialize(); // alias → paint/DomManager positions shape
// inherits: origin, width, height, top/left/…, attach
```

### Group (D)

Group does **not** exist yet. **D must** aggregate child `TextLine.cells()`
(or `points()`) into `group.cells()` for `DropScene.from(group)`. Do not
expect TextLine to know about Group.

### Smoke

Node checks: H/V size with spaces; non-space cells only; href/lineId;
all-spaces empty paint; attach+solve origin shifts cells; aliases equal;
`npm run build` OK. DisplayText / Configuration untouched (E).
