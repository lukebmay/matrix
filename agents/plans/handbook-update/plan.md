# handbook-update

**Rank:** 3

## Goal

The catalog installed here is 0.9.19. It was 0.9.18.
A later agent brings the code in line with
`agent-handbook changelog 0.9.18`. This plan does not
make those product edits. Each correction is a
`handbook-<topic>` plan, and this file lists them.

## Guide

[`handbook.md`](../../handbook.md), Handbook updates.
The range is that changelog command. A newer entry
replaces an older one on the same rule. 0.9.19
replaces the 0.9.15 XDG home rule. The statement is
"XDG directory variables" in
[`scripting.md`](../../installed/scripting.md)
(scripting 2.10.0).

## Checks

`catalog_version` in `agents/installed/.meta.toml` is
`0.9.19`. The corrections below exist, and no other
lag from that range is left unnamed.

## This repo

The first handbook-update is archived at
`plans/.archived/handbook-update/`. It already said
that plans opened before catalog 0.9.18 may omit the
`handbook-` prefix. `handbook-file-size` from that
range is done and archived. Later handbook plans use
the prefix. This directory is a new plan. The archive
stays where it is.

Read on this update:

- `interactive-play` changes the center slot to an
  optional portrait. It does not state an XDG, home,
  or file-size rule. Rank 1, already off the queue.
  Not rewritten. Not dropped.

No plan was rewritten. No plan was dropped.

## Corrections

Nothing lags. This is a static page. No app or script
keeps config, data, state, cache, logs, or runtime
files outside the repo build (`dist/`) and the deploy
rsync. No product file detects an XDG system, defaults
to `~/.<app>/`, sends runtime to `/tmp`, or keeps logs
outside a state home. `~/.ssh` and `~/.gitconfig` are
not this rule, and this repo does not use them.
`handbook-xdg` was not opened.
