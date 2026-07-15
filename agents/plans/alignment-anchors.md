# Plan — Alignment, anchors, and groups

**Status:** Ready — tasks filed  
**Project:** `projects/matrix`  
**Branch:** `refactor_07-2026`  
**Priority:** P1 — coherent business-card layout  

**Next task:**
[alignment-anchors_a-geometry-grid.md](../tasks/alignment-anchors_a-geometry-grid.md)

## Problem

Text placement is ad hoc (`location: [2, -4]` per line). Lines right-justify
independently, so block left edges misalign. Negative “from far edge”
indexing mixes poorly with padding-by-characters. Need a shared size +
attachment model for stacks, resize, and reveal.

## Goal

1. **Positionables** with canonical origin (top-left character) and
   integer width × height (spaces count in size).
2. **Anchors** resolve to canonical row/col (character cells, not
   exclusive edges).
3. **Attachments** lock this-point to that-point (static and/or anchors).
4. **Groups** are abstract positionables; children attach to group or
   siblings.
5. **Readable utilities** (not pure-FP hairballs) for common stacks.
6. Layout emits cells; rain/reveal keep current contracts.

Out of scope: video, multi-parent constraints, layout undo, animation
runtime, percent anchors (follow-on task G).

### Related product work (spawn / DropScene / Symphony) — end goal

Authoritative rules: `agents/project.md`.  
Tasks:
- [rain-storm-column-coverage.md](../tasks/rain-storm-column-coverage.md)
  — Rain/Storm sets + scene modes (MVP)
- [alignment-anchors_f-reveal-glue.md](../tasks/alignment-anchors_f-reveal-glue.md)
  — bind layout → scenes
- [symphony-orchestration.md](../tasks/symphony-orchestration.md)
  — event-driven “animation machine” (after MVP)

This app is ultimately a **simple animation machine**: scenes enter
**revealing** / **hiding** modes over time, driven by timers and scene
events. Layout and weather are subsystems; the **Symphony** is the
developer-facing script the orchestrator plays.

| Term | Meaning |
| --- | --- |
| **Drop** | One falling thread |
| **Rain** | Ambient spawn (grid DropScene; soft-square; forever) |
| **Storm** | Optional faster column coverage for a content DropScene |
| **DropScene** | Set of canonical points + column bookkeeping + **mode** |
| **Symphony** | Declarative program: when event X → start scene Y / mode Z |
| **Orchestrator** | Runs the Symphony; listens to scene events |

#### Four modes (replace vague activate/deactivate)

Prefer **not** a single “activated” boolean that means both show and hide.

| Kind | Mode | Meaning |
| --- | --- | --- |
| **Stable** | `hidden` | Text not shown; DropManager **ignores** this scene (no set updates, no Storm, no show/hide on pass) |
| **Stable** | `revealed` | Text fully shown (or fully intended-shown); idle until a hide scene/mode runs |
| **Active** | `revealing` | Drops over points **show** glyphs; `columnsSelected` tracks columns still needing coverage |
| **Active** | `hiding` | Reset `columnsSelected` from full `columns`; drops over points **hide** glyphs as columns are selected |

**Idle vs active:** A DropScene may **exist** in the graph at any time
(`hidden` or `revealed`). The drop system **only acts on it** while in
`revealing` or `hiding`. Entering an active mode is what used to be
called “activate.”

**Recommended split (prefer over one dual-purpose scene):**

- **Reveal DropScene** — mode path `hidden → revealing → revealed`
- **Hide DropScene** — mode path `revealed → hiding → hidden`  
  Same points/layout source; separate instances or one scene with a
  single active mode at a time. **Default design: separate scene
  instances** (reveal vs hide) so each has one job, one
  `columnsSelected` lifecycle, and clear completion events. Share the
  same `points` reference or rebuild from the same positionable.

#### Column selection

| Mode enter | `columnsSelected` |
| --- | --- |
| → `revealing` | Set to all scene `columns` still needing first coverage (or full set) |
| → `hiding` | **Reset** to full `columns` (every col must get a drop again to hide) |
| stable modes | No selection drive; Rain does not touch this scene’s sets |

Without-replacement while non-empty; Storm optional in `revealing` /
`hiding` to speed coverage. Rain grid scene uses first-pass then free
random (see prior).

#### Bidirectional Rain ↔ Storm / active scenes

On **spawn** on column `c`:

| Source | Effect |
| --- | --- |
| Rain on `c` | Remove `c` from Rain first-pass set. If a content scene is **`revealing` or `hiding`**, also remove `c` from that scene’s `columnsSelected`. |
| Storm on `c` | Remove `c` from that scene’s `columnsSelected`. Also remove `c` from Rain first-pass. |

Stable scenes (`hidden` / `revealed`): **no** Rain→scene set updates.

#### Events (scene → orchestrator)

Scenes emit (or record timestamps for) at least:

| Event | When |
| --- | --- |
| `modeEnter(mode)` / `started` | Entered `revealing` or `hiding` |
| `dropSelected(col)` | Column chosen for a drop for this scene |
| `pointRevealed(r,c)` / `pointHidden(r,c)` | Tip (or policy) finished show/hide at a point |
| `completed` | Selection exhausted + points in target stable state (often same as last point resolved) |

Orchestrator / Symphony keys off these (and timers) to start other
scenes: e.g. “when roles reveal **completed** → start email revealing”
or “after 20s → start roles hiding.”

#### Symphony (developer interface) — end goal

Declarative **thread of cues**, not ad-hoc `setTimeout` soup in
Configuration long-term:

```text
// sketch only — exact DSL in symphony task
symphony
  .at(0).rain()                          // grid Rain always
  .at(3.5s).start(rolesReveal)           // → revealing
  .on(rolesReveal, 'completed').start(emailReveal)
  .at(30s).start(rolesHide)              // → hiding, reset columns
```

MVP may still use timers; **API shape** should not block growing into
event-driven cues. Keep scene objects dumb enough that the Symphony
owns sequencing.

#### Points from layout

- `positionable.cells()` / `points()` → DropScene points  
- Rain DropScene = whole **Grid** columns  
- Do not overload origin-only `canonical()`

#### Layering

```text
Symphony (cues)
  → Orchestrator
      → DropScenes (mode, columnsSelected, events)
      → Rain / Storm rate + column pick
      → Drop particles
layout Positionables → cells() → scene points
DomManager ← mode + points (show/hide on pass)
```

**Ship sequencing:** layout A–E; Rain/DropScene MVP
(`rain-storm-column-coverage`); F glue; Symphony task after that (or
thin timer Symphony in E/F if needed for demo).

---

## Design decisions

### Character geometry (inclusive)

```text
origin (row₀, col₀) = top-left character
top()    = row₀
left()   = col₀
bottom() = row₀ + height - 1    // bottommost character
right()  = col₀ + width - 1     // rightmost character
middle() = row₀ + ⌊(height-1)/2⌋
center() = col₀ + ⌊(width-1)/2⌋
```

No exclusive edges in core. Packing: `other.top() = this.bottom() + 1`
(or `+ 1` on an attachment expression).

### Coordinates

`[row, col]`, origin top-left, row↓ col→. Not X/Y in public APIs.

### Naming: `Grid` = coordinate layer; rename cell store

| Name | Role |
| --- | --- |
| **`Grid`** | Root **coordinate** positionable (was tentatively “Plane”). Size ROWS×COLS, origin [0,0]. Module: `layout/Grid.mjs`. |
| **`DomGrid`** | Current `Grid.mjs` — 2D store of **DOM cell elements** + column wrappers. Rename on slice A. |

**Why not keep cell store as Grid:** Luke wants “Grid” for the coordinate
system. The old file is a render/DOM map, not the math plane.

**Why DomGrid:** more specific than bare Grid; “BrowserGrid” is fine too
but DomGrid is shorter and accurate (holds DOM nodes). Aliases in
comments OK.

**Rejected for coordinate root:** Canvas (HTML baggage), Matrix (app
class), Plane (OK but Luke leans Grid).

### Anchors — objects that are “effectively functions”

**Decision:** An **Anchor** is a readable value that reduces to a
canonical **number** (row or col) or **point** `[row, col]`.

At resolve time, components duck-type:

| Kind | Resolve |
| --- | --- |
| `number` | Use as-is (static canonical) |
| `function` | Call `(ctx) => number` |
| **Anchor object** | Call `.canonical(ctx)` (or `.resolve(ctx)`) → number |

Point-level anchors may expose `.canonical(ctx) → [row, col]`.

Design intent:

- **Not** “everything must be a bare lambda.” Prefer named types and
  methods so Configuration reads like prose.
- **Semantically** still “something that yields a number/point when
  asked” — functions are the degenerate case.
- Avoid deep pure-FP composition chains; keep OOP/readable helpers.

Example shape (illustrative):

```js
// Component anchor
class OffsetFrom {
  constructor(positionable, edge, delta = 0) { ... }
  canonical(ctx) {
    return this.positionable[this.edge]() + this.delta;
  }
}

// Readable attach
line.attach({
  this: Anchors.topLeft(line),           // point anchor object
  that: [2, Anchors.right(grid).minus(3)], // mixed static + anchor
});
```

Arithmetic helpers (`plus`, `minus`) on anchors beat nested arrows.

### Attachments

- One attachment per positionable (default origin `[0, 0]`).
- `attachment = { this: point, that: point }`.
- Each point = `[rowComp, colComp]`; **each component** independently
  number | function | Anchor-with-`.canonical`.
- Equality after resolve; solver sets **this** item’s origin.

### Cycles

- Forest rooted at coordinate `Grid` / static pins.
- `env.errorOnCycles`: dev `true`, production `false`.
- Directed cycles + double absolute pin when easy.

### Size and spaces

- H-line: h=1, w=length; V-line: w=1, h=length; **spaces count in size**.
- Paint: spaces do not get solid static glyphs — drops shine through.

### Groups and utilities

- Group = abstract positionable; first child `that` on group; others on
  group or siblings.
- Utilities wire attachments; authors may hand-wire.
- Prefer **clear imperative helpers** over abstract FP pipelines.
- `stackVertical` / `stackHorizontal` with **`offsetRow` / `offsetCol`**:

| Utility | Default offsetRow | Default offsetCol |
| --- | --- | --- |
| vertical | 1 | 0 |
| horizontal | 0 | 1 |

### Environment

`src/js/env.mjs`: frozen `MODE`, `errorOnCycles`. Detect localhost →
dev; override via `?env=` / `__MATRIX_ENV__`. Bundler later can feed
`import.meta.env` through the same facade.

### Reveal

Layout first → cells. Reveal groups = collections of positionables (often
one alignment group). Separate concept from layout group.

### Insets

Configuration hardcodes character pads (`grid.left() + 3`, etc.) by eye
in task E — not an architecture open question.

---

## Target layout (files)

```text
src/js/env.mjs
src/js/layout/
  Grid.mjs              // coordinate root positionable (NEW)
  Positionable.mjs
  Anchor.mjs            // objects + resolveComponent / resolvePoint
  attach.mjs            // attach, solveLayout, cycle check
  stack.mjs
  TextLine.mjs
  Group.mjs
src/js/DomGrid.mjs      // RENAMED from Grid.mjs (DOM cell store)
Configuration.mjs       // card + email via layout
// DisplayText shrinks or folds into TextLine + content/reveal tracking
```

---

## Task table

| ID | Task file | Depends | Deliverable |
| --- | --- | --- | --- |
| **A** | [alignment-anchors_a-geometry-grid.md](../tasks/alignment-anchors_a-geometry-grid.md) | — | Positionable geometry; coordinate `Grid`; rename `Grid.mjs` → `DomGrid` |
| **B** | [alignment-anchors_b-env-attach-solve.md](../tasks/alignment-anchors_b-env-attach-solve.md) | A | `env.mjs`; Anchor resolve; attach + solve; cycles |
| **C** | [alignment-anchors_c-textline.md](../tasks/alignment-anchors_c-textline.md) | A | TextLine size + materialize (spaces shine through, href) |
| **D** | [alignment-anchors_d-group-stacks.md](../tasks/alignment-anchors_d-group-stacks.md) | B, C | Group + stackVertical/Horizontal + offsetRow/Col |
| **E** | [alignment-anchors_e-wire-configuration.md](../tasks/alignment-anchors_e-wire-configuration.md) | D | Configuration card/email; remove old locations |
| **F** | [alignment-anchors_f-reveal-glue.md](../tasks/alignment-anchors_f-reveal-glue.md) | E | Storm glue from layout; use Rain/Storm names |
| **G** | later | F | Percent anchors (not filed until needed) |
| **Rain** | [rain-storm-column-coverage.md](../tasks/rain-storm-column-coverage.md) | — (parallel) | Modes + sets + events MVP |
| **Sym** | [symphony-orchestration.md](../tasks/symphony-orchestration.md) | Rain + F | Event/time cue “animation machine” |

Completed plan-linked tasks →
`agents/plans/alignment-anchors/completed/`.

### Plan done when

- [ ] Card lines share one left column; email left-aligned ~3 from left
- [ ] Resize re-layouts cleanly
- [ ] Inclusive character geometry only
- [ ] Mixed static/anchor components work; Anchor objects readable
- [ ] `errorOnCycles` env-gated
- [ ] DomGrid rename complete; Rain/Storm still work
- [ ] Rain first-pass without-replacement done (or tracked done via Rain task)

---

## Reasoning log (why these choices)

| Choice | Why |
| --- | --- |
| Inclusive right/bottom | Character-grid intuition; packing uses explicit +1 |
| Grid for coordinates | Luke’s preferred name; product language |
| DomGrid for cell store | Disambiguate without Canvas/Matrix collisions |
| Anchor objects | Human-readable; still reducible to canonical values |
| Avoid pure-FP chains | Maintainability for a portfolio app |
| offsetRow/Col | Matches coordinate names; both axes always available |
| env facade | Professional multi-env flags without a bundler yet |
| Task slices A–F | Session-sized; plan-linked naming |

---

## Session notes

**2026-07-14:** Initial plan from design thread.

**2026-07-14:** Plane → **Grid** (coords); cell store → **DomGrid**;
Anchor objects + `.canonical`; utilities readable not pure-FP; tasks A–F
filed.

**2026-07-14:** Four scene modes (hidden/revealing/revealed/hiding);
separate reveal vs hide scenes preferred; hide resets columnsSelected;
events; **Symphony** end-goal + task; activate/deactivate language retired.
