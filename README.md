# Matrix — lukemay.com homepage

Hand-coded *The Matrix*-style falling-character rain that reveals a
business-card layout (name, roles, email, links) over time.

Submodule of the [lukemay.com](https://github.com/lukebmay/lukemay.com)
monorepo. Deployed to `/matrix/`; the monorepo **root** shell loads these
assets as the public homepage.

## Story

Ambient rain runs forever with a **wavy spawn rate** (soft square wave —
noticeable plateaus, not flat noise and not a hard on/off square). After a
few seconds, **reveal waves** add extra drops limited to the columns of
each text group (roles, then email) so visitors are not waiting for pure
luck.

Rules that matter for the feel:

| Rule | Detail |
| --- | --- |
| **Additive spawns** | Baseline and reveal policies both run; not mode-switched |
| **One drop per column** | Never two live drops in the same column |
| **Shared coverage** | If baseline already drops on a reveal column, that reveal marks it covered and does not need another |

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
