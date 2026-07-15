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

// Owns live drops. Additive spawn policies; max one drop per column.
// Reveal satisfaction is driven by DomManager when glyphs actually show
// (not merely when a drop is spawned on a column).
function DropManager(...args) {
  if (!new.target) return new DropManager(...args);
  const self = this;

  const cfg = state.config;
  const policies = state.spawnPolicies ?? [];
  const drops = new Set();
  const occupied = new Set();
  const justFinishedCols = new Set();

  self.getDrops = () => Array.from(drops);
  self.takeFinishedColumns = () => {
    const cols = Array.from(justFinishedCols);
    justFinishedCols.clear();
    return cols;
  };

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

  const startNewDrops = (elapsedSeconds) => {
    let free = freeColumns();
    if (free.length === 0) return;

    const active = policies
      .filter((p) => p.isActive && !p.isComplete)
      .sort((a, b) => b.priority - a.priority);

    for (const policy of active) {
      if (free.length === 0) break;
      policy.syncCompletion?.();
      if (policy.isComplete) continue;

      const want = policy.accumulator.advance(elapsedSeconds);
      if (want <= 0) continue;

      const cols = policy.pickColumns(want, free);
      for (const col of cols) {
        if (spawnOn(col)) {
          free = free.filter((c) => c !== col);
        }
      }
    }
  };

  self.killCompletedDrops = () => {
    for (const drop of drops) {
      if (drop.isComplete) {
        drops.delete(drop);
        occupied.delete(drop.col);
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

  // Called when content at (r,c) becomes visible — shrink reveal pools.
  self.notifyCellRevealed = (r, c) => {
    const layers = state.contentLayers ?? [];
    for (const layer of layers) {
      if (!layer.markRevealed?.(r, c)) continue;
      if (layer.columnFullyRevealed?.(c)) {
        for (const p of policies) {
          if (!p.infinite) p.markCovered(c);
        }
      }
    }
    for (const p of policies) {
      p.syncCompletion?.();
    }
  };
}

export { DropManager };
export default DropManager;
