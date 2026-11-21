# handbook-update

**Rank:** 3

## Goal

The catalog installed here is 0.9.18. It was 0.9.15.
A later agent brings the code in line with
`agent-handbook changelog 0.9.15`. This plan does not
make those product edits. Each correction is a
`handbook-<topic>` plan, and this file lists them.

## Guide

[`handbook.md`](../../handbook.md), Handbook updates and
Source files. The range is that changelog command. A
newer entry replaces an older one on the same rule.
The 5000 line rule replaces the 3000 line count. Do
not use a 3000 line rule.

## Checks

`catalog_version` in `agents/installed/.meta.toml` is
`0.9.18`. The corrections below exist, and no other
lag from that range is left unnamed.

## This repo

This is the first handbook-update here. Plans opened
before catalog 0.9.18 may omit the `handbook-` prefix.
They were found by what they change.

Read on this update:

- `interactive-play` changes the center slot to an
  optional portrait. It does not state a file-size
  rule. Rank 1, already off the queue. Not rewritten.
- `plans/.archived/complete-v0.1.4-v0.7.0-migration`
  is the finished move onto agent-handbook. It is not
  on the queue. Not rewritten.

No plan was rewritten. No plan was dropped.

## Corrections

- [`handbook-file-size`](../handbook-file-size/plan.md).
  `src/js/DropManager.mjs` was 1358 lines in a multi-file
  module. The smoke is now `src/js/DropManager.smoke.mjs`.
  The manager is 591 lines and still owns live drops.
  Nothing else under `src/` or `scripts/` is over 1200
  lines. No one-file program or whole-program script is
  over 5000, and none under that was queued for a split.
  This correction is done.

0.9.15 does not lag. This is a static page, not an
installable app, and no product file reads
`<APP>_CONFIG_HOME`, the other app homes, or `XDG_*`.
