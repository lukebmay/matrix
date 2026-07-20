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
  self.sceneManager = null;
  self.scenePlayer = null;
  self.themeDirector = null; // active palette + spawn blend
  // Weather scale (runtime): Matrix may escalate mid-session with cheap glow.
  // null = follow frozen config; false/true override allowStormStack / scale.
  self.weatherScale = null; // null | boolean — constrained weather when true
  self.allowStormStack = null; // null | boolean — storm second-drop when true
  // Monotonic order for storm FIFO (DropManager: first activated finishes first).
  self.stormStartSeq = 0;
}

const state = State();

export { state };
export default state;
