import state from "./State.mjs";
import DropScene from "./DropScene.mjs";

function DropManager(...args) {
  if (!new.target) return new DropManager(...args);
  let self = this;

  const cfg = state.config;

  let texts = state.staticTexts;
  const drops = new Set();

  self.getDrops = () => {
    return Array.from(drops);
  };

  let dropScenes = texts.map((st) => DropScene(st, 3));

  let defaultDropScene = DropScene();

  let currentScene;
  let currentText;

  const startNewDrops = (seconds) => {
    if ((!currentScene || currentScene.isComplete) && texts.length) {
      currentScene = dropScenes.shift();
      currentText = texts.shift();
    }
    let newDrops;
    if (currentText?.isActive) {
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

