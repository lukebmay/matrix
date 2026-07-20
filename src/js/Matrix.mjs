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
import DomGrid from "./DomGrid.mjs";
import DomManager from "./DomManager.mjs";
import DropManager from "./DropManager.mjs";
import SceneManager from "./SceneManager.mjs";

let runTimeoutId, autopauseTimeoutId, pauseDifference = 0;

function Matrix(...args) {
  if (!new.target) return new Matrix(...args);
  const self = this;

  const cfg = state.config;

  const scene = cfg.createScene();
  state.contentLayers = scene.contentLayers;
  state.rain = scene.rain ?? null;
  state.dropScenes = scene.dropScenes ?? [];
  state.spawnPolicies = scene.spawnPolicies ?? [];
  state.sceneManager =
    scene.sceneManager ?? SceneManager({ scenes: state.dropScenes });
  state.scenePlayer = scene.scenePlayer ?? null;

  self.isRunning = false;
  self.isPaused = false;

  let then = Date.now() - 1;
  // Autopause remaining across stop/start (pause + tab hide).
  let autopauseRemainingMs = cfg.AUTOPAUSE_TIME;
  let autopauseStartedAt = 0;

  self.start = () => {
    self.isRunning = true;
    state.scenePlayer?.unpause?.();
    runTimeoutId = setTimeout(updateMatrix, cfg.FRAME_DELAY);
    // Kiosk / AUTOPAUSE_TIME 0: never arm portfolio autopause.
    if (cfg.AUTOPAUSE_TIME > 0) {
      autopauseStartedAt = Date.now();
      autopauseTimeoutId = setTimeout(() => {
        self.pause();
      }, Math.max(0, autopauseRemainingMs));
    }
    then = Date.now() - pauseDifference;
  };
  self.stop = () => {
    pauseDifference = Date.now() - then;
    self.isRunning = false;
    if (runTimeoutId) clearTimeout(runTimeoutId);
    if (autopauseTimeoutId) {
      clearTimeout(autopauseTimeoutId);
      if (autopauseStartedAt > 0) {
        const elapsed = Date.now() - autopauseStartedAt;
        autopauseRemainingMs = Math.max(0, autopauseRemainingMs - elapsed);
        autopauseStartedAt = 0;
      }
      autopauseTimeoutId = null;
    }
    state.scenePlayer?.pause?.();
  };
  self.destroy = () => {
    self.stop();
    state.scenePlayer?.cancel?.();
    state.scenePlayer = null;
    state.sceneManager = null;
    state.rain?.cancel?.();
    for (const s of state.dropScenes ?? []) {
      s.cancel?.();
    }
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

  // Freeze cues until first start() (constructor runs before Application.start).
  self.stop();

  state.grid = DomGrid();
  state.dropManager = DropManager();
  state.domManager = DomManager();
  // Homepage hover binds cells; grid must exist first.
  state.scenePlayer?.attachHover?.();

  const updateMatrix = () => {
    const now = Date.now();
    const scale =
      typeof cfg.TIME_SCALE === "number" && cfg.TIME_SCALE > 0
        ? cfg.TIME_SCALE
        : 1;
    const elapsedSeconds = ((now - then) / 1000) * scale;
    // Advance → paint (incl. drops that completed this frame) → kill/spawn.
    // Kill-before-paint skipped tip rows on large dt; hide/reveal waited on rain.
    state.dropManager.advanceDrops(elapsedSeconds);
    state.domManager.updateDom();
    state.dropManager.settleDrops(elapsedSeconds);
    then = now;
    runTimeoutId = setTimeout(updateMatrix, cfg.FRAME_DELAY);
  };
}

export { Matrix };
export default Matrix;
