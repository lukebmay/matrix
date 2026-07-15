# Task — Alignment E: Wire Configuration card + email

**Status:** Done  
**Plan:** [alignment-anchors.md](../../alignment-anchors.md)  
**Depends on:** D  
**Next:** [alignment-anchors_f-reveal-glue.md](alignment-anchors_f-reveal-glue.md) (done)

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

- [x] No ad-hoc per-line absolute locations for card/email
- [x] Left-aligned multi-line card
- [x] Email ~3-col left pad
- [x] Session note updated

## Out of scope

Reveal policy rewiring details (F) beyond keeping app from breaking.

## Session note

**Shipped (2026-07-15):**

### Pads (by eye / prior feel)

| Block | Pad | Value | Meaning |
| --- | --- | --- | --- |
| roles | top | 2 | `Anchors.top(grid).plus(2)` |
| roles | right | 3 | `Anchors.right(grid).minus(3)` → right edge at `COLS-4` |
| email | left | 3 | `Anchors.left(grid).plus(3)` |
| email | bottom | 2 | `Anchors.bottom(grid).minus(2)` → shared corner row `ROWS-3` |

### contentLayers construction

```text
Grid(ROWS,COLS)
  roles: TextLine[] → stackVertical(align left, name "roles")
         pin topRight → [padTop, right-padRight]
  email: Group "email" (L-shape)
         H + V TextLines share group bottomLeft
         pin group bottomLeft → [bottom-padBottom, left+padLeft]
  solveLayout([grid, rolesGroup, ...roleLines, emailGroup, emailH, emailV])
  roles = DisplayText({ cells: rolesGroup.cells() })
  email = DisplayText({ cells: emailGroup.cells() })
  contentLayers = [roles, email]
  spawnPolicies unchanged (baseline + reveal-roles 3.5s + reveal-email 9s)
```

Group names for F: **`roles`**, **`email`** (children `role-0…`, `email-h`, `email-v`).

### DisplayText changes

- Accepts **`cells`** or **`positions`** only (layout output shape).
- **Removed** per-line `location` + negative-index justify + `addText` path.
- Still exposes: `.positions`, `.columns`, `unrevealedColumns`, `markRevealed`,
  `columnFullyRevealed`, `isComplete`, `complete` / `forceShowAll`.
- Optional bounds skip vs `state.config` ROWS/COLS.

### Tests

- `npm run build` OK.
- Node smoke (40×80): role lines share `left()`; roles top=2 right=COLS-4;
  email left=3; H/V share bottom-left corner; DisplayText cells non-empty;
  no negative coords. Browser eyeball **skipped** (no headless).

### Handoff F

| Concern | Where |
| --- | --- |
| Paint cells | `rolesGroup.cells()` / `emailGroup.cells()` → `DisplayText.positions` |
| Reveal columns | `layer.columns` / `layer.unrevealedColumns()` (still DisplayText) |
| Layout groups | `name: "roles"`, `name: "email"` |
| DropScene source | Prefer `group.cells()` / `points()`; keep DisplayText until DropScene lands |
| Spawn | `SpawnPolicy` still keys off DisplayText column APIs + timers |
| Rain baseline | Unchanged infinite policy; no Storm yet |

Do not reintroduce `location: [r,c]`. Layout rebuilds every `createScene()` (resize restarts Matrix).
