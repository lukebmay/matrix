/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import { randomChoice } from "./util.mjs";

// Spawn policy: rate accumulator + column pool.
// Finite reveal policies optionally take getEligibleColumns() so remaining
// work tracks unrevealed content (not just "we already spawned there").
function SpawnPolicy(...args) {
  if (!new.target) return new SpawnPolicy(...args);
  const self = this;

  const {
    name,
    columns = null, // null → all columns (baseline)
    getEligibleColumns = null, // () => Iterable<number> for dynamic pools
    accumulator,
    infinite = true,
    priority = 0,
    activateAfterMs = 0,
  } = args[0] ?? {};

  self.name = name;
  self.priority = priority;
  self.infinite = infinite;
  self.accumulator = accumulator;

  const staticCols = columns ? new Set(columns) : null;
  // Static remaining when not using getEligibleColumns.
  let remaining = staticCols ? new Set(staticCols) : null;

  self.isActive = false;
  self.isComplete = false;

  const currentEligible = () => {
    if (infinite) return null; // full grid
    if (typeof getEligibleColumns === "function") {
      return new Set(getEligibleColumns());
    }
    return remaining;
  };

  self.eligibleColumns = () => currentEligible();

  // Column no longer needs a reveal drop (content already shown there).
  self.markCovered = (col) => {
    if (infinite) return false;
    if (typeof getEligibleColumns === "function") {
      // Dynamic pool: completion checked via empty eligible set.
      const left = currentEligible();
      if (!left || left.size === 0) {
        self.isComplete = true;
        self.isActive = false;
        return true;
      }
      return left.has(col) === false;
    }
    if (!remaining || !remaining.has(col)) return false;
    remaining.delete(col);
    if (remaining.size === 0) {
      self.isComplete = true;
      self.isActive = false;
    }
    return true;
  };

  self.syncCompletion = () => {
    if (infinite || !self.isActive) return;
    const left = currentEligible();
    if (left && left.size === 0) {
      self.isComplete = true;
      self.isActive = false;
    }
  };

  self.pickColumns = (count, freeColumns) => {
    if (count <= 0 || !self.isActive || self.isComplete) return [];

    let pool;
    if (infinite) {
      pool = freeColumns;
    } else {
      const eligible = currentEligible();
      if (!eligible || eligible.size === 0) {
        self.isComplete = true;
        self.isActive = false;
        return [];
      }
      pool = freeColumns.filter((c) => eligible.has(c));
    }
    if (pool.length === 0) return [];

    const picked = [];
    const available = new Set(pool);
    for (let i = 0; i < count && available.size > 0; i++) {
      const col = randomChoice(available);
      available.delete(col);
      picked.push(col);
      // Do not remove from remaining on spawn — only when content is revealed.
    }
    return picked;
  };

  self.activate = () => {
    if (self.isComplete && !infinite) return;
    // Re-check: baseline may have already revealed everything.
    if (!infinite) {
      const left = currentEligible();
      if (left && left.size === 0) {
        self.isComplete = true;
        self.isActive = false;
        return;
      }
    }
    self.isActive = true;
    if (!infinite && staticCols && !getEligibleColumns) {
      remaining = new Set(staticCols);
      self.isComplete = false;
      self.accumulator.reset();
    } else if (!infinite) {
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
