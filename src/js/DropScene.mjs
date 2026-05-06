/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */
import Drop from "./Drop.mjs";
import LinearWaveForm from "./LinearWaveForm.mjs";
import state from "./State.mjs";
import { rangeArray, randomChoice } from "./util.mjs";

function DropScene(...args) {
  if (!new.target) return new DropScene(...args);
  let self = this;

  let {
    texts,
    activationDelay,
    showOnActive,
    durationDelay,
    repeat, // boolean or integer
    repititionDelay,
  } = args[0] ?? {};

  self.showOnActive = showOnActive;

  let cfg = state.config;

  // set of column numbers
  self.texts = Array.isArray(texts) ? texts : texts ? [texts] : [];
  let columns = new Set();
  self.texts.forEach((text) => {
    if (text?.columns) text.columns.forEach((c) => columns.add(c));
  });
  if (columns.size === 0) rangeArray(cfg.COLS).forEach((c) => columns.add(c));
  let seconds = args[1] ?? 3;
  let remainingColumns = new Set(columns);

  self.isActive = false;
  self.isComplete = false;

  if (!["integer", "boolean"].includes(typeof repeat)) {
    repeat = self.texts.length ? false : true;
  }

  const createRegularWave = () => {
    let waveStart = LinearWaveForm.linearSectionsFromStartingPointAndSlopeTimePairs(1, [
      [0, 2],
      [1, 1],
      [0, 2],
      [1, 1], // ascent 2 + 1.5 + 4 + 2.5  = 10
    ]);
    let waveMiddle = LinearWaveForm.linearSectionsFromDropNumberAndTime(columns.size - 18, 10);
    let waveEnd = LinearWaveForm.linearSectionsFromStartingPointAndSlopeTimePairs(3, [
      [-1, 2],
      [0, 2], // descent 4 + 4 = 8
    ]);
    let wave = LinearWaveForm([...waveStart, ...waveMiddle, ...waveEnd]);
    return wave;
  };
  const createColumnSubsetWave = () => {
    let sections = LinearWaveForm.linearSectionsFromDropNumberAndTime(columns.size, seconds);
    return LinearWaveForm(sections);
  };

  let drops = new Set();
  self.getDrops = () => {
    return Array.from(drops);
  };

  let dropQueue = [];
  self.dropQueueAdd = (drop) => {
    dropQueue.unshift(drop);
  };
  self.dropQueueRemove = () => {
    return dropQueue.pop();
  };

  let columnQueue = [];
  self.columnQueueAdd = (col) => {
    if (columns.has(col)) {
      columnQueue.unshift(col);
    }
  };
  self.columnQueueRemove = () => {
    return columnQueue.pop();
  };

  let wave = self.texts ? createColumnSubsetWave() : createRegularWave();

  self.getNewDrops = (seconds) => {
    let dropCount = wave.getNextAreaChunk(seconds);
    let drops = [];
    for (let i = 0; i < dropCount; i++) {
      if (!repeat && remainingColumns.size === 0) {
        self.isComplete = true;
        self.isActive = false;
        break;
      }
      let c = self.columnQueueRemove() ?? randomChoice(remainingColumns) ?? randomChoice(columns);
      let drop = self.dropQueueRemove() ?? Drop();
      drop.col = c;
      drops.push(drop);
      remainingColumns.delete(c);
    }
    return drops;
  };

  self.activate = () => {
    self.isActive = true;
    self.isComplete = false;
  };
  if (typeof activationDelay !== "number") {
    activationDelay = 0;
  }
  if (typeof durationDelay !== "number") {
    activationDelay = 0;
  }
  setTimeout(self.activate, activationDelay);

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
    if (self.isActive) {
      setTimeout(self.deactivate, activationDelay + durationDelay);
    } else if (!self.isActive && repititionDelay) {
      setTimeout(self.activate, repititionDelay);
    }
  };
}

export { DropScene };

export default DropScene;
