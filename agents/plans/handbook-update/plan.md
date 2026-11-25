# handbook-update

**Rank:** 3

## Goal

The catalog installed here is 0.9.20. It was 0.9.19.
A later agent brings the code in line with
`agent-handbook changelog 0.9.19`. This plan does not
make those product edits. Each correction is a
`handbook-<topic>` plan, and this file lists them.
This plan stays off the queue.

## Guide

[`handbook.md`](../../handbook.md), Handbook updates.
The range is that changelog command. A newer entry
replaces an older one on the same rule. Do not copy
the changelog into this plan.

## Checks

`catalog_version` in `agents/installed/.meta.toml` is
`0.9.20`. `agent-handbook update` refreshed
documentation to 4.9.4 and scripting to 2.10.1. It
left root `AGENTS.md`. It did not migrate a legacy
layout. This plan is absent from
[`../../priority.md`](../../priority.md).

## This tree

The first handbook-update is archived at
`plans/.archived/handbook-update/`. It already said
that plans opened before catalog 0.9.18 may omit the
`handbook-` prefix. `handbook-file-size` from that
range is done and archived. Later handbook plans use
the prefix.

Read on this update:

- `interactive-play` changes the center slot to an
  optional portrait. It does not state the old
  guide-writing rule. Rank 1, already off the queue.
  Not rewritten. Not dropped.

Archived plans were not reopened. No plan was
dropped.

## Leftover

`agents/architecture.md` still says "Opening a plan
does not write this file." That file is a rewritten
guide. This update does not edit it, and it does not
open a plan whose job is to edit it.

`agents/acceptance.md` still says "before or with the
plan" on the sentence that amends that file. Same
leave.

## Corrections

No `handbook-<topic>` plan was opened. No product
file says the installed command runs from the
checkout. This is a static page. No script installs
a command.
