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
}

const state = State();

export { state };

export default state;

