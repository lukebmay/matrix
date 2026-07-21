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
import {
  activePerfSettings,
  dropLengthBand,
  rainSpeedBand,
} from "./performance.mjs";
import { nanoid, randomChoice, rangeArray, randomInterval } from "./util.mjs";

function Drop(...args) {
  if (!new.target) return new Drop(...args);
  const self = this;

  const cfg = state.config;
  const opts = args[0] ?? {};

  self.id = nanoid(6);

  self.col =
    typeof opts.col === "number" ? opts.col : randomChoice(rangeArray(cfg.COLS));

  // DomManager only reveal/hides for scenes entered at or before this spawn.
  self.spawnAt = opts.spawnAt ?? performance.now();

  self._row = 0.0;
  // Length from active perf level (cfg baked at start; mid-session escalate
  // re-derives from ROWS/COLS when state.perfLevel is harsher than cfg).
  const perf = activePerfSettings(state, cfg);
  let lenMin = cfg.DROP_LENGTH_MIN;
  let lenMax = cfg.DROP_LENGTH_MAX;
  if (state.perfLevel && state.perfLevel !== cfg.PERF_LEVEL) {
    const band = dropLengthBand(cfg.ROWS, cfg.COLS, perf);
    lenMin = band.min;
    lenMax = band.max;
  }
  self.length = Math.floor(randomInterval(lenMin, lenMax));
  // Rain speeds follow active perf (cfg is high/med/low at build; escalate live).
  const rainBand = rainSpeedBand(perf);
  const speedMin = opts.speedMin ?? rainBand.min ?? cfg.DROP_SPEED_MIN;
  const speedMax = opts.speedMax ?? rainBand.max ?? cfg.DROP_SPEED_MAX;
  self.speed =
    typeof opts.speed === "number" ? opts.speed : randomInterval(speedMin, speedMax);

  // Palette name at spawn (theme blend); Dom paints trails from this.
  self.theme =
    typeof opts.theme === "string" && opts.theme ? opts.theme : null;

  self.isComplete = false;

  self.getRow = () => Math.floor(self._row);

  self.update = (seconds) => {
    self._row += self.speed * seconds;
    if (self.getRow() >= cfg.ROWS + self.length - 1) {
      self.isComplete = true;
    }
  };
}

export { Drop };
export default Drop;
