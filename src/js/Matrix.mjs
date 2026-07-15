/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import state from "./State.mjs";
import Grid from "./Grid.mjs";
import DomManager from "./DomManager.mjs";
import DropManager from "./DropManager.mjs";

let runTimeoutId, autopauseTimeoutId, pauseDifference = 0;

function Matrix(...args) {
  if (!new.target) return new Matrix(...args);
  const self = this;

  const cfg = state.config;

  const scene = cfg.createScene();
  state.contentLayers = scene.contentLayers;
  state.spawnPolicies = scene.spawnPolicies;

  self.isRunning = false;
  self.isPaused = false;

  let then = Date.now() - 1;

  self.start = () => {
    self.isRunning = true;
    runTimeoutId = setTimeout(updateMatrix, cfg.FRAME_DELAY);
    autopauseTimeoutId = setTimeout(() => {
      self.pause();
    }, cfg.AUTOPAUSE_TIME);
    then = Date.now() - pauseDifference;
  };
  self.stop = () => {
    pauseDifference = Date.now() - then;
    self.isRunning = false;
    if (runTimeoutId) clearTimeout(runTimeoutId);
    if (autopauseTimeoutId) clearTimeout(autopauseTimeoutId);
  };
  self.destroy = () => {
    self.stop();
    for (const p of state.spawnPolicies ?? []) {
      p.cancel?.();
    }
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
    then = now;
    runTimeoutId = setTimeout(updateMatrix, cfg.FRAME_DELAY);
  };
}

export { Matrix };
export default Matrix;
