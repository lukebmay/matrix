/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import state from "./State.mjs";

const cellKey = (r, c) => `${r},${c}`;

// Logical grid = intentional content only. Rain never writes here.
// Resolve on tip-enter: newest active reveal → active hide → rain.
function SceneManager(...args) {
  if (!new.target) return new SceneManager(...args);
  const self = this;
  const opts = args[0] ?? {};

  // "r,c" → { char, style, href, lineId }  (present ⇒ should show)
  const logical = new Map();

  self.cellKey = cellKey;
  self.getLogical = (r, c) => logical.get(cellKey(r, c)) ?? null;

  self.clearLogical = (r, c) => {
    logical.delete(cellKey(r, c));
  };

  // Remove intentional content for every cell a scene owns. Returns keys cleared.
  self.clearLogicalForScene = (scene) => {
    const cleared = [];
    if (!scene?.cellMap) return cleared;
    for (const key of scene.cellMap.keys()) {
      if (logical.delete(key)) cleared.push(key);
    }
    return cleared;
  };

  self.clearAllLogical = () => {
    logical.clear();
  };

  const scenes = () => opts.scenes ?? state.dropScenes ?? [];

  const activeReveals = () =>
    scenes()
      .filter((s) => s.mode === "revealing" && !s.isComplete)
      .sort((a, b) => (b.modeEnteredAt ?? 0) - (a.modeEnteredAt ?? 0));

  const activeHides = () =>
    scenes().filter((s) => s.mode === "hiding" && !s.isComplete);

  // First match wins. Reveal > hide; newest reveal wins.
  self.resolve = (r, c, drop = null) => {
    const key = cellKey(r, c);

    for (const s of activeReveals()) {
      if (drop != null && s.dropAffects?.(drop) === false) continue;
      const cell = s.cellMap?.get(key);
      if (!cell) continue;
      // Spaces are not intentional content (TextLine skips them).
      if (cell.char == null || cell.char === "" || cell.char === " ") continue;
      return {
        kind: "reveal",
        scene: s,
        char: cell.char,
        style: cell.style ?? s.defaultStyle ?? null,
        href: cell.href ?? null,
        lineId: cell.lineId,
      };
    }

    for (const s of activeHides()) {
      if (drop != null && s.dropAffects?.(drop) === false) continue;
      if (!s.cellMap?.has(key)) continue;
      return {
        kind: "hide",
        scene: s,
        char: null,
        style: null,
        href: null,
        lineId: undefined,
      };
    }

    return { kind: "rain", char: null, style: null, href: null };
  };

  // Tip first entered (r,c): resolve once, write/clear logical. No rain writes.
  // Returns paint descriptor for DomManager.
  self.applyTip = (r, c, drop) => {
    const key = cellKey(r, c);
    const res = self.resolve(r, c, drop);

    if (res.kind === "reveal") {
      const entry = {
        char: res.char,
        style: res.style,
        href: res.href,
        lineId: res.lineId,
      };
      logical.set(key, entry);
      state.dropManager?.notifyCellRevealed?.(r, c);
      return { ...entry, kind: "reveal", revealed: true };
    }

    if (res.kind === "hide") {
      logical.delete(key);
      state.dropManager?.notifyCellHidden?.(r, c);
      return {
        char: null,
        style: null,
        href: null,
        kind: "hide",
        revealed: false,
      };
    }

    // Rain / no active scene: leave logical untouched.
    const prev = logical.get(key);
    if (prev?.char && prev.char !== " ") {
      return { ...prev, kind: "content", revealed: true };
    }
    return {
      char: null,
      style: null,
      href: null,
      kind: "rain",
      revealed: false,
    };
  };

  // What DOM should show for intentional content (no side effects).
  self.paintGlyph = (r, c) => {
    const entry = logical.get(cellKey(r, c));
    if (entry?.char && entry.char !== " ") {
      return {
        text: entry.char,
        revealed: true,
        style: entry.style ?? null,
        href: entry.href ?? null,
        lineId: entry.lineId,
      };
    }
    return { text: null, revealed: false, style: null, href: null };
  };

  self.isContentRevealed = (r, c) => {
    const e = logical.get(cellKey(r, c));
    return !!(e?.char && e.char !== " ");
  };
}

export { SceneManager, cellKey };
export default SceneManager;

// ===========================================================
// Smoke tests: node src/js/SceneManager.mjs
// ===========================================================
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (await import("node:url")).pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  const assert = (await import("node:assert/strict")).default;
  const { DropScene } = await import("./DropScene.mjs");

  console.log("Running SceneManager smoke tests...");

  const revA = DropScene({
    name: "a",
    points: [{ r: 1, c: 2, char: "A", href: "/a", style: "link" }],
  });
  const revB = DropScene({
    name: "b",
    points: [{ r: 1, c: 2, char: "B" }],
  });
  const hide = DropScene({
    name: "h",
    points: [{ r: 1, c: 2, char: "A" }],
  });

  const sm = SceneManager({ scenes: [revA, revB, hide] });

  revA.enterMode("revealing");
  revA.modeEnteredAt = 100;
  revB.enterMode("revealing");
  revB.modeEnteredAt = 200;
  hide.enterMode("hiding");
  hide.modeEnteredAt = 300;

  const drop = { spawnAt: 1000 };
  // Newest reveal (B) wins over older reveal and over hide.
  const res = sm.resolve(1, 2, drop);
  assert.equal(res.kind, "reveal");
  assert.equal(res.char, "B");
  assert.equal(res.scene.name, "b");

  revB.enterMode("hidden");
  const res2 = sm.resolve(1, 2, drop);
  assert.equal(res2.kind, "reveal");
  assert.equal(res2.char, "A");
  assert.equal(res2.href, "/a");

  const applied = sm.applyTip(1, 2, drop);
  assert.equal(applied.kind, "reveal");
  assert.equal(applied.char, "A");
  assert.equal(sm.paintGlyph(1, 2).text, "A");
  assert.equal(sm.paintGlyph(1, 2).href, "/a");
  assert.equal(sm.isContentRevealed(1, 2), true);

  // Rain tip must not invent logical content.
  const rainOnly = sm.applyTip(9, 9, drop);
  assert.equal(rainOnly.kind, "rain");
  assert.equal(sm.getLogical(9, 9), null);
  assert.equal(sm.paintGlyph(9, 9).revealed, false);

  // After scene settles (no active reveal/hide), rain tip keeps logical content.
  revA.enterMode("revealed");
  hide.enterMode("hidden");
  const keep = sm.applyTip(1, 2, drop);
  assert.equal(keep.kind, "content");
  assert.equal(keep.char, "A");
  assert.equal(sm.getLogical(1, 2)?.char, "A");

  // Hide only acts while a hide scene is active.
  hide.enterMode("hiding");
  hide.modeEnteredAt = 50;
  const res3 = sm.resolve(1, 2, drop);
  assert.equal(res3.kind, "hide");

  const hidden = sm.applyTip(1, 2, drop);
  assert.equal(hidden.kind, "hide");
  assert.equal(sm.getLogical(1, 2), null);
  assert.equal(sm.paintGlyph(1, 2).revealed, false);

  // Pre-activation drop must not reveal or hide.
  revA.enterMode("revealing");
  revA.modeEnteredAt = 500;
  hide.enterMode("hidden");
  const preDrop = { spawnAt: 100 };
  assert.equal(sm.resolve(1, 2, preDrop).kind, "rain");
  assert.equal(sm.applyTip(1, 2, preDrop).kind, "rain");
  assert.equal(sm.getLogical(1, 2), null);
  const postDrop = { spawnAt: 600 };
  assert.equal(sm.applyTip(1, 2, postDrop).kind, "reveal");
  assert.equal(sm.getLogical(1, 2)?.char, "A");

  // Force-clear scene cells (ScenePlayer abort).
  const cleared = sm.clearLogicalForScene(revA);
  assert.ok(cleared.includes("1,2"));
  assert.equal(sm.isContentRevealed(1, 2), false);

  const green = (t) => `\x1b[32m${t}\x1b[0m`;
  console.log(`SceneManager smoke tests passed! ${green("✓")}`);
}
