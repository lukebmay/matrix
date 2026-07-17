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
// Storm: may stack one second drop on occupied columnsSelected cols (no-overtake).
// Cap 2 live drops/col — re-activations must not pile 3+ across cycles.
// On spawn col c: drain Rain first-pass and every active scene's columnsSelected.
const MAX_DROPS_PER_COL = 2;

function DropManager(...args) {
  if (!new.target) return new DropManager(...args);
  const self = this;

  const cfg = state.config;
  const drops = new Set();
  // col → ordered live drops (spawn order; leader = highest _row).
  const byCol = new Map();
  const justFinishedCols = new Set();

  self.getDrops = () => Array.from(drops);
  self.getDropsOn = (col) => Array.from(byCol.get(col) ?? []);
  self.takeFinishedColumns = () => {
    const cols = Array.from(justFinishedCols);
    justFinishedCols.clear();
    return cols;
  };

  const liveCount = (col) => byCol.get(col)?.length ?? 0;
  const isOccupied = (col) => liveCount(col) > 0;
  // Second drop only when exactly one leader is already falling.
  const canStackOn = (col) => liveCount(col) === 1;

  const freeColumns = () => {
    const free = [];
    for (let c = 0; c < cfg.COLS; c++) {
      if (!isOccupied(c)) free.push(c);
    }
    return free;
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
  const notifySpawnColumn = (col) => {
    state.rain?.onColumnSpawned?.(col);
    for (const scene of state.dropScenes ?? []) {
      // Stable scenes ignore (onColumnSpawned no-ops when not active).
      scene.onColumnSpawned?.(col);
    }
  };

  // allowStack: storm second drop only (never 3+) on an occupied column.
  const spawnOn = (col, opts = {}, { allowStack = false } = {}) => {
    const n = liveCount(col);
    if (n > 0 && !allowStack) return null;
    if (n > 0 && allowStack && n >= MAX_DROPS_PER_COL) return null;
    const drop = Drop({ col, ...opts });
    drops.add(drop);
    let list = byCol.get(col);
    if (!list) {
      list = [];
      byCol.set(col, list);
    }
    list.push(drop);
    notifySpawnColumn(col);
    return drop;
  };

  const advanceSource = (source, elapsedSeconds) => {
    const acc = source.stormAccumulator ?? source.accumulator;
    if (!acc) return 0;
    return acc.advance(elapsedSeconds);
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
      if (source.stormEnabled && source.columnsSelected?.size === 0) {
        source.stopStorm?.();
        continue;
      }

      const acc = source.stormAccumulator ?? source.accumulator;
      const want = advanceSource(source, elapsedSeconds);
      if (want <= 0) continue;

      const isStorm = source.stormEnabled === true;
      const stackable = isStorm ? stackableSelected(source) : [];

      // No free columns: rain/legacy refund. Storm may still stack.
      if (free.length === 0 && stackable.length === 0) {
        acc?.refund?.(want);
        continue;
      }

      const cols = isStorm
        ? source.pickColumns(want, free, stackable)
        : source.pickColumns(want, free);

      let spawned = 0;
      for (const col of cols) {
        const isStack = isOccupied(col);
        let dropOpts = {};
        if (isStorm) {
          dropOpts = stormDropOpts(source, col, isStack);
          if (dropOpts == null) continue;
        }
        if (spawnOn(col, dropOpts, { allowStack: isStack })) {
          spawned += 1;
          free = free.filter((c) => c !== col);
        }
      }

      // VRA issues "want" even when cols are blocked; refund so budget survives.
      const missed = want - spawned;
      if (missed > 0) acc?.refund?.(missed);

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

  self.updateDrops = (elapsedSeconds) => {
    for (const drop of drops) {
      drop.update(elapsedSeconds);
    }
    self.killCompletedDrops();
    startNewDrops(elapsedSeconds);
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

  const green = (t) => `\x1b[32m${t}\x1b[0m`;
  console.log(`DropManager smoke tests passed! ${green("✓")}`);
}
