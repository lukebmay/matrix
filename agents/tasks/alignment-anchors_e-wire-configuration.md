# Task — Alignment E: Wire Configuration card + email

**Status:** Ready  
**Plan:** [alignment-anchors.md](../plans/alignment-anchors.md)  
**Depends on:** D  
**Next:** F

## Goal

Replace per-line `location: [r, c]` / negative justify with layout
stacks + `pin` to coordinate **Grid**. Visual insets by eye.

## Do

1. Upper-right roles card: vertical stack, `align: 'left'`, pin top-right
   (or similar) to grid with character pads.
2. Email block: left-aligned, ~3 cols from left, bottom area; vertical
   and/or horizontal lines as designed.
3. Delete old negative-index path from DisplayText once unused.
4. Resize path: rebuild layout on Configuration restart (already
   restarts Matrix).
5. Eyeball `npm run dev` — card left edges flush; email pad ~3.

## Done when

- [ ] No ad-hoc per-line absolute locations for card/email
- [ ] Left-aligned multi-line card
- [ ] Email ~3-col left pad
- [ ] Session note updated

## Out of scope

Reveal policy rewiring details (F) beyond keeping app from breaking.

## Session note

*(overwrite each session)*
