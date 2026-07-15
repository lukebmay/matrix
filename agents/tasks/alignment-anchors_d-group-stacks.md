# Task — Alignment D: Group + stack utilities

**Status:** Ready  
**Plan:** [alignment-anchors.md](../plans/alignment-anchors.md)  
**Depends on:** B, C  
**Next:** E

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

- [ ] Both stack helpers work with default offsets
- [ ] Both offsets overridable (static or function)
- [ ] Group size is a correct bounding box for default stacks
- [ ] Session note updated

## Out of scope

Live Configuration card copy (E).

## Session note

*(overwrite each session)*
