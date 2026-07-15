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

// Root coordinate positionable: origin [0,0], size ROWS×COLS.
function Grid(...args) {
  if (!new.target) return new Grid(...args);
  const opts = args[0] ?? {};
  const rows = opts.rows ?? opts.ROWS ?? 0;
  const cols = opts.cols ?? opts.COLS ?? 0;

  const self = Positionable({
    origin: opts.origin ?? [0, 0],
    width: cols,
    height: rows,
  });
  self.ROWS = rows;
  self.COLS = cols;
  return self;
}

export { Grid };
export default Grid;
