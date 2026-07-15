# Task — Plan animation orchestration / scheduling

**Status:** Ready (refine residual; base plan exists)  
**Kind:** Plan task (design remaining surface; implement after approval)  
**Depends on:** SceneManager + ScenePlayer MVP  
**Related:** [symphony-orchestration.md](symphony-orchestration.md),  
[plans/symphony.md](../plans/symphony.md)

## Goal

Finish the **animation machine** design for what is still open after MVP:

1. Unified animation clock (frame `dt` + cues)  
2. Full action catalog + schedulable `clearScene` / `clearView`  
3. Event cues `on(scene, "completed")`  
4. Homepage script fully data-driven  
5. Next implement tasks

**Base plan already written:** [plans/symphony.md](../plans/symphony.md)  
(SceneManager resolve, ScenePlayer phases, tip-once paint).

## Why still needed

- Instant clear of logical grid (force hide) not first-class  
- Event-driven branches not implemented  
- Clock still setTimeout-based remaining, not frame-synced  
- clearView / multi-phase authoring polish  

## Do

1. Read `ScenePlayer.mjs`, `SceneManager.mjs`, `plans/symphony.md`.  
2. Extend plan: clear utilities, event cues, clock options.  
3. Name next implement task(s).  
4. Stop for approval before coding those slices.

## Done when

- [ ] Residual sections filled in `plans/symphony.md`
- [ ] Next implement task linked
- [ ] Session note updated

## Out of scope

Visual timeline editor; audio sync; full game-engine ECS.

## Session note

**2026-07-15:** MVP implemented (SceneManager, ScenePlayer/Phase, 20s gap,
always-3-line quote). Residual design only; formerly named Symphony.
