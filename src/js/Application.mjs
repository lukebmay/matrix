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
    self.matrix?.stop();
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
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !self.matrix?.isPaused) {
      self.matrix?.start();
    } else if (!self.matrix?.isPaused) {
      self.matrix?.stop();
    }
  });
}

const app = Application();

export { app, Application };
export default app;
