/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

function isFiniteNumber(x) {
  return typeof x === "number" && Number.isFinite(x);
}

/** Scalar component: resolves to a number. */
function Anchor(...args) {
  if (!new.target) return new Anchor(...args);
  const self = this;
  const fn = args[0];
  const opts = args[1] ?? {};
  self.source = opts.source ?? null;

  self.canonical = (ctx) => fn(ctx);
  self.resolve = (ctx) => self.canonical(ctx);

  self.plus = (n) =>
    Anchor((ctx) => self.canonical(ctx) + n, { source: self.source });
  self.minus = (n) =>
    Anchor((ctx) => self.canonical(ctx) - n, { source: self.source });
}

/** Point: resolves to [row, col]. */
function PointAnchor(...args) {
  if (!new.target) return new PointAnchor(...args);
  const self = this;
  const fn = args[0];
  const opts = args[1] ?? {};
  self.source = opts.source ?? null;

  self.canonical = (ctx) => {
    const p = fn(ctx);
    return [p[0], p[1]];
  };
  self.resolve = (ctx) => self.canonical(ctx);

  self.plus = (dr, dc) => {
    let dRow = dr;
    let dCol = dc;
    if (Array.isArray(dr)) {
      dRow = dr[0];
      dCol = dr[1];
    }
    dRow = dRow ?? 0;
    dCol = dCol ?? 0;
    return PointAnchor(
      (ctx) => {
        const [r, c] = self.canonical(ctx);
        return [r + dRow, c + dCol];
      },
      { source: self.source }
    );
  };
  self.minus = (dr, dc) => {
    if (Array.isArray(dr)) return self.plus(-dr[0], -dr[1]);
    return self.plus(-(dr ?? 0), -(dc ?? 0));
  };
}

function resolveComponent(comp, ctx = {}) {
  if (isFiniteNumber(comp)) return comp;
  if (typeof comp === "function") return comp(ctx);
  if (comp != null && typeof comp.canonical === "function") {
    const v = comp.canonical(ctx);
    if (!isFiniteNumber(v)) {
      throw new TypeError("Anchor.canonical must return a number for components");
    }
    return v;
  }
  if (comp != null && typeof comp.resolve === "function") {
    const v = comp.resolve(ctx);
    if (!isFiniteNumber(v)) {
      throw new TypeError("Anchor.resolve must return a number for components");
    }
    return v;
  }
  throw new TypeError(`Cannot resolve component: ${String(comp)}`);
}

function resolvePoint(point, ctx = {}) {
  if (point != null && typeof point.canonical === "function") {
    const v = point.canonical(ctx);
    if (Array.isArray(v) && v.length >= 2) {
      return [resolveComponent(v[0], ctx), resolveComponent(v[1], ctx)];
    }
    throw new TypeError("PointAnchor.canonical must return [row, col]");
  }
  if (point != null && typeof point.resolve === "function" && !Array.isArray(point)) {
    const v = point.resolve(ctx);
    if (Array.isArray(v) && v.length >= 2) {
      return [resolveComponent(v[0], ctx), resolveComponent(v[1], ctx)];
    }
  }
  if (Array.isArray(point) && point.length >= 2) {
    return [resolveComponent(point[0], ctx), resolveComponent(point[1], ctx)];
  }
  throw new TypeError(`Cannot resolve point: ${String(point)}`);
}

/** Collect positionables closed over by a point (for deps / cycles). */
function collectSources(point, into = new Set()) {
  if (point == null) return into;
  if (Array.isArray(point)) {
    for (const c of point) collectSources(c, into);
    return into;
  }
  if (typeof point === "object") {
    if (point.source != null) into.add(point.source);
    if (Array.isArray(point.sources)) {
      for (const s of point.sources) if (s != null) into.add(s);
    }
  }
  return into;
}

function edge(p, name) {
  return Anchor(() => p[name](), { source: p });
}

const Anchors = {
  top: (p) => edge(p, "top"),
  left: (p) => edge(p, "left"),
  bottom: (p) => edge(p, "bottom"),
  right: (p) => edge(p, "right"),
  middle: (p) => edge(p, "middle"),
  center: (p) => edge(p, "center"),

  topLeft: (p) =>
    PointAnchor(() => [p.top(), p.left()], { source: p }),
  topRight: (p) =>
    PointAnchor(() => [p.top(), p.right()], { source: p }),
  bottomLeft: (p) =>
    PointAnchor(() => [p.bottom(), p.left()], { source: p }),
  bottomRight: (p) =>
    PointAnchor(() => [p.bottom(), p.right()], { source: p }),
  middleCenter: (p) =>
    PointAnchor(() => [p.middle(), p.center()], { source: p }),
};

export {
  Anchor,
  PointAnchor,
  Anchors,
  resolveComponent,
  resolvePoint,
  collectSources,
};
export default Anchors;
