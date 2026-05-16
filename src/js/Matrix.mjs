/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Matrix is the core of the application and drives the main animation loop. It updates drop positions via DropManager, then renders active scenes from state.scenes (last entry takes priority; default scene is first).

import state from "./Matrix/State.mjs";
import Grid from "./Matrix/Grid.mjs";
import DomManager from "./Matrix/DomManager.mjs";
import DropManager from "./Matrix/DropManager.mjs";

let runTimeoutId, autopauseTimeoutId, pauseDifference;

function Matrix(...args) {
  if (!new.target) return new Matrix(...args);
  let self = this;

  const cfg = state.config;

  state.dropScenes = cfg.createDropScenes();

  self.isRunning = false;
  self.isPaused = false;

  let then = Date.now() - 1; // guarantee time delta is non-zero

  self.start = () => {
    self.isRunning = true;
    runTimeoutId = setTimeout(updateMatrix, cfg.FRAME);
    autopauseTimeoutId = setTimeout(() => {
      self.pause();
      // console.log("Application auto-paused after time limit.");
    }, cfg.AUTOPAUSE_TIME);
    then = Date.now() - pauseDifference;
  };
  self.stop = () => {
    pauseDifference = Date.now() - then;
    self.isRunning = false;
    if (runTimeoutId) clearTimeout(runTimeoutId);
    if (autopauseTimeoutId) clearTimeout(autopauseTimeoutId);
  };
  self.unpause = () => {
    self.isPaused = false;
    self.start();
  };
  self.pause = () => {
    self.isPaused = true;
    self.stop();
  };

  self.stop();

  state.grid = Grid();
  state.dropManager = DropManager();
  state.domManager = DomManager();

  const updateMatrix = () => {
    const now = Date.now();
    const elapsedSeconds = (now - then) / 1000;
    state.dropManager.updateDrops(elapsedSeconds);
    state.domManager.updateDom();
    state.dropManager.killCompletedDrops();
    then = now;
    runTimeoutId = setTimeout(updateMatrix, cfg.FRAME_DELAY);
  };
}

export { Matrix };

export default Matrix;
