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

// Single string as a positionable line. Spaces count in size; paint skips them.
// horizontal: h=1, w=length; vertical: w=1, h=length.
function TextLine(...args) {
  if (!new.target) return new TextLine(...args);
  const opts = args[0] ?? {};
  const text = opts.text != null ? String(opts.text) : "";
  const orientation =
    opts.orientation === "vertical" ? "vertical" : "horizontal";
  const href = opts.href ?? null;
  const lineId = opts.lineId;

  const length = text.length;
  const width = orientation === "vertical" ? 1 : length;
  const height = orientation === "vertical" ? length : 1;

  const self = Positionable({
    origin: opts.origin ?? [0, 0],
    width,
    height,
    name: opts.name,
  });

  self.text = text;
  self.orientation = orientation;
  self.href = href;
  if (lineId !== undefined) self.lineId = lineId;

  // Non-space glyphs at current origin. DomManager / DropScene shape.
  self.cells = () => {
    const [r0, c0] = self.origin;
    const out = [];
    for (let i = 0; i < length; i++) {
      const char = text[i];
      if (!char || char === " ") continue;
      const r = orientation === "vertical" ? r0 + i : r0;
      const c = orientation === "vertical" ? c0 : c0 + i;
      const cell = { r, c, char, href };
      if (lineId !== undefined) cell.lineId = lineId;
      out.push(cell);
    }
    return out;
  };

  // Aliases: DropScene points / paint materialize (not origin-only canonical).
  self.points = () => self.cells();
  self.materialize = () => self.cells();

  return self;
}

export { TextLine };
export default TextLine;
