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
// Rain: at most one live drop per column.
// Storm: may stack one second drop on occupied columnsSelected cols (no-overtake)
// unless weather scale disables stacking (cfg.ALLOW_STORM_STACK / state).
// Cap 2 live drops/col — re-activations must not pile 3+ across cycles.
// On spawn col c: drain Rain first-pass and every active scene's columnsSelected.
// Global concurrent budget (maxActiveDrops) targets ~FRAME_DELAY ms of work:
// when live count is at max, startNewDrops waits (VRA units refunded).
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

  // --- Dynamic concurrent-drop budget (wall frame time vs FRAME_DELAY) ---
  // Hard bounds are small on purpose — COLS×2 was a render free-for-all.
  // Controller uses inter-tick wall gap (paint shows up there; JS work alone
  // often under-reports). Over budget for a streak → cut; under for a streak →
  // raise one. Never culls live drops; spawn waits at the cap.
  // Fallbacks only when cfg omits knobs (tests / partial config).
  const cols = cfg.COLS || 20;
  const hardMin = Math.max(1, Number(cfg.ACTIVE_DROPS_MIN) || 2);
  const hardMax = Math.max(
    hardMin,
    Number(cfg.ACTIVE_DROPS_MAX) || Math.min(cols, 40),
  );
  const initRaw = Number(cfg.ACTIVE_DROPS_INIT);
  let maxActiveDrops = Math.min(
    hardMax,
    Math.max(
      hardMin,
      Number.isFinite(initRaw) ? initRaw : Math.min(hardMax, Math.max(6, Math.floor(cols * 0.5))),
    ),
  );
  // EMA of wall inter-tick gap (ms). JS work EMA is debug-only.
  let frameEmaMs = 0;
  let workEmaMs = 0;
  let frameSamples = 0;
  // Consecutive over/under budget ticks before adjusting the cap.
  let slowStreak = 0;
  let fastStreak = 0;
  const SLOW_STREAK_N = 6; // ~period of slow frames before cut
  const FAST_STREAK_N = 12; // longer under-budget run before raise
  // Absorb vsync quantization (~50ms on a 45ms target) without false cuts.
  const OVERRUN_SLACK_MS = 12;

  // Copy for tests / external callers that retain the array.
  self.getDrops = () => Array.from(drops);
  self.getDropsOn = (col) => Array.from(byCol.get(col) ?? []);
  self.getActiveDropCount = () => drops.size;
  self.getMaxActiveDrops = () => maxActiveDrops;
  self.getFrameEmaMs = () => frameEmaMs;
  self.getWorkEmaMs = () => workEmaMs;
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

  // Matrix: wallGapMs = inter-tick period; workMs = JS advance/paint/settle.
  // Prefer wall gap for the budget (render jank / main-thread paint show up).
  // workMs is a secondary signal when it alone exceeds the target.
  self.noteFrameTiming = (wallGapMs, workMs = 0) => {
    const gap = Number(wallGapMs);
    const work = Number(workMs);
    if (!Number.isFinite(gap) || gap < 0) return;

    frameSamples += 1;
    const alpha = frameSamples < 8 ? 0.4 : 0.2;
    frameEmaMs = frameSamples === 1 ? gap : frameEmaMs * (1 - alpha) + gap * alpha;
    if (Number.isFinite(work) && work >= 0) {
      workEmaMs =
        frameSamples === 1 ? work : workEmaMs * (1 - alpha) + work * alpha;
    }

    const targetMs = Math.max(16, Number(cfg.FRAME_DELAY) || 45);
    // Frame "cost": wall period, or JS work if it alone blew the budget.
    const frameMs = Math.max(gap, Number.isFinite(work) ? work : 0);
    // Over: clearly past target (not just 3×vsync ≈50ms on a 45ms budget).
    const over = frameMs > targetMs + OVERRUN_SLACK_MS;
    // Under: clear headroom (e.g. 2×vsync ≈33ms) before raising density.
    const under = frameMs < targetMs * 0.85;

    if (over) {
      slowStreak += 1;
      fastStreak = 0;
      if (slowStreak >= SLOW_STREAK_N) {
        // Cut harder when far over (e.g. 90ms on a 45ms target → cut 2).
        const ratio = frameEmaMs / targetMs;
        const cut = ratio >= 1.8 ? 2 : 1;
        maxActiveDrops = Math.max(hardMin, maxActiveDrops - cut);
        slowStreak = 0;
      }
    } else if (under) {
      fastStreak += 1;
      slowStreak = 0;
      if (fastStreak >= FAST_STREAK_N && maxActiveDrops < hardMax) {
        maxActiveDrops = Math.min(hardMax, maxActiveDrops + 1);
        fastStreak = 0;
      }
    } else {
      // In the band around target: hold cap, decay streaks slowly.
      slowStreak = Math.max(0, slowStreak - 1);
      fastStreak = Math.max(0, fastStreak - 1);
    }
  };

  // Back-compat alias (JS work only — prefer noteFrameTiming).
  self.noteFrameWork = (workMs) => self.noteFrameTiming(workMs, workMs);

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

    // Legacy bridge: SpawnPolicy list still supported if present.
    for (const p of state.spawnPolicies ?? []) {
      if (p && p !== state.rain && p.isActive && !p.isComplete) sources.push(p);
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
    const theme =
      opts.theme ??
      state.themeDirector?.pickSpawnTheme?.() ??
      state.themeDirector?.active ??
      null;
    const drop = Drop({ col, ...opts, theme });
    drops.add(drop);
    let list = byCol.get(col);
    if (!list) {
      list = [];
      byCol.set(col, list);
    }
    list.push(drop);
    notifySpawnColumn(col, drop);
    return drop;
  };

  const advanceSource = (source, elapsedSeconds) => {
    const acc = source.stormAccumulator ?? source.accumulator;
    if (!acc) return 0;
    return acc.advance(elapsedSeconds);
  };

  // Weather constrained: frozen cfg and/or mid-session ratchet.
  const weatherConstrained = () => {
    if (state.weatherScale === true) return true;
    if (state.weatherScale === false) return false;
    return cfg.WEATHER_SCALE === true;
  };

  // Storm stack: off when weather scale (cfg or runtime ratchet).
  const allowStormStack = () => {
    if (state.allowStormStack === false) return false;
    if (state.allowStormStack === true) return true;
    if (cfg.ALLOW_STORM_STACK === false) return false;
    return true;
  };

  // Ambient rain thinning when weather escalates mid-session (cfg was full).
  const ambientRainScale = () => {
    if (state.weatherScale !== true || cfg.WEATHER_SCALE === true) return 1;
    const s = cfg.WEATHER_RAIN_PEAK_SCALE;
    return typeof s === "number" && s > 0 && s < 1 ? s : 0.65;
  };

  // Any content/rain drain storm currently spawning (pause ambient rain).
  const anyStormActive = () => {
    if (state.rain?.stormEnabled) return true;
    for (const scene of state.dropScenes ?? []) {
      if (scene?.stormEnabled) return true;
    }
    return false;
  };

  // Constrained: ambient rain off while storms run (less concurrent paint).
  // Ratchet mid-session: treat as on unless cfg explicitly false.
  const pauseRainDuringStorm = () => {
    if (!weatherConstrained()) return false;
    return cfg.PAUSE_RAIN_DURING_STORM !== false;
  };

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
    const stormMin = cfg.STORM_DROP_SPEED_MIN ?? cfg.DROP_SPEED_MIN;
    const stormMax = cfg.STORM_DROP_SPEED_MAX ?? cfg.DROP_SPEED_MAX;
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
      // DropScene: isActive is a getter; SpawnPolicy/Rain: boolean or getter.
      const active =
        typeof source.isActive === "function" ? source.isActive() : source.isActive;
      if (!active) continue;

      // Storm done covering once selection is empty (rain may have helped).
      // Runs even at the concurrency cap so storms do not stick enabled.
      if (source.stormEnabled && source.columnsSelected?.size === 0) {
        source.stopStorm?.();
        continue;
      }

      // Global concurrency cap: wait (do not advance rate clocks) until a drop
      // dies. Higher-priority sources run first (storms before rain), so content
      // wins the remaining slots when the budget is tight.
      if (spawnRoom() <= 0) continue;

      // Rain: drain storm uses storm acc; ambient uses forever acc.
      // DropScenes only join when stormEnabled (storm acc).
      const isStorm = source.stormEnabled === true;

      // Constrained: freeze ambient rain while any storm is active (do not
      // advance the soft-square clock — resume cleanly when storms end).
      if (
        source === state.rain &&
        !isStorm &&
        pauseRainDuringStorm() &&
        anyStormActive()
      ) {
        continue;
      }

      const rateAcc =
        source === state.rain && !isStorm
          ? source.accumulator
          : (source.stormAccumulator ?? source.accumulator);
      let want = rateAcc?.advance?.(elapsedSeconds) ?? 0;
      if (want <= 0) continue;

      // Mid-session weather scale: thin ambient rain (peak already scaled if
      // cfg.WEATHER_SCALE was set at construction). Do **not** refund dropped
      // units — intentional discard; refund would restore the full average.
      if (source === state.rain && !isStorm) {
        const peakScale = ambientRainScale();
        if (peakScale < 1 && want > 0) {
          const scaled = want * peakScale;
          const whole = Math.floor(scaled);
          const frac = scaled - whole;
          want = whole + (Math.random() < frac ? 1 : 0);
          if (want <= 0) continue;
        }
      }

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

      // No free columns: rain/legacy refund. Storm may still stack (if allowed).
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
    stateMod.spawnPolicies = [];
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
      WEATHER_RAIN_PEAK_SCALE: 0.65,
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
    stateMod.spawnPolicies = [];
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

  // --- Weather scale: ambient rain paused while a content storm is active ---
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
      WEATHER_SCALE: true,
      PAUSE_RAIN_DURING_STORM: true,
      WEATHER_RAIN_PEAK_SCALE: 0.65,
      WEATHER_LENGTH_SCALE: 0.6,
    };
    stateMod.weatherScale = true;
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
    stateMod.spawnPolicies = [];
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
    stateMod.spawnPolicies = [];
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

  // --- Concurrent budget: wall frame time drives max; at cap spawn waits ---
  {
    const { default: stateMod } = await import("./State.mjs");
    const { default: Rain } = await import("./Rain.mjs");
    const { VariableRateAccumulator } = await import("./util.mjs");

    stateMod.config = {
      COLS: 10,
      ROWS: 20,
      DROP_SPEED_MIN: 8,
      DROP_SPEED_MAX: 18,
      DROP_LENGTH_MIN: 4,
      DROP_LENGTH_MAX: 8,
      FRAME_DELAY: 45,
      ACTIVE_DROPS_MIN: 2,
      ACTIVE_DROPS_MAX: 8,
      ACTIVE_DROPS_INIT: 4,
    };
    stateMod.weatherScale = null;
    stateMod.allowStormStack = null;

    if (typeof globalThis.performance === "undefined") {
      globalThis.performance = { now: () => Date.now() };
    }

    const rain = Rain({
      cols: 10,
      accumulator: VariableRateAccumulator(500, Infinity, () => 100),
    });
    stateMod.rain = rain;
    stateMod.dropScenes = [];
    stateMod.spawnPolicies = [];
    stateMod.contentLayers = [];

    const dm = DropManager();
    assert.equal(dm.getMaxActiveDrops(), 4, "init from ACTIVE_DROPS_INIT");

    dm.settleDrops(0.1);
    assert.equal(dm.getActiveDropCount(), 4, "spawn fills to maxActive");

    // Further settle at cap: no new drops (wait).
    dm.settleDrops(0.1);
    assert.equal(dm.getActiveDropCount(), 4, "at cap: wait, no extra spawn");

    // Under-budget wall gaps for a streak → raise cap by 1.
    for (let i = 0; i < 12; i++) dm.noteFrameTiming(30, 2);
    assert.equal(dm.getMaxActiveDrops(), 5, "fast streak raises cap by 1");

    // Over-budget wall gaps for a streak → cut cap.
    const beforeCut = dm.getMaxActiveDrops();
    for (let i = 0; i < 6; i++) dm.noteFrameTiming(80, 10);
    assert.ok(
      dm.getMaxActiveDrops() < beforeCut,
      "slow streak cuts cap",
    );
    assert.ok(dm.getMaxActiveDrops() >= 2, "floors at ACTIVE_DROPS_MIN");

    // Existing live drops are not culled — only new spawns wait.
    const liveBefore = dm.getActiveDropCount();
    dm.settleDrops(0.05);
    assert.equal(
      dm.getActiveDropCount(),
      liveBefore,
      "shrink does not cull; wait for natural complete",
    );
  }

  const green = (t) => `\x1b[32m${t}\x1b[0m`;
  console.log(`DropManager smoke tests passed! ${green("✓")}`);
}
