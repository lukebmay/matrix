/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import Positionable from "./Positionable.mjs";

// Abstract positionable; children attach to group and/or siblings (see stack.mjs).
// Size is the bounding box of children (set by stack helpers or fitToChildren).
function Group(...args) {
  if (!new.target) return new Group(...args);
  const opts = args[0] ?? {};

  const self = Positionable({
    origin: opts.origin ?? [0, 0],
    width: opts.width ?? 0,
    height: opts.height ?? 0,
    name: opts.name,
  });

  self.children = opts.children ? [...opts.children] : [];

  self.add = (child) => {
    if (child != null) self.children.push(child);
    return self;
  };

  // Aggregate paint/DropScene cells from descendants that expose cells().
  self.cells = () => {
    const out = [];
    for (const child of self.children) {
      if (child != null && typeof child.cells === "function") {
        out.push(...child.cells());
      }
    }
    return out;
  };

  self.points = () => self.cells();
  self.materialize = () => self.cells();

  // Bounding box from current child origins (after solve). Origin stays put.
  self.fitToChildren = () => {
    const kids = self.children.filter(
      (c) => c != null && c.width != null && c.height != null
    );
    if (!kids.length) {
      self.width = 0;
      self.height = 0;
      return self;
    }
    let minR = Infinity;
    let minC = Infinity;
    let maxR = -Infinity;
    let maxC = -Infinity;
    for (const c of kids) {
      minR = Math.min(minR, c.top());
      minC = Math.min(minC, c.left());
      maxR = Math.max(maxR, c.bottom());
      maxC = Math.max(maxC, c.right());
    }
    self.width = maxC - minC + 1;
    self.height = maxR - minR + 1;
    return self;
  };

  return self;
}

export { Group };
export default Group;
