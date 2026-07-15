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
import { rangeMapArray } from "./util.mjs";

// DOM cell element store (columns + r,c cells).
function DomGrid(...args) {
  if (!new.target) return new DomGrid(...args);
  const self = this;

  const cfg = state.config;

  self.ROWS = cfg.ROWS || 10;
  self.COLS = cfg.COLS || 20;

  const grid = [];
  self.columns = Array(self.COLS);

  rangeMapArray(self.ROWS, () => {
    const row = [];
    rangeMapArray(self.COLS, () => {
      row.push(undefined);
    });
    grid.push(row);
  });

  self.setColumn = (c, value) => {
    if (typeof c !== "number") return;
    if (c < 0 || c >= cfg.COLS) return;
    self.columns[c] = value;
  };

  self.getColumn = (c) => {
    if (typeof c !== "number") return;
    if (c < 0 || c >= cfg.COLS) return;
    return self.columns[c];
  };

  self.set = (r, c, value) => {
    if (typeof r !== "number" || typeof c !== "number") return;
    if (r < 0 || r >= cfg.ROWS || c < 0 || c >= cfg.COLS) return;
    grid[r][c] = value;
  };

  self.get = (r, c) => {
    if (typeof r !== "number" || typeof c !== "number") return;
    if (r < 0 || r >= cfg.ROWS || c < 0 || c >= cfg.COLS) return;
    return grid[r][c];
  };
}

export { DomGrid };
export default DomGrid;
