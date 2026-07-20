/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Homepage play via Unit/Thread sugar (card → quote → loop).

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

  const rolesAtMs = opts.rolesAtMs ?? 1_000;
  const emailAfterRolesMs = opts.emailAfterRolesMs ?? 2_000;
  const rolesStormSec = opts.rolesStormSec ?? 3;
  const emailStormSec = opts.emailStormSec ?? 3;
  const cardHoldAfterEmailMs = opts.cardHoldAfterEmailMs ?? 4_000;
  const afterCardGoneMs =
    opts.afterCardGoneMs ?? opts.afterEmailGoneMs ?? 3_000;
  const quoteHoldMs = opts.quoteHoldMs ?? 5_000;
  const cardHideStormSec = opts.cardHideStormSec ?? 3;
  const quoteStormSec = opts.quoteStormSec ?? 3;
  const quoteHideStormSec = opts.quoteHideStormSec ?? 3;
  const restartGapMs = opts.restartGapMs ?? 0;
  // After hide-hover re-reveal, hold full text this long before hide restarts.
  const hideLookHoldMs = opts.hideLookHoldMs ?? 5_000;
  // Color blend after quote completes: ramp mixed drops, then pure next, commit.
  const themeBlendSec = opts.themeBlendSec ?? 5;
  const themeFullSec = opts.themeFullSec ?? 1.5;
  // Ambient --col-low fade after commit (residual cells use --res-low).
  const themeFadeSec = opts.themeFadeSec ?? 3;
  // After email storm done (or hover-reveal email): flat-rate pool drain.
  // Duration is derived from remaining firstPass / rate (see Rain.startDrainStorm).
  const coverageDrainRate = opts.coverageDrainRate ?? 10;

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
  const quoteReveal = revealUnit(ctx, s.quoteReveal, { name: "quote" });
  const quoteHide = hideUnit(ctx, s.quoteHide, { name: "quoteHide" });
  const afterEmail = holdUnit(ctx, {
    name: "afterEmail",
    ms: cardHoldAfterEmailMs,
    onHover: "extend",
  });
  const quoteHold = holdUnit(ctx, {
    name: "quoteHold",
    ms: quoteHoldMs,
    onHover: "extend",
  });

  // Coverage pool drain: after roles+email storms finished starting drops,
  // or immediately if hover fully reveals email. Never before the card.
  let coverageDrainStarted = false;
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
  const startCoverageDrain = () => {
    if (coverageDrainStarted) return;
    coverageDrainStarted = true;
    const rain = state.rain;
    if (!rain?.startDrainStorm) return;
    // Flat rate until firstPass empty (DropManager stops on empty too).
    const actualSec = rain.startDrainStorm(undefined, {
      rate: coverageDrainRate,
    });
    clearCoverageDrainTimer();
    if (!(actualSec > 0)) return; // pool already empty
    // Watchdog slightly past expected window if refunds stall completion.
    const watchMs = Math.max(Math.ceil(actualSec * 1000) + 500, 500);
    coverageDrainTimer = player.at(watchMs, () => {
      coverageDrainTimer = null;
      rain.stopDrainStorm?.();
    });
  };
  const tryStartCoverageDrain = () => {
    if (coverageDrainStarted) return;
    if (emailHoverRevealed || (rolesStormDone && emailStormDone)) {
      startCoverageDrain();
    }
  };
  // Mark card storms done so drain arms even if stormStart/Stop was missed
  // (skip path, complete-before-storm, FIFO edge cases on mobile).
  const markRolesStormDone = () => {
    rolesStormSeen = true;
    rolesStormDone = true;
    tryStartCoverageDrain();
  };
  const markEmailStormDone = () => {
    emailStormSeen = true;
    emailStormDone = true;
    tryStartCoverageDrain();
  };
  const resetCoverageDrainArm = () => {
    coverageDrainStarted = false;
    rolesStormSeen = false;
    emailStormSeen = false;
    rolesStormDone = false;
    emailStormDone = false;
    emailHoverRevealed = false;
    clearCoverageDrainTimer();
    state.rain?.stopDrainStorm?.();
  };
  const offRolesStormStart = s.rolesReveal.on?.("stormStart", () => {
    rolesStormSeen = true;
  });
  const offEmailStormStart = s.emailReveal.on?.("stormStart", () => {
    emailStormSeen = true;
  });
  const offRolesStormStop = s.rolesReveal.on?.("stormStop", () => {
    // Prefer stop after start; also accept stop when selection already empty.
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
  // Scene settled without a stormStop (e.g. rain covered cols first).
  const offRolesCompleted = s.rolesReveal.on?.("completed", () => {
    markRolesStormDone();
  });
  const offEmailCompleted = s.emailReveal.on?.("completed", () => {
    markEmailStormDone();
  });

  // After storm step: if skipped (no columns left), mark done so coverage
  // drain is not stuck waiting for stormStart/stormStop.
  const armStormOrSkip = (unit, scene, sec, onSkipped) => {
    unit.onStart((t) => {
      t.storm(sec).call(() => {
        if (scene?.stormEnabled) return;
        if ((scene?.columnsSelected?.size ?? 0) > 0) return;
        onSkipped?.();
      });
    });
  };

  armStormOrSkip(roles, s.rolesReveal, rolesStormSec, markRolesStormDone);
  armStormOrSkip(email, s.emailReveal, emailStormSec, markEmailStormDone);
  armStormOrSkip(cardHide, s.cardHide, cardHideStormSec);
  armStormOrSkip(quoteReveal, s.quoteReveal, quoteStormSec);
  armStormOrSkip(quoteHide, s.quoteHide, quoteHideStormSec);

  // Hover policies on units only (binder is hit-test).
  roles.onHover({ whileRevealing: "hasten" });
  // Hover-reveal email: hasten + start coverage drain without waiting on storms.
  email.onHover((u) => {
    if (u.scene?.mode !== "revealing") return;
    emailHoverRevealed = true;
    u.hasten();
    tryStartCoverageDrain();
  });
  quoteReveal.onHover({ whileRevealing: "hasten" });

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
  quoteHide.onHover(() => hideHoverReReveal(quoteHide, [quoteReveal]));

  // Bind after DomGrid exists (Matrix creates grid after createScene).
  const hoverBindings = [
    { unit: roles, cells: s.rolesReveal.points },
    { unit: email, cells: s.emailReveal.points },
    { unit: afterEmail, cells: s.cardHide.points },
    { unit: cardHide, cells: s.cardHide.points },
    { unit: quoteReveal, cells: s.quoteReveal.points },
    { unit: quoteHold, cells: s.quoteReveal.points },
    { unit: quoteHide, cells: s.quoteHide.points },
  ];
  let unbindHover = () => {};
  player.attachHover = () => {
    unbindHover();
    unbindHover = bindHover(hoverBindings);
    return unbindHover;
  };

  // Email starts 2s after roles (concurrent); main line waits email only.
  // After email storm (or hover-reveal): flat-rate coverage-pool drain.
  // Theme blend starts only after quote fully completes (hide done).
  const show = thread(ctx, { name: "show" })
    .call(resetCoverageDrainArm)
    .clearView()
    .delay(rolesAtMs)
    .spawn(roles)
    .delay(emailAfterRolesMs)
    .run(email)
    // Email unit done ⇒ card is up; ensure coverage drain has started even if
    // stormStop events were missed (common when rain already cleared cols).
    .call(() => {
      markRolesStormDone();
      markEmailStormDone();
    })
    .run(afterEmail)
    .call(() => {
      s.rolesReveal.stopStorm?.();
      s.emailReveal.stopStorm?.();
    })
    .clear(s.quoteHide)
    .clear(s.quoteReveal)
    .run(cardHide)
    .call(() => {
      if (s.rolesReveal.mode !== "hidden") s.rolesReveal.enterMode("hidden");
      if (s.emailReveal.mode !== "hidden") s.emailReveal.enterMode("hidden");
    })
    .delay(afterCardGoneMs)
    .run(quoteReveal)
    .run(quoteHold)
    .call(() => s.quoteReveal.stopStorm?.())
    .clear(s.cardHide)
    .run(quoteHide)
    .call(() => {
      const dir = state.themeDirector;
      dir?.beginNextTransition?.({
        blendSec: themeBlendSec,
        fullSec: themeFullSec,
        fadeSec: themeFadeSec,
      });
      // New-color first-pass: only next-theme drops drain the pool.
      const nextTheme = dir?.next ?? dir?.active;
      const cols = state.config?.COLS;
      state.rain?.resetCoverage?.({
        cols: cols != null ? cols : undefined,
        theme: nextTheme,
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
