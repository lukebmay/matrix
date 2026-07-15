/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

function State(...args) {
  if (!new.target) return new State(...args);
  const self = this;

  self.config = null;
  self.grid = null;
  self.dropManager = null;
  self.domManager = null;
  self.contentLayers = null;
  self.rain = null;
  self.dropScenes = null;
  self.spawnPolicies = null; // legacy bridge; prefer rain + dropScenes
  self.sceneManager = null;
  self.scenePlayer = null;
}

const state = State();

export { state };
export default state;
