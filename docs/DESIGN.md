# Matrix — Design notes

Hand-coded Matrix rain that moonlights as a business card. This file is the
**why** file: decisions that look weird until you know the war story. For
how to run it, see the README. For agent task machinery, see `agents/`.

---

## Weather, not particles

We talk about **rain**, **storms**, and **drops** on purpose.

| Term | What it really is |
| --- | --- |
| **Drop** | One falling thread (dumb motion + tip) |
| **Rain** | Ambient forever-weather on the whole grid |
| **Storm** | Optional burst rate aimed at *one content scene’s columns* |
| **DropScene** | Text points + column sets + a **mode** |
| **ScenePlayer** | Timed/event cues that drive those modes (tiny animation machine) |

Calling everything “emitters” and “layers” would be accurate and soul-dead.
Weather makes the rules legible: rain is climate; storms are local weather
fronts that blow through a business card.

---

## Four modes, two that work

A DropScene always *exists*. Only two modes get help from falling code:

| Mode | Kind | Drops act? |
| --- | --- | --- |
| `hidden` | stable | No |
| `revealing` | active | Yes — **show** glyphs; drain selection |
| `revealed` | stable | No — text stays |
| `hiding` | active | Yes — **hide** glyphs; selection rebuilt on enter |

Stable modes are furniture. Active modes are jobs. Prefer **separate**
reveal vs hide scene instances (one job each) instead of one scene that
flip-flops identity.

Entering `hiding` always **resets** `columnsSelected`. Hide is not “whatever
was left from reveal.” Hide is a new assignment: every column that owns
content must be visited again.

---

## Occupation is not coverage

The bug that launched a thousand last-column lags:

A rain drop can **occupy** a column before a content scene activates. That
drop never counted for reveal (`dropAffects` is false — it was born too
early). The column looks “busy,” so rain waits, storm waits, and the quote’s
last letter sits in purgatory for a second while a tourist finishes falling.

**Rule:** occupation ≠ coverage. Coverage is “a post-activation spawn claimed
this column for the active scene.” Selection drains on spawn while the scene
is active; tips paint glyphs only when `dropAffects` says the drop is allowed
to touch that scene.

---

## Bidirectional sets (Rain ↔ Storm)

When *anything* successfully spawns on column `c`:

1. Rain’s first-pass set forgets `c` (if it still cared).
2. Every **active** scene drops `c` from `columnsSelected`.

Stable scenes ignore the memo. That way ambient rain and content storms share
credit without double-booking the same column for “still needed.”

First-pass rain is without replacement until every column has been kissed
once; then free random. Even coverage first, chaos later.

---

## Storms: honest budgets, impolite columns

Storms use a **finite** `VariableRateAccumulator` tuned to finish remaining
selected columns in roughly N seconds (mild ease-in, no late dip that parks
the last unit).

If the VRA says “spawn 3” but columns are blocked, we **refund** the missed
units. Finite budgets used to evaporate into the ether while the UI waited —
refund keeps the storm honest without inventing free drops from nothing.

**Last three free columns** force max storm drop speed. When you’re almost
done, finish like you mean it. Occupied stack columns **do not** get blind
max speed (see below) — physics outranks drama.

---

## Stack behind the leader (and the cycle-3 trap)

When a storm still needs a column that already has a live drop, it may place
a **second** drop on that column so coverage does not wait for the squatter.

### No overtaking (fancy)

The follower starts at row 0. We compute a **max safe speed** so that when
the leader tip reaches the final grid row, the follower is still **at least
one glyph behind**:

\[
v_F \le \frac{(\textit{rows}-2) - r_F}{(\textit{rows}-1 - r_L) / v_L}
\]

(with a required head start of ≥1 row; otherwise skip stack this frame).

Rejected alternative: uncapped dual tips racing each other. Cool demo; bad
business card.

### Cap at two

“Second drop” means **two**, not “one more every cycle.” Early builds allowed
another stack whenever selection re-armed while the previous pair was still
falling. By cycle three the grid looked like a Christmas tree of tips.

`MAX_DROPS_PER_COL = 2`. Stack only when `liveCount === 1`. Rain still
one-per-column forever.

### Trail paint

Multi-tip columns paint a **union** trail (any tip row, any body row). Clear
the column trail only when the **last** drop on that column dies. Otherwise
the survivor flickers into a ghost town mid-fall.

---

## Logical grid vs DOM rain

**SceneManager** owns intentional content (`logical` map). Rain **never**
writes there. Tips resolve: newest active reveal → active hide → leave
logical alone (rain noise only).

**DomManager** paints:

- Settled content from logical (`m-revealed`, glow, links)
- Drop tips/trails as weather chrome
- Settled styles win off-trail so trails do not clobber permanent glyphs

If you only have a DOM and no logical layer, hide/reveal across loops becomes
a riddle written in classLists. We tried the riddle. Logical grid is the
answer key.

---

## ScenePlayer: pause-aware puppetry

`ScenePlayer` is a pause-aware clock plus a tiny play context:

`delay | on/wait | activate | hide | storm | clear | call | loop`

Cues use real `setTimeout` under the hood but **pause** freezes remaining
delay. Tab hide stops the matrix frame loop; unhide resumes — unless kiosk
mode keeps the loop alive (see long-running / kiosk below).

Legacy Style C cue chains (`ctx.on("appStart").activate…`) still work for
smokes and escape hatches. The live homepage uses the Unit/Thread runtime.

### Interactive play (Unit / Thread runtime)

The show is not a pure timeline: hover must hasten reveal, extend hold, and
re-reveal mid-hide without advancing the wrong beat. Design:
`agents/plans/interactive-play.md`. Runtime: `src/js/play/runtime.mjs`.

| Idea | Choice |
| --- | --- |
| Substrate | **Events** (delay = timer emit + wait) |
| Nouns | **Unit** (lifecycle) + **Thread** (linear waits) + DropScene (dumb) |
| Factories | `revealUnit` / `hideUnit` / `holdUnit` wire scene `completed` under the hood |
| Sugar | `run` / `spawn` / `delay` / `loop` → start + wait `completed` (or not) |
| Cancel | Generation + dispose waiters (`off` + `player.clear`) — not cancellable Promises |
| `completed` | Success of current run only; abort/restart does not emit it |
| Hover | Unit policies + `bindHover` hit-test; DomManager style only |

**`run` vs `spawn`:** `thread.run(u)` starts `u` and waits for its
`completed`. `thread.spawn(u)` starts without waiting (homepage: roles
reveal overlaps email). Parent waits are gen-scoped; unit restart does
**not** emit a spurious `completed`, so the parent advances once on the
next real finish.

### Hover: policies on units, not DomManager

Old DomManager link `mouseover` force-tipped incomplete lines — a partial
“finish reveal” hack that ignored hide phases and storm restart.

| Phase | Policy |
| --- | --- |
| Revealing | `hasten` → same-gen `forceSettleActive` → one `completed` |
| Holding | `onHover: "extend"` → `rearm(ms)` full window |
| Hiding | **Never** hasten hide. `softLeaveActive` → re-reveal → **look-hold** |
| | (default 5s, re-arm on re-hover) → `hideUnit.restart()` + storm |
| Revealed / style | DomManager `.m-link-hover` only |

Binder (`play/hover.mjs`) maps content cells → `unit.handleHover()`.
Hide abort must not emit `completed` or the parent thread jumps to the
quote. Shared card points mean hide re-reveal force-shows roles **and**
email before restarting `cardHide`.

---

## Layout without a layout engine

`layout/` is anchors, groups, text lines, and a small solver — enough to pin
roles top-right, email bottom-left, quote center, without importing a UI
framework into a Matrix homage. Cells from positionables become DropScene
points. One geometry, two consumers (paint + weather).

---

## Glow: settled vs tip

Tip cells are allowed to be gaudy (double hi-color bloom). Settled body text
needed a **tight black edge** plus a soft outer halo so mid-green (`#119922`)
stays crisp on pure black. Links are already bright cyan — outer halo only,
no black edge, so they do not look muddy.

CSS owns the look; paint only toggles classes. Performance loves that more
than three stacked 25px shadows on every static cell.

---

## Rates without a soundtrack

`VariableRateAccumulator` integrates an arbitrary rate function, emits whole
units, carries fractional remainder. Soft-square rain eases between trough
and peak so the room does not feel like a metronome. Storms use a mild
ease-in so late columns are denser, not abandoned.

No video path. No canvas particles. DOM `<code>` cells and a 90ms timeout
loop — crude, portable, and weirdly correct for “hacker terminal on a wall.”

---

## Stack and runtime

| Choice | Why |
| --- | --- |
| ES modules, no bundler | Portfolio clarity; view-source is a feature |
| `scripts/build.sh` → rsync to `dist/` | Boring deploy beats clever deploy |
| Proprietary headers | Portfolio, not npm candy |

---

## Long-running safety + kiosk mode

Portfolio defaults: **10-minute autopause**, **click-to-pause**, and **stop
when the tab is hidden**. Fine for lukemay.com in a browser; hostile to a
24/7 wall Pi. Kiosk flips those off; watchdog + optional soft reload handle
stuck chains and multi-day insurance.

### Kiosk activation (shipped)

One switch, several doors — all resolve to `Configuration.KIOSK` via
`src/js/kiosk.mjs` (`resolveKiosk`):

| Door | Example |
| --- | --- |
| **Path (preferred)** | `/kiosk`, `/matrix/kiosk` (trailing slash OK) |
| Query | `?kiosk=1` / `?wall=1` (`0` / `false` / `off` stay portfolio) |
| Hash | `#kiosk` / `#wall` |
| Global | `globalThis.__MATRIX_KIOSK__ = true` before app load |

**Static shells** (no SPA router — nginx serves real directories):

| URL | Source |
| --- | --- |
| `lukemay.com/matrix/kiosk/` | matrix `src/kiosk/index.html` → parent `app.mjs` |
| `lukemay.com/kiosk/` | monorepo root `kiosk/index.html` → `../matrix/app.mjs` |
| `lukemay.com/` / `…/matrix/` | portfolio mode (no kiosk path) |

When matrix is the homepage, root ships a thin `/kiosk/` shell that loads the
same matrix assets. When you swap homepage projects later, replace that shell
or leave it pointing at matrix for a dedicated wall URL.

**What kiosk disables**

| Feature | Portfolio | Kiosk |
| --- | --- | --- |
| Autopause | `AUTOPAUSE_TIME` ~10 min | `0` — never armed |
| Click-to-pause | window click toggles | ignored |
| visibilitychange | stop on hide / start on show | ignored (keep-alive) |
| Content links | navigate | still navigate (wall may want that inert later) |

Soft reload stays opt-in (`SOFT_RELOAD_MS`, default `0`) in both modes.

### Completion watchdog (shipped)

Play chains wait on DropScene `completed`. If a scene stays `revealing` /
`hiding` forever (empty selection but points never painted, or columns never
drained), the loop freezes.

| Piece | Role |
| --- | --- |
| `DropScene.forceSettle()` | Active → stable end + emit `completed` (`forced: true`) |
| `SceneManager.applyLogicalForScene` | Watchdog force-reveal writes logical cells |
| `ScenePlayer` wait on `*.events.completed` | After `COMPLETION_WATCHDOG_MS` (default 60s), `forceSettleActive` |
| Config `COMPLETION_WATCHDOG_MS` | Wired through `homepagePlay`; `0` disables |

`forceStableHidden` still does **not** emit `completed` (abort/clear path).
Recovery that must unblock a wait uses `forceSettle` / `forceSettleActive`.

### Soft reload (optional, off by default)

`Configuration.SOFT_RELOAD_MS` (default `0`). When &gt; 0, `Application.run`
arms a one-shot `location.reload()`. Wall operators can set e.g. daily
(`24 * 60 * 60 * 1000`) as heap-creep insurance; portfolio stays off.

### Bounded occupancy (checklist)

| Cap | Where |
| --- | --- |
| Rain: one live drop per column | DropManager / Rain |
| Storm: ≤2 live drops per column | DropManager stack-behind-leader |
| Logical map cleared on hide / loop / force paths | SceneManager + ScenePlayer |

Scary bits for multi-day runs were **policy timers** (now kiosk) and **stuck
completion** (watchdog), not unbounded arrays.

---

## What we refused

| Idea | Why not |
| --- | --- |
| Video / WebGL rain | Wrong aesthetic budget; DOM is the joke |
| One mega-scene for all text | Hide/reveal ownership becomes spaghetti |
| Uncapped multi-drop tip races | Looks cool, breaks readability and speed rules |
| Design rationale in source comments | Rots; this file is the museum |

---

## Reading order for new agents

1. This file (you are here)
2. `agents/project.md` (status + priorities)
3. Active task under `agents/tasks/`
4. `src/js/play/homepage.mjs` then DropScene → DropManager → DomManager
