# Task — ScenePlayer play authoring

**Status:** Ready  
**Kind:** Implement (plan-linked)  
**Plan:** [plans/scene-player.md](../plans/scene-player.md)  
**Design (locked):**  
[plans/scene-player/completed/scene-player-play-plan.md](../plans/scene-player/completed/scene-player-play-plan.md)  
**Branch:** `refactor_07-2026`

## Goal

Ship programmatic play authoring on ScenePlayer:

- Thin play **context** + **cue chains** (Style A multi-chain + Style C
  linear; same primitives)
- **`storm(seconds)`** as VRA **coverage window** (all pool cols *begin*
  within the window)
- Homepage play module **`src/js/play/homepage.mjs`** (Style C linear)
- Wire **Configuration** off `cardQuoteLoop`
- Smokes; pause/cancel still work

## Locked API (do not re-litigate)

| Piece | Choice |
| --- | --- |
| Verb | `.on(event)` primary; `.wait(event)` ≡ same |
| Events | DropScene `started` + `completed` (payload has mode). Prefer `scene.events.started` / `.completed` handles if cheap; string `"completed"` OK mid-chain |
| `.storm(3)` subject | Last scene activated/hidden on that chain; or `storm(scene, seconds)` |
| storm VRA | Rebuild/configure accumulator **per call** (`units` ≈ remaining pool / `columns.size`, `durationSeconds` = arg) |
| Context | Thin `player.context({ scenes })` |
| `call` | Functions only `() => …` |
| Homepage | Style C linear in `src/js/play/homepage.mjs` |
| Clock | Keep pause-aware `at` / remaining; **no** frame-dt in this task |

### Primitives

| Verb | Effect |
| --- | --- |
| `on` / `wait` | Arm (chain start) or barrier (mid-chain) |
| `delay(ms)` | Pause-aware wait |
| `activate(scene)` | `enterMode("revealing")` |
| `hide(scene)` | `enterMode("hiding")` |
| `storm(seconds)` / `storm(scene, seconds)` | Coverage VRA + `startStorm` |
| `clear(scene)` / `clearView()` | Force stable hidden + logical clear (reuse existing force path) |
| `call(fn)` | Arbitrary step |
| `loop()` / `loopFrom(label)` | Restart |
| `context({ scenes })` | Registry + chain builder |

## Scope

1. **Play context + chains** on ScenePlayer (or small sibling module if
   cleaner — prefer extending `ScenePlayer.mjs` unless file bloats).
2. **Style A + C** share scheduler: each `ctx.on(...)` starts a chain;
   Style C is one long chain with mid-chain `on`/`wait`.
3. **`storm(seconds)`** rebuilds scene storm accumulator for the window,
   then `startStorm()`. Rain still drains; do not invent stop-on-timer as
   primary semantics.
4. **Homepage:** `src/js/play/homepage.mjs` — linear Style C matching
   current card→quote pacing intent (delays from interim opts are fine
   defaults).
5. **Configuration:** build scenes as today; call homepage play instead of
   `cardQuoteLoop`. Keep `Phase` / `cardQuoteLoop` exportable for tests or
   delete only if smokes fully migrated.
6. **Smokes:** context register, chain arm + delay + activate, mid-chain
   wait on `completed`, storm configures finite VRA + enables storm,
   pause/cancel does not leave runaway timers.
7. **Pause/cancel:** chain steps must honor existing player pause/cancel
   (same as `at` / event offs cleanup).

## Code map

| Path | Role |
| --- | --- |
| `src/js/ScenePlayer.mjs` | Player clock; add `context` + chain builder (or extract play builder next to it) |
| `src/js/DropScene.mjs` | Optional cheap `scene.events` handles for `started`/`completed`; existing emit names stay |
| `src/js/play/homepage.mjs` | **New** — homepage Style C play |
| `src/js/Configuration.mjs` | Wire play module; stop using `cardQuoteLoop` for live homepage |
| `src/js/util/VariableRateAccumulator.mjs` | Consume as-is for storm rebuild |
| Existing force-hidden helper in ScenePlayer | Reuse for `clear` / loop reset |

## Done when

- [ ] `player.context({ scenes })` returns chainable builder
- [ ] Style C homepage play runs card → quote → loop without
      `cardQuoteLoop`
- [ ] Style A multi-chain works (at least smoke / minimal parallel chain)
- [ ] `.storm(n)` rebuilds VRA for coverage window and starts storm on
      subject scene
- [ ] `on`/`wait` arm + mid-chain barrier on `started`/`completed`
- [ ] Pause/cancel still safe
- [ ] Smokes green; `scripts/build.sh` green
- [ ] Plan + this task session note updated

## Out of scope

- Visual timeline editor
- Async Style D runner
- Frame-`dt` unified clock
- Deploy / production push
- Re-designing DropScene mode machine
- G-percent anchors / paint eyeball (separate task)

## Acceptance sketch

Homepage play roughly:

```js
// src/js/play/homepage.mjs
export function homepagePlay(player, scenes) {
  const ctx = player.context({ scenes });
  const s = ctx.scenes;
  ctx
    .on("appStart")
    .delay(3_000)
    .activate(s.rolesReveal) // or names registered in context
    .storm(3)
    .on(s.rolesReveal.events.completed)
    // …
    .loop();
  ctx.emit?.("appStart"); // or player.start / context.start — pick one simple kick
}
```

Exact kick (`appStart` synthetic event vs `ctx.start()`) is implementer's
choice — keep it one obvious entry.

## Session note

Ready for implement. Design locked in
[scene-player-play-plan.md](../plans/scene-player/completed/scene-player-play-plan.md).
No code yet in this taskforce pass.
