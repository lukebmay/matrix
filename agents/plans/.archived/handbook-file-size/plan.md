# handbook-file-size

**Rank:** 3

## Goal

`src/js/DropManager.mjs` agrees with Source files. It is
split on a responsibility that already has a name, or
the directory index records why it stays large and the
next count.

## Guide

[`handbook.md`](../../handbook.md) Source files. Do not
copy it. The file is one module under `src/js/`. It is
not a one-file program and not a whole-program script.
The 5000 line ceiling does not apply. Do not use a
3000 line count.

## Checks

The manager still owns live drops the way
[`architecture.md`](../../architecture.md) says. The
smoke still runs when the module is the process entry,
and the shipped build still has no `node:` import from
this file. The file is under 1200 lines, or `src/js/`
has an index entry that names it, the count it may
reach, one sentence why, and the next count. No other
file is split in this plan.
