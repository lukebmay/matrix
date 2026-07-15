/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import { rangeArray, randomChoice } from "./util.mjs";

// Spawn policy: rate accumulator + column pool. Finite policies track
// remaining columns; markCovered() lets baseline satisfy a reveal column.
function SpawnPolicy(...args) {
  if (!new.target) return new SpawnPolicy(...args);
  const self = this;

  const {
    name,
    columns = null, // null → all columns (baseline)
    accumulator,
    infinite = true,
    priority = 0,
    activateAfterMs = 0,
  } = args[0] ?? {};

  self.name = name;
  self.priority = priority;
  self.infinite = infinite;
  self.accumulator = accumulator;

  const allCols = columns ? new Set(columns) : null;
  let remaining = allCols ? new Set(allCols) : null;

  self.isActive = false;
  self.isComplete = false;

  self.eligibleColumns = () => {
    if (infinite) return allCols; // null means full grid
    return remaining;
  };

  self.markCovered = (col) => {
    if (infinite || !remaining) return false;
    if (!remaining.has(col)) return false;
    remaining.delete(col);
    if (remaining.size === 0) {
      self.isComplete = true;
      self.isActive = false;
    }
    return true;
  };

  self.pickColumns = (count, freeColumns) => {
    if (count <= 0 || !self.isActive) return [];
    const pool = infinite
      ? freeColumns
      : freeColumns.filter((c) => remaining.has(c));
    if (pool.length === 0) return [];

    const picked = [];
    const available = new Set(pool);
    for (let i = 0; i < count && available.size > 0; i++) {
      const col = randomChoice(available);
      available.delete(col);
      picked.push(col);
      if (!infinite) {
        remaining.delete(col);
      }
    }
    if (!infinite && remaining.size === 0) {
      self.isComplete = true;
      self.isActive = false;
    }
    return picked;
  };

  self.activate = () => {
    if (self.isComplete && !infinite) return;
    self.isActive = true;
    if (!infinite && allCols) {
      remaining = new Set(allCols);
      self.isComplete = false;
      self.accumulator.reset();
    }
  };

  self.deactivate = () => {
    self.isActive = false;
  };

  let activateTimer = null;
  if (activateAfterMs > 0) {
    activateTimer = setTimeout(self.activate, activateAfterMs);
  } else if (activateAfterMs === 0) {
    self.isActive = true;
  }

  self.cancel = () => {
    if (activateTimer !== null) {
      clearTimeout(activateTimer);
      activateTimer = null;
    }
    self.isActive = false;
  };
}

export { SpawnPolicy };
export default SpawnPolicy;
