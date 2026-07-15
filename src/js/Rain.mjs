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

// Ambient grid weather: soft-square forever.
// First-pass without replacement over all columns, then free random.
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

  // First-pass set: drain without replacement until empty.
  self.firstPass = new Set(allCols);

  Object.defineProperty(self, "isActive", {
    get: () => true,
    enumerable: true,
  });

  self.onColumnSpawned = (col) => {
    const had = self.firstPass.delete(col);
    return had;
  };

  self.markCovered = (col) => self.onColumnSpawned(col);

  self.pickColumns = (count, freeColumns) => {
    if (count <= 0 || freeColumns.length === 0) return [];

    const freeFirst = freeColumns.filter((c) => self.firstPass.has(c));
    const pool = freeFirst.length > 0 ? freeFirst : freeColumns;
    if (pool.length === 0) return [];

    const picked = [];
    const available = new Set(pool);
    for (let i = 0; i < count && available.size > 0; i++) {
      const col = randomChoice(available);
      available.delete(col);
      picked.push(col);
    }
    return picked;
  };

  self.syncCompletion = () => {};
  self.cancel = () => {};
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

  const rain = Rain({ cols: 5 });
  assert.equal(rain.firstPass.size, 5);

  const free = [0, 1, 2, 3, 4];
  const first = rain.pickColumns(2, free);
  assert.equal(first.length, 2);
  for (const c of first) assert.ok(rain.firstPass.has(c)); // not drained until spawn

  for (const c of first) rain.onColumnSpawned(c);
  assert.equal(rain.firstPass.size, 3);

  // Drain first-pass
  for (const c of [0, 1, 2, 3, 4]) rain.onColumnSpawned(c);
  assert.equal(rain.firstPass.size, 0);

  // Free random still picks from free
  const freePick = rain.pickColumns(3, [1, 3, 4]);
  assert.equal(freePick.length, 3);

  const green = (t) => `\x1b[32m${t}\x1b[0m`;
  console.log(`Rain smoke tests passed! ${green("✓")}`);
}
