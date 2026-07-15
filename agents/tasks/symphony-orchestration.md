# Task — Symphony orchestration (animation machine)

**Status:** Ready (after Rain/DropScene MVP + layout F)  
**Plan:** [alignment-anchors.md](../plans/alignment-anchors.md)  
**Depends on:** rain-storm-column-coverage, alignment F (scenes exist)  
**Priority:** After card layout ships; informs earlier APIs only

## Goal

Developer-facing **Symphony**: a simple programmed thread of cues that
the orchestrator plays — the end-state “animation machine.”

Scenes already expose **events** (`started`, `dropSelected`,
`pointRevealed` / `pointHidden`, `completed`). Symphony wires:

- time offsets (`at(3.5s)`)
- event triggers (`on(scene, 'completed')`)
- actions (`start(scene)`, `enterMode`, start Storm, …)

## End-user mental model

```text
Rain always
  → rolesReveal scene (revealing) @ 3.5s
  → emailReveal when rolesReveal.completed
  → optional rolesHide @ T or on event
```

Not a general game engine — linear/branching **cues** only.

## Do

1. Sketch/implement thin API (chainable or data array of cues).
2. Orchestrator subscribes to scene events + clock.
3. Replace ad-hoc Configuration `setTimeout`s with a Symphony script
   for the homepage card.
4. Document authoring in README / project.md one example.

## Done when

- [ ] Homepage sequence is data/Symphony, not scattered timers
- [ ] New scene can be added with a few cue lines
- [ ] Session note updated

## Design notes

- Keep scenes **dumb** (mode + sets + events); Symphony owns sequencing.
- Reveal and hide are **separate scenes** (or separate mode runs) so
  completion events stay unambiguous.
- Prefer explicit cues over implicit magic.

## Out of scope

Visual timeline editor; multi-track audio sync.

## Session note

*(overwrite each session)*
