# complete-v0.1.4-v0.7.0-migration

**Rank:** 5

## Goal

This repo uses agent-handbook. The live plans are in the new
shape, and the queue has been triaged.

## Guide

[`handbook.md`](../../handbook.md) and
[`plans/README.md`](../README.md). Not product design.

## Checks

- [x] Steps 1–3 are done. The live handbook is
      `agents/handbook.md` and `agents/roles/`. There is no
      composer.
- [x] Every plan that was live is in the new plan shape.
      Flat plan files are translated. They are not left as
      the queue.
- [x] Each plan's status was re-read against the new handbook.
- [x] A plan that is waiting was checked again. It stays
      waiting only when the new handbook still makes that
      wait true. None stayed waiting.
- [x] A plan whose work is already done is closed, even if
      it was still sitting on the old queue.
- [x] Each remaining plan has a status and a rank, and
      `priority.md` lists them in rank order. Rank 1 stays
      off that list, so the list is empty. This plan left
      the queue when the triage finished.

## Handoff

Done 2026-11-06. Not the queue.

No product task had to finish before triage. The saying
playlist already swaps center-slot sayings from a pool.
The optional ASCII portrait is
`plans/interactive-play/`, rank 1, parked, not listed.

Unfiled, and not started: deploy and job-search polish
(named in the old project file, never its own plan).
Kiosk hover keep-vs-disable was an open question, not a
task. `human.md` stayed in `agents/.quarantine/` because
this handbook has no home for it. The product README names
`docs/DESIGN.md`; `docs/` is empty. No conflict was filed.

Installed: bash, css, html, javascript, web-frontend,
secrets. Skipped zsh. The scripts are bash. Skipped the
web kit (it also installs typescript, web-backend, and
rest-api, which this repo does not use).

Old completed plans and `agents/archive/` stayed in
quarantine. Nothing was copied to `plans/.archived/`.
