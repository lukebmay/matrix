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

// Content group: multiple lines (each may have its own href) that share one
// reveal wave. Tracks which (r,c) cells are still unrevealed.
//
// lines: array of {
//   text, location: [r,c], orientation?: "horizontal"|"vertical", href?: string
// }
// Legacy tuples also accepted: [text, location, orientation?, href?]
function DisplayText(...args) {
  if (!new.target) return new DisplayText(...args);
  const self = this;
  const opts = args[0] ?? {};

  // Default href for lines that omit their own (optional).
  self.defaultHref = opts.href ?? null;

  const rawLines = opts.lines ?? opts.texts ?? [];
  const cfg = state.config;

  self.columns = new Set();
  self.positions = [];
  self.isComplete = false;

  let lineSeq = 0;

  const normalizeLine = (entry) => {
    if (Array.isArray(entry)) {
      const [text, location, orientation, href] = entry;
      return { text, location, orientation, href };
    }
    return entry;
  };

  self.addText = (entry) => {
    const { text: rawText, location, orientation: orientIn, href: lineHref } =
      normalizeLine(entry);
    let text = rawText;
    let orientation = orientIn ?? "horizontal";
    let [r, c] = location;
    const href = lineHref ?? self.defaultHref;
    const lineId = lineSeq++;

    if (r < 0) {
      r += cfg.ROWS;
      if (orientation === "vertical") {
        r = r - text.length + 1;
        if (r < 0) {
          text = text.slice(Math.abs(r));
          r = 0;
        }
      }
    }

    if (c < 0) {
      c += cfg.COLS;
      if (orientation === "horizontal") {
        c = c - text.length + 1;
        if (c < 0) {
          text = text.slice(Math.abs(c));
          c = 0;
        }
      }
    }

    if (orientation === "horizontal" && c > 0 && c + text.length > cfg.COLS) {
      text = text.slice(0, text.length - (c + text.length - cfg.COLS));
    } else if (orientation === "vertical" && r > 0 && r + text.length > cfg.ROWS) {
      text = text.slice(0, text.length - (r + text.length - cfg.ROWS));
    }

    if (orientation === "horizontal") {
      if (c < 0 || c >= cfg.COLS || r < 0 || r >= cfg.ROWS) return;
      if (c + text.length >= cfg.COLS) {
        text = text.slice(0, text.length - (c + text.length - cfg.COLS));
      }
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch && ch !== " ") {
          self.columns.add(c + i);
          self.positions.push({
            r,
            c: c + i,
            char: ch,
            href,
            lineId,
            revealed: false,
          });
        }
      }
    } else if (orientation === "vertical") {
      if (c < 0 || c >= cfg.COLS || r < 0 || r >= cfg.ROWS) return;
      if (r + text.length >= cfg.ROWS) {
        text = text.slice(0, text.length - (r + text.length - cfg.ROWS));
      }
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch && ch !== " ") {
          self.columns.add(c);
          self.positions.push({
            r: r + i,
            c,
            char: ch,
            href,
            lineId,
            revealed: false,
          });
        }
      }
    }
  };

  for (const line of rawLines) {
    self.addText(line);
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

  self.complete = () => {
    for (const p of self.positions) p.revealed = true;
    self.isComplete = true;
  };

  self.forceShowAll = () => {
    self.complete();
  };
}

export { DisplayText };
export default DisplayText;
