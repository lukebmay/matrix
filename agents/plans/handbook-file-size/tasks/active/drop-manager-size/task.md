# drop-manager-size

**Status:** ready

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

The developer writes what changed, why, and how it was
checked. The reviewer then writes the summary, the
context worth keeping, and the result.
