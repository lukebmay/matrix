/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */
import state from "../State.mjs";
import util from "../util.mjs";

function Grid(...args) {
  if (!new.target) return new Grid(...args);
  let self = this;

  const cfg = state.config;

  self.ROWS = cfg.ROWS || 10;
  self.COLS = cfg.COLS || 20;

  let grid = [];
  self.columns = Array(self.COLS);

  util.rangeMapArray(self.ROWS, () => {
    let row = [];
    util.rangeMapArray(self.COLS, () => {
      row.push(undefined);
    });
    grid.push(row);
  });

  self.setColumn = (c, value) => {
    if (typeof c !== "number") return;
    if (c < 0 || c >= cfg.COLS) {
      return;
    }
    self.columns[c] = value;
  };

  self.getColumn = (c) => {
    if (typeof c !== "number") return;
    if (c < 0 || c >= cfg.COLS) {
      return;
    }
    return self.columns[c];
  };

  self.set = (r, c, value) => {
    if (typeof r !== "number" || typeof c !== "number") return;
    if (r < 0 || r >= cfg.ROWS || c < 0 || c >= cfg.COLS) {
      return;
    }
    grid[r][c] = value;
  };

  self.get = (r, c) => {
    if (typeof r !== "number" || typeof c !== "number") return;
    if (r < 0 || r >= cfg.ROWS || c < 0 || c >= cfg.COLS) {
      return;
    }
    return grid[r][c];
  };
}

export { Grid };

export default Grid;
