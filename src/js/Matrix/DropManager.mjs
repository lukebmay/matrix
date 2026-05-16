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
import { objFilter } from "../util.mjs";
import DropScene from "./DropScene.mjs";

function DropManager(...args) {
  if (!new.target) return new DropManager(...args);
  let self = this;

  let dropScenes = state.dropScenes;
  let defaultDropScene = dropScenes.default;

  const drops = new Set();

  self.getDrops = () => {
    return Array.from(drops);
  };

  const startNewDrops = (elapsedSeconds) => {
    let activeScenes = objFilter(dropScenes, (k_, v, o_) => v.isActive);

    let newDrops;
    if (currentScene?.isActive) {
      newDrops = currentScene.getNewDrops(elapsedSeconds);
    } else {
      newDrops = defaultDropScene.getNewDrops(elapsedSeconds);
    }
    for (let drop of newDrops) {
      drops.add(drop);
    }
  };

  self.killCompletedDrops = () => {
    for (let drop of drops) {
      if (drop.isComplete) drops.delete(drop);
    }
  };

  self.updateDrops = (elapsedSeconds) => {
    for (let drop of drops) {
      drop.update(elapsedSeconds);
    }
    startNewDrops(elapsedSeconds);
  };
}

export { DropManager };

export default DropManager;
