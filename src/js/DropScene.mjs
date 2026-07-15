/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import { randomChoice } from "./util.mjs";

const MODES = Object.freeze(["hidden", "revealing", "revealed", "hiding"]);
const ACTIVE = Object.freeze(new Set(["revealing", "hiding"]));
const STABLE = Object.freeze(new Set(["hidden", "revealed"]));

// Points + column selection + mode machine. DropManager acts only while active.
// Optional Storm rate speeds column coverage during revealing/hiding.
function DropScene(...args) {
  if (!new.target) return new DropScene(...args);
  const self = this;
  const opts = args[0] ?? {};

  self.name = opts.name ?? "scene";
  self.priority = opts.priority ?? 10;

  // Shared position objects (may also live on DisplayText.positions).
  const raw = opts.points ?? opts.cells ?? [];
  self.points = Array.isArray(raw) ? raw : Array.from(raw ?? []);
  for (const p of self.points) {
    if (p.revealed === undefined) p.revealed = false;
  }
  self.positions = self.points;

  self.columns = opts.columns
    ? new Set(opts.columns)
    : new Set(self.points.map((p) => p.c));

  self.columnsSelected = new Set();
  self.mode = opts.mode && MODES.includes(opts.mode) ? opts.mode : "hidden";
  self.isComplete = false;

  // Optional Storm: rate while active.
  self.stormAccumulator = opts.stormAccumulator ?? opts.accumulator ?? null;
  self.infinite = false;

  const listeners = new Map();

  self.on = (event, fn) => {
    if (typeof fn !== "function") return () => {};
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(fn);
    return () => set.delete(fn);
  };

  self.off = (event, fn) => {
    listeners.get(event)?.delete(fn);
  };

  const emit = (event, detail) => {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(detail);
      } catch {
        // ignore listener errors
      }
    }
  };
  self.emit = emit;

  self.isModeActive = () => ACTIVE.has(self.mode);
  self.isModeStable = () => STABLE.has(self.mode);

  // DropManager spawn-source flag (active mode and not settled).
  Object.defineProperty(self, "isActive", {
    get: () => ACTIVE.has(self.mode) && !self.isComplete,
    enumerable: true,
  });

  self.hasPoint = (r, c) => self.points.some((p) => p.r === r && p.c === c);

  const allPointsRevealed = () =>
    self.points.length === 0 || self.points.every((p) => p.revealed);

  const allPointsHidden = () =>
    self.points.length === 0 || self.points.every((p) => !p.revealed);

  const rebuildSelection = () => {
    self.columnsSelected = new Set(self.columns);
  };

  const settleIfDone = () => {
    if (!ACTIVE.has(self.mode)) return false;
    if (self.columnsSelected.size > 0) return false;

    if (self.mode === "revealing") {
      if (!allPointsRevealed()) return false;
      self.mode = "revealed";
      self.isComplete = true;
      emit("completed", { scene: self, mode: "revealed" });
      emit("modeEnter", { scene: self, mode: "revealed" });
      return true;
    }

    if (self.mode === "hiding") {
      if (!allPointsHidden()) return false;
      self.mode = "hidden";
      self.isComplete = true;
      emit("completed", { scene: self, mode: "hidden" });
      emit("modeEnter", { scene: self, mode: "hidden" });
      return true;
    }
    return false;
  };

  // hiding always resets columnsSelected; revealing builds it.
  self.enterMode = (next) => {
    if (!MODES.includes(next)) {
      throw new Error(`DropScene.enterMode: unknown mode ${next}`);
    }
    const prev = self.mode;
    self.mode = next;
    self.isComplete = false;

    if (next === "revealing" || next === "hiding") {
      rebuildSelection();
      self.stormAccumulator?.reset?.();
      emit("modeEnter", { scene: self, mode: next, prev });
      emit("started", { scene: self, mode: next });
      settleIfDone();
      return self;
    }

    self.columnsSelected = new Set();
    if (next === "revealed") {
      for (const p of self.points) p.revealed = true;
      self.isComplete = true;
    }
    if (next === "hidden") {
      for (const p of self.points) p.revealed = false;
      self.isComplete = false;
    }
    emit("modeEnter", { scene: self, mode: next, prev });
    return self;
  };

  // Spawn on col: drain selection while active. Stable scenes ignore.
  self.onColumnSpawned = (col) => {
    if (!ACTIVE.has(self.mode) || self.isComplete) return false;
    if (!self.columnsSelected.has(col)) return false;
    self.columnsSelected.delete(col);
    emit("dropSelected", { scene: self, col });
    settleIfDone();
    return true;
  };

  self.markColumnCovered = (col) => self.onColumnSpawned(col);

  self.notifyPointRevealed = (r, c) => {
    let newly = false;
    for (const p of self.points) {
      if (p.r === r && p.c === c && !p.revealed) {
        p.revealed = true;
        newly = true;
      }
    }
    if (newly) {
      emit("pointRevealed", { scene: self, r, c });
      settleIfDone();
    }
    return newly;
  };

  self.notifyPointHidden = (r, c) => {
    let newly = false;
    for (const p of self.points) {
      if (p.r === r && p.c === c && p.revealed) {
        p.revealed = false;
        newly = true;
      }
    }
    if (newly) {
      emit("pointHidden", { scene: self, r, c });
      settleIfDone();
    }
    return newly;
  };

  self.markRevealed = (r, c) => self.notifyPointRevealed(r, c);
  self.markHidden = (r, c) => self.notifyPointHidden(r, c);

  self.unrevealedColumns = () => {
    const cols = new Set();
    for (const p of self.points) {
      if (!p.revealed) cols.add(p.c);
    }
    return cols;
  };

  self.columnFullyRevealed = (col) => {
    let any = false;
    for (const p of self.points) {
      if (p.c !== col) continue;
      any = true;
      if (!p.revealed) return false;
    }
    return any;
  };

  self.syncCompletion = () => settleIfDone();

  // Storm pick: without replacement from columnsSelected ∩ free.
  self.pickColumns = (count, freeColumns) => {
    if (count <= 0 || !self.isActive || !self.stormAccumulator) return [];
    if (self.columnsSelected.size === 0) {
      settleIfDone();
      return [];
    }
    const pool = freeColumns.filter((c) => self.columnsSelected.has(c));
    if (pool.length === 0) return [];

    const picked = [];
    const available = new Set(pool);
    for (let i = 0; i < count && available.size > 0; i++) {
      const col = randomChoice(available);
      available.delete(col);
      picked.push(col);
    }
    return picked;
  };

  let enterTimer = null;
  if (opts.enterModeAfterMs != null && opts.enterModeAfterMs >= 0) {
    const target = opts.enterModeOnStart ?? "revealing";
    if (opts.enterModeAfterMs === 0) {
      self.enterMode(target);
    } else {
      enterTimer = setTimeout(() => self.enterMode(target), opts.enterModeAfterMs);
    }
  }

  self.cancel = () => {
    if (enterTimer !== null) {
      clearTimeout(enterTimer);
      enterTimer = null;
    }
  };

  if (ACTIVE.has(self.mode) && self.columnsSelected.size === 0) {
    rebuildSelection();
  }
}

// Layout binding for F: positionable.cells()/points() → scene points.
DropScene.from = (positionable, opts = {}) => {
  const cells =
    typeof positionable?.cells === "function"
      ? positionable.cells()
      : typeof positionable?.points === "function"
        ? positionable.points()
        : [];
  return DropScene({ ...opts, points: cells });
};

DropScene.MODES = MODES;
DropScene.ACTIVE_MODES = ACTIVE;
DropScene.STABLE_MODES = STABLE;

export { DropScene, MODES, ACTIVE, STABLE };
export default DropScene;

// ===========================================================
// Smoke tests: node src/js/DropScene.mjs
// ===========================================================
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (await import("node:url")).pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  const assert = (await import("node:assert/strict")).default;

  console.log("Running DropScene smoke tests...");

  const pts = [
    { r: 0, c: 1, char: "A", revealed: false },
    { r: 0, c: 2, char: "B", revealed: false },
  ];
  const scene = DropScene({ name: "t", points: pts });
  assert.equal(scene.mode, "hidden");
  assert.equal(scene.isModeActive(), false);
  assert.equal(scene.isActive, false);

  const events = [];
  scene.on("started", (d) => events.push(["started", d.mode]));
  scene.on("dropSelected", (d) => events.push(["dropSelected", d.col]));
  scene.on("completed", (d) => events.push(["completed", d.mode]));
  scene.on("modeEnter", (d) => events.push(["modeEnter", d.mode]));

  scene.enterMode("revealing");
  assert.equal(scene.mode, "revealing");
  assert.equal(scene.isActive, true);
  assert.equal(scene.columnsSelected.size, 2);
  assert.ok(events.some((e) => e[0] === "started"));

  scene.onColumnSpawned(1);
  assert.equal(scene.columnsSelected.size, 1);
  assert.ok(events.some((e) => e[0] === "dropSelected" && e[1] === 1));

  // Hide path resets full set.
  scene.enterMode("hiding");
  assert.equal(scene.mode, "hiding");
  assert.equal(scene.columnsSelected.size, 2);

  scene.onColumnSpawned(1);
  scene.onColumnSpawned(2);
  assert.equal(scene.columnsSelected.size, 0);
  assert.equal(scene.mode, "hidden");
  assert.ok(events.some((e) => e[0] === "completed" && e[1] === "hidden"));

  // Reveal path: selection empty then points → revealed
  const pts2 = [
    { r: 1, c: 3, char: "X", revealed: false },
    { r: 1, c: 4, char: "Y", revealed: false },
  ];
  const rev = DropScene({ name: "rev", points: pts2 });
  rev.enterMode("revealing");
  rev.onColumnSpawned(3);
  rev.onColumnSpawned(4);
  assert.equal(rev.mode, "revealing");
  rev.notifyPointRevealed(1, 3);
  rev.notifyPointRevealed(1, 4);
  assert.equal(rev.mode, "revealed");

  // Stable scenes ignore column spawn
  const stable = DropScene({
    name: "s",
    points: [{ r: 0, c: 0, char: "Z", revealed: true }],
    mode: "revealed",
  });
  assert.equal(stable.onColumnSpawned(0), false);

  const fakePos = { cells: () => [{ r: 2, c: 5, char: "Q" }] };
  const from = DropScene.from(fakePos, { name: "from" });
  assert.equal(from.points.length, 1);
  assert.ok(from.columns.has(5));

  // Layout-group shape: cells() aggregate (F glue).
  const groupLike = {
    cells: () => [
      { r: 0, c: 10, char: "L", href: "/x", lineId: 0 },
      { r: 1, c: 10, char: "M", href: "/x", lineId: 1 },
      { r: 1, c: 11, char: "N", href: "/x", lineId: 1 },
    ],
  };
  const glued = DropScene.from(groupLike, { name: "roles-reveal", mode: "hidden" });
  assert.equal(glued.mode, "hidden");
  assert.equal(glued.points.length, 3);
  assert.equal(glued.columns.size, 2);
  glued.enterMode("revealing");
  assert.equal(glued.mode, "revealing");
  assert.equal(glued.columnsSelected.size, 2);
  glued.onColumnSpawned(10);
  glued.onColumnSpawned(11);
  assert.equal(glued.columnsSelected.size, 0);
  assert.equal(glued.mode, "revealing"); // points not yet shown
  for (const p of glued.points) glued.notifyPointRevealed(p.r, p.c);
  assert.equal(glued.mode, "revealed");
  assert.equal(glued.isComplete, true);
  // Stable: no set drain
  assert.equal(glued.onColumnSpawned(10), false);

  const green = (t) => `\x1b[32m${t}\x1b[0m`;
  console.log(`DropScene smoke tests passed! ${green("✓")}`);
}
