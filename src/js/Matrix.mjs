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

  // Per-instance timers (module-level ids used to leak across restart()).
  let runTimeoutId = null;
  let autopauseTimeoutId = null;
  let pauseDifference = 0;
  let then = Date.now() - 1;
  // Autopause remaining across temporary stop/start (tab hide).
  // Intentionally preserved through visibility stop — not through
  // pause-after-budget-exhausted (see unpause reset).
  let autopauseRemainingMs = cfg.AUTOPAUSE_TIME;
  let autopauseStartedAt = 0;

  const clearFrameTimeout = () => {
    if (runTimeoutId) {
      clearTimeout(runTimeoutId);
      runTimeoutId = null;
    }
  };

  // Burn active arm time into remaining; clear the timeout.
  const clearAutopauseTimeout = ({ burn = true } = {}) => {
    if (!autopauseTimeoutId) {
      autopauseStartedAt = 0;
      return;
    }
    clearTimeout(autopauseTimeoutId);
    autopauseTimeoutId = null;
    if (burn && autopauseStartedAt > 0) {
      const elapsed = Date.now() - autopauseStartedAt;
      autopauseRemainingMs = Math.max(0, autopauseRemainingMs - elapsed);
    }
    autopauseStartedAt = 0;
  };

  self.start = () => {
    // Idempotent: visibility can re-enter; never stack frame/autopause arms.
    if (self.isRunning) return;
    self.isRunning = true;
    state.scenePlayer?.unpause?.();
    // Kiosk / AUTOPAUSE_TIME 0: never arm portfolio autopause.
    if (cfg.AUTOPAUSE_TIME > 0) {
      // Budget already spent (e.g. tab-show after exact drain): park paused
      // instead of arming a 0ms timeout that immediately re-pauses forever.
      if (autopauseRemainingMs <= 0) {
        self.isRunning = false;
        self.isPaused = true;
        state.scenePlayer?.pause?.();
        return;
      }
      autopauseStartedAt = Date.now();
      const budget = autopauseRemainingMs;
      autopauseTimeoutId = setTimeout(() => {
        // Explicitly exhaust so unpause can detect a spent session.
        autopauseTimeoutId = null;
        autopauseStartedAt = 0;
        autopauseRemainingMs = 0;
        self.pause();
      }, budget);
    }
    runTimeoutId = setTimeout(updateMatrix, cfg.FRAME_DELAY);
    then = Date.now() - pauseDifference;
  };
  self.stop = () => {
    // Only sample frame gap while actually running (constructor stop is fine).
    if (self.isRunning) {
      pauseDifference = Date.now() - then;
    }
    self.isRunning = false;
    clearFrameTimeout();
    clearAutopauseTimeout({ burn: true });
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
    // After autopause fires remaining is 0; a fresh click must re-arm a full
    // window. Without this, start() arms setTimeout(pause, 0) and freezes again.
    if (cfg.AUTOPAUSE_TIME > 0 && autopauseRemainingMs <= 0) {
      autopauseRemainingMs = cfg.AUTOPAUSE_TIME;
    }
    // Force a clean start even if something left isRunning true.
    if (self.isRunning) {
      clearAutopauseTimeout({ burn: false });
      self.isRunning = false;
      clearFrameTimeout();
    }
    self.start();
  };
  self.pause = () => {
    if (self.isPaused && !self.isRunning) return;
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
    if (!self.isRunning) return;
    const now = Date.now();
    const scale =
      typeof cfg.TIME_SCALE === "number" && cfg.TIME_SCALE > 0
        ? cfg.TIME_SCALE
        : 1;
    const elapsedSeconds = ((now - then) / 1000) * scale;
    // Advance → paint (incl. drops that completed this frame) → kill/spawn.
    // Kill-before-paint skipped tip rows on large dt; hide/reveal waited on rain.
    state.themeDirector?.tick?.(elapsedSeconds);
    state.dropManager.advanceDrops(elapsedSeconds);
    state.domManager.updateDom();
    state.dropManager.settleDrops(elapsedSeconds);
    then = now;
    if (self.isRunning) {
      runTimeoutId = setTimeout(updateMatrix, cfg.FRAME_DELAY);
    }
  };
}

export { Matrix };
export default Matrix;
