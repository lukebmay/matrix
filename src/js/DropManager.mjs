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
import { rangeArray } from "./util.mjs";

// Owns live drops. Additive spawn policies; max one drop per column.
// When baseline covers a reveal column, that reveal marks it covered.
function DropManager(...args) {
  if (!new.target) return new DropManager(...args);
  const self = this;

  const cfg = state.config;
  const policies = state.spawnPolicies ?? [];
  const drops = new Set();
  const occupied = new Set(); // column → has live drop

  self.getDrops = () => Array.from(drops);

  const freeColumns = () => {
    const free = [];
    for (let c = 0; c < cfg.COLS; c++) {
      if (!occupied.has(c)) free.push(c);
    }
    return free;
  };

  const spawnOn = (col) => {
    if (occupied.has(col)) return null;
    const drop = Drop({ col });
    drops.add(drop);
    occupied.add(col);
    return drop;
  };

  // Baseline (low priority) covering a col satisfies active finite policies.
  const notifyRevealCovered = (col) => {
    for (const p of policies) {
      if (!p.isActive || p.infinite) continue;
      p.markCovered(col);
    }
  };

  const startNewDrops = (elapsedSeconds) => {
    let free = freeColumns();
    if (free.length === 0) return;

    // Higher priority first (reveals), then baseline.
    const active = policies
      .filter((p) => p.isActive && !p.isComplete)
      .sort((a, b) => b.priority - a.priority);

    for (const policy of active) {
      if (free.length === 0) break;

      const want = policy.accumulator.advance(elapsedSeconds);
      if (want <= 0) continue;

      const cols = policy.pickColumns(want, free);
      for (const col of cols) {
        if (spawnOn(col)) {
          free = free.filter((c) => c !== col);
          // If a non-reveal (baseline) took a reveal-eligible column, mark it.
          if (policy.infinite) {
            notifyRevealCovered(col);
          }
        }
      }
    }
  };

  self.killCompletedDrops = () => {
    for (const drop of drops) {
      if (drop.isComplete) {
        drops.delete(drop);
        occupied.delete(drop.col);
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
}

export { DropManager };
export default DropManager;
