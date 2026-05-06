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
import DropScene from "./DropScene.mjs";

function DropManager(...args) {
  if (!new.target) return new DropManager(...args);
  let self = this;

  let dropScenes = state.dropScenes;
  let defaultDropScene = DropScene();

  const drops = new Set();

  self.getDrops = () => {
    return Array.from(drops);
  };

  let currentScene;

  const startNewDrops = (seconds) => {
    if (!currentScene || currentScene.isComplete) {
      currentScene = dropScenes.shift();
    }
    let newDrops;
    if (currentScene?.isActive) {
      newDrops = currentScene.getNewDrops(seconds);
    } else {
      newDrops = defaultDropScene.getNewDrops(seconds);
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

  self.updateDrops = (seconds) => {
    for (let drop of drops) {
      drop.update(seconds);
    }
    startNewDrops(seconds);
  };
}

export { DropManager };

export default DropManager;
