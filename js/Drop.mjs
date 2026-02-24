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
import { nanoid, randomChoice, rangeArray, randomInterval } from "./util.mjs";

function Drop(...args) {
  if (!new.target) return new Drop(...args);
  let self = this;

  self.id = nanoid(6);

  const cfg = state.config;

  self.col = randomChoice(rangeArray(cfg.COLS));

  self._row = 0.0; // decimal
  self.length = Math.floor(randomInterval(cfg.DROP_LENGTH_MIN, cfg.DROP_LENGTH_MAX));
  // characters per second
  self.speed = randomInterval(cfg.DROP_SPEED_MIN, cfg.DROP_SPEED_MAX);

  self.isComplete = false;

  self.prevRow = null;

  self.getRow = () => {
    return Math.floor(self._row);
  };

  self.update = (seconds) => {
    self.prevRow = self.getRow();
    self._row += self.speed * seconds;
    if (self.getRow() >= cfg.ROWS + self.length - 1) {
      self.isComplete = true;
    }
  };
}

export { Drop };

export default Drop;

