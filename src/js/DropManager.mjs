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

// ===========================================================
// Smoke tests: node src/js/DropManager.mjs
// ===========================================================
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (await import("node:url")).pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  const assert = (await import("node:assert/strict")).default;

  console.log("Running DropManager smoke tests...");

  // --- maxSafeStackSpeed ---
  {
    // rows=20, leader at 5 speed 10 → t=(19-5)/10=1.4; F≤18 → vF≤18/1.4
    const v = maxSafeStackSpeed({ _row: 5, speed: 10 }, { rows: 20 });
    assert.ok(Math.abs(v - 18 / 1.4) < 1e-9, `expected ~12.857 got ${v}`);

    // At that speed, when L hits 19, F hits 18 (one behind).
    const t = (19 - 5) / 10;
    assert.ok(Math.abs(5 + 10 * t - (0 + v * t) - 1) < 1e-9);

    // No head start → 0 (do not stack).
    assert.equal(maxSafeStackSpeed({ _row: 0.5, speed: 10 }, { rows: 20 }), 0);
    assert.equal(maxSafeStackSpeed({ _row: 0, speed: 10 }, { rows: 20 }), 0);

    // Leader already on final row → match speed.
    assert.equal(maxSafeStackSpeed({ _row: 19, speed: 12 }, { rows: 20 }), 12);

    // Bad inputs.
    assert.equal(maxSafeStackSpeed(null, { rows: 20 }), 0);
    assert.equal(maxSafeStackSpeed({ _row: 5, speed: 0 }, { rows: 20 }), 0);
  }

  // --- occupancy / rain one-per-col / storm stack ---
  {
    const { default: stateMod } = await import("./State.mjs");
    const { default: DropScene } = await import("./DropScene.mjs");
    const { default: Rain } = await import("./Rain.mjs");
    const { VariableRateAccumulator } = await import("./util.mjs");

    stateMod.config = {
      COLS: 5,
      ROWS: 20,
      DROP_SPEED_MIN: 8,
      DROP_SPEED_MAX: 20,
      STORM_DROP_SPEED_MIN: 11,
      STORM_DROP_SPEED_MAX: 20,
      DROP_LENGTH_MIN: 4,
      DROP_LENGTH_MAX: 8,
    };

    if (typeof globalThis.performance === "undefined") {
      globalThis.performance = { now: () => Date.now() };
    }

    // High avg units/s so a short frame still yields ≥1 spawn.
    const rain = Rain({
      cols: 5,
      accumulator: VariableRateAccumulator(200, Infinity, () => 1),
    });
    const pts = [
      { r: 2, c: 1, char: "A", revealed: false },
      { r: 2, c: 2, char: "B", revealed: false },
      { r: 2, c: 3, char: "C", revealed: false },
    ];
    const scene = DropScene({
      name: "stack-test",
      points: pts,
      priority: 10,
      stormAccumulator: VariableRateAccumulator(10, 5, () => 1),
    });
    scene.enterMode("revealing");

    stateMod.rain = rain;
    stateMod.dropScenes = [scene];
    stateMod.contentLayers = [];

    const dm = DropManager();

    // Occupy col 1 via rain only (storm off); first-pass forced to {1}.
    scene.stormEnabled = false;
    rain.firstPass = new Set([1]);
    dm.updateDrops(0.05);
    assert.equal(dm.getDropsOn(1).length, 1, "squatter on col 1");
    assert.equal(dm.getDrops().length, 1);

    // Rain drained active selection on spawn — restore for squat simulation
    // (pre-activation drop would not have counted as coverage).
    scene.columnsSelected = new Set([1, 2, 3]);
    scene.startStorm();
    // Burst storm budget so free selected + stack all fire this frame.
    scene.stormAccumulator = VariableRateAccumulator(20, 1, () => 1);

    const squatter = dm.getDropsOn(1)[0];
    squatter._row = 6;
    squatter.speed = 10;

    // free ∩ selected = {2,3}; stackable = {1} once free selected drained.
    dm.updateDrops(0.5);

    const on1 = dm.getDropsOn(1);
    assert.ok(on1.length >= 2, `storm stacked on col 1, got ${on1.length}`);

    const lead = on1.reduce((a, b) => (a._row >= b._row ? a : b));
    const follower = on1.find((d) => d !== lead);
    assert.ok(follower, "follower exists");
    const cap = maxSafeStackSpeed(lead, { rows: 20 });
    assert.ok(
      follower.speed <= cap + 1e-9,
      `follower speed ${follower.speed} > maxSafe ${cap}`,
    );

    // Rain still one-per-col on occupied.
    const before = dm.getDropsOn(1).length;
    scene.stormEnabled = false;
    rain.firstPass = new Set();
    rain.accumulator = VariableRateAccumulator(200, Infinity, () => 1);
    dm.updateDrops(0.05);
    assert.equal(
      dm.getDropsOn(1).length,
      before,
      "rain does not stack on occupied col",
    );

    // Re-activation must not pile a 3rd drop while the pair is still live.
    assert.equal(dm.getDropsOn(1).length, 2, "pair before re-activate");
    scene.enterMode("revealing");
    scene.startStorm();
    scene.stormAccumulator = VariableRateAccumulator(20, 1, () => 1);
    scene.columnsSelected = new Set([1]);
    const pair = dm.getDropsOn(1);
    for (const d of pair) {
      d._row = 6;
      d.speed = 10;
    }
    dm.updateDrops(0.5);
    assert.equal(
      dm.getDropsOn(1).length,
      2,
      "cap 2 live drops/col across re-activation",
    );

    // Clear: finished col only when every drop on it is gone.
    for (const d of dm.getDrops()) d.isComplete = true;
    dm.killCompletedDrops();
    assert.equal(dm.getDrops().length, 0);
    const finished = dm.takeFinishedColumns();
    assert.ok(finished.includes(1));
  }

  // --- DropScene free-then-stack pick ---
  {
    const { default: DropScene } = await import("./DropScene.mjs");
    const { VariableRateAccumulator } = await import("./util.mjs");
    if (typeof globalThis.performance === "undefined") {
      globalThis.performance = { now: () => Date.now() };
    }
    const scene = DropScene({
      name: "pick",
      points: [
        { r: 0, c: 0, char: "a" },
        { r: 0, c: 1, char: "b" },
        { r: 0, c: 2, char: "c" },
      ],
      stormAccumulator: VariableRateAccumulator(1, 10, () => 1),
    });
    scene.enterMode("revealing");
    scene.startStorm();
    // Free: 0; stackable: 1,2. Want 2 → free first then one stack.
    const picked = scene.pickColumns(2, [0], [1, 2]);
    assert.equal(picked.length, 2);
    assert.equal(picked[0], 0, "free preferred first");
    assert.ok([1, 2].includes(picked[1]), "second from stackable");

    // Only stackable left.
    const onlyStack = scene.pickColumns(1, [], [1, 2]);
    assert.equal(onlyStack.length, 1);
    assert.ok([1, 2].includes(onlyStack[0]));
  }

  // --- Weather scale: no storm stack when ALLOW_STORM_STACK false ---
  {
    const { default: stateMod } = await import("./State.mjs");
    const { default: DropScene } = await import("./DropScene.mjs");
    const { default: Rain } = await import("./Rain.mjs");
    const { VariableRateAccumulator } = await import("./util.mjs");

    stateMod.config = {
      COLS: 4,
      ROWS: 20,
      DROP_SPEED_MIN: 8,
      DROP_SPEED_MAX: 20,
      STORM_DROP_SPEED_MIN: 11,
      STORM_DROP_SPEED_MAX: 20,
      DROP_LENGTH_MIN: 4,
      DROP_LENGTH_MAX: 8,
      ALLOW_STORM_STACK: false,
      WEATHER_SCALE: true,
      WEATHER_LENGTH_SCALE: 0.6,
    };
    stateMod.weatherScale = true;
    stateMod.allowStormStack = false;

    if (typeof globalThis.performance === "undefined") {
      globalThis.performance = { now: () => Date.now() };
    }

    const rain = Rain({
      cols: 4,
      accumulator: VariableRateAccumulator(200, Infinity, () => 1),
    });
    const pts = [
      { r: 2, c: 1, char: "A", revealed: false },
      { r: 2, c: 2, char: "B", revealed: false },
    ];
    const scene = DropScene({
      name: "no-stack",
      points: pts,
      priority: 10,
      stormAccumulator: VariableRateAccumulator(10, 5, () => 1),
    });
    scene.enterMode("revealing");

    stateMod.rain = rain;
    stateMod.dropScenes = [scene];
    stateMod.contentLayers = [];

    const dm = DropManager();

    // Squatter on col 1 (rain only).
    scene.stormEnabled = false;
    rain.firstPass = new Set([1]);
    dm.updateDrops(0.05);
    assert.equal(dm.getDropsOn(1).length, 1, "squatter on col 1");

    scene.columnsSelected = new Set([1, 2]);
    scene.startStorm();
    scene.stormAccumulator = VariableRateAccumulator(20, 1, () => 1);
    const squatter = dm.getDropsOn(1)[0];
    squatter._row = 6;
    squatter.speed = 10;

    dm.updateDrops(0.5);
    assert.equal(
      dm.getDropsOn(1).length,
      1,
      "weather scale: storm does not stack on occupied col",
    );
    // Free selected col 2 should still get a storm drop.
    assert.ok(
      dm.getDropsOn(2).length >= 1,
      "free selected col still storm-spawned",
    );

    stateMod.weatherScale = null;
    stateMod.allowStormStack = null;
  }

  // --- Ambient rain paused while a content storm still has columns ---
  {
    const { default: stateMod } = await import("./State.mjs");
    const { default: DropScene } = await import("./DropScene.mjs");
    const { default: Rain } = await import("./Rain.mjs");
    const { VariableRateAccumulator } = await import("./util.mjs");

    stateMod.config = {
      COLS: 6,
      ROWS: 20,
      DROP_SPEED_MIN: 8,
      DROP_SPEED_MAX: 18,
      STORM_DROP_SPEED_MIN: 11,
      STORM_DROP_SPEED_MAX: 18,
      DROP_LENGTH_MIN: 5,
      DROP_LENGTH_MAX: 8,
      ALLOW_STORM_STACK: false,
      PAUSE_RAIN_DURING_STORM: true,
      WEATHER_LENGTH_SCALE: 0.6,
    };
    stateMod.weatherScale = null;
    stateMod.allowStormStack = false;

    if (typeof globalThis.performance === "undefined") {
      globalThis.performance = { now: () => Date.now() };
    }

    // Huge ambient want so any rain spawn would show up immediately.
    const rain = Rain({
      cols: 6,
      accumulator: VariableRateAccumulator(500, Infinity, () => 50),
    });
    // Slow storm: stays active after one short settle (selection not emptied).
    const scene = DropScene({
      name: "pause-rain",
      points: [
        { r: 2, c: 0, char: "A", revealed: false },
        { r: 2, c: 1, char: "B", revealed: false },
        { r: 2, c: 2, char: "C", revealed: false },
        { r: 2, c: 3, char: "D", revealed: false },
      ],
      priority: 10,
      stormAccumulator: VariableRateAccumulator(20, 20, () => 0.2),
    });
    scene.enterMode("revealing");
    scene.startStorm();

    stateMod.rain = rain;
    stateMod.dropScenes = [scene];
    stateMod.contentLayers = [];

    const dm = DropManager();
    dm.settleDrops(0.05);

    assert.equal(scene.stormEnabled, true, "storm still active mid-coverage");
    // Free cols outside the scene must stay empty (ambient rain off).
    assert.equal(dm.getDropsOn(4).length, 0, "no ambient rain on free col 4");
    assert.equal(dm.getDropsOn(5).length, 0, "no ambient rain on free col 5");
    // Soft-square clock frozen: rain acc time does not advance while paused.
    const rainTimeDuring = rain.accumulator.currentTime ?? null;

    // After storm stops, ambient rain may spawn on free cols again.
    scene.stopStorm();
    scene.enterMode("revealed");
    dm.settleDrops(0.1);
    assert.ok(
      dm.getDropsOn(4).length + dm.getDropsOn(5).length >= 1,
      "ambient rain resumes after storm",
    );
    if (rainTimeDuring != null && rain.accumulator.currentTime != null) {
      assert.ok(
        rain.accumulator.currentTime > rainTimeDuring,
        "rain clock advances only after storm",
      );
    }

    stateMod.weatherScale = null;
    stateMod.allowStormStack = null;
  }

  // --- Large dt: paint before kill flushes tip rows (Matrix frame order) ---
  {
    const { default: stateMod } = await import("./State.mjs");
    const { default: DropScene } = await import("./DropScene.mjs");
    const { default: Rain } = await import("./Rain.mjs");
    const { default: SceneManager } = await import("./SceneManager.mjs");
    const { VariableRateAccumulator } = await import("./util.mjs");
    if (typeof globalThis.performance === "undefined") {
      globalThis.performance = { now: () => Date.now() };
    }

    stateMod.config = {
      COLS: 4,
      ROWS: 20,
      DROP_SPEED_MIN: 10,
      DROP_SPEED_MAX: 20,
      STORM_DROP_SPEED_MIN: 20,
      STORM_DROP_SPEED_MAX: 20,
      DROP_LENGTH_MIN: 4,
      DROP_LENGTH_MAX: 8,
    };

    const rain = Rain({
      cols: 4,
      accumulator: VariableRateAccumulator(0.001, Infinity, () => 0.001),
    });
    const pts = [
      { r: 5, c: 1, char: "A", revealed: true },
      { r: 12, c: 1, char: "B", revealed: true },
    ];
    const scene = DropScene({
      name: "large-dt-hide",
      points: pts,
      priority: 20,
      // Burst: all units in one settle tick.
      stormAccumulator: VariableRateAccumulator(4, 1, () => 1),
    });
    stateMod.rain = rain;
    stateMod.dropScenes = [scene];
    stateMod.contentLayers = [];
    stateMod.sceneManager = SceneManager({ scenes: [scene] });
    stateMod.sceneManager.applyLogicalForScene(scene);

    const dm = DropManager();
    stateMod.dropManager = dm;

    const lastTip = new WeakMap();
    const paintLikeDom = () => {
      for (const d of dm.getDrops()) {
        const r = d.getRow();
        const pr = lastTip.has(d) ? lastTip.get(d) : null;
        const from = pr == null ? 0 : pr + 1;
        const to = Math.min(r, 19);
        for (let row = from; row <= to; row++) {
          if (row >= 0) stateMod.sceneManager.applyTip(row, d.col, d);
        }
        lastTip.set(d, r);
      }
    };

    scene.enterMode("hiding");
    // Rebuild burst after enterMode reset.
    scene.stormAccumulator = VariableRateAccumulator(4, 0.05, () => 1);
    scene.startStorm();

    // Spawn (settle after empty paint — new drops appear post-paint).
    dm.advanceDrops(0.05);
    paintLikeDom();
    dm.settleDrops(0.05);
    assert.ok(dm.getDrops().length >= 1, "storm spawned");
    assert.equal(scene.columnsSelected.has(1), false, "col claimed on spawn");

    // Force a completing jump; paint while still live, then settle.
    for (const d of dm.getDrops()) {
      d.speed = 80;
      d._row = 0;
    }
    dm.advanceDrops(1); // → row 80, complete
    const stillLive = dm.getDrops().filter((d) => d.isComplete);
    assert.ok(stillLive.length >= 1, "completed drops still in set for paint");
    paintLikeDom();
    assert.equal(pts.every((p) => !p.revealed), true, "tips flushed before kill");
    assert.equal(scene.mode, "hidden", "hide settles from large-dt flush");
    dm.settleDrops(0.05);
    assert.equal(dm.getDrops().filter((d) => d.isComplete).length, 0);
  }

  // --- Concurrent budget: max starts at COLS; fast path stays there ---
  {
    const { default: stateMod } = await import("./State.mjs");
    const { default: Rain } = await import("./Rain.mjs");
    const { VariableRateAccumulator } = await import("./util.mjs");

    stateMod.config = {
      COLS: 16,
      ROWS: 20,
      DROP_SPEED_MIN: 8,
      DROP_SPEED_MAX: 18,
      DROP_LENGTH_MIN: 4,
      DROP_LENGTH_MAX: 8,
      FRAME_DELAY: 75,
      INITIAL_DROP_MAX: 16,
      MIN_DROP_MAX: 12,
    };
    stateMod.weatherScale = null;
    stateMod.allowStormStack = null;

    if (typeof globalThis.performance === "undefined") {
      globalThis.performance = { now: () => Date.now() };
    }

    const rain = Rain({
      cols: 16,
      accumulator: VariableRateAccumulator(500, Infinity, () => 100),
    });
    stateMod.rain = rain;
    stateMod.dropScenes = [];
    stateMod.contentLayers = [];

    const dm = DropManager();
    assert.equal(dm.getMaxActiveDrops(), 16, "max starts at INITIAL/COLS");
    assert.equal(dm.getDropBudgetPhase(), "climb");

    // Grow live drops with cheap frame times; lock at COLS when full.
    for (let n = 0; n < 80 && dm.getDropBudgetPhase() === "climb"; n++) {
      dm.settleDrops(0.05);
      dm.noteFrameTiming(50, 1);
    }
    assert.equal(dm.getDropBudgetPhase(), "stable", "locks after filling COLS");
    assert.equal(dm.getMaxActiveDrops(), 16, "stays at INITIAL on fast path");
    assert.ok(
      dm.getActiveDropCount() <= dm.getMaxActiveDrops(),
      "live never exceeds maxActive",
    );
  }

  // --- 200ms 10-frame avg clamps max to current live (at/above MIN) ---
  {
    const { default: stateMod } = await import("./State.mjs");
    const { default: Rain } = await import("./Rain.mjs");
    const { VariableRateAccumulator } = await import("./util.mjs");

    stateMod.config = {
      COLS: 24,
      ROWS: 20,
      DROP_SPEED_MIN: 8,
      DROP_SPEED_MAX: 18,
      DROP_LENGTH_MIN: 4,
      DROP_LENGTH_MAX: 8,
      FRAME_DELAY: 75,
      INITIAL_DROP_MAX: 24,
      MIN_DROP_MAX: 12,
    };
    stateMod.weatherScale = null;
    stateMod.allowStormStack = null;
    if (typeof globalThis.performance === "undefined") {
      globalThis.performance = { now: () => Date.now() };
    }
    stateMod.rain = Rain({
      cols: 24,
      accumulator: VariableRateAccumulator(500, Infinity, () => 100),
    });
    stateMod.dropScenes = [];
    stateMod.contentLayers = [];

    const dm = DropManager();
    assert.equal(dm.getMaxActiveDrops(), 24, "starts open at COLS");

    // Grow live with expensive frames; must not clamp before MIN (12).
    for (let n = 0; n < 200 && dm.getActiveDropCount() < 12; n++) {
      dm.settleDrops(0.05);
      dm.noteFrameTiming(250, 1);
    }
    assert.ok(dm.getActiveDropCount() >= 12, "reached MIN live drops");
    assert.equal(dm.getDropBudgetPhase(), "climb", "still open below settle");
    assert.equal(dm.getMaxActiveDrops(), 24, "max still INITIAL before clamp");

    // Hold live ≥12 for 10 frames at 210ms → clamp to that live count.
    const liveAtClamp = dm.getActiveDropCount();
    for (let i = 0; i < 15; i++) {
      dm.noteFrameTiming(210, 1);
      if (dm.getDropBudgetPhase() === "stable") break;
    }
    assert.equal(dm.getDropBudgetPhase(), "stable", "200ms avg settles");
    assert.equal(
      dm.getMaxActiveDrops(),
      Math.max(12, liveAtClamp),
      "clamps max to live count at trip",
    );
  }

  // --- Rain pause for storm resets rate clock to trough ---
  {
    const { default: stateMod } = await import("./State.mjs");
    const { default: Rain } = await import("./Rain.mjs");

    stateMod.config = {
      COLS: 8,
      ROWS: 20,
      DROP_SPEED_MIN: 10,
      DROP_SPEED_MAX: 20,
      DROP_LENGTH_MIN: 4,
      DROP_LENGTH_MAX: 8,
      FRAME_DELAY: 75,
      ACTIVE_DROPS_MIN: 8,
      ACTIVE_DROPS_MAX: 8,
      PAUSE_RAIN_DURING_STORM: true,
      ALLOW_STORM_STACK: false,
    };
    stateMod.weatherScale = null;
    stateMod.allowStormStack = null;
    if (typeof globalThis.performance === "undefined") {
      globalThis.performance = { now: () => Date.now() };
    }

    let rainTime = 0;
    const acc = {
      advance(dt) {
        rainTime += dt;
        return 0;
      },
      reset() {
        rainTime = 0;
      },
      refund() {},
    };
    const rain = Rain({ cols: 8, accumulator: acc });
    stateMod.rain = rain;
    // Fake content storm active.
    stateMod.dropScenes = [
      {
        isActive: true,
        stormEnabled: true,
        stormStartSeq: 1,
        stormAccumulator: {
          advance: () => 0,
          refund() {},
        },
        columnsSelected: new Set([0, 1]),
        columns: new Set([0, 1]),
        priority: 10,
        infinite: false,
        isComplete: false,
        pickColumns: () => [],
        syncCompletion() {},
        stopStorm() {
          this.stormEnabled = false;
        },
      },
    ];
    stateMod.contentLayers = [];

    const dm = DropManager();
    // Advance rain rate clock a bit first (simulate mid-cycle).
    acc.advance(3);
    assert.ok(rainTime > 0, "rain clock advanced");
    // settleDrops runs startNewDrops — storm active should pause rain + reset.
    dm.settleDrops(0.05);
    assert.equal(rainTime, 0, "rain accumulator reset on storm pause");
  }

  // --- Max drops: ambient rain rate resets to 0 while cap is full ---
  {
    const { default: stateMod } = await import("./State.mjs");
    const { default: Rain } = await import("./Rain.mjs");
    const { VariableRateAccumulator } = await import("./util.mjs");

    stateMod.config = {
      COLS: 4,
      ROWS: 20,
      DROP_SPEED_MIN: 1,
      DROP_SPEED_MAX: 2,
      DROP_LENGTH_MIN: 4,
      DROP_LENGTH_MAX: 5,
      FRAME_DELAY: 75,
      ACTIVE_DROPS_MIN: 1,
      ACTIVE_DROPS_MAX: 1,
      ACTIVE_DROPS_CALIBRATE: false,
      PAUSE_RAIN_DURING_STORM: true,
      ALLOW_STORM_STACK: false,
    };
    if (typeof globalThis.performance === "undefined") {
      globalThis.performance = { now: () => Date.now() };
    }

    let rainTime = 0;
    let resetCount = 0;
    const acc = {
      advance(dt) {
        rainTime += dt;
        return 1;
      },
      reset() {
        rainTime = 0;
        resetCount += 1;
      },
      refund() {},
    };
    const rain = Rain({ cols: 4, accumulator: acc });
    stateMod.rain = rain;
    stateMod.dropScenes = [];
    stateMod.contentLayers = [];

    const dm = DropManager();
    // First tick fills the single drop slot.
    dm.settleDrops(0.05);
    assert.equal(dm.getDrops().length, 1, "one live drop at cap");
    // Mid-cycle advance then another tick at cap → must reset, not advance.
    acc.advance(2);
    assert.ok(rainTime > 0, "simulated mid-cycle rain time");
    const resetsBefore = resetCount;
    dm.settleDrops(0.05);
    assert.equal(dm.getDrops().length, 1, "still at cap");
    assert.ok(resetCount > resetsBefore, "rain reset while at max drops");
    assert.equal(rainTime, 0, "rain rate at trough while cap full");
  }

  // --- Storm FIFO: second activated storm waits until first finishes columns ---
  {
    const { default: stateMod } = await import("./State.mjs");
    const { default: DropScene } = await import("./DropScene.mjs");
    const { default: Rain } = await import("./Rain.mjs");
    const { VariableRateAccumulator } = await import("./util.mjs");

    stateMod.config = {
      COLS: 6,
      ROWS: 20,
      DROP_SPEED_MIN: 10,
      DROP_SPEED_MAX: 20,
      STORM_DROP_SPEED_MIN: 12,
      STORM_DROP_SPEED_MAX: 20,
      DROP_LENGTH_MIN: 4,
      DROP_LENGTH_MAX: 6,
      FRAME_DELAY: 75,
      ACTIVE_DROPS_MIN: 20,
      ACTIVE_DROPS_MAX: 20,
      ACTIVE_DROPS_CALIBRATE: false,
      PAUSE_RAIN_DURING_STORM: true,
      ALLOW_STORM_STACK: false,
    };
    stateMod.weatherScale = null;
    stateMod.allowStormStack = false;
    stateMod.stormStartSeq = 0;
    if (typeof globalThis.performance === "undefined") {
      globalThis.performance = { now: () => Date.now() };
    }

    // Quiet ambient rain so only storms spawn.
    const rain = Rain({
      cols: 6,
      accumulator: VariableRateAccumulator(0, Infinity, () => 0),
    });
    rain.firstPass = new Set();

    const first = DropScene({
      name: "storm-first",
      points: [
        { r: 1, c: 0, char: "A", revealed: false },
        { r: 1, c: 1, char: "B", revealed: false },
      ],
      priority: 10,
      // High unit budget so a single settle tick yields spawns.
      stormAccumulator: VariableRateAccumulator(20, 1, () => 1),
    });
    const second = DropScene({
      name: "storm-second",
      points: [
        { r: 2, c: 2, char: "C", revealed: false },
        { r: 2, c: 3, char: "D", revealed: false },
      ],
      priority: 10,
      stormAccumulator: VariableRateAccumulator(20, 1, () => 1),
    });
    first.enterMode("revealing");
    first.startStorm();
    // Re-arm burst after startStorm reset (same unit window, denser for smoke).
    first.stormAccumulator = VariableRateAccumulator(20, 1, () => 1);
    second.enterMode("revealing");
    second.startStorm();
    second.stormAccumulator = VariableRateAccumulator(20, 1, () => 1);
    assert.ok(
      first.stormStartSeq < second.stormStartSeq,
      "activation order recorded",
    );

    stateMod.rain = rain;
    stateMod.dropScenes = [second, first]; // reverse list order; FIFO by seq
    stateMod.contentLayers = [];

    const dm = DropManager();
    dm.settleDrops(0.2);

    // First storm may have spawned; second must not until first is done.
    assert.equal(
      second.columnsSelected.size,
      2,
      "second storm still full while first unfinished",
    );
    assert.equal(
      dm.getDropsOn(2).length + dm.getDropsOn(3).length,
      0,
      "no drops on second storm cols yet",
    );
    assert.ok(
      first.columnsSelected.size < 2 ||
        dm.getDropsOn(0).length + dm.getDropsOn(1).length >= 1,
      "first storm made progress",
    );

    // Finish first by covering its columns.
    first.columnsSelected = new Set();
    first.stopStorm();
    dm.settleDrops(0.2);
    assert.ok(
      dm.getDropsOn(2).length + dm.getDropsOn(3).length >= 1 ||
        second.columnsSelected.size < 2,
      "second storm starts after first completes",
    );
  }

  const green = (t) => `\x1b[32m${t}\x1b[0m`;
  console.log(`DropManager smoke tests passed! ${green("✓")}`);
}
