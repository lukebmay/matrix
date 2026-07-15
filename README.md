# Matrix — lukemay.com homepage

Hand-coded *The Matrix*-style falling-character rain that reveals a
business-card layout (name, roles, email, links) over time.

Submodule of the [lukemay.com](https://github.com/lukebmay/lukemay.com)
monorepo. Deployed to `/matrix/`; the monorepo **root** shell loads these
assets as the public homepage.

## Story

**Rain** runs forever (wavy rate; first-pass without replacement so columns
light evenly). **DropScenes** hold text points and a **mode**: stable
`hidden` / `revealed`, or active `revealing` / `hiding`. Only active modes
are driven by drops (show or hide glyphs; column sets drain without
replacement). Prefer separate reveal vs hide scenes. Optional **Storms**
speed an active scene. Rain↔Storm column sets update both ways. Long-term,
a **Symphony** of timed/event cues sequences scenes (simple animation
machine).

| Rule | Detail |
| --- | --- |
| **Modes** | hidden → revealing → revealed; revealed → hiding → hidden |
| **Hiding** | Reset column set; hide as drops cover columns |
| **Rain first-pass** | Without replacement, then free random |
| **Bidirectional sets** | Active scenes only |
| **Symphony** | Event/time cues (follow-on task) |

Drops only move. Glyphs and links live on a content layer; the DOM painter
shows the static character when a tip crosses that cell.

## Status

Runnable on branch `refactor_07-2026` (AI finish of the mid-refactor).
Human WIP snapshot: `refactor_incomplete-mid-refactor`.

## Run / build

```bash
npm install
npm run dev      # serve src/
npm test         # placeholder
npm run build    # copy src/ → dist/
```

Monorepo deploy (from repo root):

```bash
python3 scripts/deploy.py matrix
```

## Layout

```text
src/js/
  Application.mjs      # lifecycle: pause, resize, visibility
  Configuration.mjs    # grid, colors, scene factory
  State.mjs
  Matrix.mjs           # frame loop
  Drop.mjs             # dumb particle
  SpawnPolicy.mjs      # rate + column pool (baseline or reveal)
  DropManager.mjs      # live drops; additive policies; occupancy
  DisplayText.mjs      # content positions + href
  DomManager.mjs       # paint rain + static chars
  Grid.mjs
  util/VariableRateAccumulator.mjs
```

## License

Proprietary portfolio code — see `LICENSE.md` / file headers.
