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

// Owns live drops. Additive Rain + active-scene Storms; max one drop per column.
// On spawn col c: drain Rain first-pass and every active scene's columnsSelected.
function DropManager(...args) {
  if (!new.target) return new DropManager(...args);
  const self = this;

  const cfg = state.config;
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

  const spawnOn = (col, opts = {}) => {
    if (occupied.has(col)) return null;
    const drop = Drop({ col, ...opts });
    drops.add(drop);
    occupied.add(col);
    notifySpawnColumn(col);
    return drop;
  };

  const advanceSource = (source, elapsedSeconds) => {
    const acc = source.stormAccumulator ?? source.accumulator;
    if (!acc) return 0;
    return acc.advance(elapsedSeconds);
  };

  const startNewDrops = (elapsedSeconds) => {
    let free = freeColumns();
    if (free.length === 0) return;

    const sources = spawnSources();
    for (const source of sources) {
      if (free.length === 0) break;

      source.syncCompletion?.();
      if (source.isComplete && !source.infinite) continue;
      // DropScene: isActive is a getter; SpawnPolicy/Rain: boolean or getter.
      const active =
        typeof source.isActive === "function" ? source.isActive() : source.isActive;
      if (!active) continue;

      const want = advanceSource(source, elapsedSeconds);
      if (want <= 0) continue;

      const dropOpts =
        source.stormEnabled === true
          ? {
              speedMin: cfg.STORM_DROP_SPEED_MIN ?? cfg.DROP_SPEED_MIN,
              speedMax: cfg.STORM_DROP_SPEED_MAX ?? cfg.DROP_SPEED_MAX,
            }
          : {};

      const cols = source.pickColumns(want, free);
      for (const col of cols) {
        if (spawnOn(col, dropOpts)) {
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

export { DropManager };
export default DropManager;
