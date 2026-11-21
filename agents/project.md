# Project

**Owner:** human. Agents may propose edits. Apply them only as
[Changing the guide](plans/README.md#changing-the-guide) says.

## What this is

Vanilla JS Matrix rain business-card homepage for lukemay.com.
It is a submodule. The monorepo root shell loads `./matrix/*`.
It deploys to `/home/luke/www/matrix/`.

How it is built: [`architecture.md`](./architecture.md). Words:
[`glossary.md`](./glossary.md). Product checks:
[`acceptance.md`](./acceptance.md). Bugs:
[`issues.md`](./issues.md).

## Stack

- Runtime: ES modules, no bundler
- Build: `scripts/build.sh` rsyncs `src/` to `dist/`
- Rate: `VariableRateAccumulator` with softSquare / pulse rate functions
- Deploy: `scripts/deploy.sh` needs the lukemay.com monorepo. The old project file also names monorepo `scripts/deploy/matrix.py`

## Conventions

- Portfolio, not an npm package. Proprietary headers stay on the sources.
- Shell scripts in this repo are bash (`#!/usr/bin/env bash`).
- How to run it is the product README.

## Branches

The old project file recorded these names. This file does not
say which one is checked out.

| Branch | Meaning |
| --- | --- |
| `master` | Last pre-finish Luke line (LinearWaveForm era) |
| `refactor_incomplete-mid-refactor` | Human incomplete DropScene/VRA WIP |
| `refactor_07-2026` | AI implementation of the finish design |
