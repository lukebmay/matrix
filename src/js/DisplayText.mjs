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

// Content layer from laid-out cells. Reveal tracking for DomManager.
// DropScene may share .positions. opts.cells | opts.positions.
function DisplayText(...args) {
  if (!new.target) return new DisplayText(...args);
  const self = this;
  const opts = args[0] ?? {};

  self.defaultHref = opts.href ?? null;
  self.columns = new Set();
  self.positions = [];
  self.isComplete = false;

  const cfg = state.config;
  const cells = opts.cells ?? opts.positions ?? [];

  for (const cell of cells) {
    const r = cell.r;
    const c = cell.c;
    const char = cell.char;
    if (char == null || char === "" || char === " ") continue;
    if (cfg != null) {
      if (r < 0 || c < 0 || r >= cfg.ROWS || c >= cfg.COLS) continue;
    }
    self.columns.add(c);
    // Share DropScene points when already shaped (F glue).
    if (cell.revealed !== undefined) {
      if (cell.href == null && self.defaultHref != null) cell.href = self.defaultHref;
      self.positions.push(cell);
    } else {
      self.positions.push({
        r,
        c,
        char,
        href: cell.href ?? self.defaultHref,
        lineId: cell.lineId,
        revealed: false,
      });
    }
  }

  self.unrevealedColumns = () => {
    const cols = new Set();
    for (const p of self.positions) {
      if (!p.revealed) cols.add(p.c);
    }
    return cols;
  };

  self.columnFullyRevealed = (col) => {
    let any = false;
    for (const p of self.positions) {
      if (p.c !== col) continue;
      any = true;
      if (!p.revealed) return false;
    }
    return any;
  };

  // Returns true if this position newly transitioned to revealed.
  self.markRevealed = (r, c) => {
    let newly = false;
    for (const p of self.positions) {
      if (p.r === r && p.c === c && !p.revealed) {
        p.revealed = true;
        newly = true;
      }
    }
    if (newly && self.positions.every((p) => p.revealed)) {
      self.isComplete = true;
    }
    return newly;
  };

  // Returns true if this position newly transitioned to hidden.
  self.markHidden = (r, c) => {
    let newly = false;
    for (const p of self.positions) {
      if (p.r === r && p.c === c && p.revealed) {
        p.revealed = false;
        newly = true;
      }
    }
    if (newly) self.isComplete = false;
    return newly;
  };

  self.complete = () => {
    for (const p of self.positions) p.revealed = true;
    self.isComplete = true;
  };

  self.forceShowAll = () => {
    self.complete();
  };

  /**
   * Rebuild positions from cells (playlist saying swap). Shares point objects
   * that already carry `revealed` so DropScene paint stays in sync.
   */
  self.setCells = (cells) => {
    const list = cells ?? [];
    self.positions.length = 0;
    self.columns = new Set();
    self.isComplete = false;
    const cfg = state.config;
    for (const cell of list) {
      if (cell == null) continue;
      const r = cell.r;
      const c = cell.c;
      const char = cell.char;
      if (char == null || char === "" || char === " ") continue;
      if (cfg != null) {
        if (r < 0 || c < 0 || r >= cfg.ROWS || c >= cfg.COLS) continue;
      }
      self.columns.add(c);
      if (cell.revealed !== undefined) {
        if (cell.href == null && self.defaultHref != null) {
          cell.href = self.defaultHref;
        }
        cell.revealed = false;
        self.positions.push(cell);
      } else {
        self.positions.push({
          r,
          c,
          char,
          href: cell.href ?? self.defaultHref,
          lineId: cell.lineId,
          revealed: false,
        });
      }
    }
    return self;
  };
}

export { DisplayText };
export default DisplayText;
