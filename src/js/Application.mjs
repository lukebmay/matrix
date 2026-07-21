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
    if (!event.clickHandled) {
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
    try {
      state.config = Configuration();
      self.matrix = Matrix();
      self.matrix.start();
      window.addEventListener("click", self.onClick);
      window.addEventListener("resize", self.onResize, true);
      // Boot OK flag for HTML watchdog (DDG / WebKit silent module failures).
      try {
        window.__MATRIX_OK__ = true;
        const stale = document.getElementById("matrix-boot-timeout");
        if (stale?.parentNode) stale.parentNode.removeChild(stale);
      } catch {
        /* ignore */
      }
      // Optional multi-day insurance; off when SOFT_RELOAD_MS is 0 / unset.
      const reloadMs = state.config.SOFT_RELOAD_MS;
      if (reloadMs > 0) {
        window.setTimeout(() => {
          location.reload();
        }, reloadMs);
      }
    } catch (err) {
      // Surface boot failures (otherwise black body with no rain).
      console.error("[matrix] failed to start", err);
      try {
        const msg = document.createElement("pre");
        msg.id = "matrix-boot-error";
        msg.style.cssText =
          "color:#0f0;padding:1rem;white-space:pre-wrap;font:14px monospace;position:relative;z-index:9999";
        msg.textContent = `Matrix failed to start:\n${err?.stack || err}`;
        document.body?.appendChild(msg);
      } catch {
        /* ignore */
      }
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
      // Auto-resume; start() clears the BACKGROUND PAUSED diagnostic badge.
      matrix.start();
    } else {
      // Tab hide: temporary stop + diagnostic badge (should never be visible).
      matrix.pause("background");
    }
  });
}

const app = Application();

export { app, Application };
export default app;
