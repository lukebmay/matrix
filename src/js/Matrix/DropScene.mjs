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
import state from "../State.mjs";
import { Queue, rangeArray, randomChoice } from "../util.mjs";

function DropScene(...args) {
  if (!new.target) return new DropScene(...args);
  let self = this;

  let { scene, duration } = args[0] ?? {};

  durationSeconds = typeof durationSeconds === "number" ? durationSeconds : 6;

  let cfg = state.config;

  // set of column numbers
  self.texts = Array.isArray(texts) ? texts : texts ? [texts] : [];
  let columns = new Set();
  self.texts.forEach((text) => {
    if (text?.columns) text.columns.forEach((c) => columns.add(c));
  });
  if (columns.size === 0) rangeArray(cfg.COLS).forEach((c) => columns.add(c));

  let remainingColumns = new Set(columns);

  self.isActive = false;
  self.isComplete = false;

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
    let sections = LinearWaveForm.linearSectionsFromDropNumberAndTime(
      columns.size,
      duration / 1000,
    );
    return LinearWaveForm(sections);
  };

  let wave = self.texts.length > 0 ? createColumnSubsetWave() : createRegularWave();

  let drops = new Set();
  self.getDrops = () => {
    return Array.from(drops);
  };

  self.dropQueue = Queue();
  self.columnQueue = Queue();

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
    remainingColumns = new Set(columns);
    wave = self.texts.length > 0 ? createColumnSubsetWave() : createRegularWave();
    setTimeout(self.deactivate, duration);
  };

  self.deactivate = () => {
    self.isActive = false;
    self.isComplete = false;
  };
}

export { DropScene };

export default DropScene;
