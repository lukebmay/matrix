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
  state.sceneManager = scene.sceneManager ?? SceneManager({ scenes: state.dropScenes });
  state.scenePlayer = scene.scenePlayer ?? null;

  self.isRunning = false;
  self.isPaused = false;

  // Per-instance frame arm (module-level ids used to leak across restart()).
  let rafId = null;
  let autopauseTimeoutId = null;
  let pauseDifference = 0;
  // performance.now() clock for the frame scheduler (not Date.now).
  let then = 0;
  // Autopause remaining across temporary stop/start (tab hide).
  // Intentionally preserved through visibility stop — not through
  // pause-after-budget-exhausted (see unpause reset).
  let autopauseRemainingMs = cfg.AUTOPAUSE_TIME;
  let autopauseStartedAt = 0;

  const nowMs = () =>
    typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

  const clearFrameArm = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const scheduleFrame = () => {
    // One arm only; start/stop clear before re-arming.
    rafId = requestAnimationFrame(onFrame);
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
    then = nowMs() - pauseDifference;
    scheduleFrame();
  };
  self.stop = () => {
    // Only sample frame gap while actually running (constructor stop is fine).
    if (self.isRunning) {
      pauseDifference = nowMs() - then;
    }
    self.isRunning = false;
    clearFrameArm();
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
      clearFrameArm();
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

  // --- Frame scheduler: rAF + throttle + adaptive interval ---
  // Base cadence ~FRAME_DELAY; stretch toward max when work spikes so cheaper
  // frames beat fighting for FPS. Quality ratchet only escalates (DOM + state).
  const baseInterval = Math.max(1, Number(cfg.FRAME_DELAY) || 90);
  const maxInterval = Math.max(baseInterval, Number(cfg.FRAME_DELAY_MAX) || baseInterval * 2);
  // Cap sim step so one hitch cannot explode advance; still large enough for
  // paint-before-kill tip flush on a multi-interval stall (~250ms).
  const maxDtSec = Math.max(0.05, (Number(cfg.FRAME_DT_MAX_MS) || 250) / 1000);
  // Live target ms between ticks (adaptive; starts at base).
  let targetInterval = baseInterval;
  const slowFramesNeeded = 8;
  let slowFrameStreak = 0;
  let cheapGlowOn = !!cfg.IS_CHEAP_GLOW;
  // Seed runtime weather from frozen config (null state = follow cfg).
  state.weatherScale = cfg.WEATHER_SCALE === true ? true : null;
  state.allowStormStack = cfg.ALLOW_STORM_STACK === false ? false : null;
  let weatherScaleOn = state.weatherScale === true;

  const enableConstrainedQuality = () => {
    if (!cheapGlowOn) {
      cheapGlowOn = true;
      document.documentElement.classList.add("m-cheap-glow");
    }
    if (!weatherScaleOn) {
      weatherScaleOn = true;
      // Runtime thin rain + shorter new tails (cfg lengths were full).
      state.weatherScale = true;
      // No second drop on occupied storm cols (less concurrent paint).
      state.allowStormStack = false;
    }
  };

  // Ease interval toward `next` (ms). Heavy work stretches; light eases down.
  const setTargetInterval = (next) => {
    targetInterval = Math.min(maxInterval, Math.max(baseInterval, next));
  };

  const onFrame = (frameTime) => {
    rafId = null;
    if (!self.isRunning) return;

    const now = typeof frameTime === "number" && Number.isFinite(frameTime) ? frameTime : nowMs();
    const wallGapMs = now - then;

    // Throttle: skip vsyncs until the live target interval has elapsed.
    // Uses last *tick* time (not delay-after-work) so overrun is not sticky.
    if (wallGapMs < targetInterval * 0.92) {
      scheduleFrame();
      return;
    }

    const scale = typeof cfg.TIME_SCALE === "number" && cfg.TIME_SCALE > 0 ? cfg.TIME_SCALE : 1;
    // Clamp sim dt; wall gap still informs quality / adaptive interval.
    const elapsedSeconds = Math.min(maxDtSec, (wallGapMs / 1000) * scale);
    const workStart = nowMs();

    // Advance → paint (incl. drops that completed this frame) → kill/spawn.
    // Kill-before-paint skipped tip rows on large dt; hide/reveal waited on rain.
    state.themeDirector?.tick?.(elapsedSeconds);
    state.dropManager.advanceDrops(elapsedSeconds);
    state.domManager.updateDom();
    state.dropManager.settleDrops(elapsedSeconds);

    const workMs = nowMs() - workStart;

    // Adaptive interval: prefer fewer frames when JS work is heavy.
    // Stretch toward work×1.2 (capped); ease back a few ms when light.
    const heavyWork = workMs >= Math.max(40, Math.floor(targetInterval * 0.55));
    if (heavyWork) {
      setTargetInterval(Math.max(targetInterval, workMs * 1.2));
    } else if (targetInterval > baseInterval && workMs < targetInterval * 0.35) {
      setTargetInterval(targetInterval - 5);
    }

    // Quality ratchet: cheap glow + weather scale if work / gap stays heavy.
    // Budgets track the *current* target so intentional stretch is not punished.
    if (!cheapGlowOn || !weatherScaleOn) {
      const slowWorkMs = Math.max(40, Math.floor(targetInterval * 0.55));
      const slowGapMs = targetInterval + slowWorkMs;
      const heavy = workMs >= slowWorkMs || wallGapMs >= slowGapMs;
      if (heavy) {
        slowFrameStreak += 1;
        if (slowFrameStreak >= slowFramesNeeded) enableConstrainedQuality();
      } else {
        slowFrameStreak = 0;
      }
    }

    // Anchor next throttle to this tick (not work-end) — recovers after spikes.
    then = now;
    if (self.isRunning) scheduleFrame();
  };
}

export { Matrix };
export default Matrix;
