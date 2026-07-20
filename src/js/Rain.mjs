/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import { randomChoice, rangeArray } from "./util.mjs";
import VariableRateAccumulator from "./util/VariableRateAccumulator.mjs";
import state from "./State.mjs";

// Ambient grid weather: cosine trough-start forever (period from config).
// Coverage pool (firstPass): without replacement until every column has had a
// drop of coverageTheme (initial green, then each color-change target).
// Optional 1s drain storm after email: high-rate storm over remaining pool.
function Rain(...args) {
  if (!new.target) return new Rain(...args);
  const self = this;
  const opts = args[0] ?? {};

  self.name = opts.name ?? "rain";
  self.priority = opts.priority ?? 0;
  self.infinite = true;
  self.isComplete = false;
  self.accumulator = opts.accumulator;

  const colCount = opts.cols ?? opts.columnCount ?? 0;
  const allCols =
    opts.columns != null
      ? Array.from(opts.columns)
      : rangeArray(colCount);

  // Coverage pool: drain without replacement until empty.
  self.firstPass = new Set(allCols);
  // Only spawns of this theme count toward the pool (null = any theme).
  self.coverageTheme = opts.coverageTheme ?? null;

  // Drain storm (DropManager storm path): targets remaining firstPass.
  self.stormEnabled = false;
  self.stormAccumulator = null;
  self.stormStartSeq = 0;

  Object.defineProperty(self, "isActive", {
    get: () => true,
    enumerable: true,
  });

  // Alias so DropManager stackableSelected / storm stop use the coverage pool.
  Object.defineProperty(self, "columnsSelected", {
    get: () => self.firstPass,
    enumerable: true,
  });

  self.resetCoverage = (optsIn = {}) => {
    const cols =
      optsIn.columns != null
        ? Array.from(optsIn.columns)
        : optsIn.cols != null
          ? rangeArray(optsIn.cols)
          : allCols;
    self.firstPass = new Set(cols);
    if (optsIn.theme !== undefined) self.coverageTheme = optsIn.theme;
    return self;
  };

  // drop optional: theme filter when coverageTheme is set.
  self.onColumnSpawned = (col, drop) => {
    if (self.coverageTheme != null && drop != null) {
      const t = drop.theme;
      if (t != null && t !== self.coverageTheme) return false;
    }
    const had = self.firstPass.delete(col);
    if (had && self.stormEnabled && self.firstPass.size === 0) {
      self.stopDrainStorm();
    }
    return had;
  };

  self.markCovered = (col, drop) => self.onColumnSpawned(col, drop);

  // Flat drain rate (drops/s) until firstPass is empty.
  const DRAIN_RATE = 10;

  /**
   * Coverage-pool drain storm: constant rate until firstPass is empty.
   * @param {number} [_seconds] ignored (kept for call-site compat)
   * @param {{ rate?: number }} [opts] rate defaults to 10 drops/s
   * @returns {number} expected durationSeconds at that rate (0 if skipped)
   */
  self.startDrainStorm = (_seconds = 1, opts = {}) => {
    // Nothing left in the coverage pool — skip (do not enable an empty storm).
    const units = self.firstPass?.size ?? 0;
    if (units <= 0) {
      self.stormEnabled = false;
      self.stormAccumulator = null;
      return 0;
    }
    const rate =
      typeof opts.rate === "number" && opts.rate > 0 ? opts.rate : DRAIN_RATE;
    // Window long enough for `units` at flat `rate`; VRA normalizes exactly.
    const durationSeconds = Math.max(units / rate, 0.001);
    self.stormAccumulator = VariableRateAccumulator(
      units,
      durationSeconds,
      VariableRateAccumulator.rates.constant(rate),
    );
    self.stormEnabled = true;
    state.stormStartSeq = (state.stormStartSeq ?? 0) + 1;
    self.stormStartSeq = state.stormStartSeq;
    return durationSeconds;
  };

  self.stopDrainStorm = () => {
    self.stormEnabled = false;
    self.stormAccumulator = null;
    return self;
  };

  // DropManager may call stopStorm when selection empty.
  self.stopStorm = () => self.stopDrainStorm();
  self.startStorm = () => self.startDrainStorm(1);

  self.pickColumns = (count, freeColumns, stackableColumns = []) => {
    if (count <= 0) return [];

    // Coverage pool pending: without replacement (free first, then stack if storm).
    if (self.firstPass.size > 0) {
      const freePool = freeColumns.filter((c) => self.firstPass.has(c));
      const stackPool =
        self.stormEnabled === true
          ? (stackableColumns ?? []).filter(
              (c) => self.firstPass.has(c) && !freePool.includes(c),
            )
          : [];

      if (freePool.length === 0 && stackPool.length === 0) return [];

      const picked = [];
      const take = (pool) => {
        const available = new Set(pool);
        while (picked.length < count && available.size > 0) {
          const col = randomChoice(available);
          available.delete(col);
          picked.push(col);
        }
      };
      take(freePool);
      if (picked.length < count) take(stackPool);
      return picked;
    }

    // Pool empty: free random (ambient only; drain storm should already stop).
    if (self.stormEnabled) return [];
    if (freeColumns.length === 0) return [];
    const picked = [];
    const available = new Set(freeColumns);
    for (let i = 0; i < count && available.size > 0; i++) {
      const col = randomChoice(available);
      available.delete(col);
      picked.push(col);
    }
    return picked;
  };

  self.syncCompletion = () => {
    if (self.stormEnabled && self.firstPass.size === 0) self.stopDrainStorm();
  };
  self.cancel = () => {
    self.stopDrainStorm();
  };
}

export { Rain };
export default Rain;

// ===========================================================
// Smoke tests: node src/js/Rain.mjs
// ===========================================================
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (await import("node:url")).pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  const assert = (await import("node:assert/strict")).default;

  console.log("Running Rain smoke tests...");

  const rain = Rain({ cols: 5, coverageTheme: "green" });
  assert.equal(rain.firstPass.size, 5);

  const free = [0, 1, 2, 3, 4];
  const first = rain.pickColumns(2, free);
  assert.equal(first.length, 2);
  for (const c of first) assert.ok(rain.firstPass.has(c)); // not drained until spawn

  for (const c of first) rain.onColumnSpawned(c, { theme: "green" });
  assert.equal(rain.firstPass.size, 3);

  // Wrong theme does not drain.
  rain.onColumnSpawned(0, { theme: "red" });
  assert.equal(rain.firstPass.size, 3);

  // First-pass still pending but only non-firstPass cols free → wait.
  const remaining = [...rain.firstPass];
  assert.ok(remaining.length > 0);
  const freeNotInFirst = free.filter((c) => !rain.firstPass.has(c));
  assert.ok(freeNotInFirst.length > 0);
  const waited = rain.pickColumns(2, freeNotInFirst);
  assert.equal(waited.length, 0);

  // Drain first-pass
  for (const c of [0, 1, 2, 3, 4]) rain.onColumnSpawned(c, { theme: "green" });
  assert.equal(rain.firstPass.size, 0);

  // Free random still picks from free
  const freePick = rain.pickColumns(3, [1, 3, 4]);
  assert.equal(freePick.length, 3);

  // Reset + drain storm
  rain.resetCoverage({ cols: 5, theme: "blue" });
  assert.equal(rain.firstPass.size, 5);
  assert.equal(rain.coverageTheme, "blue");
  rain.startDrainStorm(1);
  assert.equal(rain.stormEnabled, true);
  assert.ok(rain.stormAccumulator);
  const stormPick = rain.pickColumns(2, free, []);
  assert.equal(stormPick.length, 2);
  rain.stopDrainStorm();
  assert.equal(rain.stormEnabled, false);

  const green = (t) => `\x1b[32m${t}\x1b[0m`;
  console.log(`Rain smoke tests passed! ${green("✓")}`);
}
