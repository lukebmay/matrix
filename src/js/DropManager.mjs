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
import Drop from "./Drop.mjs";
import { activePerfSettings, stormSpeedBand } from "./performance.mjs";

// Max follower tip speed so that when the leader tip reaches the final grid
// row, the follower is still ≥1 glyph behind. Follower starts at row 0.
// L(t)=rL+vL*t, F(t)=vF*t; at t when L hits rows-1, F ≤ rows-2.
function maxSafeStackSpeed(leader, opts = {}) {
  const rows = opts.rows;
  const rF = opts.followerStartRow ?? 0;
  if (leader == null || !(rows > 0)) return 0;
  const vL = Number(leader.speed);
  const rL = Number(
    leader._row != null
      ? leader._row
      : typeof leader.getRow === "function"
        ? leader.getRow()
        : 0,
  );
  if (!(vL > 0) || !Number.isFinite(rL) || !Number.isFinite(rF)) return 0;

  // One-glyph head start required for a behind-leader stack.
  if (rL - rF < 1) return 0;

  const finalRow = rows - 1;
  const targetF = finalRow - 1; // one behind leader on final row

  if (rL >= finalRow) {
    // Leader already on/past final row: matching speed preserves gap.
    return vL;
  }

  const distL = finalRow - rL;
  const t = distL / vL;
  const room = targetF - rF;
  if (!(t > 0) || !(room > 0)) return 0;
  return room / t;
}

// Owns live drops. Additive Rain + active-scene Storms.
// Rain: one live drop per column. Storm: optional second drop (no-overtake)
// unless weather scale disables stack. Cap 2/col. Spawn drains first-pass and
// active scene columnsSelected. Concurrent budget clamps max from wall-gap
// samples. Storm FIFO (stormStartSeq); rain holds while storms have columns.
const MAX_DROPS_PER_COL = 2;

function DropManager(...args) {
  if (!new.target) return new DropManager(...args);
  const self = this;

  const cfg = state.config;
  const drops = new Set();
  // col → ordered live drops (spawn order; leader = highest _row).
  const byCol = new Map();
  const justFinishedCols = new Set();
  // Reused free-column list (mutated in place during spawn; not retained by callers).
  const freeScratch = [];
  // Reused buffer for takeFinishedColumns ( DomManager reads once per frame).
  const finishedScratch = [];

  // Concurrent-drop budget: start at INITIAL (=COLS). Rolling 10-frame wall-gap
  // avg; each new live peak restarts the sample. Below MIN never clamp; at/above
  // MIN, clamp max to live when avg ≥ perf.frameAvgClampMs (high 200 / med|low 150).
  const cols = Math.max(1, cfg.COLS || 20);
  const cfgInitial = Number(cfg.INITIAL_DROP_MAX ?? cfg.ACTIVE_DROPS_MAX);
  const cfgMin = Number(cfg.MIN_DROP_MAX ?? cfg.ACTIVE_DROPS_MIN);
  const INITIAL_DROP_MAX = Math.max(
    1,
    Number.isFinite(cfgInitial) && cfgInitial > 0
      ? Math.min(cols, Math.floor(cfgInitial))
      : cols,
  );
  // Floor for settled max; never above the ceiling (narrow grids).
  const MIN_DROP_MAX = Math.min(
    INITIAL_DROP_MAX,
    Math.max(1, Number.isFinite(cfgMin) && cfgMin > 0 ? Math.floor(cfgMin) : 12),
  );
  const ROLLING_FRAMES = 10;
  const frameAvgLimitMs = () => {
    const perf = activePerfSettings(state, cfg);
    const n = Number(perf.frameAvgClampMs ?? cfg.FRAME_AVG_CLAMP_MS);
    return Number.isFinite(n) && n > 0 ? n : 200;
  };

  // Calibrate when config declares a budget (production Configuration does).
  // Smokes that omit INITIAL/MIN/ACTIVE_DROPS_* open the full cap immediately.
  // ACTIVE_DROPS_CALIBRATE: false forces open even when those are set.
  const hasBudgetConfig =
    cfg.INITIAL_DROP_MAX != null ||
    cfg.MIN_DROP_MAX != null ||
    cfg.ACTIVE_DROPS_MIN != null ||
    cfg.ACTIVE_DROPS_MAX != null;
  const calibrate =
    cfg.ACTIVE_DROPS_CALIBRATE !== false &&
    cfg.ACTIVE_DROPS_CALIBRATE !== 0 &&
    hasBudgetConfig;

  /** @type {'climb'|'stable'} */
  let phase = calibrate ? "climb" : "stable";
  let maxActiveDrops = INITIAL_DROP_MAX;
  let peakLive = 0;
  let framesSincePeak = 0;
  const frameWindow = [];
  let workEmaMs = 0;
  let frameSamples = 0;

  self.getDrops = () => Array.from(drops);
  self.getDropsOn = (col) => Array.from(byCol.get(col) ?? []);
  self.getActiveDropCount = () => drops.size;
  self.getMaxActiveDrops = () => maxActiveDrops;
  self.getWorkEmaMs = () => workEmaMs;
  self.getDropBudgetPhase = () => phase;
  // Hot path: paint iterates without Array.from.
  self.forEachColumnDrops = (fn) => {
    for (const [c, list] of byCol) {
      if (list.length > 0) fn(c, list);
    }
  };
  self.isColumnLive = (col) => (byCol.get(col)?.length ?? 0) > 0;
  self.takeFinishedColumns = () => {
    if (justFinishedCols.size === 0) {
      finishedScratch.length = 0;
      return finishedScratch;
    }
    finishedScratch.length = 0;
    for (const c of justFinishedCols) finishedScratch.push(c);
    justFinishedCols.clear();
    return finishedScratch;
  };

  const pushEma = (prev, sample, n, warmAlpha = 0.4, steadyAlpha = 0.15) => {
    if (n <= 1) return sample;
    const a = n < 10 ? warmAlpha : steadyAlpha;
    return prev * (1 - a) + sample * a;
  };

  const windowMean = (buf) => {
    if (!buf.length) return 0;
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i];
    return s / buf.length;
  };

  const settleAt = (level) => {
    maxActiveDrops = Math.max(
      MIN_DROP_MAX,
      Math.min(INITIAL_DROP_MAX, Math.floor(level)),
    );
    phase = "stable";
    peakLive = 0;
    framesSincePeak = 0;
    frameWindow.length = 0;
  };

  // Matrix: wallGapMs = inter-tick period; workMs = JS advance/paint/settle.
  self.noteFrameTiming = (wallGapMs, workMs = 0) => {
    const gap = Number(wallGapMs);
    const work = Number(workMs);
    if (!Number.isFinite(gap) || gap < 0) return;

    frameSamples += 1;
    if (Number.isFinite(work) && work >= 0) {
      workEmaMs = pushEma(workEmaMs, work, frameSamples);
    }

    if (phase === "stable") return;

    const live = drops.size;

    frameWindow.push(gap);
    if (frameWindow.length > ROLLING_FRAMES) frameWindow.shift();

    // New peak live count → restart the post-add sample window.
    if (live > peakLive) {
      peakLive = live;
      framesSincePeak = 0;
    }

    if (peakLive < 1) return;

    framesSincePeak += 1;
    if (frameWindow.length < ROLLING_FRAMES) return;

    const avg = windowMean(frameWindow);
    const reportDrops = Math.max(live, peakLive);

    // Below MIN: keep max open at INITIAL.
    if (reportDrops < MIN_DROP_MAX) return;

    // At/above MIN: rolling avg over clamp threshold → this drop count is max.
    if (avg >= frameAvgLimitMs()) {
      settleAt(reportDrops);
      return;
    }

    // Full grid held without tripping clamp — lock at INITIAL.
    if (reportDrops >= INITIAL_DROP_MAX && framesSincePeak >= ROLLING_FRAMES) {
      settleAt(INITIAL_DROP_MAX);
    }
  };

  // Remaining spawn slots this tick (0 → wait; refund VRA units).
  const spawnRoom = () => Math.max(0, maxActiveDrops - drops.size);

  const liveCount = (col) => byCol.get(col)?.length ?? 0;
  const isOccupied = (col) => liveCount(col) > 0;
  // Second drop only when exactly one leader is already falling.
  const canStackOn = (col) => liveCount(col) === 1;

  const freeColumns = () => {
    freeScratch.length = 0;
    for (let c = 0; c < cfg.COLS; c++) {
      if (!isOccupied(c)) freeScratch.push(c);
    }
    return freeScratch;
  };

  // Remove col from freeScratch in place (swap-pop).
  const removeFree = (free, col) => {
    const i = free.indexOf(col);
    if (i < 0) return;
    const last = free.length - 1;
    free[i] = free[last];
    free.pop();
  };

  const leaderOn = (col) => {
    const list = byCol.get(col);
    if (!list?.length) return null;
    let lead = list[0];
    for (let i = 1; i < list.length; i++) {
      if (list[i]._row > lead._row) lead = list[i];
    }
    return lead;
  };

  const spawnSources = () => {
    const sources = [];
    if (state.rain) sources.push(state.rain);

    for (const scene of state.dropScenes ?? []) {
      if (scene.isActive && scene.stormEnabled && scene.stormAccumulator) {
        sources.push(scene);
      }
    }

    return sources.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  };

  // Bidirectional set update after a successful spawn on col.
  // Rain coverage pool is theme-filtered via drop; scenes take any spawn.
  const notifySpawnColumn = (col, drop) => {
    state.rain?.onColumnSpawned?.(col, drop);
    for (const scene of state.dropScenes ?? []) {
      // Stable scenes ignore (onColumnSpawned no-ops when not active).
      scene.onColumnSpawned?.(col);
    }
  };

  // allowStack: storm second drop only (never 3+) on an occupied column.
  // Also respects global maxActiveDrops (caller should check spawnRoom first).
  const spawnOn = (col, opts = {}, { allowStack = false } = {}) => {
    if (spawnRoom() <= 0) return null;
    const n = liveCount(col);
    if (n > 0 && !allowStack) return null;
    if (n > 0 && allowStack && n >= MAX_DROPS_PER_COL) return null;
    // Theme baked at spawn so mid-air drops keep their color through blend.
    const dir = state.themeDirector;
    let theme =
      opts.theme ??
      dir?.pickSpawnTheme?.() ??
      dir?.active ??
      null;
    // Color blend: once next-theme claims a column, old-theme may not land there.
    if (theme != null && dir?.canSpawnOn && !dir.canSpawnOn(col, theme)) {
      const next = dir.next;
      if (next && dir.canSpawnOn(col, next)) {
        theme = next;
      } else {
        return null;
      }
    }
    const drop = Drop({ col, ...opts, theme });
    drops.add(drop);
    let list = byCol.get(col);
    if (!list) {
      list = [];
      byCol.set(col, list);
    }
    list.push(drop);
    dir?.notifySpawn?.(col, theme);
    notifySpawnColumn(col, drop);
    return drop;
  };

  const advanceSource = (source, elapsedSeconds) => {
    const acc = source.stormAccumulator ?? source.accumulator;
    if (!acc) return 0;
    return acc.advance(elapsedSeconds);
  };

  // Active perf settings (single source for weather/glow levers).
  const perfNow = () => activePerfSettings(state, cfg);

  // Storm stack: high only (or explicit state override).
  const allowStormStack = () => {
    if (state.allowStormStack === false) return false;
    if (state.allowStormStack === true) return true;
    return perfNow().allowStormStack !== false;
  };

  // Any content/rain drain storm still enabled (columns pending or just emptied).
  const anyStormActive = () => {
    if (state.rain?.stormEnabled) return true;
    for (const scene of state.dropScenes ?? []) {
      if (scene?.stormEnabled) return true;
    }
    return false;
  };

  // Ambient rain vs storms — from perf level (high: continue through storms).
  // Explicit cfg.PAUSE_RAIN_DURING_STORM wins for smokes without PERF_LEVEL.
  const pauseRainDuringStorm = () => {
    if (state.perfLevel) return perfNow().pauseRainDuringStorm !== false;
    if (cfg.PAUSE_RAIN_DURING_STORM === false) return false;
    if (cfg.PAUSE_RAIN_DURING_STORM === true) return true;
    return perfNow().pauseRainDuringStorm !== false;
  };

  // How to resume ambient rain after a pause (preserve curve vs trough reset).
  const rainResumeMode = () => {
    if (state.perfLevel) return perfNow().rainResume ?? "restart";
    if (cfg.RAIN_RESUME) return cfg.RAIN_RESUME;
    // Legacy smokes: pause without resume mode ⇒ restart (old trough reset).
    if (cfg.PAUSE_RAIN_DURING_STORM === true) return "restart";
    return perfNow().rainResume ?? "restart";
  };

  // Earliest-activated storm still enabled (FIFO). Later storms wait.
  const pickCurrentStorm = () => {
    const storms = [];
    if (state.rain?.stormEnabled && state.rain.stormAccumulator) {
      storms.push(state.rain);
    }
    for (const scene of state.dropScenes ?? []) {
      const active =
        typeof scene.isActive === "function" ? scene.isActive() : scene.isActive;
      if (active && scene.stormEnabled && scene.stormAccumulator) {
        storms.push(scene);
      }
    }
    if (!storms.length) return null;
    storms.sort((a, b) => (a.stormStartSeq ?? 0) - (b.stormStartSeq ?? 0));
    return storms[0];
  };

  // True while ambient rain is held at trough (storm columns or drop cap).
  // On enter: reset rain rate clock to 0 so resume starts quiet.
  let rainHeldAtTrough = false;

  // Exactly one live drop + still selected + head start for no-overtake speed.
  const stackableSelected = (source) => {
    const selected = source.columnsSelected;
    if (!selected?.size) return [];
    const out = [];
    for (const c of selected) {
      if (!canStackOn(c)) continue;
      const leader = leaderOn(c);
      if (!leader) continue;
      if (maxSafeStackSpeed(leader, { rows: cfg.ROWS }) <= 0) continue;
      out.push(c);
    }
    return out;
  };

  const stormDropOpts = (source, col, isStack) => {
    // Prefer live perf bands so mid-session escalate updates storm speeds.
    const band = stormSpeedBand(perfNow());
    const stormMin = band.min ?? cfg.STORM_DROP_SPEED_MIN ?? cfg.DROP_SPEED_MIN;
    const stormMax = band.max ?? cfg.STORM_DROP_SPEED_MAX ?? cfg.DROP_SPEED_MAX;
    const stormTailMax = 3;
    const remaining = source.columnsSelected?.size ?? 0;
    const isTail = remaining > 0 && remaining <= stormTailMax;

    if (!isStack) {
      return isTail
        ? { speed: stormMax }
        : { speedMin: stormMin, speedMax: stormMax };
    }

    const leader = leaderOn(col);
    const maxSafe = maxSafeStackSpeed(leader, { rows: cfg.ROWS });
    if (!(maxSafe > 0)) return null;

    // Stack always uses no-overtake math; last-3 free max does not apply.
    if (isTail || maxSafe < stormMin) {
      return { speed: maxSafe };
    }
    return { speedMin: stormMin, speedMax: maxSafe };
  };

  const startNewDrops = (elapsedSeconds) => {
    let free = freeColumns();
    const sources = spawnSources();

    for (const source of sources) {
      source.syncCompletion?.();
      if (source.isComplete && !source.infinite) continue;
      // DropScene: isActive is a getter; Rain: boolean.
      const active =
        typeof source.isActive === "function" ? source.isActive() : source.isActive;
      if (!active) continue;

      // Storm done covering once selection is empty (rain may have helped).
      // Runs even at the concurrency cap so storms do not stick enabled.
      if (source.stormEnabled && source.columnsSelected?.size === 0) {
        source.stopStorm?.();
        continue;
      }

      // Rain: drain storm uses storm acc; ambient uses forever acc.
      // DropScenes only join when stormEnabled (storm acc).
      const isStorm = source.stormEnabled === true;

      // Only the earliest-activated storm may spawn; later storms wait (no VRA
      // advance) until the first finishes its columnsSelected.
      if (isStorm && source !== pickCurrentStorm()) continue;

      // Ambient rain hold while storms active (med/low) or drop cap full.
      // Resume mode (perf): preserve = freeze curve on storm; restart = trough.
      // Cap full always resets to trough so resume breathes from quiet.
      // High: pauseRainDuringStorm false → only cap holds rain.
      if (source === state.rain && !isStorm) {
        const holdForStorm = pauseRainDuringStorm() && anyStormActive();
        const holdForCap = spawnRoom() <= 0;
        if (holdForStorm || holdForCap) {
          if (!rainHeldAtTrough) {
            const resetCurve =
              holdForCap || (holdForStorm && rainResumeMode() === "restart");
            if (resetCurve) source.accumulator?.reset?.();
            rainHeldAtTrough = true;
          }
          continue;
        }
        if (rainHeldAtTrough) rainHeldAtTrough = false;
      }

      // Global concurrency cap: storms wait (do not advance rate clocks) until
      // a drop dies. Higher-priority / current storm wins remaining slots.
      if (spawnRoom() <= 0) continue;

      const rateAcc =
        source === state.rain && !isStorm
          ? source.accumulator
          : (source.stormAccumulator ?? source.accumulator);
      let want = rateAcc?.advance?.(elapsedSeconds) ?? 0;
      if (want <= 0) continue;

      // Cap want to remaining concurrent slots; refund the rest so budget waits.
      const room = spawnRoom();
      if (room <= 0) {
        rateAcc?.refund?.(want);
        continue;
      }
      if (want > room) {
        rateAcc?.refund?.(want - room);
        want = room;
      }

      const stackable =
        isStorm && allowStormStack() ? stackableSelected(source) : [];

      // No free columns: refund. Storm may still stack when allowed.
      if (free.length === 0 && stackable.length === 0) {
        rateAcc?.refund?.(want);
        continue;
      }

      const cols = isStorm
        ? source.pickColumns(want, free, stackable)
        : source.pickColumns(want, free);

      let spawned = 0;
      for (const col of cols) {
        if (spawnRoom() <= 0) break;
        const isStack = isOccupied(col);
        let dropOpts = {};
        if (isStorm) {
          dropOpts = stormDropOpts(source, col, isStack);
          if (dropOpts == null) continue;
        }
        if (spawnOn(col, dropOpts, { allowStack: isStack })) {
          spawned += 1;
          removeFree(free, col);
        }
      }

      // VRA issues "want" even when cols are blocked; refund so budget survives.
      const missed = want - spawned;
      if (missed > 0) rateAcc?.refund?.(missed);

      if (source.stormEnabled && source.columnsSelected?.size === 0) {
        source.stopStorm?.();
      }
    }
  };

  self.killCompletedDrops = () => {
    for (const drop of drops) {
      if (!drop.isComplete) continue;
      drops.delete(drop);
      const list = byCol.get(drop.col);
      if (list) {
        const i = list.indexOf(drop);
        if (i >= 0) list.splice(i, 1);
        if (list.length === 0) {
          byCol.delete(drop.col);
          // Trail clear only when every drop on the column has finished.
          justFinishedCols.add(drop.col);
        }
      } else {
        justFinishedCols.add(drop.col);
      }
    }
  };

  // Motion only. Matrix paints while completed drops still live, then settleDrops.
  // Kill-before-paint skipped tip rows on large dt (selection drained, glyphs left).
  self.advanceDrops = (elapsedSeconds) => {
    for (const drop of drops) {
      drop.update(elapsedSeconds);
    }
  };

  // After DomManager tip flush: free completed cols, then rain/storm spawn.
  self.settleDrops = (elapsedSeconds) => {
    self.killCompletedDrops();
    startNewDrops(elapsedSeconds);
  };

  // Tests / callers without a paint phase.
  self.updateDrops = (elapsedSeconds) => {
    self.advanceDrops(elapsedSeconds);
    self.settleDrops(elapsedSeconds);
  };

  // Glyph became visible at (r,c) — update content layers + active reveal scenes.
  self.notifyCellRevealed = (r, c) => {
    const layers = state.contentLayers ?? [];
    for (const layer of layers) {
      layer.markRevealed?.(r, c);
    }
    for (const scene of state.dropScenes ?? []) {
      if (scene.mode === "revealing") {
        scene.notifyPointRevealed?.(r, c);
      }
    }
    for (const scene of state.dropScenes ?? []) {
      scene.syncCompletion?.();
    }
  };

  // Glyph hidden at (r,c) during hiding mode.
  self.notifyCellHidden = (r, c) => {
    const layers = state.contentLayers ?? [];
    for (const layer of layers) {
      layer.markHidden?.(r, c);
    }
    for (const scene of state.dropScenes ?? []) {
      if (scene.mode === "hiding") {
        scene.notifyPointHidden?.(r, c);
      }
    }
    for (const scene of state.dropScenes ?? []) {
      scene.syncCompletion?.();
    }
  };
}

export { DropManager, maxSafeStackSpeed };
export default DropManager;
