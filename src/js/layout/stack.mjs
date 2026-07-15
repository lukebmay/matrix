/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import { Anchors } from "./Anchor.mjs";
import Group from "./Group.mjs";

// Stack strategy (hybrid):
// - First child pins to the group (group slot).
// - Packing axis: sibling chain (next after prev + offset).
// - Align axis: each child to the group edge/center so mixed widths share one line.
// Offsets are evaluated at wire time (number or (index, prev, item) => number).

function resolveOffset(offset, index, prev, item) {
  if (typeof offset === "function") return offset(index, prev, item);
  return offset ?? 0;
}

function colAnchor(p, align) {
  if (align === "center") return Anchors.center(p);
  if (align === "right") return Anchors.right(p);
  return Anchors.left(p);
}

function rowAnchor(p, align) {
  if (align === "middle") return Anchors.middle(p);
  if (align === "bottom") return Anchors.bottom(p);
  return Anchors.top(p);
}

function ensureGroup(options) {
  if (options.group) return options.group;
  return Group({ name: options.name });
}

function adoptChildren(group, items) {
  for (const item of items) {
    if (item != null && !group.children.includes(item)) {
      group.children.push(item);
    }
  }
}

/**
 * Inclusive packing span: next = prev.edge + offset.
 * offset=1 is adjacent (no empty cell); each gap contributes (offset - 1).
 */
function packedSpan(sizes, gaps) {
  if (!sizes.length) return 0;
  let span = 0;
  for (const s of sizes) span += s;
  for (const g of gaps) span += g - 1;
  return span;
}

/**
 * Vertical stack: packing down, align left|center|right.
 * Defaults: offsetRow=1 (adjacent), offsetCol=0.
 * @returns {Group}
 */
function stackVertical(items, options = {}) {
  const list = (items ?? []).filter((x) => x != null);
  const align = options.align ?? "left";
  const offsetRow = options.offsetRow ?? 1;
  const offsetCol = options.offsetCol ?? 0;
  const group = ensureGroup(options);

  adoptChildren(group, list);

  if (!list.length) {
    group.width = 0;
    group.height = 0;
    return group;
  }

  const gaps = [];
  for (let i = 1; i < list.length; i++) {
    gaps.push(resolveOffset(offsetRow, i, list[i - 1], list[i]));
  }

  group.height = packedSpan(
    list.map((c) => c.height),
    gaps
  );
  group.width = Math.max(...list.map((c) => c.width));

  // First: group slot.
  const first = list[0];
  first.attach({
    this: [Anchors.top(first), colAnchor(first, align)],
    that: [Anchors.top(group), colAnchor(group, align)],
  });

  // Rest: pack on sibling, align on group (+ offsetCol).
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const item = list[i];
    const or = resolveOffset(offsetRow, i, prev, item);
    const oc = resolveOffset(offsetCol, i, prev, item);
    item.attach({
      this: [Anchors.top(item), colAnchor(item, align)],
      that: [Anchors.bottom(prev).plus(or), colAnchor(group, align).plus(oc)],
    });
  }

  // Expand width if offsetCol shifts children past the max-width box.
  if (list.length > 1) {
    let maxRight = group.width - 1;
    let minLeft = 0;
    for (let i = 1; i < list.length; i++) {
      const oc = resolveOffset(offsetCol, i, list[i - 1], list[i]);
      if (oc === 0) continue;
      // Relative col of left edge under group-align + oc (group at 0,0).
      const w = list[i].width;
      let left;
      if (align === "center") {
        left =
          Math.floor((group.width - 1) / 2) -
          Math.floor((w - 1) / 2) +
          oc;
      } else if (align === "right") {
        left = group.width - w + oc;
      } else {
        left = oc;
      }
      minLeft = Math.min(minLeft, left);
      maxRight = Math.max(maxRight, left + w - 1);
    }
    if (minLeft < 0 || maxRight > group.width - 1) {
      group.width = maxRight - minLeft + 1;
    }
  }

  return group;
}

/**
 * Horizontal stack: packing right, align top|middle|bottom.
 * Defaults: offsetRow=0, offsetCol=1 (adjacent).
 * @returns {Group}
 */
function stackHorizontal(items, options = {}) {
  const list = (items ?? []).filter((x) => x != null);
  const align = options.align ?? "top";
  const offsetRow = options.offsetRow ?? 0;
  const offsetCol = options.offsetCol ?? 1;
  const group = ensureGroup(options);

  adoptChildren(group, list);

  if (!list.length) {
    group.width = 0;
    group.height = 0;
    return group;
  }

  const gaps = [];
  for (let i = 1; i < list.length; i++) {
    gaps.push(resolveOffset(offsetCol, i, list[i - 1], list[i]));
  }

  group.width = packedSpan(
    list.map((c) => c.width),
    gaps
  );
  group.height = Math.max(...list.map((c) => c.height));

  const first = list[0];
  first.attach({
    this: [rowAnchor(first, align), Anchors.left(first)],
    that: [rowAnchor(group, align), Anchors.left(group)],
  });

  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const item = list[i];
    const or = resolveOffset(offsetRow, i, prev, item);
    const oc = resolveOffset(offsetCol, i, prev, item);
    item.attach({
      this: [rowAnchor(item, align), Anchors.left(item)],
      that: [rowAnchor(group, align).plus(or), Anchors.right(prev).plus(oc)],
    });
  }

  if (list.length > 1) {
    let maxBottom = group.height - 1;
    let minTop = 0;
    for (let i = 1; i < list.length; i++) {
      const or = resolveOffset(offsetRow, i, list[i - 1], list[i]);
      if (or === 0) continue;
      const h = list[i].height;
      let top;
      if (align === "middle") {
        top =
          Math.floor((group.height - 1) / 2) -
          Math.floor((h - 1) / 2) +
          or;
      } else if (align === "bottom") {
        top = group.height - h + or;
      } else {
        top = or;
      }
      minTop = Math.min(minTop, top);
      maxBottom = Math.max(maxBottom, top + h - 1);
    }
    if (minTop < 0 || maxBottom > group.height - 1) {
      group.height = maxBottom - minTop + 1;
    }
  }

  return group;
}

export { stackVertical, stackHorizontal, resolveOffset };
export default { stackVertical, stackHorizontal };
