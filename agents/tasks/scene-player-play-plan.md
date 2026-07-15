# Task — Plan ScenePlayer play authoring

**Status:** In progress (design notes; implement after approval)  
**Kind:** Plan task (design remaining surface; implement after approval)  
**Depends on:** SceneManager + ScenePlayer MVP  
**Related:** [scene-player-mvp.md](scene-player-mvp.md) (MVP shipped),  
[plans/scene-player.md](../plans/scene-player.md)

## Goal

Finish the **animation machine** design for what is still open after MVP:

1. **Programmatic play authoring** (multi-style — see below)  
2. **Storm(duration)** as coverage window on the VRA curve  
3. Unified animation clock (frame `dt` + cues)  
4. Full action catalog + schedulable `clearScene` / `clearView`  
5. Homepage play rewritten on the new surface (own module OK)  
6. Named next implement task(s)

**Base plan:** [plans/scene-player.md](../plans/scene-player.md)

## Why still needed

- Homepage play is buried in `cardQuoteLoop` + magic opts
  (`afterCardGoneMs`, `quoteHoldMs`, …) — hard to redesign pacing
- Fixed `Phase` / `loopPhases` is declarative duration soup; recent
  event wiring is still ad-hoc inside one factory
- Instant clear of logical grid not first-class on a cue chain
- Clock still `setTimeout` remaining, not frame-synced
- Authoring needs **several valid skins**, not one rigid DSL

## Direction — programmatic play (multi-style)

### Pain with current style

| Current | Problem |
| --- | --- |
| `cardQuoteLoop(scenes, { quoteHoldMs, … })` | Magic factory + magic option names |
| `cardRevealPhase` / `quotePhase` | Opaque phase builders; not the play itself |
| Nested `whenCompleted` + `player.at` in one function | Works, but not an authoring API |

**Wanted:** write the play in normal JS — readable steps, real control
flow, waits on time **or** scene events — without inventing a second
language of option bags. **Allow multiple skins** of the same primitives.

### Storm(duration) — product meaning

Not “start storm and stop after N seconds” as the primary idea.

**`.storm(seconds)`** (on a chain bound to a scene, or
`.storm(scene, seconds)`) means:

> Reconfigure / start the scene’s **Storm** rate so that **every column
> still in that scene’s pool (`columnsSelected` / column set) will have
> *begun* spawning a storm drop within ~`seconds`.**

Implementation sketch (fits existing VRA):

| Piece | Role |
| --- | --- |
| Units | ≈ remaining columns to cover (or full `columns.size` at start) |
| `durationSeconds` | the `seconds` argument |
| `rateFn` | existing pulse / soft-square shape, normalized over that window |
| Effect | denser/faster storm when window is short; gentler when long |

So storm is a **coverage-time contract**, not a free-floating timer name.
Rain can still help drain columns; storm is the optional boost shaped to
finish *starts* in the window (completion of reveal still depends on
drop travel + tip resolve).

Optional later: auto-`stopStorm` when units exhausted or scene settles.

### Context — many ways to skin a cat

Luke wants play scripts that can live in **their own file** without a
wall of scene imports. That argues for a **play context** that holds:

- registered scenes (`ctx.scenes.roles`, …)
- event handles (`ctx.scenes.roles.events.activated` / `completed`)
- the player / clock
- chain builders that schedule on that player

**`state` is app wiring**, not a play-authoring façade. Scenes today are
not all on `state` in a play-friendly map; play should not reach into
`state.dropScenes` by index. A thin `PlayContext` (or
`player.context({ scenes })`) is still useful even though `state` exists.

Rule of thumb:

| Layer | Holds |
| --- | --- |
| `state` | Runtime singletons (dom, rain, sceneManager, …) |
| `PlayContext` / `player.context(...)` | Named scenes + cue builder for **this play** |
| `Configuration` / `play/homepage.mjs` | Builds scenes, registers them, writes the play |

Context is **optional sugar** over the same primitives: you can always
pass scene refs and use the player directly.

### Style A — event chains from context (Luke)

```js
// play/homepage.mjs — scenes registered once at boot
const ctx = scenePlayer.context({
  scenes: { roles, email, cardHide, quote, quoteHide },
});

ctx.on("appStart").delay(3_000).activateScene(ctx.scenes.roles);

ctx
  .on(ctx.scenes.roles.events.activated) // or .completed / modeEnter
  .delay(3_000)
  .activateScene(ctx.scenes.email);

ctx
  .on(ctx.scenes.email.events.completed)
  .delay(2_000)
  .hideScene(ctx.scenes.cardHide)
  .storm(3); // coverage window: all card-hide cols begin within 3s

ctx
  .on(ctx.scenes.cardHide.events.completed)
  .delay(3_000)
  .activateScene(ctx.scenes.quote);

ctx
  .on(ctx.scenes.quote.events.completed)
  .delay(5_000)
  .hideScene(ctx.scenes.quoteHide)
  .storm(3);

ctx.on(ctx.scenes.quoteHide.events.completed).delay(0).loopFrom("appStart");
```

**Pros:** each reaction is local; easy to add parallel reactions; play
file only imports ScenePlayer + maybe helpers.  
**Cons:** many top-level chains; order of *registration* ≠ single story
read; need clear event names (`activated` vs `completed`).

### Style B — `.call` / generic invoke (Luke)

```js
ctx.on("appStart").delay(3_000).call(ctx.scenes.roles.activate /*, args */);
ctx.on("appStart").delay(6_000).call(ctx.scenes.email.activate).delay(3_000).storm(3);
```

**Pros:** maximum escape hatch; anything callable is a step.  
**Cons:** loses scene-aware defaults (which scene does trailing
`.storm(3)` bind to?); `call(fn)` with unbound methods is footguny in JS
unless you pass `(scene, "activate")` or `() => scene.activate()`.

Prefer **bound lambdas** if we keep `call`:

```js
ctx.on("appStart").delay(3_000).call(() => ctx.scenes.roles.activate());
```

### Style C — single linear story (preferred homepage)

`on` and `when` are **not** two paradigms — same wait primitive, different
position in the earlier draft. **Unify** under one verb (recommend
**`on`**, or **`wait`** if that reads better):

| Position | Meaning |
| --- | --- |
| First step | Arm: run the rest when this event fires (`appStart`, …) |
| Later step | Barrier: pause the chain until this event fires |

```js
const ctx = scenePlayer.context({ scenes: { roles, email, cardHide, quote, quoteHide } });
const s = ctx.scenes;

ctx
  .on("appStart")
  .delay(3_000)
  .activate(s.roles)
  .storm(3) // bound to last/active scene on chain
  .on(s.roles.events.completed) // same `on`, mid-chain wait
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

Optional alias: `.wait(event)` ≡ `.on(event)` if “on” feels odd mid-chain.
Do **not** maintain separate `when` semantics.

**Pros:** one top-to-bottom narrative; best for the current homepage.  
**Cons:** parallel “start email while roles still revealing” needs
fork or a second chain (Style A).

### Style D — imperative async (alternative)

```js
const ctx = scenePlayer.context({ scenes: { roles, email, cardHide, quote, quoteHide } });
const s = ctx.scenes;

async function homepagePlay(signal) {
  await ctx.delay(3_000, signal);
  s.roles.activate();
  ctx.storm(s.roles, 3);
  await ctx.when(s.roles, "completed", signal);
  await ctx.delay(2_000, signal);
  s.email.activate();
  // …
  await ctx.when(s.quoteHide, "completed", signal);
  return homepagePlay(signal); // loop
}

scenePlayer.run(homepagePlay);
```

**Pros:** real JS control flow (`if`, parallel `Promise.all`).  
**Cons:** pause/cancel must integrate with `signal`; easier to misuse;
slightly more machinery.

### Style E — no context, scene refs (minimal)

```js
// Only if play lives next to Configuration
scenePlayer
  .on("appStart")
  .delay(3_000)
  .activate(rolesReveal)
  .when(rolesReveal, "completed")
  // …
```

**Pros:** no registry.  
**Cons:** play module imports every scene or closes over Configuration.

### Recommendation

| Piece | Choice |
| --- | --- |
| **Primitives** | One small set: `delay`, **`on` (wait/arm)**, `activate`/`hide`, `storm(seconds)`, `clear`, `loop`, `call` |
| **Skins** | Support **A + C** first (multi-chain *and* linear). Same `on` + scheduler under both. |
| **Context** | **Yes, thin** — `player.context({ scenes })` for play files; not a second global. `state` stays runtime. |
| **`.call`** | Escape hatch with **functions only** `() => …`; don’t over-index on method+args reflection. |
| **Storm** | **Coverage window** on VRA (Luke’s definition). Chain form `.storm(3)` applies to subject scene of that chain. |
| **v1 homepage** | Style **C** (linear) is enough; Style **A** = extra top-level `ctx.on(...)` chains if needed. |
| **Async Style D** | Later if linear+multi-chain hurts. |
| **Phases / cardQuoteLoop** | Interim; migrate homepage off after builder ships. |

**Best default for this portfolio homepage:** Style **C** linear chain with
`ctx.scenes.*` — one readable story. Keep Style **A** as the same API
(`ctx.on(event)` starts a chain) so you are not locked into one narrative
shape. Treat `.call` as power-user, not the main path.

### Action catalog (minimum)

| Verb | Effect |
| --- | --- |
| `on(source)` | Wait for event (chain start **or** mid-chain barrier). Alias: `wait` |
| `delay(ms)` | Pause-aware time wait |
| `activate(scene)` / `activateScene` | `enterMode("revealing")` |
| `hide(scene)` / `hideScene` | `enterMode("hiding")` |
| `storm(seconds)` / `storm(scene, seconds)` | Shape+start storm so pool columns **begin** within window |
| `clear(scene)` / `clearView()` | Force stable hidden + logical clear |
| `call(fn)` | Run arbitrary function as a step |
| `loop()` / `loopFrom(label)` | Restart |
| `context({ scenes })` | Play-local registry + builder |

No separate `when` — use `on` / `wait` everywhere.

Pause/cancel remain on the player (existing).

### Event surface (scenes)

Expose stable handles for authoring (names draft):

| Handle | Fires when |
| --- | --- |
| `events.activated` / `started` | Entered `revealing` or `hiding` |
| `events.completed` | Settled to `revealed` or `hidden` (payload includes mode) |
| `events.stormStart` / `stormStop` | Optional |

Avoid requiring stringly `"completed"` only — `ctx.scenes.roles.events.completed`
is nicer in play files (Style A).

### What not to build (v1)

- Visual timeline editor  
- Audio sync  
- YAML/JSON play files  
- Deep pure-FP composition  
- Full async DSL before linear + multi-chain work  

### Clock (still residual)

Builder steps schedule through the same pause-aware clock as today
(`at` / remaining). Frame-`dt` unification can come later without
changing the play script surface.

## Do

1. [x] Read current `ScenePlayer.mjs` + residual plans  
2. [x] Capture programmatic-authoring direction (multi-style + storm)  
3. [x] Rename plan/tasks: `symphony-*` → `scene-player-*`  
4. [ ] Agree API surface with Luke (styles A/C, storm window, context)  
5. [ ] Name implement task (suggested below)  
6. [ ] Stop for approval before coding the builder  

## Suggested next implement task

| Task | Scope |
| --- | --- |
| `scene-player-play.md` | Play context + cue chains; `storm(seconds)` VRA window; migrate homepage off `cardQuoteLoop`; smokes |

Optional follow-up: frame clock, async runner, richer parallel.

## Done when

- [x] Residual authoring direction written  
- [x] Naming in plan docs uses ScenePlayer; paths `scene-player-*`  
- [ ] Luke sign-off on API sketch  
- [ ] Implement task linked + plan “next” updated  
- [ ] Session note updated  

## Out of scope

Visual timeline editor; audio sync; full game-engine ECS.

## Session note

**2026-07-15 — Multi-style play + storm window**

- **Storm(time):** coverage contract — VRA duration so all scene-pool
  columns **begin** dropping within that window (not merely stopStorm).  
- **Context:** useful for play-in-own-file; distinct from `state`; optional
  if scenes are closed over. Prefer thin `player.context({ scenes })`.  
- **Styles:** support event multi-chain (A) + linear story (C); `call` as
  escape hatch; async (D) later. Recommended homepage: **C** with
  `ctx.scenes`.  
- Paths renamed: scene-player-*.  
- Interim: event-driven `cardQuoteLoop` until builder ships.

**Open questions**
1. Prefer verb spelling: `.on(event)` only, or `.wait(event)` alias?  
2. Event handle names: `activated` vs reuse `started` / `modeEnter`?  
3. Chain-local `.storm(3)` subject = last activated/hidden scene — OK?  
4. Should `storm(seconds)` rebuild the accumulator each call, or only
   set duration on an existing factory?  
5. Play module path: `src/js/play/homepage.mjs`?
