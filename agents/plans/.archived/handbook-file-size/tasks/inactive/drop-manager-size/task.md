# drop-manager-size

**Status:** done

## Goal

Bring `src/js/DropManager.mjs` in line with the
source-file count.

## Do

The file is 1358 lines. The module ends at the exports
just before the smoke banner. The banner through the
end is the inline smoke. `scripts/build.sh` strips that
trailing banner from the shipped copy so the browser
graph has no `node:` import. Other files under `src/js/`
keep the same trailing smoke and are under 1200 lines.
Leave them alone.

Split the smoke from the manager if that is the named
piece and the manager file then meets the count. Keep
the smoke an async IIFE with no top-level await, and
keep it running only when its file is the process
entry. Keep the build strip working for whatever file
still holds the banner.

Do not carve the manager into pieces that have no name.
If the file should stay one file, say that reason to
the user first. Then record it in the `src/js/` index:
the file, the count it may reach, one sentence why,
and the next count. The size now is 1358, so that next
count is 1500. Create the index if the directory has
none. The entry is a map, not a copy of the file.

## Checks

Run `node src/js/DropManager.mjs` and see the smoke
pass. `scripts/test.sh` does not run these smokes.
After a build, the shipped DropManager module has no
`node:` import. The source file is under 1200 lines,
or the index entry above exists.

## Note

Split the trailing smoke out of `src/js/DropManager.mjs`
into `src/js/DropManager.smoke.mjs`. The manager was 1358
lines because that smoke sat after the exports. The smoke
is the named piece, so the manager still owns live drops
and is 591 lines. Exports are unchanged: `DropManager`,
`maxSafeStackSpeed`, and the default export. The app does
not import the smoke. The smoke is still an async IIFE
with no top-level await. It runs only when that file is
the process entry (`process.argv[1]` matches its
`import.meta.url`). The banner stays in front of the
`node:` imports so `scripts/build.sh` still strips them.

Checked: `node src/js/DropManager.smoke.mjs` printed the
passing smoke. `node src/js/DropManager.mjs` exited 0 and
did not run that smoke; the manager source has no `node:`
import. `scripts/test.sh` reported no tests and exited 0.
After `scripts/build.sh`, `rg node:` on
`dist/js/DropManager.mjs` and `dist/js/DropManager.smoke.mjs`
found no matches. `wc -l` on the manager is 591. No other
source file was split.

Not fixed: `node src/js/DropManager.mjs` still loads
`node:url` from `src/js/performance.mjs`. That smoke
imports `node:url` before it checks that it is the entry,
and DropManager imports the module. Other smokes were
left alone. `README.md` layout does not name the new
file. README is human-owned, so it was not edited.

The reviewer then writes the summary, the context worth
keeping, and the result.

## Summary

No defects remain. The smoke is
`src/js/DropManager.smoke.mjs`. The manager is 591 lines,
still owns live drops, and exports `DropManager`,
`maxSafeStackSpeed`, and the default. The app still
imports only that default from `./DropManager.mjs`.

## Context

The smoke body is the old trailing block, unchanged. The
new file adds the header and imports the two names the
smoke calls. The banner stays in front of the `node:`
imports, so the build strip still removes them. Both
files are under 1200. No other source file was split.

`README.md` does not name the smoke file. That is a note.
README is human-owned, the layout was already a short
map, and no check here requires the line.

Loading the manager under Node still hits the dynamic
`node:url` import in `src/js/performance.mjs`, because
that smoke starts before its entry check. The manager
already imported that module, and this split did not
change it. Not a defect of this change. `src/js/` still
has no directory index. The task asked for one only if
the manager stayed large. That is a pre-existing note,
not a failed check.

## Result

Passed. `node src/js/DropManager.smoke.mjs` printed the
passing smoke. `node src/js/DropManager.mjs` exited 0
and did not print that banner. Importing the smoke from
another entry did not run the tests. There is no
top-level await. After `scripts/build.sh`, neither
`dist/js/DropManager.mjs` nor
`dist/js/DropManager.smoke.mjs` contains `node:`. The
task Checks sentence that expects the smoke on
`DropManager.mjs` is the pre-split command. The smoke
file is the entry now. Detail is `cr-01.md`.
