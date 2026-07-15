# Task — Rain / Storm / DropScene modes + column sets

**Status:** Ready  
**Plan:** [alignment-anchors.md](../plans/alignment-anchors.md)  
**Depends on:** layout `cells()` helpful; Grid-wide Rain can stub first  
**Parallel with:** alignment A–C  
**After this:** F (layout glue); [symphony-orchestration.md](symphony-orchestration.md)

## Goal

MVP weather + **DropScene modes** (not vague activate/deactivate):

1. **Rain** first-pass without replacement; then free random.
2. **DropScene** with modes: `hidden` | `revealing` | `revealed` | `hiding`.
3. Prefer **separate reveal vs hide scene instances** (one job each).
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

- [ ] Four modes behave as table
- [ ] Hide path resets column set
- [ ] Bidirectional sets; stable scenes ignored
- [ ] Events fire enough for a future Symphony
- [ ] Session note updated

## Out of scope

Full Symphony DSL (see symphony task); full anchor layout.

## Session note

*(overwrite each session)*
