# Plan — Interactive play authoring

**Status:** Active — runtime + hover shipped; **quote playlist next**  
**Project:** `projects/matrix`  
**Branch:** `refactor_07-2026` (or current product branch)  
**Related:** [scene-player.md](completed/scene-player.md) (shipped cue chains),
[hover-hasten-reveal.md](interactive-play/completed/hover-hasten-reveal.md) (done)

## Goal

A **dev-friendly animation design system** for stitching DropScenes into a
homepage show — not a pure timeline editor. The show has **weather + text
modes** *and* **user interaction** that can interrupt, hasten, re-reveal, and
**jump back** into a prior beat.

Homepage evolution targets:

1. Card (roles + email) ↔ interleaved **quote playlist**
2. Occasional **ASCII portrait** slot instead of a quote
3. Hover that is useful for reading/clicking (not just CSS polish)

## What we already have

| Piece | Today |
| --- | --- |
| DropScene modes | `hidden` / `revealing` / `revealed` / `hiding` |
| ScenePlayer context | `delay \| on/wait \| activate \| hide \| storm \| clear \| call \| label \| loop \| loopFrom` |
| Homepage Style C | One linear chain in `src/js/play/homepage.mjs` |
| Layout groups | `rolesGroup`, `emailGroup`, `quoteGroup` → DropScene points |
| Hover (partial) | DomManager link `mouseover` force-applies tip on incomplete **line** only |
| Hover | [hover-hasten-reveal.md](interactive-play/completed/hover-hasten-reveal.md) — hasten / extend / re-reveal — **done** |

### Pain points

1. **Flat chain is hard to restart locally.**  
   `loop` / `loopFrom` bump generation and **force-hide every scene in the
   context**. That is correct for full cycle restart, wrong for “user hovered
   mid-hide — re-reveal card and restart *this hold+hide beat only*.”

2. **Interactivity is bolted on, not authored.**  
   Hover lives in DomManager; play lives in homepage.mjs. No shared notion of
   “this group is interactive while in these modes.”

3. **Content is hard-coded one quote.**  
   Playlist (N quotes + occasional portrait) needs a **content slot** and a
   **unit that can be swapped** without rewriting the whole chain.

4. **Jump vs wrap is undecided.**  
   We need either global seek (`goto("cardHold")`) with clear cleanup policy,
   or **restartable subplays** (units), or both.

## Design principles (proposed)

1. **Everything is events** — delays, scene settle, hover, unit complete are
   the same substrate. Time is a timer that *emits*; chains *subscribe*.
2. **Atomic async units** chain via events to *feel* like sync threads.
3. **Happy path stays readable** — linear thread syntax still preferred for
   the main show; multi-thread is opt-in where concurrency is real.
4. **Interaction is first-class** — hover/click are unit events, not DomManager
   policy.
5. **Restarts have a scope** — cancel generation for that unit/thread only.
6. **Scenes stay dumb** — DropScene = modes + columns + scene events.
   Units / player own composition + interrupts.
7. **Weather stays weather** — hasten/re-reveal re-enter modes / force
   logical; no second paint path.

## Locked direction (2026-07-17 review)

**Event substrate + Units + Threads; sugar on top; no cancellable promises
as the core model.**

### Nouns (naming)

| Name | Meaning | Avoid |
| --- | --- | --- |
| **DropScene** | Weather/mode primitive (exists) | Calling it a “unit” |
| **Unit** | Play lifecycle wrapper (`start`/`stop`/`restart`, completion rule, hover) | `sceneAction` (long, vague) |
| **Thread** | Linear waiter chain (one gen, advances on events) | OS/async confusion — document “play thread” |
| **Event** | Bus signal | Mixing with DOM events without prefix |
| **Play / Context** | Registry + factories for one homepage show | — |
| **Hold** | Special unit: timer-only, optional extend-on-hover | Overloading `delay` for interruptible holds |

Prefer factories by kind rather than a free-form `sceneAction` string:

| Factory | On `start` | Completes when |
| --- | --- | --- |
| `revealUnit(scene)` | `enterMode("revealing")` | DropScene `completed` with mode `revealed` |
| `hideUnit(scene)` | `enterMode("hiding")` | DropScene `completed` with mode `hidden` |
| `holdUnit({ ms, onHover? })` | arm timer | timer expired (extend re-arms, does not complete early) |
| `thread()` | first step / explicit `.start()` | last step completed (or `loop`) |

**Not primary API:** `completedOn(scene.events.revealed)`.

DropScene today emits **`completed`** (payload `{ mode }`), not a separate
`revealed` event. Units **wire that under the hood**:

```text
revealUnit  → start: enterMode(revealing)
            → done:  once(scene.completed where mode===revealed) → unit.emit("completed")
hideUnit    → start: enterMode(hiding)
            → done:  once(scene.completed where mode===hidden)  → unit.emit("completed")
```

Escape hatch only when needed:

| Escape | Use |
| --- | --- |
| `unit.completeWhen(eventSpec)` | Custom / multi-scene join (e.g. both roles+email) |
| `thread.wait(eventSpec)` | Mid-thread barrier without a Unit |

Happy path authors never write `completedOn`.

### Why event substrate

| Today | Problem | Event model |
| --- | --- | --- |
| Sequential step PC | Hard to interrupt mid-chain | Waiters cancel with generation |
| `delay` as special step | Restart remainder math | Timer emits; re-arm = new timer |
| Hover outside player | Two brains | `unit` receives `hover` |
| `loopFrom` force-hides all | Wrong scope | `unit.restart()` / `thread.restart()` |

### Runtime shape

```text
Unit.start()
  → gen++
  → emit "start"
  → kind body (enterMode …)
  → optional side threads (e.g. delay→storm)  [do not gate completed]
  → arm completion waiter (scene.completed / timer)
  → on fire: emit "completed" (if gen still current)

Thread.run(unit)
  → desugars to: wait previous completed → unit.start() → wait unit.completed
```

**Delay:**

```text
.delay(ms)  ≡  arm Timer → wait expired → next
```

### Sugar (required) + desugaring table

**Rule:** everything is event wiring. Sugar must have a **one-line desugar**
so authors can always expand it mentally.

| Sugar | Desugars to (conceptual) |
| --- | --- |
| `t.run(a).run(b)` | `a.on("completed", () => b.start());` (and `t` waits each `completed` in order) |
| `t.run(a).delay(ms).run(b)` | after `a.completed`, arm timer; on expired, `b.start()`; wait `b.completed` |
| `t.loop()` | on thread body completed → `t.restart()` (new gen) |
| `revealUnit(scene)` | start→revealing; completeWhen scene.completed@revealed |
| `hideUnit(scene)` | start→hiding; completeWhen scene.completed@hidden |
| `holdUnit({ms, onHover:"extend"})` | start→timer; hover→re-arm timer; complete on expire |
| `u.onStart(fn)` | `u.on("start", () => fn(sideThread))` |
| `u.onHover(policy)` | binder → `u` hover handler by current mode |

**`run` contract (make obvious):**

1. `thread.run(x)` means: **start `x` when the thread reaches this step**, then
   **wait until `x` emits `completed`** (same gen), then continue.
2. `x` is a Unit (or anything with `start` + `completed`).
3. Nested `thread` is a Unit-like: `run(innerThread)` starts the inner thread
   and waits for *its* completed.
4. Side effects that must not gate the main line use `onStart` side threads
   (storm), not `run`.

**Start discipline (avoid double-start bugs):**

| Pattern | Behavior |
| --- | --- |
| Build then start | `const t = thread().run(a).run(b); t.start();` |
| Do not | also `a.on("completed", () => b.start())` for the same edge |
| Explicit multi-wire | OK when *not* using linear sugar for that edge |

Document: **either sugar-sequence *or* hand-wired edges for a given
dependency — not both.**

### Waiter lifetime (restart / stop / discard)

**Problem:** parent thread does `.run(revealUnit)` → arms a wait on
`revealUnit.completed`. Hover restarts the unit. Without cleanup you get
**two waits** or a **zombie wait** that fires on a later completion and
advances the parent too early (or twice).

**Rule: every wait is owned by a generation; only the current gen may fire.**

```text
Parent thread T (gen T_g) reaches .run(U):
  1. U.start()           // bumps U.gen → U_g
  2. T arms waiter W:
       { owner: T, ownerGen: T_g, target: U, targetGen: U_g, event: "completed" }
  3. On U.completed:
       fire W only if T.gen === T_g AND U.gen === U_g
       else ignore (stale)
```

| Event | What happens to waits |
| --- | --- |
| **`U.restart()`** (e.g. hover mid-reveal) | `U.gen++`. Old unit-internal waits (storm side thread, scene.completed) dropped. Parent’s W still armed but requires **old `targetGen`** → will **not** fire on the *next* completed from the new run… **unless we re-bind.** |
| **Correct parent behavior on child restart** | Two valid designs (pick one at implement): **(A)** Parent wait is on **unit identity + event**, not frozen targetGen — only `ownerGen` matters; any *current* completion of U counts (restart is invisible to parent; parent still waits for “eventually completed once”). **(B)** Restart is local; parent wait stays until one successful completed with matching lifecycle token parent captured at `run`. |
| **Hover hasten (no full restart)** | Usually no new parent wait: same U.gen, force settle → one `completed` → parent advances once. Prefer this for *revealing* hasten. |
| **Hide re-reveal + restart hide unit** | Parent is often waiting on `hideUnit.completed`. Restart hide → must **not** double-advance. Use gen: old in-flight hide’s completed is stale; parent wait either re-armed for new gen **or** waits for “one completed after start token S”. |
| **`U.stop()`** | `U.gen++`, clear U’s waiters, optional `cancelled` event. Parent waiting on U: **does not** treat cancel as completed (unless policy says so). Parent stays blocked or times out / watchdog — default: **stay blocked until explicit parent restart**. |
| **`T.stop()` / `T.restart()` / ctx cancel** | `T.gen++`, **dispose all waiters owned by T** (timers, unit.completed, synthetic). Child units: policy — default **stop children T started** so work and listeners die. |
| **Thread discarded (no refs)** | Must not rely on GC for correctness. **Explicit dispose** on stop/cancel unregisters scene listeners and clears timer maps. If something only holds closures on scene.on without off(), that is a leak — gen bump must call `off()`. |

**Recommended default (implement):**

1. Each waiter: `{ id, ownerGen, off, fire }`.  
2. Arming registers `off` in the owner’s `waiters` set.  
3. `bumpGen(owner)` → for each waiter: `off()`; clear set; ownerGen++.  
4. Child `completed` handler: if `owner.gen !== ownerGen` return; else advance once and `off()`.  
5. **Reveal hasten:** force settle same gen (one completed).  
6. **Hide hover restart:** `hideUnit.restart()` bumps hide gen and clears *its* waiters; **parent thread’s** wait on hide was registered with an `off` tied to parent gen — the listener should be:

   ```text
   // parent waiting on unit U completed (any successful finish of current run)
   U.on("completed", handler) 
   // handler checks parent.gen; does NOT require frozen U.gen from start
   // BUT must ignore completed that is "cancelled" or from forced stop without success
   // After U.restart(), the NEXT real completed is the one that advances parent
   ```

   So parent wait is **not** “first completed after arm” if restart emits a
   spurious completed — restart must **not** emit `completed` for the aborted
   run. Only a successful settle emits `completed`. Aborted run → `cancelled`
   or silent gen bump.

**Memory:** no unbounded waits if every path that abandons work calls
`bumpGen` / `dispose`. Scene `on` always paired with `off` in disposer.
Discarded thread without `stop()` is a bug in authoring/runtime — `ctx.cancel()`
and `player.cancel()` must dispose the play context root.

**Answer in one line:** restart does **not** leave two live waits; old waits
are unsubscribed or gen-stale no-ops; stop/discard **must** dispose; we never
rely on “wait forever in memory” as OK.

### Cancellation vs promises (design stance)

**Agree with the spirit of the “promises are not cancelable” position.**

- A Promise is a *value* for an operation that will settle. Cancelling the
  Promise object is a category error; it “breaks the promise.”
- Bluebird cancellation was pragmatic and muddied the model.
- Modern JS separates **interest/abort** (`AbortSignal`) from the Promise:
  the promise still settles (often `AbortError`); you didn’t un-write the
  monadic contract.

**Implication for this system:**

| Do | Don’t |
| --- | --- |
| Cancel **subscriptions / generations / work** (timers, scene waiters) | Build core API on “cancellable Promise” |
| `stop`/`restart` → gen++; old waiters no-op; unit may emit `cancelled` | Pretend `await unit` can be cancelled mid-flight without a token |
| Optional later: `waitCompleted(unit, { signal })` that races abort | `.cancel()` on a Promise subclass |

So: **generation-cancel on threads/units** is the right primitive. If we ever
add async sugar, it wraps “wait for event or abort,” not Bluebird-style
promise cancel.

### Extend hold (option)

| Policy | Behavior |
| --- | --- |
| `extend` / `rearm` | Hover during hold: cancel timer waiter, arm full `ms` again (default lean) |
| `none` | Style only |
| Mid-hide | **Not** extend — re-reveal + `hideUnit.restart()` |

### Canonical authoring sketch

```js
const roles = revealUnit(ctx, s.rolesReveal, { name: "roles" });
const email = revealUnit(ctx, s.emailReveal, { name: "email" });
const cardHide = hideUnit(ctx, s.cardHide, { name: "cardHide" });
const afterEmail = holdUnit(ctx, { name: "afterEmail", ms: 2_000, onHover: "extend" });

roles.onStart((t) => t.delay(3_000).storm(3));
email.onStart((t) => t.storm(5));
cardHide.onStart((t) => t.storm(3));

roles.onHover({ whileRevealing: "hasten" });
email.onHover({ whileRevealing: "hasten" });
cardHide.onHover({
  whileHiding: () => {
    roles.forceRevealed();
    email.forceRevealed();
    cardHide.restart();
  },
});

// Happy path — sugar only (no parallel hand-wires for same edges)
const show = thread(ctx, { name: "show" })
  .run(roles)
  .run(email)
  .run(afterEmail)
  .run(cardHide)
  // … interlude …
  .loop();

show.start();
```

Equivalent explicit fragment (what sugar means):

```js
// .run(roles).run(email) ≈
// show-thread: start roles → wait roles.completed → start email → wait email.completed
```

### Residual risks (known, not blockers)

| Risk | Mitigation |
| --- | --- |
| Stale `completed` after restart | gen on every unit/thread waiter |
| Double-wiring sugar + manual `on` | doc rule; later debug assert |
| Storm side thread outlives unit | side threads use unit gen; stop with unit |
| Card hide spans two reveals | `forceRevealed` both; optional later `groupUnit` |
| Listener leaks | `off` on gen bump / ctx.cancel |
| Name “Thread” | comment + docs: play thread, not worker |
| Sugar opacity | desugar table in DESIGN.md + JSDoc one-liners |
| Stuck scene | keep completion watchdog |
| Who owns hover hit-test | binder maps cells → unit; DomManager stays dumb |

### Rejected for v1

- Primary `completedOn` / free-form completion on every unit
- Cancellable promises as core
- Full Rx / visual node editor
- Pure keyframe timeline only
- Async/await as the *only* authoring style (optional later sugar OK)

## Core design question: jump vs units

### Option A — Labels + seek (`goto` / `loopFrom` with policies)

Extend chain labels into **named beats**. Interaction handlers call
`ctx.goto("cardHold", { policy })`.

| Pros | Cons |
| --- | --- |
| Minimal new concepts; labels already exist | Cleanup policy per seek is easy to get wrong |
| One timeline to read | Local restart still fights global `forceStableHidden` |
| Good for “skip to quote” | Playlist content change mid-seek is awkward |

**Policies (sketch):**

| Policy | Clears | Re-arms |
| --- | --- | --- |
| `full` | All scenes stable hidden + logical | Run from label (today’s loop) |
| `segment` | Only scenes tagged to segment | Run from label; leave other content alone |
| `soft` | Cancel pending delays/waits; leave logical | Re-enter modes as steps say |

### Option B — Restartable units (subplays)

Compose the show from **named units** that can start/stop/restart:

```text
show = loop(
  unit("card", cardScript),
  unit("interlude", pickQuoteOrPortrait),
)
```

Each unit owns: scenes it may touch, entry cleanup, hover policy, exit.

| Pros | Cons |
| --- | --- |
| Hover “reset hide timer” = `unit.restartBeat("holdHide")` | More API surface |
| Playlist = unit factory with content | Nesting can get cute |
| Matches mental model card vs quote vs face | Style A multi-chain + units need rules |

### Option C — Hybrid (recommended direction to debate)

- **Author** as linear Style C (or multi-chain A) with **labels / segment markers**.
- **Compile** (or wrap) into **units** for restart scope + interaction binding.
- **Interaction handlers** never poke DomManager tips alone; they call
  `player.interrupt(scope, action)`.

```text
homepage script (readable)
  → segments { cardReveal, cardHoldHide, quoteReveal, quoteHoldHide }
  → bind hover on rolesGroup/emailGroup → interrupt(card*, …)
  → content slot for interlude playlist
```

This keeps authoring friendly while making jump/restart well-defined.

## Interaction model (hover first)

### Targets

| Target | Meaning |
| --- | --- |
| **Group** (roles, email, quote, future portrait) | Default: whole card face / whole quote |
| **Member** (one TextLine / role line) | Optional finer hasten / highlight only that line |
| **Abstract alignment group** | Same as Group — attach policy on layout object used to build DropScene |

Prefer **group-level default** + optional per-line override. Card hide uses
**shared points** (roles+email); re-reveal on hide almost certainly wants
**whole card**, not one line.

### Mode → hover action (product)

| Scene / phase | Hover | Notes |
| --- | --- | --- |
| **Revealing** / incomplete | **Hasten** reveal (group or line) | Finish logical + settle mode if all points done |
| **Revealed** (stable hold) | Style only (links) | Optional: extend hold timer |
| **Hiding** | **Re-reveal full scope** + **reset hold/hide timeline** + re-storm hide | Never hasten hide |
| **Hidden** / other unit active | No-op or hit-test ignore | Don’t resurrect card while quote owns the slot |

### Who owns the handler?

| Layer | Role |
| --- | --- |
| Layout group / TextLine | Optional flags: `interactive`, `hoverScope: "group"\|"line"` |
| Interaction binder (new small module) | Hit-test cells → group → active unit → policy |
| ScenePlayer / unit | `hasten(scene\|group)`, `reRevealAndRestart(segment)` |
| DomManager | Pointer events + paint; **not** business policy |

Today’s DomManager tip force-finish is a **temporary** bridge; product hover
should go through the interaction binder so hide restart can talk to the
player.

## Jump / restart for hide hover

Hide hover is the hard case: user is mid-`cardHide` (or hold timer after
email completed), and we must:

1. Abort hide progress (logical full text back)
2. Settle reveal scenes to `revealed` (or re-enter revealing and hasten)
3. Cancel pending chain waits for *this segment only*
4. Restart: hold delay → hide + storm again
5. **Not** jump to quote or full homepage loop

That implies at least **segment-scoped cancel**, not only global
`player.cancel()` / full `loopFrom`.

**Minimal machinery needed (whatever option we pick):**

| Capability | Why |
| --- | --- |
| Named segment bounds | Know what “card hold+hide” is |
| Cancel pending steps in segment | Stop old hide completion from advancing to quote |
| Re-enter segment entry | Restart hold timer |
| Scoped scene reset | Re-reveal card points; don’t force-hide quote if not involved |

Full-show `loop()` stays global.

## Content playlist (later, shape now)

Interleave between card cycles:

```text
card → interlude[i] → card → interlude[i+1] → …
```

| Interlude kind | Content | Layout |
| --- | --- | --- |
| Quote | string → wrapLinesAlways3 | existing quoteGroup pattern |
| Portrait | ASCII lines / TextLines | same center slot, different cells |

Authoring sketch (not API lock):

```js
const interludes = [
  { type: "quote", text: "…" },
  { type: "quote", text: "…" },
  { type: "portrait", lines: faceAscii }, // sometimes
];

// each card cycle: next interlude, rebuild points or swap prebuilt scenes
```

Design constraints to bake in early:

- **One center slot** (shared region) so quote and portrait don’t both paint
- Rebuild or pool DropScenes when content changes (points/columns change)
- Unit/segment boundary after card hide is the natural swap point
- Hover policies on interlude same family as quote (hasten / re-reveal hide)

## Authoring DX goals

What “very nice / dev-friendly” should mean here:

1. **Read top-to-bottom** like the current homepage chain  
2. **Name beats** (`label` / `segment`) without ceremony  
3. **Attach interaction in one place** near the script, not buried in DomManager  
4. **Swap interlude content** without rewriting weather cues  
5. **Escape hatch** remains `call(fn)` — but happy path shouldn’t need it for
   hover or playlist advance  
6. **No visual timeline editor** in v1 (still code); optional later

### Strawman API (discussion only)

```js
const card = segment("card", (s) =>
  s
    .activate(scenes.rolesReveal).storm(3)
    .delay(2000)
    .activate(scenes.emailReveal).storm(5)
    .on(scenes.emailReveal.events.completed)
    .delay(2000)
    .hide(scenes.cardHide).storm(3)
    .on(scenes.cardHide.events.completed),
);

const interlude = segment("interlude", (s) =>
  s
    .call(() => loadNextInterlude())
    .activate(scenes.interludeReveal).storm(3)
    .on(scenes.interludeReveal.events.completed)
    .delay(5000)
    .hide(scenes.interludeHide).storm(3)
    .on(scenes.interludeHide.events.completed),
);

ctx
  .on("appStart")
  .clearView()
  .run(card)
  .delay(3000)
  .run(interlude)
  .loop();

bindHover(rolesGroup, {
  whileRevealing: "hasten",
  whileHiding: { reReveal: "card", restart: "card.holdHide" }, // names TBD
});
```

Open: whether `segment` is a real object or just labeled ranges on one chain.

## Relationship to existing tasks

| Item | Relationship |
| --- | --- |
| [interactive-play_runtime.md](interactive-play/completed/interactive-play_runtime.md) | **Done** — Unit/Thread runtime + homepage migrate |
| [hover-hasten-reveal.md](interactive-play/completed/hover-hasten-reveal.md) | **Done** — unit hover policies |
| scene-player plan | Foundation; this plan extends authoring + interaction |
| Quotes playlist / portrait | Later interlude content tasks |

### Sequencing (locked)

1. ~~Design lock~~ → [completed/interactive-play_design.md](interactive-play/completed/interactive-play_design.md)  
2. ~~Unit/Thread runtime~~ + homepage migrate → [completed/interactive-play_runtime.md](interactive-play/completed/interactive-play_runtime.md)  
3. ~~Hover~~ (hasten / extend hold / re-reveal+restart) → [completed/hover-hasten-reveal.md](interactive-play/completed/hover-hasten-reveal.md)  
4. Quote playlist interlude  
5. ASCII portrait interlude kind  

No DomManager policy shortcut.

## Open questions (narrow — core model locked)

1. **Hold extend math:** full re-arm of `ms` (lean default) vs add remaining?  
2. **Hover scope default:** whole group vs line-level for multi-line roles?  
3. **Card packaging:** keep sibling units (lean) vs later `groupUnit("card")`?  
4. **Playlist cadence / portrait:** later content tasks — shape already “interlude unit.”  
5. **Kiosk hover:** keep vs disable — product polish later.  

## Out of scope (for now)

- Visual timeline GUI  
- Audio sync  
- Frame-`dt` unified clock (separate residual)  
- Touch-specific gestures beyond “hover/focus equivalent”  
- Full game ECS  

## Task slices

| Task | Status |
| --- | --- |
| [interactive-play_design.md](interactive-play/completed/interactive-play_design.md) | **Done** — design locked 2026-07-17 |
| [interactive-play_runtime.md](interactive-play/completed/interactive-play_runtime.md) | **Done** — runtime + homepage 2026-07-17 |
| [hover-hasten-reveal.md](interactive-play/completed/hover-hasten-reveal.md) | **Done** — unit hover policies 2026-07-17 |
| quote playlist | Later |
| ascii portrait interlude | Later |

## Session note

**2026-07-17 — Hover shipped**

Unit hover policies + binder. DomManager no longer force-tips incomplete
lines; CSS link hover only.

| Piece | Path / API |
| --- | --- |
| Binder | `play/hover.mjs` → `bindHover([{ unit, cells }])` |
| Dispatch | `unit.handleHover()` / `hasten()` / `rearm` / hide callback |
| Abort hide | `softLeaveActive(scene)` — no `completed` |
| Re-show | `forceStableRevealed` → logical + paint |
| Homepage | hasten roles/email/quote; card/quote hide re-reveal+restart; hold extend |
| Smokes | runtime hasten / hide restart / hold extend / softLeave |

**Next agent bullets**
1. **Quote playlist interlude** (content slot after card hide; N quotes,
   swap points without rewriting the whole chain).  
2. Deploy + job-search polish (live surface for recruiters).  
3. Later: ASCII portrait interlude kind.  
4. Keep hover policies on units — do not reintroduce DomManager tip-force.

**2026-07-20 — Plan status check**

Only active plan. Design / runtime / hover slices archived complete.
Foundation plans (alignment-anchors, scene-player, adaptive-performance)
moved to `plans/completed/`.
