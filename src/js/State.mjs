/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// State is the single source of truth for the application. Implemented as a top-level singleton to avoid prop drilling (passing data through many intermediate components that don't need it).

function State(...args) {
  if (!new.target) return new State(...args);
  const self = this;

  self.config = null;
}

const state = State();

export { state };

export default state;
