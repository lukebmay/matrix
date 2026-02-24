import Drop from "./Drop.mjs";
import LinearWaveForm from "./LinearWaveForm.mjs";
import state from "./State.mjs";
import { rangeArray, randomChoice } from "./util.mjs";

function DropScene(...args) {
  if (!new.target) return new DropScene(...args);
  let self = this;

  let cfg = state.config;

  // set of column numbers
  let staticText = args[0];
  let columns = staticText ? new Set(staticText.columns) : new Set(rangeArray(cfg.COLS));
  let seconds = args[1] ?? 3;
  let remainingColumns = new Set(columns);

  self.isComplete = false;
  self.shouldLoop = args[0] ? false : true;

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

  let wave = args[0] ? createColumnSubsetWave() : createRegularWave();

  self.getNewDrops = (seconds) => {
    let dropCount = wave.getNextAreaChunk(seconds);
    let drops = [];
    for (let i = 0; i < dropCount; i++) {
      if (!self.shouldLoop && remainingColumns.size === 0) {
        self.isComplete = true;
        staticText.isActive = false;
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
}

export { DropScene };

export default DropScene;

