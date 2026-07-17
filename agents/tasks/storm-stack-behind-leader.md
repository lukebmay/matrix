# Task — Storm stack-behind-leader (multi-drop on occupied cols)

**Status:** Ready  
**Plan:** standalone (storm coverage polish)  
**Priority:** P1 — last-column storm lag when a squatter blocks the col  
**Depends on:** DropManager one-per-col, DropScene `columnsSelected` /
`dropAffects`, storm VRA refund + mild rate (shipped)

## Goal

When a **storm** still needs a column that is **occupied**, allow a second
drop on that column so coverage does not wait for the squatter to finish.
Cap speed so the new drop **never overtakes** the leader (fancy: stay at
least one glyph behind when the leader clears the bottom).

Rain keeps the one-live-drop-per-column rule.

## Why

Pre-activation (or other non-covering) drops block a column without
satisfying `dropAffects` / selection coverage. Storm + refund keep budget
honest, but wall-clock wait on the squatter still causes intermittent
~1s last-column delays (esp. quote / email).

Occupation must not equal coverage when the live drop does not count for
the active scene.

## Design (locked for implementer)

### When to stack

1. **Rain:** still at most one live drop per column; rain waits if blocked.
2. **Storm pick order:**
   - Prefer `free ∩ columnsSelected` as today.
   - If more storm units are owed and only **occupied** selected cols
     remain, **stack** on those columns (second drop allowed).
3. Do **not** stack when the column is no longer in `columnsSelected`
   (already claimed by a post-activation spawn).

### Speed — do not overtake (fancy)

Compute a **max safe speed** for the new drop given the leader on that
column: as fast as possible without catching up — ideally so that when
the leader clears the final row, the follower is still **at least one
character row behind**.

Inputs (typical): leader `speed`, leader `_row` / length, `cfg.ROWS`,
new drop start row `0`, optional new `length`.

### Interaction with “last 3 max speed”

Today: last **3** remaining `columnsSelected` storm spawns use fixed
`STORM_DROP_SPEED_MAX`.

**Stacking overrides that rule when the column is occupied:**

| Case | Speed rule |
| --- | --- |
| Free column, remaining selection ≤ 3 | Keep **max** storm speed (`STORM_DROP_SPEED_MAX`) |
| **Occupied** column, remaining ≤ 3 (tail) | **Not** blind max. Use **max safe no-overtake** speed (as fast as allowed without passing the leader) |
| Occupied column, remaining > 3 | Random in `[STORM_DROP_SPEED_MIN, maxSafe]` (clamp: if `maxSafe < min`, use `maxSafe`) |
| Free column, remaining > 3 | Existing storm random `[STORM_DROP_SPEED_MIN, STORM_DROP_SPEED_MAX]` |

So: last-3 max speed remains for **free** tail drops; for **double drops**,
no-overtake math always wins, and the tail still goes **as fast as safe**.

### Multi-scene / paint

- New stacked drop gets normal `spawnAt` → `dropAffects` works for the
  active scene.
- Leader may predate the scene; tip resolve still gated by `dropAffects`.
- Settled `m-revealed` stays owned by logical paint (do not let trails
  clobber settled glyphs).
- Unconstrained tip overtaking (no speed cap) is **out of scope** — that
  was rejected vs this fancier stack.

### Occupancy model

- `occupied`: col → ordered live drops (leader first, or by row).
- Free columns = no live drops.
- Storm stack targets = selected ∩ has leader.
- Clear col only when **all** drops on it complete.

## Do

1. Multi-drop occupancy in `DropManager` (list/map per col).
2. Storm pick: free selected first; then stack on occupied selected.
3. Implement max-safe-speed helper (one-glyph-behind fancy version).
4. Wire speed rules table above (last-3 free max; stack overrides).
5. Dom/trail: multi tip on one col paints safely; logical reveal path OK.
6. Smoke: occupied pre-activation col gets storm stack without waiting
   for free; follower never passes leader row; last-3 free still max;
   last-3 occupied uses safe max not blind max.
7. Session note; mark done when acceptance passes.

## Done when

- [ ] Storm can place on occupied `columnsSelected` cols (stack)
- [ ] Rain still one drop per column
- [ ] Follower never overtakes leader (one-glyph-behind when possible)
- [ ] Last-3 **free** → max storm speed
- [ ] Last-3 **occupied** → max **safe** speed (overrides blind max)
- [ ] Non-tail occupied → random stormMin..maxSafe
- [ ] Refund / mild storm curve still behave
- [ ] Build / smokes green; browser eyeball quote/email last cols

## Out of scope

- Hover hasten ([hover-hasten-reveal.md](hover-hasten-reveal.md))
- Uncapped multi-drop / tip racing
- Changing `dropAffects` semantics

## Prior art (this branch, pre-task)

Storm polish already shipped or in-flight before this task:

- Raised storm drop floor; mild ease-in rate (no tail dip)
- Finite VRA refund when spawn blocked; flush shortfall
- Last-3 free columns forced to max drop speed (test / finish)

## Session note

(not started — next session)

Start from `DropManager` occupancy + storm pick; keep last-3 free max
behavior and implement stack speed overrides as in the table.
