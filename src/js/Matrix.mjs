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
import {
  applyPerfCss,
  getPerfSettings,
  nextPerfLevel,
  PERF_HIGH,
  PERF_LOW,
  PERF_MEDIUM,
} from "./performance.mjs";

function Matrix(...args) {
  if (!new.target) return new Matrix(...args);
  const self = this;

  const cfg = state.config;

  const scene = cfg.createScene();
  state.contentLayers = scene.contentLayers;
  state.rain = scene.rain ?? null;
  state.dropScenes = scene.dropScenes ?? [];
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

  // --- Paused HUD (same panel chrome as #m-debug; center of viewport) ---
  // Reasons → label. "background" is temporary (auto-resume); others own freeze.
  const PAUSE_LABELS = {
    manual: "PAUSED",
    auto: "AUTO-PAUSED",
    background: "BACKGROUND PAUSED",
  };
  /** @type {null | "manual" | "auto" | "background"} */
  let pauseReason = null;
  let pausedEl = null;
  const removePausedHud = () => {
    if (pausedEl?.parentNode) pausedEl.parentNode.removeChild(pausedEl);
    pausedEl = null;
  };
  const ensurePausedHud = () => {
    if (pausedEl) return pausedEl;
    const root = document.createElement("div");
    root.id = "m-paused";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    document.body.appendChild(root);
    pausedEl = root;
    return root;
  };
  /** @param {null | "manual" | "auto" | "background"} reason */
  const setPausedHud = (reason) => {
    if (!reason) {
      removePausedHud();
      return;
    }
    const root = ensurePausedHud();
    const label = PAUSE_LABELS[reason] ?? PAUSE_LABELS.manual;
    if (root.textContent !== label) root.textContent = label;
  };
  const clearBackgroundHud = () => {
    if (pauseReason !== "background") return;
    pauseReason = null;
    setPausedHud(null);
  };

  self.start = () => {
    // Idempotent: visibility can re-enter; never stack frame/autopause arms.
    if (self.isRunning) return;
    // Leaving a temporary tab-hide freeze (auto-resume path).
    clearBackgroundHud();
    self.isRunning = true;
    state.scenePlayer?.unpause?.();
    // Kiosk / AUTOPAUSE_TIME 0: never arm portfolio autopause.
    if (cfg.AUTOPAUSE_TIME > 0) {
      // Budget already spent (e.g. tab-show after exact drain): park paused
      // instead of arming a 0ms timeout that immediately re-pauses forever.
      if (autopauseRemainingMs <= 0) {
        self.isRunning = false;
        self.isPaused = true;
        pauseReason = "auto";
        setPausedHud("auto");
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
        self.pause("auto");
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
    pauseReason = null;
    setPausedHud(null);
    state.scenePlayer?.cancel?.();
    state.scenePlayer = null;
    state.sceneManager = null;
    state.rain?.cancel?.();
    for (const s of state.dropScenes ?? []) {
      s.cancel?.();
    }
  };

  self.unpause = () => {
    self.isPaused = false;
    pauseReason = null;
    setPausedHud(null);
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
  /**
   * Freeze the matrix and show a reason badge.
   * @param {"manual" | "auto" | "background"} [reason="manual"]
   *   manual     — click-to-pause; owns freeze until unpause
   *   auto       — autopause budget; owns freeze until unpause
   *   background — tab hide; temporary stop, auto-resume on start()
   */
  self.pause = (reason = "manual") => {
    if (reason === "background") {
      // User/autopause freeze owns the session — do not clobber label or isPaused.
      if (self.isPaused) return;
      pauseReason = "background";
      setPausedHud("background");
      self.stop();
      return;
    }
    // Always re-assert the badge when already frozen (double-fire, etc.).
    if (self.isPaused && !self.isRunning) {
      if (reason === "manual" || reason === "auto") {
        pauseReason = reason;
      }
      setPausedHud(pauseReason || reason);
      return;
    }
    self.isPaused = true;
    pauseReason = reason === "auto" ? "auto" : "manual";
    setPausedHud(pauseReason);
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
  const baseInterval = Math.max(1, Number(cfg.FRAME_DELAY) || 40);
  const maxInterval = Math.max(baseInterval, Number(cfg.FRAME_DELAY_MAX) || baseInterval * 4);
  // Cap sim step so one hitch cannot explode advance; still large enough for
  // paint-before-kill tip flush on a multi-interval stall (~250ms).
  const maxDtSec = Math.max(0.05, (Number(cfg.FRAME_DT_MAX_MS) || 250) / 1000);
  // Live target ms between ticks (adaptive; starts at base).
  let targetInterval = baseInterval;
  // Performance levels (escalate only): high → medium → low.
  // Settings live in performance.mjs; DOM class + state.perfLevel update here.
  // During drop-budget climb, escalate sooner.
  const slowFramesNeeded = 8;
  const slowFramesNeededClimb = 4;
  let slowFrameStreak = 0;
  let perfLevel = cfg.PERF_LEVEL ?? PERF_HIGH;
  state.perfLevel = perfLevel;
  state.allowStormStack = getPerfSettings(perfLevel).allowStormStack ? null : false;
  // Compat for any leftover readers.
  state.weatherScale = perfLevel === PERF_HIGH ? null : true;

  // --- Debug HUD (click top-left cell to toggle; fixed-layout table) ---
  const ROLL_N = 30;
  const rollGaps = [];
  const rollWork = [];
  let debugOn = false;
  let debugEl = null;
  /** @type {Map<string, {a: HTMLElement, b: HTMLElement}> | null} */
  let debugCells = null;
  let cornerClickHandler = null;

  const pushRoll = (buf, value) => {
    buf.push(value);
    if (buf.length > ROLL_N) buf.shift();
  };
  const mean = (buf) => {
    if (!buf.length) return 0;
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i];
    return s / buf.length;
  };

  // Fixed-width fields (6 chars) so columns never shift; matches CSS 6ch cols.
  const n1 = (v) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return "   —  ";
    // e.g. "  13.3" / " 100.0"
    return x.toFixed(1).padStart(6, " ");
  };
  const n0 = (v) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return "   —  ";
    // e.g. "    75" / "   180"
    return String(Math.round(x)).padStart(6, " ");
  };
  // Budget phases → short tokens that fit the value column.
  const PHASE_SHORT = {
    climb: "climb",
    stable: "hold",
  };
  const t6 = (s) => {
    const raw = PHASE_SHORT[s] ?? String(s ?? "—");
    return raw.slice(0, 6).padStart(6, " ");
  };

  const removeDebugHud = () => {
    if (debugEl?.parentNode) debugEl.parentNode.removeChild(debugEl);
    debugEl = null;
    debugCells = null;
  };

  // Stable DOM: build table once; paint only writes cell text.
  const ensureDebugHud = () => {
    if (debugEl) return debugEl;
    const root = document.createElement("div");
    root.id = "m-debug";
    root.setAttribute("aria-hidden", "true");

    const table = document.createElement("table");
    table.className = "m-debug-table";

    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    for (const h of ["", "now", "avg"]) {
      const th = document.createElement("th");
      th.textContent = h;
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    // label → column meaning (short, intuitive)
    // fps: tick rate | gap: wall ms | work: JS ms | drop: live / max | perf
    const rows = [
      ["fps", "fps"],
      ["gap", "gap"],
      ["work", "work"],
      ["drop", "drop"],
      ["perf", "perf"],
    ];
    const cells = new Map();
    for (const [key, label] of rows) {
      const tr = document.createElement("tr");
      const tdK = document.createElement("td");
      tdK.className = "m-debug-k";
      tdK.textContent = label;
      const tdA = document.createElement("td");
      tdA.className = "m-debug-a";
      const tdB = document.createElement("td");
      tdB.className = "m-debug-b";
      tr.append(tdK, tdA, tdB);
      tbody.appendChild(tr);
      cells.set(key, { a: tdA, b: tdB });
    }
    table.appendChild(tbody);
    root.appendChild(table);
    document.body.appendChild(root);
    debugEl = root;
    debugCells = cells;
    return root;
  };

  const setRow = (key, a, b = "") => {
    const c = debugCells?.get(key);
    if (!c) return;
    if (c.a.textContent !== a) c.a.textContent = a;
    if (c.b.textContent !== b) c.b.textContent = b;
  };

  const paintDebugHud = (wallGapMs, workMs) => {
    if (!debugOn) return;
    ensureDebugHud();
    const avgGap = mean(rollGaps);
    const avgWork = mean(rollWork);
    const fps = avgGap > 0 ? 1000 / avgGap : 0;
    const q =
      perfLevel === PERF_LOW ? "low" : perfLevel === PERF_MEDIUM ? "med" : "high";
    const dm = state.dropManager;
    const live = dm?.getActiveDropCount?.() ?? 0;
    const cap = dm?.getMaxActiveDrops?.() ?? 0;
    const workEma = dm?.getWorkEmaMs?.() ?? avgWork;

    // now | avg  (always 6-char fields — see n0/n1/t6)
    const blank = "      ";
    setRow("fps", n1(fps), blank);
    setRow("gap", n0(wallGapMs), n0(avgGap));
    setRow("work", n1(workMs), n1(workEma));
    setRow("drop", n0(live), n0(cap));
    setRow("perf", t6(q), blank);
  };

  const setDebugOn = (on) => {
    debugOn = !!on;
    if (!debugOn) {
      removeDebugHud();
      return;
    }
    ensureDebugHud();
    paintDebugHud(targetInterval, 0);
  };

  // Corner slot (0,0): toggle debug without click-to-pause.
  const corner = state.grid?.get?.(0, 0);
  if (corner) {
    cornerClickHandler = (event) => {
      event.stopPropagation();
      event.clickHandled = "Debug HUD";
      setDebugOn(!debugOn);
    };
    corner.addEventListener("click", cornerClickHandler);
    corner.title = "Toggle debug FPS";
    corner.style.cursor = "pointer";
  }

  // Tear down HUD + corner listener with the matrix instance.
  const prevDestroy = self.destroy;
  self.destroy = () => {
    if (corner && cornerClickHandler) {
      corner.removeEventListener("click", cornerClickHandler);
      cornerClickHandler = null;
    }
    setDebugOn(false);
    setPausedHud(null);
    prevDestroy();
  };

  // Escalate one step (high→med→low). Updates CSS + state; never relaxes.
  const escalatePerf = () => {
    const next = nextPerfLevel(perfLevel);
    if (!next) return false;
    perfLevel = next;
    state.perfLevel = next;
    const s = getPerfSettings(next);
    state.weatherScale = next === PERF_HIGH ? null : true;
    state.allowStormStack = s.allowStormStack ? null : false;
    applyPerfCss(next);
    return true;
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
    // ~1 vsync of slack so a ~45ms target can land on 2×16.7ms (~33ms) or
    // 3× (~50ms) cleanly instead of missing the nearer cadence by a few ms.
    const vsyncSlackMs = 17;
    if (wallGapMs + vsyncSlackMs < targetInterval) {
      scheduleFrame();
      return;
    }

    const scale = typeof cfg.TIME_SCALE === "number" && cfg.TIME_SCALE > 0 ? cfg.TIME_SCALE : 1;
    // Clamp sim dt; wall gap still informs quality / adaptive interval.
    const elapsedSeconds = Math.min(maxDtSec, (wallGapMs / 1000) * scale);
    const workStart = nowMs();

    // Advance → paint → theme residual tick (after paint so lerp sticks) → spawn.
    // Kill-before-paint skipped tip rows on large dt; hide/reveal waited on rain.
    state.dropManager.advanceDrops(elapsedSeconds);
    state.domManager.updateDom();
    // Residual slug-track + debug fade after paint (paint must not win over lerp).
    state.themeDirector?.tick?.(elapsedSeconds);
    state.dropManager.settleDrops(elapsedSeconds);

    const workMs = nowMs() - workStart;

    // Concurrent-drop budget: climb levels + 10-frame wall-gap avg (stable hold).
    // Pass live schedule target so overruns are vs what we are trying to hit.
    state.dropManager.noteFrameTiming?.(wallGapMs, workMs);

    // Adaptive interval: prefer fewer frames when JS work is heavy.
    // Stretch toward work×1.2 (capped); ease back a few ms when light.
    // Drop cap is the primary budget; interval stretch is a backstop.
    const heavyWork = workMs >= Math.max(16, Math.floor(targetInterval * 0.55));
    if (heavyWork) {
      setTargetInterval(Math.max(targetInterval, workMs * 1.2));
    } else if (targetInterval > baseInterval && workMs < targetInterval * 0.35) {
      setTargetInterval(targetInterval - 5);
    }

    // Performance ratchet (escalate only): high → medium → low.
    // Budgets track the *current* target so intentional stretch is not punished.
    // During drop-budget climb, escalate sooner so thrifty settings apply early.
    const budgetPhase = state.dropManager?.getDropBudgetPhase?.() ?? "stable";
    const climbing = budgetPhase === "climb";
    const slowWorkMs = Math.max(40, Math.floor(targetInterval * 0.55));
    const slowGapMs = targetInterval + slowWorkMs;
    const highGap =
      wallGapMs >= Math.max(targetInterval * 1.15, baseInterval * 1.4);
    const stretchedHard = targetInterval >= maxInterval * 0.85;
    const heavyFrame =
      workMs >= slowWorkMs || wallGapMs >= slowGapMs || highGap || stretchedHard;

    if (perfLevel !== PERF_LOW) {
      if (heavyFrame) {
        slowFrameStreak += 1;
        const need = climbing ? slowFramesNeededClimb : slowFramesNeeded;
        if (slowFrameStreak >= need) {
          if (escalatePerf()) slowFrameStreak = 0;
        }
      } else {
        slowFrameStreak = 0;
      }
    }

    pushRoll(rollGaps, wallGapMs);
    pushRoll(rollWork, workMs);
    paintDebugHud(wallGapMs, workMs);

    // Anchor next throttle to this tick (not work-end) — recovers after spikes.
    then = now;
    if (self.isRunning) scheduleFrame();
  };
}

export { Matrix };
export default Matrix;
