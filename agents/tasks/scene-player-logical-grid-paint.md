# Task — Logical grid + DOM paint (SceneManager fix)

**Status:** Code done (smokes + build green; **optional browser eyeball**)  
**Plan:** [scene-player.md](../plans/scene-player.md)  
**Priority:** Optional residual — human eyeball of card → quote → loop  
**Depends on:** DropScene modes, Rain first-pass, ScenePlayer (shipped)

## Goal

Make **SceneManager + logical grid** the single source of truth for
**intentional characters**, and make **DomGrid / DomManager** only paint from
that plus rain. Fix tip-once resolve and reveal/hide precedence so the homepage
sequence looks correct.

**Do not assume** current `SceneManager.mjs` / Dom path is correct—re-read this
task and verify in the browser.

## Two grids (required mental model)

| Grid | What it holds | Role |
| --- | --- | --- |
| **Logical grid** | Non-random, **intentionally placed** characters (and style/meta) that **should be showing** | Source of truth for content |
| **DOM grid** | What the browser paints (`code` cells) | View: logical glyph **or** rain noise |

### Logical grid rules

- Entry at `"r,c"` is either:
  - a **content char** (from a reveal), or
  - **empty / none** (`" "` or absent) meaning “no intentional character.”
- Intentional characters **stay** on the logical grid once revealed.
- They are removed / cleared **only** when a **hide** scene is active **and** a
  valid drop hits that cell (tip enter) — then logical goes back to none.
- Rain does **not** own the logical grid. Rain only fills the **DOM** when
  logical has no content char.
- ScenePlayer **force-abort** of an active hide/reveal also clears that
  scene’s logical cells (phase transitions must not leave stale glyphs).

### DOM grid rules

| Logical state | DOM text |
| --- | --- |
| Has intentional char | Paint that char (settled style; tip may be super-bright while tip is on cell) |
| Empty / `" "` | Paint **random** rain char when a drop is on / paints that cell |

Trail/tip CSS (`m-drop`, `m-drop-tip`) is DOM-only; it does not rewrite logical
content except via the tip-enter resolve path below.

```text
Drop tip enters (r,c)  [once per drop per cell]
  → resolve against active scenes
  → write / clear logical grid
  → paint DOM from logical (or random if empty)
```

---

## Resolve (authoritative)

Search order — **first match wins**:

1. **Active reveal scenes**, **most recently activated first**
   (`modeEnteredAt` desc). If scene owns `(r,c)` → set logical to scene char
   (+ style/href).
2. Else **active hide scenes**. If owns `(r,c)` → clear logical to none/`" "`.
3. Else → pure rain (do not invent content on logical).

### Precedence

| Conflict | Winner |
| --- | --- |
| Reveal vs hide same cell | **Reveal** |
| Two reveals same cell | **Most recently activated** |
| Only hide + drop hit | Clear logical |
| No active scene | Logical unchanged; DOM rain if empty |

### Activation / drops

- `columnsSelected` is built only on `enterMode("revealing"|"hiding")`.
- Drops spawned **before** activation must not affect that scene
  (`dropAffects` / `spawnAt >= modeEnteredAt`).
- Glyph change only on **tip first entering** a cell — not every trail frame.
- Multi-row jumps: DomManager tracks last tip row per drop and walks
  every newly entered row so skipped cells still resolve.

### Styles / meta

Same search order as characters. Super-bright = tip only; settled content =
calm `m-revealed` / link style; hide removes settled bright with the glyph.
`href` / `m-link` stamped at init from content layers; **visibility** only via
logical + `m-revealed`.

### Scene cell maps

Each DropScene: `Map<"r,c", { char, href?, style?, … }>` for O(1) ownership
(not array scans every frame). Spaces are **not** owned (`TextLine.cells`
skips them → rain gaps between words).

---

## Related product rules (keep working)

### Modes

| Mode | Acts? | On drop cover |
| --- | --- | --- |
| `hidden` | No | — |
| `revealing` | Yes | Show → logical char |
| `revealed` | No | Logical stays |
| `hiding` | Yes; reset `columnsSelected` | Clear logical on hit |

Separate reveal vs hide scene instances preferred.

### Rain first-pass

- Without replacement until every column has had one drop; if remaining
  first-pass cols are occupied, **wait** (no early free-random).
- On spawn col `c`: drain Rain first-pass + every **active** scene’s
  `columnsSelected`.

### Storms

Delayed via `startStorm()`; not automatic on enterMode.

### Homepage loop (timings)

Rain from t=0 (slow→heavy ~3s). Roles/email start **hidden**.

| Time (phase) | Action |
| --- | --- |
| 3s | Roles reveal |
| 5s | Email reveal |
| 6s / 10s | Roles / email storms |
| 20s | Card hide + quote reveal |
| 23s | Storms on hide + quote |
| quote+10s | Quote hide |
| **+20s gap** | Then loop roles/email again |

Quote: **always exactly 3 lines**, centered. Reusable `Phase` list +
`loopPhases` (in `ScenePlayer.mjs`).

### Pause

Freeze frame loop **and** ScenePlayer cues; remaining delays survive unpause.

---

## Failure modes to kill (current browser)

1. Garbled quote mid-screen mixed with rain while roles still shown.
2. Rain noise **inside** words (spaces not owned — decide: blank static cells
   for spaces when line revealed, or document rain-in-gaps).
3. Hide-before-reveal or dual writers (`data-static-char` + logical + DisplayText).
4. Trail re-resolving / re-randomizing content every frame.

---

## Do

1. Read this task + `agents/plans/scene-player.md` + current
   `SceneManager.mjs`, `DomManager.mjs`, `DropScene.mjs`, `ScenePlayer.mjs`.
2. Make **logical grid** clearly intentional content only; rain never writes
   content chars into logical.
3. DomManager: tip-enter → resolve once → logical write → DOM paint; trail =
   styles + paint-from-logical only.
4. Enforce resolve order (newest reveal → hide → rain).
5. Eyeball full card → quote → 20s gap → card loop.
6. Smokes + `npm run build`.
7. Update plan + this task session note.

## Done when

- [x] Logical grid = only intentional chars; hide+drop clears them
- [x] DOM = logical char or random rain when logical empty
- [x] Tip-once; reveal beats hide; newest reveal wins
- [ ] No garbled dual paint in browser (roles, email, quote) — **eyeball**
- [x] ScenePlayer phase timings still match table
- [x] Session note + plan updated

## Out of scope

Event DSL, clearView utilities, percent anchors, deploy, visual timeline.

## Code map

| Path | Role |
| --- | --- |
| `src/js/SceneManager.mjs` | Logical grid, resolve, applyTip |
| `src/js/DropScene.mjs` | modes, `cellMap`, storm, events |
| `src/js/DomManager.mjs` | DOM grid paint + trail CSS |
| `src/js/DomGrid.mjs` | DOM cell storage |
| `src/js/Drop.mjs` | motion only (`col`, speed, length, `spawnAt`) |
| `src/js/DropManager.mjs` | spawn / column notify |
| `src/js/ScenePlayer.mjs` | pause-aware cues, phases, force clear |
| `src/js/Configuration.mjs` | layout + wire scenes |

## Session note

*(overwrite each session)*

**2026-07-15 — Wrapup (code done; optional eyeball)**

Ownership model verified + hide-paint fix shipped. Play authoring also
shipped (`src/js/play/homepage.mjs`); homepage no longer uses
`cardQuoteLoop`.

| Issue fixed earlier | Fix |
| --- | --- |
| Hide tip cleared logical but DOM kept intentional char as “rain” | `paintFromLogical`: if cell had `m-revealed`, force `randomChar()` when empty |

| Module | Role |
| --- | --- |
| `SceneManager` | Logical intentional only; hide deletes; rain never writes |
| `DomManager` | Tip-once multi-row; hide replaces content glyph |
| `ScenePlayer` | `forceStableHidden` + play `context` chains |
| Spaces | Not owned → **rain gaps between words** |

**Still open (human only)**
1. Browser eyeball: card → quote → loop (tick dual-paint checkbox if clean).
2. When eyeball passes: mark this task Done and archive under
   `plans/scene-player/completed/`.
