# Task — Rain / Storm / DropScene modes + column sets

**Status:** Done (2026-07-15)  
**Plan:** [alignment-anchors.md](../../alignment-anchors.md)  
**Depends on:** layout `cells()` helpful; Grid-wide Rain can stub first  
**Parallel with:** alignment A–E  
**After this:** F (layout glue); [symphony-orchestration.md](../../../tasks/symphony-orchestration.md)

## Goal

MVP weather + **DropScene modes** (not vague activate/deactivate):

1. **Rain** first-pass without replacement; then free random.
2. **DropScene** with modes: `hidden` | `revealing` | `revealed` | `hiding`.
3. Prefer **separate** reveal vs hide scene instances (one job each).
4. Bidirectional Rain ↔ active-scene column sets.
5. Entering `hiding` **resets** `columnsSelected`; drops hide as columns
   are covered.
6. Stable scenes ignored by DropManager for set/show logic.
7. Emit basic **events** (`started`, `dropSelected`, `completed`, …)
   even if Symphony is later.

## Modes

| Mode | DropManager acts? | Tip over point |
| --- | --- | --- |
| `hidden` | No | — |
| `revealing` | Yes | show glyph |
| `revealed` | No (idle) | stays shown |
| `hiding` | Yes; **reset** columnsSelected on enter | hide glyph |

## Do

1. DropScene fields: points, columns, columnsSelected, mode, optional
   Storm rate.
2. `enterMode('revealing'|'hiding'|…)` — reset selection when entering
   `hiding`; build selection when entering `revealing`.
3. Rain grid scene; first-pass without replacement.
4. On spawn col `c`: update Rain set; if any scene in revealing/hiding,
   update that `columnsSelected`; Storm↔Rain both ways.
5. Events: at least mode enter + completed (selection empty + stable).
6. Smoke: no long dark columns; reveal then hide pass works.

## Done when

- [x] Four modes behave as table
- [x] Hide path resets column set
- [x] Bidirectional sets; stable scenes ignored
- [x] Events fire enough for a future Symphony
- [x] Session note updated

## Out of scope

Full Symphony DSL (see symphony task); full anchor layout.

## Session note

**2026-07-15 — Rain/DropScene MVP shipped**

### API

| Piece | Module | Notes |
| --- | --- | --- |
| `DropScene` | `src/js/DropScene.mjs` | modes, `columnsSelected`, Storm `stormAccumulator`, events |
| `DropScene.from(pos, opts)` | same | layout binding stub for F (`cells()`/`points()`) |
| `Rain` | `src/js/Rain.mjs` | first-pass `Set` then free random; soft-square via VRA |
| `DropManager` | updated | spawn sources = rain + active storms; bidirectional on spawn |
| Configuration | timers → `enterMode('revealing')` | roles @3.5s, email @9s; `spawnPolicies: []` |

### Events (scene)

`modeEnter`, `started`, `dropSelected`, `pointRevealed`, `pointHidden`,
`completed` — via `scene.on(event, fn)`.

### Wire shape for F

```js
const layer = DisplayText({ cells: group.cells() });
const reveal = DropScene({
  name: "roles-reveal",
  points: layer.positions, // shared
  columns: layer.columns,
  enterModeAfterMs: 3500,
  enterModeOnStart: "revealing",
  stormAccumulator: VariableRateAccumulator(...),
});
// or: DropScene.from(group, { name, stormAccumulator, enterModeAfterMs, ... })
```

Prefer **separate** hide instance later:
`DropScene.from(group, { name: "roles-hide", mode: "revealed" })` then
`enterMode("hiding")`.

### Smoke

- `node src/js/DropScene.mjs`
- `node src/js/Rain.mjs`
- `npm run build`

### Residual for F

- Prefer `DropScene.from(group)` end-to-end; optional drop DisplayText if
  DropScene covers paint fields
- Hide scenes not wired in Configuration (API + DomManager path ready)
- Symphony still timers; listen to `completed` when ready
