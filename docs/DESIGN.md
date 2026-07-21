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
early). The column looks “busy,” so rain waits, storm waits, and the saying’s
last letter sits in purgatory for a second while a tourist finishes falling.

**Rule:** occupation ≠ coverage. Coverage is “a post-activation spawn claimed
this column for the active scene.” Selection drains on spawn while the scene
is active; tips paint glyphs only when `dropAffects` says the drop is allowed
to touch that scene.

### Paint before kill (large dt)

A cousin of the same lie: the frame used to **advance → kill completed →
spawn → paint**. On a long frame (tab hitch, busy main thread) a drop can
jump from near the top past `ROWS` and die **before** DomManager flushes tip
rows. Selection was already drained on spawn, so the storm thinks it is
done — leftover hide/reveal glyphs sit until ambient rain randomly re-hits
the column.

**Frame order now:** `advanceDrops` → `updateDom` (completed drops still in
the live set so tip rows flush through the bottom) → `settleDrops` (kill +
spawn). Claim without a tip pass is no longer a hitch away.

### Frame scheduler (rAF, not sticky timeout)

Rain is rAF-throttled, not 60 FPS. Base `FRAME_DELAY` is **~75ms on
mobile/cheap** (paint-bound) and **~45ms on desktop**. On a 60 Hz display
ticks land on nearby vsyncs via one frame of throttle slack — not a sticky
timeout. The old loop was `setTimeout(work, FRAME_DELAY)` *after* each tick
— so a 50ms JS burst made the wall gap **delay + work**, and the next hitch
felt sticky forever.

**Now:** `requestAnimationFrame` drives the arm; ticks only fire when the
**live target interval** has elapsed since the last tick. Overrun is
measured from tick-to-tick, not delay-after-work, so the cadence recovers
as soon as the main thread breathes. We do **not** step every vsync —
more paint is not free.

**Concurrent drop budget (open → sample → clamp):** find how many live
drops this *browser* can paint before frames drag — not a fixed “12”.

1. **Open** — max starts at **`INITIAL_DROP_MAX = COLS`**. Ambient rain and
   storms may fill the grid on a fast machine.
2. **Sample** — while still climbing, keep a rolling **10-frame wall-gap**
   window. Each time live count hits a new peak, restart the window so the
   average reflects the cost *at that occupancy*, not the empty ramp-up.
3. **Clamp** — once live ≥ **`MIN_DROP_MAX` (12**, or COLS if narrower) and
   the 10-frame average wall gap is **≥ 200ms**, settle max to that live
   count. Never clamp below MIN. If the grid fills without tripping 200ms,
   lock max at COLS (desktop path).

Spawn **waits** at the cap (storms still priority over rain; ambient rain
resets to trough when held). Work ms still drives interval stretch and the
quality ratchet; the drop cap is the primary budget.

**Storm drop speed:** 70–100% of the rain speed span (`DROP_SPEED_MIN`…
`DROP_SPEED_MAX`) so storm tips clear faster and free concurrency slots
while selection still needs coverage. Stack-behind-leader still clamps to
no-overtake safe speed.

**Rain pause during storm (constrained):** ambient rain freezes while any
storm runs. On first pause the soft-square accumulator **resets to t=0**
(trough / lowest rate) so resume does not restart mid-peak and fight storms
for slots.

When work still spikes, the interval **stretches** toward `FRAME_DELAY_MAX`
(~180ms) as a backstop (alongside the quality ratchet). Keep that wide ceiling
— constrained devices already blow past a tighter cap. Sim `dt` is clamped
(`FRAME_DT_MAX_MS` ≈ 250) so one long stall cannot explode advance.
Pause / tab-hide cancel the rAF arm; unpause restores the residual gap.

**Debug HUD:** click the top-left character cell to toggle a bottom-right
overlay (rolling FPS, gap/work, target, **live/max drops**, quality). Click
again to hide; does not toggle pause.

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

### Dirty trail paint

A falling column used to rewrite **every** trail cell’s classes and `--drop-*`
vars on every frame. Most of that work is noise: the tip usually advances one
row, one cell leaves the tail, and the middle of the trail is already correct.

**Rule:** restyle only on **tip enter** (resolve + glyph), **trail leave**
(clear drop chrome; re-sync settled content if needed), or **role / theme flip**
(tip↔body, or a different drop owns the cell). Cache the last trail role and
theme name on the cell so steady body rows are free. Glyph/logical still runs
once per tip pass — not every frame for the whole tail.

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
saying. Shared card points mean hide re-reveal force-shows roles **and**
email before restarting `cardHide`.

---

## Layout without a layout engine

`layout/` is anchors, groups, text lines, and a small solver — enough to pin
roles top-right, email bottom-left, saying center, without importing a UI
framework into a Matrix homage. Cells from positionables become DropScene
points. One geometry, two consumers (paint + weather).

---

## Glow: settled vs tip

Tip cells are allowed to be gaudy (double hi-color bloom). Settled body text
needed a **tight black edge** plus a soft outer halo so mid hue (`MED`)
stays crisp on pure black. Links use the brightest near-white of the same
hue — outer halo only, no black edge, so they do not look muddy.

After bold Ubuntu + Matrix `scaleY`, ink covers more of each cell than the
old thin English rain, so residual (`LOW`) and tail/settled mid (`MED`)
were dimmed to keep roughly the same net light per square. Tip `HI` stays
bright for the reveal pulse.

CSS owns the look; paint only toggles classes. Performance loves that more
than three stacked 25px shadows on every static cell.

**Performance levels** (`high` / `medium` / `low`) centralize every quality
lever in [`src/js/performance.mjs`](../src/js/performance.mjs). Call sites
should read `activePerfSettings(state, cfg)` (or cfg fields baked at
construction) instead of scattering mobile / cheap-glow / weather-scale checks.

| Level | When | Drops | Glow | Storms | Rain vs storm |
| --- | --- | --- | --- | --- | --- |
| **high** | capable desktop (default) | slow long (len ≤ 60% of max(R,C)); more concurrent; stack ok; clamp ~200ms | full tip + tail neon; tip may brighten settled | 30–100% of high rain speed; shortest window (1×) | **continues** through storms |
| **medium** | narrow ≤768 or low-power hints, or ratchet | faster floor (20–100% of high span); len ≤ 50% min 5; clamp ~150ms | rain trails thrift; settled/link glow **fixed** under drops (`m-perf-med`) | 50–100%; window ×1.5 | **pauses**; resumes mid-curve |
| **low** | further ratchet | faster still (40–100%); len ≤ 40% min 4; clamp ~150ms | rain tip/trail flat (`m-perf-low`); settled fixed under drops | 70–100%; window ×2.5 | **pauses**; resumes at trough |

Static gate: `detectInitialPerfLevel` (mobile or low-power → medium). Runtime
ratchet only escalates (high → medium → low) after sustained heavy frames /
high inter-render gap. Escalate updates `state.perfLevel` + HTML class —
`Configuration` is frozen, so the ratchet must not mutate cfg.

Ambient rain still **pulses** (cosine trough-start) so the rate breathes above
a floor of 1. Rain mean stays `COLS / period` on all levels.
Plan: [adaptive-performance](../agents/plans/completed/adaptive-performance.md).

## Color themes

Palettes live in `src/js/themes.mjs`. Settled text uses document CSS vars
(`--col-*`). Falling drops bake a **theme name at spawn** and Dom paints
per-cell `--drop-*` so mid-air trails keep their color.

| Role | Surface |
| --- | --- |
| **low** | Residual / dark fill |
| **med** | Drop tails |
| **body** | Settled non-link text (slightly whiter than med) |
| **hi** | Drop tip (bright, still on-hue) |
| **link** | Settled links (brighter; more hue than pure white) |
| **linkHover** | Link hover (closest to white, still tinted) |

### Color change (spawn blend + visual fade)

`ThemeDirector` owns the sequence:

1. **Saying hide activates** → `beginSpawnBlend`: **new** color drops may spawn
   alongside old; coverage pool **refills** for the next theme (**no** drain
   storm). Once a next-theme drop lands on a column, old-theme drops may not
   spawn on that column again.
2. **Saying hide completes** → `startVisualTransition` (~2s empty window):
   residual slug tracks (`--res-low`), ambient `--col-low`, and debug HUD
   accents lerp to the next palette together. Paint must not stomp the lerp
   (old-theme trails leave residual alone; theme tick runs after paint).
3. **Commit** (end of empty window): settled roles snap; only the new color spawns;
   residual blend ends.

**One-shot coverage drain storm:** after the **first** email reveal storm only,
so every column gets residual background text. Never again after that.

**Order (repeat forever):** 3 cycles of **green**, then one cycle of each
other color in `THEME_ORDER` (`blue → purple → red → orange → yellow`),
then back to 3× green.

### Hold / open timings (all performance levels)

| Moment | Duration |
| --- | --- |
| Opening rain before first roles | **3s** |
| Rain lead before reveal storm finishes a scene | **3s** |
| After last reveal of a series (email / saying fully up) | **6s** full text before hide |
| After last hide of a series (all text gone) | **2s** empty before next text |
| Color residual + debug fade (after saying hide) | **2s** (same-color green still holds 2s) |

### Coverage pool (first-pass + color change)

Rain keeps a **without-replacement** column pool (`firstPass`): pick only from
remaining columns until every column has had a drop of the **coverage theme**.
On each color transition start the pool **refills** and `coverageTheme`
becomes the next palette (ambient drain only — no storm).

Cells use `overflow: visible` so bloom can spill into neighbors. The grid is
**exact-fill**: `COLS`/`ROWS` from a target cell size, then
`CHAR_WIDTH = viewWidth / COLS` and `CHAR_HEIGHT = viewHeight / ROWS` so
`#matrix` is `100%` of the viewport — no letterbox black border. Outer-edge
glow may clip slightly at the viewport; immersion beats a padded frame.

---

## Two faces: rain vs English

| Face | Source | Role |
| --- | --- | --- |
| **Matrix Code** | [Rezmason/matrix](https://github.com/Rezmason/matrix) (MIT) | Rain noise + non-settled cells |
| **Ubuntu Sans Mono Bold** | Canonical (Ubuntu Font Licence) | Settled card / saying / email |
| **Courier Prime** | fallback only | Stack safety |

Classic film rain is mostly katakana (plus a handful of Latin/symbols) from
an archived Path of Neo SWF — Rezmason cleaned that into `Matrix-Code.ttf`.
That alphabet is **not** a full English face, so settled business-card text
needs a second mono.

English uses the same family as Ghostty / nvim (`UbuntuSansMono Nerd Font`),
without Nerd icon patches — **Ubuntu Sans Mono** at **Bold** so stem width
sits near Matrix Code (pipe ink ~0.14em vs Matrix ~0.13em). Space Mono was
too skinny next to the rain.

Sizing:

| Role | Family | Size | Why |
| --- | --- | --- | --- |
| Rain / non-settled | Matrix Code | width `0.98×CHAR_WIDTH` on `.m-glyph`, then `scaleY` | Advance fits width; Y-stretch matches English (~0.93× cell height) so rain rows aren’t short blobs |
| Settled English | Ubuntu Sans Mono Bold | `0.95 × CHAR_SIZE` | Line box ≈ 1.2em; thick terminal stems; `transform: none` |
| Grid cell | — | exact viewport / COLS×ROWS | No black gutter; advance target 0.56em |

Without the rain `scaleY`, Matrix glyphs sat as short blobs with dark bands
between rows while Ubuntu text filled the cell — immersion killer.

---

## Rates without a soundtrack

`VariableRateAccumulator` integrates an arbitrary rate function, emits whole
units, carries fractional remainder. Soft-square rain eases between trough
and peak so the room does not feel like a metronome. Storms use a mild
ease-in so late columns are denser, not abandoned.

No video path. No canvas particles. DOM `<code>` cells and an rAF-throttled
~40ms cadence — crude, portable, and weirdly correct for “hacker terminal
on a wall.”

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
