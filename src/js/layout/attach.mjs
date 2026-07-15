/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import env from "../env.mjs";
import { resolvePoint, collectSources } from "./Anchor.mjs";

/** Store one attachment on a positionable. */
function attach(positionable, spec) {
  if (positionable == null) {
    throw new TypeError("attach: positionable required");
  }
  if (spec == null || spec.this == null || spec.that == null) {
    throw new TypeError("attach: { this, that } required");
  }
  positionable.attachment = { this: spec.this, that: spec.that };
  return positionable;
}

function depsOf(positionable) {
  const att = positionable.attachment;
  if (!att) return [];
  const sources = collectSources(att.that);
  // Self is not a prior dependency for topo (we solve self from that).
  sources.delete(positionable);
  return [...sources];
}

/**
 * Directed cycle among items that participate in attachments.
 * Returns a path array if cycle found, else null.
 */
function findCycle(items) {
  const set = new Set(items);
  const graph = new Map();
  for (const p of items) {
    if (!p.attachment) {
      graph.set(p, []);
      continue;
    }
    graph.set(
      p,
      depsOf(p).filter((d) => set.has(d))
    );
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map(items.map((p) => [p, WHITE]));
  const parent = new Map();

  function dfs(u, stack) {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of graph.get(u) ?? []) {
      if (!set.has(v)) continue;
      if (color.get(v) === GRAY) {
        const i = stack.indexOf(v);
        return stack.slice(i).concat(v);
      }
      if (color.get(v) === WHITE) {
        parent.set(v, u);
        const cyc = dfs(v, stack);
        if (cyc) return cyc;
      }
    }
    stack.pop();
    color.set(u, BLACK);
    return null;
  }

  for (const p of items) {
    if (color.get(p) === WHITE) {
      const cyc = dfs(p, []);
      if (cyc) return cyc;
    }
  }
  return null;
}

function labelOf(p) {
  if (p == null) return "?";
  if (p.name) return String(p.name);
  if (p.ROWS != null && p.COLS != null) return `Grid(${p.ROWS}x${p.COLS})`;
  return `Pos[${p.origin?.[0]},${p.origin?.[1]} ${p.width}x${p.height}]`;
}

function formatCyclePath(path) {
  return path.map(labelOf).join(" → ");
}

/** Place origin so this-point equals that-point. */
function solveOne(positionable, ctx = {}) {
  const att = positionable.attachment;
  if (!att) return;

  const thatPt = resolvePoint(att.that, ctx);

  const savedRow = positionable.origin[0];
  const savedCol = positionable.origin[1];
  positionable.origin[0] = 0;
  positionable.origin[1] = 0;
  let thisAtZero;
  try {
    thisAtZero = resolvePoint(att.this, ctx);
  } catch (err) {
    positionable.origin[0] = savedRow;
    positionable.origin[1] = savedCol;
    throw err;
  }

  positionable.origin[0] = thatPt[0] - thisAtZero[0];
  positionable.origin[1] = thatPt[1] - thisAtZero[1];
}

/**
 * Kahn topo: items with attachment after their that-sources.
 * Unattached items first (roots / static).
 */
function topoOrder(items) {
  const set = new Set(items);
  const indeg = new Map();
  const children = new Map();

  for (const p of items) {
    indeg.set(p, 0);
    children.set(p, []);
  }

  for (const p of items) {
    if (!p.attachment) continue;
    for (const d of depsOf(p)) {
      if (!set.has(d)) continue;
      // edge d → p (d before p)
      children.get(d).push(p);
      indeg.set(p, indeg.get(p) + 1);
    }
  }

  const queue = [];
  for (const p of items) {
    if (indeg.get(p) === 0) queue.push(p);
  }

  const ordered = [];
  while (queue.length) {
    const u = queue.shift();
    ordered.push(u);
    for (const v of children.get(u)) {
      indeg.set(v, indeg.get(v) - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }

  // Leftovers are in cycles (or depend on cycle); append remaining.
  if (ordered.length < items.length) {
    for (const p of items) {
      if (!ordered.includes(p)) ordered.push(p);
    }
  }
  return ordered;
}

/**
 * Solve attachments roots→leaves.
 * @param {Iterable} positionables all items (grid + attached children)
 * @param {object} [options]
 * @param {boolean} [options.errorOnCycles] default env.errorOnCycles
 * @param {object} [options.ctx] passed to anchor resolve
 */
function solveLayout(positionables, options = {}) {
  const items = [...positionables];
  const errorOnCycles = options.errorOnCycles ?? env.errorOnCycles;
  const ctx = options.ctx ?? {};

  const cycle = findCycle(items);
  if (cycle && errorOnCycles) {
    throw new Error(`layout cycle: ${formatCyclePath(cycle)}`);
  }

  const order = topoOrder(items);
  for (const p of order) {
    if (p.attachment) solveOne(p, ctx);
  }
  return order;
}

export { attach, solveLayout, solveOne, findCycle, depsOf, topoOrder };
export default { attach, solveLayout };
