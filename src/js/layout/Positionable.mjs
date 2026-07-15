/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Inclusive character geometry: origin = top-left cell [row, col].
function Positionable(...args) {
  if (!new.target) return new Positionable(...args);
  const self = this;
  const opts = args[0] ?? {};

  self.origin = Array.isArray(opts.origin)
    ? [opts.origin[0], opts.origin[1]]
    : [0, 0];
  self.width = opts.width ?? 0;
  self.height = opts.height ?? 0;
  self.attachment = null;
  if (opts.name != null) self.name = opts.name;

  self.top = () => self.origin[0];
  self.left = () => self.origin[1];
  self.bottom = () => self.origin[0] + self.height - 1;
  self.right = () => self.origin[1] + self.width - 1;
  self.middle = () => self.origin[0] + Math.floor((self.height - 1) / 2);
  self.center = () => self.origin[1] + Math.floor((self.width - 1) / 2);

  // One attachment: { this: point, that: point } — solved by solveLayout.
  self.attach = (spec) => {
    if (spec == null || spec.this == null || spec.that == null) {
      throw new TypeError("attach: { this, that } required");
    }
    self.attachment = { this: spec.this, that: spec.that };
    return self;
  };
}

export { Positionable };
export default Positionable;
