# Task — Interactive play Unit/Thread runtime

**Status:** Done (2026-07-17)  
**Plan:** [plans/interactive-play.md](../../interactive-play.md)  
**Priority:** P1 — foundation for hover + homepage re-author  
**Depends on:** Design lock
[interactive-play_design.md](interactive-play_design.md)

## Goal

Implement the **event-based Unit + Thread runtime** locked in the plan:
generation-scoped waiters, dispose on stop/restart, sugar with clear
desugaring, factories for reveal/hide/hold. Migrate homepage play onto it
**without** shipping hover yet (hover is the next task).

## Locked design (do not re-debate)

Read [plans/interactive-play.md](../../interactive-play.md) — especially
**Locked direction** and **Waiter lifetime**.

| Rule | Detail |
| --- | --- |
| Substrate | Events; delay = timer emit + wait |
| Nouns | Unit, Thread (play thread), Event; DropScene stays dumb |
| Factories | `revealUnit` / `hideUnit` / `holdUnit` wire completion under the hood |
| Sugar | `thread.run(a).run(b).delay(ms).loop()` desugars to start + wait completed |
| Cancel | gen++ + `off()` all owned waiters; **not** cancellable Promises |
| `completed` | Success of current run only — abort/restart does **not** emit completed |
| Build order | This runtime **before** hover — no DomManager policy shortcut |

## Do

1. Add runtime module(s) under `src/js/` (e.g. play units/threads on
   ScenePlayer context, or sibling modules — match existing style).
2. Implement waiter set + generation dispose; scene `on` always paired with
   `off`.
3. Factories: reveal / hide / hold (`onHover: "extend"` can be stubbed or
   wired only if cheap; full hover product is next task).
4. Thread sugar: `run`, `delay`, `loop`, `start` / `stop` / `restart`.
5. Migrate `src/js/play/homepage.mjs` to the new API with **equivalent**
   card → quote → loop behavior (storm/delays preserved).
6. Keep pause/cancel/watchdog working with new waiters.
7. Smokes for: chain advance, restart without double-complete, stop disposes
   waits, loop gen, delay pause if feasible.
8. Session note on this task + plan; leave hover for
   [hover-hasten-reveal.md](../../../tasks/hover-hasten-reveal.md).

## Done when

- [x] Unit/Thread runtime with gen-scoped waiter dispose
- [x] reveal/hide/hold factories; completion under the hood
- [x] Homepage uses sugar (or explicit equivalent) on new runtime
- [x] No double-advance on unit restart in smokes
- [x] `ctx`/`player` cancel disposes waits (no listener leak in smokes)
- [x] Old Style C behavior preserved for eyeball loop
- [x] Build / existing smokes green; new smokes for runtime
- [x] Hover **not** required for this task’s done

## Out of scope

- Product hover (hasten / re-reveal / extend) — next task
- Quote playlist / ASCII portrait
- Visual timeline; frame-dt clock
- DomManager tip-force “hover” improvements beyond what migration needs

## Session note

**2026-07-17 — Runtime shipped**

| Piece | Path / API |
| --- | --- |
| Runtime | `src/js/play/runtime.mjs` — `revealUnit` / `hideUnit` / `holdUnit` / `thread` |
| Homepage | `src/js/play/homepage.mjs` — Unit/Thread sugar; concurrent roles via `spawn` |
| Timer dispose | `ScenePlayer.clear(id)` for delay waiter off |
| Watchdog | `ctx.completionWatchdogMs` exposed; units arm settle watchdog |
| Smokes | `node src/js/play/runtime.mjs` — chain, restart, stop, cancel, loop, pause, hold rearm, spawn |

**Desugar notes for next agent**

- `run(u)` = start + wait `completed` (parent gen only; not frozen child gen).
- `spawn(u)` = start without wait; child still stopped on thread stop/loop.
- `restart` / `stop` bump gen, dispose waiters, **no** `completed`.
- `holdUnit.rearm(ms)` ready for extend-on-hover; `onHover` stored only.
- Factories register on ctx cancel via `_playRuntime.roots`.

**Next:** [hover-hasten-reveal.md](../../../tasks/hover-hasten-reveal.md) —
wire unit hover policies only (no DomManager business logic).
