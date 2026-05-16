/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */
import DisplayText from "./DisplayTextScene/DisplayText.mjs";

function DisplayTextScene(...args) {
  if (!new.target) return new DisplayTextScene(...args);
  let self = this;

  let { name, texts } = args[0] ?? {};

  self.name = name;
  self.texts = texts.map((t) => DisplayText(t));

  self.columns = new Set(self.texts.flatMap((text) => text.columns));

  self.positions = self.texts.flatMap((text) => text.positions);

  self.values = self.updateValues(elsapsedSeconds, dropTipPassedPositions);
}

export { DisplayTextScene };

export default DisplayTextScene;
