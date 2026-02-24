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

function StaticText(...args) {
  if (!new.target) return new StaticText(...args);
  let self = this;

  let {
    href,
    texts,
    activationDelay,
    showOnActive,
    durationDelay,
    repeat, // boolean or integer
    repititionDelay,
  } = args[0] ?? {};

  self.href = href;
  self.showOnActive = showOnActive;
  texts = texts ?? [];

  const cfg = state.config;

  // An active layer will display its static texts when a drop tip crosses over them, while
  //   an inactive layer will hide its static text when a drop tip crosses over them.
  self.isActive = false;
  // A complete layer is one in which a drop has been started on each column of the layer
  //   during either activation or deactivation.
  self.isComplete = false;

  self.columns = new Set();

  self.positions = [];

  self.addText = (text, location, orientation) => {
    orientation = orientation ?? "horizontal";
    let [r, c] = location;

    // negative indexing of rows (bottom justify if vertical)
    if (r < 0) {
      r += cfg.ROWS;
      if (orientation === "vertical") {
        r = r - text.length + 1;
        // if justification causes index to become negative, slice
        //   off text and set index to 0
        if (r < 0) {
          text = text.slice(Math.abs(r));
          r = 0;
        }
      }
    }

    // negative indexing of columns (right justify if horizontal)
    if (c < 0) {
      c += cfg.COLS;
      if (orientation === "horizontal") {
        c = c - text.length + 1;
        // if justification causes index to become negative, slice
        //   off text and set index to 0
        if (c < 0) {
          text = text.slice(Math.abs(c));
          c = 0;
        }
      }
    }

    // trim trailing text if too long
    if (orientation === "horizontal" && c > 0 && c + text.length > cfg.COLS) {
      let amountOver = c + text.length - cfg.COLS;
      text = text.slice(0, text.length - amountOver);
    } else if (orientation === "vertical" && r > 0 && r + text.length > cfg.ROWS) {
      let amountOver = r + text.length - cfg.ROWS;
      text = text.slice(0, text.length - amountOver);
    }

    if (orientation === "horizontal") {
      if (c < 0 || c >= cfg.COLS || r < 0 || r >= cfg.ROWS) {
        return;
      }
      // cutoff excess characters if outside of grid size.
      if (c + text.length >= cfg.COLS) {
        let amountOver = c + text.length - cfg.COLS;
        text = text.slice(0, text.length - amountOver);
      }
      for (let i = 0; i < text.length; i++) {
        if (text && text !== " ") {
          self.columns.add(c + i);
          self.positions.push({
            r,
            c: c + i,
            char: text[i],
          });
        }
      }
    } else if (orientation === "vertical") {
      if (c < 0 || c >= cfg.COLS || r < 0 || r >= cfg.ROWS) {
        return;
      }
      // cutoff excess characters if outside of grid size.
      if (r + text.length >= cfg.ROWS) {
        let amountOver = r + text.length - cfg.ROWS;
        text = text.slice(0, text.length - amountOver);
      }
      for (let i = 0; i < text.length; i++) {
        if (text && text !== " ") {
          self.columns.add(c);
          self.positions.push({
            r: r + i,
            c,
            char: text[i],
          });
        }
      }
    }
  };
  for (let text of texts) {
    self.addText(...text);
  }

  self.activate = () => {
    self.isActive = true;
    self.isComplete = false;
  };
  if (typeof activationDelay === "number") setTimeout(self.activate, activationDelay);

  self.deactivate = () => {
    self.isActive = false;
    self.isComplete = false;
    if (repeat) {
      setTimeout(self.activate, repititionDelay);
      if (typeof repeat === "number") repeat--;
    }
  };

  self.complete = () => {
    self.isComplete = true;
    if (self.isActive && durationDelay) {
      setTimeout(self.deactivate, activationDelay + durationDelay);
    } else if (!self.isActive && repititionDelay) {
      setTimeout(self.activate, repititionDelay);
    }
  };
}

export { StaticText };

export default StaticText;

