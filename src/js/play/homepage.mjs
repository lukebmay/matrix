/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Style C linear homepage play (card → quote → loop).
// Kickoff: ctx.start() emits synthetic "appStart".

export function homepagePlay(player, scenes, opts = {}) {
  const ctx = player.context({
    scenes,
    // 0 disables; omit uses ScenePlayer default (60s).
    completionWatchdogMs: opts.completionWatchdogMs,
  });
  const s = ctx.scenes;

  const rolesAtMs = opts.rolesAtMs ?? 3_000;
  const emailAfterRolesMs = opts.emailAfterRolesMs ?? 2_000;
  const rolesStormSec = opts.rolesStormSec ?? 3;
  const emailStormSec = opts.emailStormSec ?? 5;
  const cardHoldAfterEmailMs = opts.cardHoldAfterEmailMs ?? 2_000;
  const afterCardGoneMs =
    opts.afterCardGoneMs ?? opts.afterEmailGoneMs ?? 3_000;
  const quoteHoldMs = opts.quoteHoldMs ?? 5_000;
  const cardHideStormSec = opts.cardHideStormSec ?? 3;
  const quoteStormSec = opts.quoteStormSec ?? 3;
  const quoteHideStormSec = opts.quoteHideStormSec ?? 3;
  const restartGapMs = opts.restartGapMs ?? 0;

  ctx
    .on("appStart")
    .clearView()
    .delay(rolesAtMs)
    .activate(s.rolesReveal)
    .storm(rolesStormSec)
    .delay(emailAfterRolesMs)
    .activate(s.emailReveal)
    .storm(emailStormSec)
    .on(s.emailReveal.events.completed)
    .delay(cardHoldAfterEmailMs)
    .call(() => {
      s.rolesReveal.stopStorm?.();
      s.emailReveal.stopStorm?.();
    })
    .clear(s.quoteHide)
    .clear(s.quoteReveal)
    .hide(s.cardHide)
    .storm(cardHideStormSec)
    .on(s.cardHide.events.completed)
    .call(() => {
      if (s.rolesReveal.mode !== "hidden") s.rolesReveal.enterMode("hidden");
      if (s.emailReveal.mode !== "hidden") s.emailReveal.enterMode("hidden");
    })
    .delay(afterCardGoneMs)
    .activate(s.quoteReveal)
    .storm(quoteStormSec)
    .on(s.quoteReveal.events.completed)
    .delay(quoteHoldMs)
    .call(() => s.quoteReveal.stopStorm?.())
    .clear(s.cardHide)
    .hide(s.quoteHide)
    .storm(quoteHideStormSec)
    .on(s.quoteHide.events.completed)
    .delay(restartGapMs)
    .loop();

  ctx.start();
  return player;
}

export default homepagePlay;
