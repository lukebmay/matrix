# General Agent Guidelines

Follow `agents/` as needed. Do **not** load every file up front — `agentsmd_build.py` composes the stable core into root `AGENTS.md`. Examples: `security.md`, `scripting.md`, `scripts-build.md` (when adding multi-file tools or changing `build-scripts.py`), `comments.md`, `ansi-colors.md`, `markdown.md`.

**Language / stack style:** when relevant, read `agents/languages/<name>.md` (languages, web-frontend/backend, DBs, containers). **Project** style/formatter/LSP configs always win over those defaults.

## No leftover test residue

Before finishing, remove test-only residue from code, configs, and the live environment:

- Paths/imports to `/tmp/...`, scratch clones, ephemeral dirs
- Dummy data, fake commits, debug prints, test-only flags in real paths
- Installer/dotfile targets rewritten to temp or non-real `shellrc` paths
- Temp files, stamps, or fixtures left unrestored

Search the diff and smoke-check real paths you touched.

## Tasks

Session-sized work lives in `agents/tasks/`. Prefer one completable session. Tasks often implement one slice of a plan.

| Rule | Detail |
| --- | --- |
| Active | Always `agents/tasks/<name>.md` while in progress or ready |
| Naming | kebab-case |
| Plan-linked | `{plan}_{task}.md` (e.g. plan `shellrc-startup.md` → task `shellrc-startup_c1-c3.md`) |
| Standalone | No plan prefix required (e.g. `scripts-agentsmd.md`) |
| Done (plan-linked) | Move to `agents/plans/<plan>/completed/` — **not** `agents/tasks/completed/` |
| Done (standalone) | Move to `agents/tasks/completed/` only when the task has **no** plan |

Examples:

| Kind | Active path | Completed path |
| --- | --- | --- |
| Plan-linked | `agents/tasks/displays-live-set_c-multigroup-aliases.md` | `agents/plans/displays-live-set/completed/displays-live-set_b-set-modes.md` |
| Plan-linked | `agents/tasks/shellrc-startup_….md` | `agents/plans/shellrc-startup/completed/shellrc-startup_b1.md` |
| Standalone | `agents/tasks/scripts-agentsmd.md` | `agents/tasks/completed/scripts-agentsmd.md` |

When finishing a plan-linked task: update acceptance + session note, move the file under that plan’s `completed/`, point the plan’s “next task” at the following slice, and fix any stale path refs.

When code changes, ALWAYS update the task with a brief note/summary on progress after each prompt. One update per session. Overwrite and re-summarize the note after each prompt instead of piling up notes.

### Archive (searchable summaries)

Finished work also gets a **high-level** entry under `agents/archive/`:

| Path | Role |
| --- | --- |
| `agents/archive/INDEX.md` | One-line table (tags, dates, links) — **search here first** |
| `agents/archive/entries/<slug>.md` | Design choices, why, major problems |
| `agents/PRIORITY.md` | Active ordered queue (not archive) |

Do not delete completed task/plan files when archiving; archive is the summary layer.
Cross-repo priorities: `~/dev/me/life/agents/PRIORITY-BOARD.md`.

## Plans

Plans live in `agents/plans/` as kebab-case **files** (`agents/plans/<plan>.md`). Read only when the current task needs them.

| Layout | Path |
| --- | --- |
| Plan doc | `agents/plans/<plan>.md` |
| Completed tasks for that plan | `agents/plans/<plan>/completed/*.md` |
| Active tasks for that plan | `agents/tasks/<plan>_….md` (still under tasks/) |

- Break work into manageable bits for the *current* tree
- Incremental plans implement against the existing layout
- Major redesigns: plan first; implement (e.g. under `src/`) only after approval
- Plan-linked completed work stays **with the plan**; do not pile it into `agents/tasks/completed/`

Update the plan as you execute (status, discoveries, task table paths). If a discovery should reshape the plan, stop and ask the user for direction.

When code changes, ALWAYS update the plan with a brief note/summary on progress after each prompt. One update per session. Overwrite and re-summarize the note after each prompt instead of piling up notes.

### Taskforce (plan via subagents, low token baggage)

When the user wants a plan run with subagents (“taskforce”):

| Rule | Detail |
| --- | --- |
| **Serial** | One task at a time. Never run taskforces for different tasks in parallel. |
| **Fresh agents** | New subagent(s) per task; do **not** resume prior taskforces (avoids transcript baggage). |
| **Scope** | Spin as many agents as that task would normally need — still one taskforce per task. |
| **Handoff** | Each taskforce finishes the task, then **overwrites** a short plan session note (and task note): what shipped, key APIs/paths, next-agent bullets only. |
| **Orchestrator** | Parent keeps only plan next-task + handoff; do not paste prior taskforce transcripts into the next prompt. |
| **Stop early** | After a task, if the next would exceed a lean context budget, **stop** and hand back to manual sessions. |

Handoffs live in the plan/task docs so the next agent loads understanding without the previous agent’s token history.
