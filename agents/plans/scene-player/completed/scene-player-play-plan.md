# Task — Plan ScenePlayer play authoring

**Status:** Design locked — ready for implement  
**Kind:** Plan task (design complete; no builder code here)  
**Depends on:** SceneManager + ScenePlayer MVP  
**Implement:** [scene-player-play.md](../../../tasks/scene-player-play.md)  
**Related:** [scene-player-mvp.md](../../../tasks/scene-player-mvp.md),  
[plans/scene-player.md](../../scene-player.md)

## Goal

Finish the **animation machine** design for residual play authoring:

1. Programmatic play authoring (multi-style primitives)
2. `storm(seconds)` as VRA coverage window
3. Unified animation clock (frame `dt` + cues) — design only; not v1
4. Action catalog + schedulable `clear` / `clearView`
5. Homepage play module path
6. Named implement task

## API audit (DropScene / ScenePlayer)

Matches code on `refactor_07-2026` — lock names to reality:

| Emit / API | Where | Notes |
| --- | --- | --- |
| `started` | `DropScene.enterMode(revealing\|hiding)` | Payload `{ scene, mode }` |
| `completed` | settle to `revealed` / `hidden` | Payload `{ scene, mode }` |
| `modeEnter` | every mode change | Payload `{ scene, mode, prev? }` |
| `dropSelected`, `pointRevealed`, `pointHidden` | coverage / paint | Not required for v1 play |
| `stormStart` / `stormStop` | `startStorm` / `stopStorm` | Optional later |
| `scene.on(event, fn)` → off | DropScene | Existing listener API |
| `onceCompleted(scene, mode?, fn)` | ScenePlayer | Filters `completed` by mode |
| `enterMode`, `startStorm` | DropScene | Today: fixed VRA from Configuration |
| `cardQuoteLoop` | ScenePlayer | Interim homepage factory |
| `player.at` / pause / cancel | ScenePlayer | Pause-aware setTimeout clock |

**No `activated` event today** — use `started`. Prefer
`scene.events.started` / `scene.events.completed` handles if cheap;
string `"completed"` also OK mid-chain.

## Locked decisions

| Question | Decision |
| --- | --- |
| Verb | Primary `.on(event)`; alias `.wait(event)` ≡ same |
| Event handles | Reuse DropScene names: `started` + `completed` (payload has mode). Expose as `scene.events.started` / `scene.events.completed` if cheap; string `"completed"` OK mid-chain |
| `.storm(3)` subject | Last scene activated/hidden on that chain; or explicit `storm(scene, seconds)` |
| storm VRA | Rebuild/configure accumulator **per call** for the coverage window (`units` ≈ remaining pool cols / `columns.size`, `durationSeconds` = arg) |
| Play module path | `src/js/play/homepage.mjs` |
| Primitives | `delay`, `on`/`wait`, `activate`/`hide`, `storm(seconds)`, `clear`, `loop`, `call(fn)` |
| Skins | **A** multi-chain + **C** linear first; homepage Style **C** |
| Context | Thin `player.context({ scenes })` |
| `call` | Functions only `() => …` |
| Phases / `cardQuoteLoop` | Interim until migrate |
| Frame-dt clock | Later — out of v1 implement |

## Direction (summary)

### Storm(duration)

`.storm(seconds)` / `.storm(scene, seconds)`:

> Reconfigure + start scene Storm so every column still in the pool
> (`columnsSelected` / full `columns` at start) **begins** spawning a
> storm drop within ~`seconds`.

| Piece | Role |
| --- | --- |
| Units | ≈ remaining cols (or `columns.size` at start of storm) |
| `durationSeconds` | `seconds` argument |
| `rateFn` | existing pulse / soft-square, normalized over window |
| Effect | denser when short; gentler when long |

Coverage-time contract, not free-floating stop timer. Rain still drains;
reveal completion still depends on drop travel + tip resolve.

### Context

| Layer | Holds |
| --- | --- |
| `state` | Runtime singletons |
| `player.context({ scenes })` | Named scenes + cue builder for **this play** |
| `play/homepage.mjs` | Builds play steps; Configuration builds scenes + wires |

Optional sugar over same primitives.

### Style A — multi-chain (supported)

```js
const ctx = scenePlayer.context({
  scenes: { roles, email, cardHide, quote, quoteHide },
});

ctx.on("appStart").delay(3_000).activate(ctx.scenes.roles);

ctx
  .on(ctx.scenes.roles.events.completed)
  .delay(3_000)
  .activate(ctx.scenes.email);

// … more top-level chains
```

### Style C — linear homepage (v1 default)

```js
const ctx = scenePlayer.context({
  scenes: { roles, email, cardHide, quote, quoteHide },
});
const s = ctx.scenes;

ctx
  .on("appStart")
  .delay(3_000)
  .activate(s.roles)
  .storm(3)
  .on(s.roles.events.completed) // or .wait(...); string "completed" OK
  .delay(2_000)
  .activate(s.email)
  .storm(5)
  .on(s.email.events.completed)
  .delay(2_000)
  .hide(s.cardHide)
  .storm(3)
  .on(s.cardHide.events.completed)
  .delay(3_000)
  .activate(s.quote)
  .storm(4)
  .on(s.quote.events.completed)
  .delay(5_000)
  .hide(s.quoteHide)
  .storm(3)
  .on(s.quoteHide.events.completed)
  .loop();
```

Same `on` = arm at chain start, barrier mid-chain. Alias `wait` ≡ `on`.

### Style B / D / E

- **B `call`:** escape hatch, functions only — not main path.
- **D async:** later if linear + multi-chain hurts.
- **E no context:** always possible with closed-over scene refs.

### Action catalog (v1)

| Verb | Effect |
| --- | --- |
| `on(source)` / `wait(source)` | Arm or mid-chain barrier |
| `delay(ms)` | Pause-aware time wait |
| `activate(scene)` | `enterMode("revealing")` |
| `hide(scene)` | `enterMode("hiding")` |
| `storm(seconds)` / `storm(scene, seconds)` | VRA coverage window + startStorm |
| `clear(scene)` / `clearView()` | Force stable hidden + logical clear |
| `call(fn)` | Arbitrary step (`() => …` only) |
| `loop()` / `loopFrom(label)` | Restart |
| `context({ scenes })` | Play-local registry + builder |

Pause/cancel remain on the player (existing).

### Out of v1

Visual timeline; audio sync; YAML/JSON plays; full async Style D;
frame-`dt` clock (keep setTimeout remaining surface stable for scripts).

## Do

1. [x] Read current `ScenePlayer.mjs` + residual plans
2. [x] Capture programmatic-authoring direction (multi-style + storm)
3. [x] Rename plan/tasks: `symphony-*` → `scene-player-*`
4. [x] Agree API surface (styles A/C, storm window, context) — locked
5. [x] Name implement task: [scene-player-play.md](../../../tasks/scene-player-play.md)
6. [x] Design lock complete — **no builder code in this task**

## Done when

- [x] Residual authoring direction written
- [x] Naming in plan docs uses ScenePlayer; paths `scene-player-*`
- [x] API sketch locked (parent approved recommended defaults)
- [x] Implement task created + plan “next” updated
- [x] Session note updated

## Out of scope

Visual timeline editor; audio sync; full game-engine ECS; implementing
the play builder (→ implement task).

## Session note

**2026-07-15 — Design locked**

Decisions locked (see table above). Implement:
[scene-player-play.md](../../../tasks/scene-player-play.md).

**Next agent (implement only)**
1. Build play context + cue chains (A + C; same primitives).
2. `storm(seconds)` rebuilds VRA per call; subject = last activate/hide.
3. Migrate homepage → `src/js/play/homepage.mjs`; wire Configuration.
4. Smokes for context/chain/storm; keep pause/cancel.
5. Do **not** do frame-dt clock, Style D, visual timeline, or deploy.
