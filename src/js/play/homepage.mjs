/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Homepage play via Unit/Thread sugar (card → saying → loop).

import {
  revealUnit,
  hideUnit,
  holdUnit,
  thread,
  softLeaveActive,
} from "./runtime.mjs";
import { bindHover } from "./hover.mjs";
import state from "../State.mjs";

export function homepagePlay(player, scenes, opts = {}) {
  const ctx = player.context({
    scenes,
    // 0 disables; omit uses ScenePlayer default (60s).
    completionWatchdogMs: opts.completionWatchdogMs,
  });
  const s = ctx.scenes;

  // Opening: ambient rain only, then first roles reveal.
  const rolesAtMs = opts.rolesAtMs ?? 3_000;
  const emailAfterRolesMs = opts.emailAfterRolesMs ?? 2_000;
  // Reveal scenes: rain covers columns for this long before storm finishes.
  const revealRainLeadMs = opts.revealRainLeadMs ?? 3_000;
  const rolesStormSec = opts.rolesStormSec ?? 3;
  const emailStormSec = opts.emailStormSec ?? 3;
  // After last reveal of a series (email / saying): hold full text before hide.
  const cardHoldAfterEmailMs = opts.cardHoldAfterEmailMs ?? 6_000;
  const sayingHoldMs = opts.sayingHoldMs ?? 6_000;
  // After last hide of a series: empty screen before next text activates.
  const afterCardGoneMs =
    opts.afterCardGoneMs ?? opts.afterEmailGoneMs ?? 2_000;
  const cardHideStormSec = opts.cardHideStormSec ?? 3;
  const sayingStormSec = opts.sayingStormSec ?? 3;
  const sayingHideStormSec = opts.sayingHideStormSec ?? 3;
  // After saying hide + theme visual idle: optional extra gap.
  const restartGapMs = opts.restartGapMs ?? 0;
  // After hide-hover re-reveal, hold full text this long before hide restarts.
  const hideLookHoldMs = opts.hideLookHoldMs ?? 6_000;
  // Color visual fade (~2s residual + debug) during post-saying-hide empty.
  const themeBlendSec = opts.themeBlendSec ?? 2;
  // One-time coverage drain after the *first* email reveal storm only.
  const coverageDrainRate = opts.coverageDrainRate ?? 10;
  // Playlist: draw next saying before each reveal (pool primed in createScene).
  const loadNextSaying = opts.loadNextSaying;

  // Thread wait target: completes now if idle, else on next theme commit.
  const themeIdleGate = {
    on(event, fn) {
      if (event !== "completed") return () => {};
      const dir = state.themeDirector;
      if (!dir) {
        fn();
        return () => {};
      }
      return dir.whenIdle(fn);
    },
  };

  const roles = revealUnit(ctx, s.rolesReveal, { name: "roles" });
  const email = revealUnit(ctx, s.emailReveal, { name: "email" });
  const cardHide = hideUnit(ctx, s.cardHide, { name: "cardHide" });
  const sayingReveal = revealUnit(ctx, s.sayingReveal, { name: "saying" });
  const sayingHide = hideUnit(ctx, s.sayingHide, { name: "sayingHide" });
  const afterEmail = holdUnit(ctx, {
    name: "afterEmail",
    ms: cardHoldAfterEmailMs,
    onHover: "extend",
  });
  const sayingHold = holdUnit(ctx, {
    name: "sayingHold",
    ms: sayingHoldMs,
    onHover: "extend",
  });

  // --- One-shot initial coverage drain (first email only) ---
  let initialCoverageDrainDone = false;
  let coverageDrainTimer = null;
  let rolesStormSeen = false;
  let emailStormSeen = false;
  let rolesStormDone = false;
  let emailStormDone = false;
  let emailHoverRevealed = false;
  const clearCoverageDrainTimer = () => {
    if (coverageDrainTimer != null) player.clear(coverageDrainTimer);
    coverageDrainTimer = null;
  };
  const startInitialCoverageDrain = () => {
    if (initialCoverageDrainDone) return;
    initialCoverageDrainDone = true;
    const rain = state.rain;
    if (!rain?.startDrainStorm) return;
    const actualSec = rain.startDrainStorm(undefined, {
      rate: coverageDrainRate,
    });
    clearCoverageDrainTimer();
    if (!(actualSec > 0)) return;
    const watchMs = Math.max(Math.ceil(actualSec * 1000) + 500, 500);
    coverageDrainTimer = player.at(watchMs, () => {
      coverageDrainTimer = null;
      rain.stopDrainStorm?.();
    });
  };
  const tryStartInitialCoverageDrain = () => {
    if (initialCoverageDrainDone) return;
    if (emailHoverRevealed || (rolesStormDone && emailStormDone)) {
      startInitialCoverageDrain();
    }
  };
  const markRolesStormDone = () => {
    rolesStormSeen = true;
    rolesStormDone = true;
    tryStartInitialCoverageDrain();
  };
  const markEmailStormDone = () => {
    emailStormSeen = true;
    emailStormDone = true;
    tryStartInitialCoverageDrain();
  };
  const offRolesStormStart = s.rolesReveal.on?.("stormStart", () => {
    rolesStormSeen = true;
  });
  const offEmailStormStart = s.emailReveal.on?.("stormStart", () => {
    emailStormSeen = true;
  });
  const offRolesStormStop = s.rolesReveal.on?.("stormStop", () => {
    if (!rolesStormSeen && (s.rolesReveal.columnsSelected?.size ?? 0) > 0) {
      return;
    }
    markRolesStormDone();
  });
  const offEmailStormStop = s.emailReveal.on?.("stormStop", () => {
    if (!emailStormSeen && (s.emailReveal.columnsSelected?.size ?? 0) > 0) {
      return;
    }
    markEmailStormDone();
  });
  const offRolesCompleted = s.rolesReveal.on?.("completed", () => {
    markRolesStormDone();
  });
  const offEmailCompleted = s.emailReveal.on?.("completed", () => {
    markEmailStormDone();
  });

  // Reveal: rain lead-in, then storm finishes coverage.
  const armRevealStorm = (unit, scene, sec, onSkipped) => {
    unit.onStart((t) => {
      t.delay(revealRainLeadMs)
        .storm(sec)
        .call(() => {
          if (scene?.stormEnabled) return;
          if ((scene?.columnsSelected?.size ?? 0) > 0) return;
          onSkipped?.();
        });
    });
  };
  // Hide: storm can start immediately (no rain lead required).
  const armHideStorm = (unit, scene, sec) => {
    unit.onStart((t) => {
      t.storm(sec).call(() => {
        if (scene?.stormEnabled) return;
        if ((scene?.columnsSelected?.size ?? 0) > 0) return;
      });
    });
  };

  armRevealStorm(roles, s.rolesReveal, rolesStormSec, markRolesStormDone);
  armRevealStorm(email, s.emailReveal, emailStormSec, markEmailStormDone);
  armHideStorm(cardHide, s.cardHide, cardHideStormSec);
  armRevealStorm(sayingReveal, s.sayingReveal, sayingStormSec);
  armHideStorm(sayingHide, s.sayingHide, sayingHideStormSec);

  // Saying hide activation: new color drops begin; coverage pool for next theme
  // (no drain storm). Visual residual fade starts after hide completes.
  sayingHide.onStart(() => {
    const dir = state.themeDirector;
    if (!dir) return;
    const next = dir.peekNext();
    dir.beginSpawnBlend(next);
    const cols = state.config?.COLS;
    state.rain?.resetCoverage?.({
      cols: cols != null ? cols : undefined,
      theme: dir.next ?? next,
    });
  });

  // Hover policies on units only (binder is hit-test).
  roles.onHover({ whileRevealing: "hasten" });
  email.onHover((u) => {
    if (u.scene?.mode !== "revealing") return;
    emailHoverRevealed = true;
    u.hasten();
    tryStartInitialCoverageDrain();
  });
  sayingReveal.onHover({ whileRevealing: "hasten" });

  // Hide hover: re-reveal, look-hold, then restart hide (re-hover re-arms hold).
  const lookHoldTimers = new Map();
  const clearLookHold = (hideU) => {
    const id = lookHoldTimers.get(hideU);
    if (id != null) player.clear(id);
    lookHoldTimers.delete(hideU);
  };
  const armLookHold = (hideU) => {
    clearLookHold(hideU);
    const id = player.at(hideLookHoldMs, () => {
      lookHoldTimers.delete(hideU);
      hideU.restart();
    });
    if (id != null) lookHoldTimers.set(hideU, id);
  };
  const hideHoverReReveal = (hideU, revealUnits) => {
    const sc = hideU.scene;
    const midHide = sc?.mode === "hiding";
    const holding = lookHoldTimers.has(hideU);
    if (!midHide && !holding) return;
    if (midHide) softLeaveActive(sc);
    for (const u of revealUnits) u.forceRevealed();
    armLookHold(hideU);
  };

  cardHide.onHover(() => hideHoverReReveal(cardHide, [roles, email]));
  sayingHide.onHover(() => hideHoverReReveal(sayingHide, [sayingReveal]));

  // Bind after DomGrid exists (Matrix creates grid after createScene).
  const hoverBindings = [
    { unit: roles, cells: s.rolesReveal.points },
    { unit: email, cells: s.emailReveal.points },
    { unit: afterEmail, cells: s.cardHide.points },
    { unit: cardHide, cells: s.cardHide.points },
    { unit: sayingReveal, cells: s.sayingReveal.points },
    { unit: sayingHold, cells: s.sayingReveal.points },
    { unit: sayingHide, cells: s.sayingHide.points },
  ];
  let unbindHover = () => {};
  player.attachHover = () => {
    unbindHover();
    unbindHover = bindHover(hoverBindings);
    return unbindHover;
  };

  // First saying is primed in createScene; later loops draw the next pool item
  // before reveal (without replacement until the pool is empty).
  let sayingCycle = 0;

  // 3s rain → roles (3s rain lead + storm) → email → hold 6s → hide → 2s empty
  // → saying → hold 6s → hide (new color from activation) → 2s visual fade → loop.
  const show = thread(ctx, { name: "show" })
    .clearView()
    .delay(rolesAtMs)
    .spawn(roles)
    .delay(emailAfterRolesMs)
    .run(email)
    .call(() => {
      markRolesStormDone();
      markEmailStormDone();
    })
    .run(afterEmail)
    .call(() => {
      s.rolesReveal.stopStorm?.();
      s.emailReveal.stopStorm?.();
    })
    .clear(s.sayingHide)
    .clear(s.sayingReveal)
    .run(cardHide)
    .call(() => {
      if (s.rolesReveal.mode !== "hidden") s.rolesReveal.enterMode("hidden");
      if (s.emailReveal.mode !== "hidden") s.emailReveal.enterMode("hidden");
    })
    .delay(afterCardGoneMs)
    .call(() => {
      // Cycle 0 already has loadNextSaying() from createScene.
      if (sayingCycle > 0) loadNextSaying?.();
      sayingCycle += 1;
    })
    .run(sayingReveal)
    .run(sayingHold)
    .call(() => s.sayingReveal.stopStorm?.())
    .clear(s.cardHide)
    .run(sayingHide)
    // Hide complete → 2s empty: residual tracks + debug fade; then old stops.
    .call(() => {
      state.themeDirector?.startVisualTransition?.({
        blendSec: themeBlendSec,
      });
    })
    .wait(themeIdleGate)
    .delay(restartGapMs)
    .loop();

  const baseCancel = ctx.cancel.bind(ctx);
  ctx.cancel = () => {
    for (const hideU of [...lookHoldTimers.keys()]) clearLookHold(hideU);
    clearCoverageDrainTimer();
    state.rain?.stopDrainStorm?.();
    for (const off of [
      offRolesStormStart,
      offEmailStormStart,
      offRolesStormStop,
      offEmailStormStop,
      offRolesCompleted,
      offEmailCompleted,
    ]) {
      if (typeof off === "function") off();
    }
    unbindHover();
    unbindHover = () => {};
    baseCancel();
  };

  show.start();
  return player;
}

export default homepagePlay;
