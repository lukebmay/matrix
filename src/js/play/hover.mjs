/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Cell hit-test → unit.handleHover. Policies live on units only.

import state from "../State.mjs";

const cellKey = (r, c) => `${r},${c}`;

/**
 * Bind pointer-over on content cells to unit hover handlers.
 * @param {Array<{ unit: object, cells?: Array<{r,c,char?}> }>} bindings
 * @returns {() => void} unbind
 */
export function bindHover(bindings) {
  if (!Array.isArray(bindings) || !bindings.length) return () => {};

  const byCell = new Map();
  for (const b of bindings) {
    const unit = b?.unit;
    if (!unit || typeof unit.handleHover !== "function") continue;
    const cells = b.cells ?? unit.scene?.points ?? [];
    for (const p of cells) {
      if (p == null) continue;
      if (p.char == null || p.char === "" || p.char === " ") continue;
      const r = p.r;
      const c = p.c;
      if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
      const key = cellKey(r, c);
      let set = byCell.get(key);
      if (!set) {
        set = new Set();
        byCell.set(key, set);
      }
      set.add(unit);
    }
  }

  if (byCell.size === 0) return () => {};

  const grid = state.grid;
  // Prefer per-cell listeners; fall back to #matrix delegation if no grid yet.
  if (grid) {
    const offs = [];
    let bound = 0;
    for (const [key, units] of byCell) {
      const parts = key.split(",");
      const r = Number(parts[0]);
      const c = Number(parts[1]);
      const el = grid.get(r, c);
      if (!el) continue;
      bound += 1;

      const onOver = () => {
        for (const u of units) {
          try {
            u.handleHover();
          } catch {
            // ignore
          }
        }
      };
      el.addEventListener("mouseover", onOver);
      offs.push(() => el.removeEventListener("mouseover", onOver));
    }
    if (bound > 0) {
      return () => {
        for (const off of offs) {
          try {
            off();
          } catch {
            // ignore
          }
        }
        offs.length = 0;
      };
    }
  }

  // Delegation: id="_r_c" on m-char cells.
  const matrixEl =
    typeof document !== "undefined"
      ? document.querySelector("#matrix")
      : null;
  if (!matrixEl) return () => {};

  const onOver = (event) => {
    const el = event.target?.closest?.(".m-char");
    if (!el?.id) return;
    const m = /^_(\d+)_(\d+)$/.exec(el.id);
    if (!m) return;
    const units = byCell.get(cellKey(Number(m[1]), Number(m[2])));
    if (!units) return;
    for (const u of units) {
      try {
        u.handleHover();
      } catch {
        // ignore
      }
    }
  };
  matrixEl.addEventListener("mouseover", onOver);
  return () => matrixEl.removeEventListener("mouseover", onOver);
}

export default bindHover;
