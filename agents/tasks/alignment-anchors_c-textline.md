# Task — Alignment C: TextLine + materialize cells

**Status:** Ready  
**Plan:** [alignment-anchors.md](../plans/alignment-anchors.md)  
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

- [ ] Sizes include spaces
- [ ] Spaces do not create static solid cells
- [ ] href per line available on positions
- [ ] `cells()`/`points()` suitable for DropScene
- [ ] Session note updated

## Out of scope

Stack utilities, full Configuration rewrite (E).

## Session note

*(overwrite each session)*
