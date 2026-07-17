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
// Equivalent timing to prior Style C chain; hover policies later.

import {
  revealUnit,
  hideUnit,
  holdUnit,
  thread,
} from "./runtime.mjs";

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

  roles.onStart((t) => t.storm(rolesStormSec));
  email.onStart((t) => t.storm(emailStormSec));
  cardHide.onStart((t) => t.storm(cardHideStormSec));
  quoteReveal.onStart((t) => t.storm(quoteStormSec));
  quoteHide.onStart((t) => t.storm(quoteHideStormSec));

  // Email starts 2s after roles (concurrent); main line waits email only.
  const show = thread(ctx, { name: "show" })
    .clearView()
    .delay(rolesAtMs)
    .spawn(roles)
    .delay(emailAfterRolesMs)
    .run(email)
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
    .delay(restartGapMs)
    .loop();

  show.start();
  return player;
}

export default homepagePlay;
