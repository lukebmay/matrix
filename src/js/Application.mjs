/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import Configuration from "./Configuration.mjs";
import Matrix from "./Matrix.mjs";
import state from "./State.mjs";

function Application(...args) {
  if (!new.target) return new Application(...args);
  const self = this;

  self.matrix = null;

  self.onClick = (event) => {
    // Wall mode: ignore casual click-to-pause (content links still navigate).
    if (state.config?.KIOSK) return;
    if (!event.clickHandled && !event.clickHandeled) {
      self.togglePause();
    }
  };

  let timeoutId;
  self.onResize = () => {
    self.matrix?.stop();
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      self.restart();
    }, 300);
  };

  self.togglePause = () => {
    if (self.matrix?.isPaused) self.matrix?.unpause();
    else self.matrix?.pause();
  };

  self.restart = () => {
    if (self.matrix?.destroy) self.matrix.destroy();
    else self.matrix?.stop();
    state.config = Configuration();
    self.matrix = Matrix();
    self.matrix.start();
  };

  self.run = () => {
    state.config = Configuration();
    self.matrix = Matrix();
    self.matrix.start();
    window.addEventListener("click", self.onClick);
    window.addEventListener("resize", self.onResize, true);
    // Optional multi-day insurance; off when SOFT_RELOAD_MS is 0 / unset.
    const reloadMs = state.config.SOFT_RELOAD_MS;
    if (reloadMs > 0) {
      window.setTimeout(() => {
        location.reload();
      }, reloadMs);
    }
  };

  document.addEventListener("visibilitychange", () => {
    // Kiosk keeps the loop alive (wall tab is always open; ignore flaky hide).
    if (state.config?.KIOSK) return;
    const matrix = self.matrix;
    if (!matrix) return;
    // User/autopause pause owns the freeze: do not start/stop underneath it.
    if (matrix.isPaused) return;
    if (document.visibilityState === "visible") {
      // Resume frame loop + re-arm remaining autopause budget.
      matrix.start();
    } else {
      // Tab hide: stop loop and burn active autopause time into remaining.
      matrix.stop();
    }
  });
}

const app = Application();

export { app, Application };
export default app;
