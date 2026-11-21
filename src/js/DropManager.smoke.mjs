/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import { DropManager, maxSafeStackSpeed } from "./DropManager.mjs";

// ===========================================================
// Smoke tests (async IIFE — no top-level await).
// Safari/WebKit TLA module-graph bugs break DDG iOS (WebKit).
// ===========================================================
if (typeof process !== "undefined" && process.argv?.[1]) {
  void (async () => {
    const { pathToFileURL } = await import("node:url");
    if (pathToFileURL(process.argv[1]).href !== import.meta.url) return;

    const assert = (await import("node:assert/strict")).default;

    console.log("Running DropManager smoke tests...");

    // --- maxSafeStackSpeed ---
    {
      // rows=20, leader at 5 speed 10 → t=(19-5)/10=1.4; F≤18 → vF≤18/1.4
      const v = maxSafeStackSpeed({ _row: 5, speed: 10 }, { rows: 20 });
      assert.ok(Math.abs(v - 18 / 1.4) < 1e-9, `expected ~12.857 got ${v}`);

      // At that speed, when L hits 19, F hits 18 (one behind).
      const t = (19 - 5) / 10;
      assert.ok(Math.abs(5 + 10 * t - (0 + v * t) - 1) < 1e-9);

      // No head start → 0 (do not stack).
      assert.equal(maxSafeStackSpeed({ _row: 0.5, speed: 10 }, { rows: 20 }), 0);
      assert.equal(maxSafeStackSpeed({ _row: 0, speed: 10 }, { rows: 20 }), 0);

      // Leader already on final row → match speed.
      assert.equal(maxSafeStackSpeed({ _row: 19, speed: 12 }, { rows: 20 }), 12);

      // Bad inputs.
      assert.equal(maxSafeStackSpeed(null, { rows: 20 }), 0);
      assert.equal(maxSafeStackSpeed({ _row: 5, speed: 0 }, { rows: 20 }), 0);
    }

    // --- occupancy / rain one-per-col / storm stack ---
    {
      const { default: stateMod } = await import("./State.mjs");
      const { default: DropScene } = await import("./DropScene.mjs");
      const { default: Rain } = await import("./Rain.mjs");
      const { VariableRateAccumulator } = await import("./util.mjs");

      stateMod.config = {
        COLS: 5,
        ROWS: 20,
        DROP_SPEED_MIN: 8,
        DROP_SPEED_MAX: 20,
        STORM_DROP_SPEED_MIN: 11,
        STORM_DROP_SPEED_MAX: 20,
        DROP_LENGTH_MIN: 4,
        DROP_LENGTH_MAX: 8,
      };

      if (typeof globalThis.performance === "undefined") {
        globalThis.performance = { now: () => Date.now() };
      }

      // High avg units/s so a short frame still yields ≥1 spawn.
      const rain = Rain({
        cols: 5,
        accumulator: VariableRateAccumulator(200, Infinity, () => 1),
      });
      const pts = [
        { r: 2, c: 1, char: "A", revealed: false },
        { r: 2, c: 2, char: "B", revealed: false },
        { r: 2, c: 3, char: "C", revealed: false },
      ];
      const scene = DropScene({
        name: "stack-test",
        points: pts,
        priority: 10,
        stormAccumulator: VariableRateAccumulator(10, 5, () => 1),
      });
      scene.enterMode("revealing");

      stateMod.rain = rain;
      stateMod.dropScenes = [scene];
      stateMod.contentLayers = [];

      const dm = DropManager();

      // Occupy col 1 via rain only (storm off); first-pass forced to {1}.
      scene.stormEnabled = false;
      rain.firstPass = new Set([1]);
      dm.updateDrops(0.05);
      assert.equal(dm.getDropsOn(1).length, 1, "squatter on col 1");
      assert.equal(dm.getDrops().length, 1);

      // Rain drained active selection on spawn — restore for squat simulation
      // (pre-activation drop would not have counted as coverage).
      scene.columnsSelected = new Set([1, 2, 3]);
      scene.startStorm();
      // Burst storm budget so free selected + stack all fire this frame.
      scene.stormAccumulator = VariableRateAccumulator(20, 1, () => 1);

      const squatter = dm.getDropsOn(1)[0];
      squatter._row = 6;
      squatter.speed = 10;

      // free ∩ selected = {2,3}; stackable = {1} once free selected drained.
      dm.updateDrops(0.5);

      const on1 = dm.getDropsOn(1);
      assert.ok(on1.length >= 2, `storm stacked on col 1, got ${on1.length}`);

      const lead = on1.reduce((a, b) => (a._row >= b._row ? a : b));
      const follower = on1.find((d) => d !== lead);
      assert.ok(follower, "follower exists");
      const cap = maxSafeStackSpeed(lead, { rows: 20 });
      assert.ok(
        follower.speed <= cap + 1e-9,
        `follower speed ${follower.speed} > maxSafe ${cap}`,
      );

      // Rain still one-per-col on occupied.
      const before = dm.getDropsOn(1).length;
      scene.stormEnabled = false;
      rain.firstPass = new Set();
      rain.accumulator = VariableRateAccumulator(200, Infinity, () => 1);
      dm.updateDrops(0.05);
      assert.equal(
        dm.getDropsOn(1).length,
        before,
        "rain does not stack on occupied col",
      );

      // Re-activation must not pile a 3rd drop while the pair is still live.
      assert.equal(dm.getDropsOn(1).length, 2, "pair before re-activate");
      scene.enterMode("revealing");
      scene.startStorm();
      scene.stormAccumulator = VariableRateAccumulator(20, 1, () => 1);
      scene.columnsSelected = new Set([1]);
      const pair = dm.getDropsOn(1);
      for (const d of pair) {
        d._row = 6;
        d.speed = 10;
      }
      dm.updateDrops(0.5);
      assert.equal(
        dm.getDropsOn(1).length,
        2,
        "cap 2 live drops/col across re-activation",
      );

      // Clear: finished col only when every drop on it is gone.
      for (const d of dm.getDrops()) d.isComplete = true;
      dm.killCompletedDrops();
      assert.equal(dm.getDrops().length, 0);
      const finished = dm.takeFinishedColumns();
      assert.ok(finished.includes(1));
    }

    // --- DropScene free-then-stack pick ---
    {
      const { default: DropScene } = await import("./DropScene.mjs");
      const { VariableRateAccumulator } = await import("./util.mjs");
      if (typeof globalThis.performance === "undefined") {
        globalThis.performance = { now: () => Date.now() };
      }
      const scene = DropScene({
        name: "pick",
        points: [
          { r: 0, c: 0, char: "a" },
          { r: 0, c: 1, char: "b" },
          { r: 0, c: 2, char: "c" },
        ],
        stormAccumulator: VariableRateAccumulator(1, 10, () => 1),
      });
      scene.enterMode("revealing");
      scene.startStorm();
      // Free: 0; stackable: 1,2. Want 2 → free first then one stack.
      const picked = scene.pickColumns(2, [0], [1, 2]);
      assert.equal(picked.length, 2);
      assert.equal(picked[0], 0, "free preferred first");
      assert.ok([1, 2].includes(picked[1]), "second from stackable");

      // Only stackable left.
      const onlyStack = scene.pickColumns(1, [], [1, 2]);
      assert.equal(onlyStack.length, 1);
      assert.ok([1, 2].includes(onlyStack[0]));
    }

    // --- Weather scale: no storm stack when ALLOW_STORM_STACK false ---
    {
      const { default: stateMod } = await import("./State.mjs");
      const { default: DropScene } = await import("./DropScene.mjs");
      const { default: Rain } = await import("./Rain.mjs");
      const { VariableRateAccumulator } = await import("./util.mjs");

      stateMod.config = {
        COLS: 4,
        ROWS: 20,
        DROP_SPEED_MIN: 8,
        DROP_SPEED_MAX: 20,
        STORM_DROP_SPEED_MIN: 11,
        STORM_DROP_SPEED_MAX: 20,
        DROP_LENGTH_MIN: 4,
        DROP_LENGTH_MAX: 8,
        ALLOW_STORM_STACK: false,
        WEATHER_SCALE: true,
        WEATHER_LENGTH_SCALE: 0.6,
      };
      stateMod.weatherScale = true;
      stateMod.allowStormStack = false;

      if (typeof globalThis.performance === "undefined") {
        globalThis.performance = { now: () => Date.now() };
      }

      const rain = Rain({
        cols: 4,
        accumulator: VariableRateAccumulator(200, Infinity, () => 1),
      });
      const pts = [
        { r: 2, c: 1, char: "A", revealed: false },
        { r: 2, c: 2, char: "B", revealed: false },
      ];
      const scene = DropScene({
        name: "no-stack",
        points: pts,
        priority: 10,
        stormAccumulator: VariableRateAccumulator(10, 5, () => 1),
      });
      scene.enterMode("revealing");

      stateMod.rain = rain;
      stateMod.dropScenes = [scene];
      stateMod.contentLayers = [];

      const dm = DropManager();

      // Squatter on col 1 (rain only).
      scene.stormEnabled = false;
      rain.firstPass = new Set([1]);
      dm.updateDrops(0.05);
      assert.equal(dm.getDropsOn(1).length, 1, "squatter on col 1");

      scene.columnsSelected = new Set([1, 2]);
      scene.startStorm();
      scene.stormAccumulator = VariableRateAccumulator(20, 1, () => 1);
      const squatter = dm.getDropsOn(1)[0];
      squatter._row = 6;
      squatter.speed = 10;

      dm.updateDrops(0.5);
      assert.equal(
        dm.getDropsOn(1).length,
        1,
        "weather scale: storm does not stack on occupied col",
      );
      // Free selected col 2 should still get a storm drop.
      assert.ok(
        dm.getDropsOn(2).length >= 1,
        "free selected col still storm-spawned",
      );

      stateMod.weatherScale = null;
      stateMod.allowStormStack = null;
    }

    // --- Ambient rain paused while a content storm still has columns ---
    {
      const { default: stateMod } = await import("./State.mjs");
      const { default: DropScene } = await import("./DropScene.mjs");
      const { default: Rain } = await import("./Rain.mjs");
      const { VariableRateAccumulator } = await import("./util.mjs");

      stateMod.config = {
        COLS: 6,
        ROWS: 20,
        DROP_SPEED_MIN: 8,
        DROP_SPEED_MAX: 18,
        STORM_DROP_SPEED_MIN: 11,
        STORM_DROP_SPEED_MAX: 18,
        DROP_LENGTH_MIN: 5,
        DROP_LENGTH_MAX: 8,
        ALLOW_STORM_STACK: false,
        PAUSE_RAIN_DURING_STORM: true,
        WEATHER_LENGTH_SCALE: 0.6,
      };
      stateMod.weatherScale = null;
      stateMod.allowStormStack = false;

      if (typeof globalThis.performance === "undefined") {
        globalThis.performance = { now: () => Date.now() };
      }

      // Huge ambient want so any rain spawn would show up immediately.
      const rain = Rain({
        cols: 6,
        accumulator: VariableRateAccumulator(500, Infinity, () => 50),
      });
      // Slow storm: stays active after one short settle (selection not emptied).
      const scene = DropScene({
        name: "pause-rain",
        points: [
          { r: 2, c: 0, char: "A", revealed: false },
          { r: 2, c: 1, char: "B", revealed: false },
          { r: 2, c: 2, char: "C", revealed: false },
          { r: 2, c: 3, char: "D", revealed: false },
        ],
        priority: 10,
        stormAccumulator: VariableRateAccumulator(20, 20, () => 0.2),
      });
      scene.enterMode("revealing");
      scene.startStorm();

      stateMod.rain = rain;
      stateMod.dropScenes = [scene];
      stateMod.contentLayers = [];

      const dm = DropManager();
      dm.settleDrops(0.05);

      assert.equal(scene.stormEnabled, true, "storm still active mid-coverage");
      // Free cols outside the scene must stay empty (ambient rain off).
      assert.equal(dm.getDropsOn(4).length, 0, "no ambient rain on free col 4");
      assert.equal(dm.getDropsOn(5).length, 0, "no ambient rain on free col 5");
      // Soft-square clock frozen: rain acc time does not advance while paused.
      const rainTimeDuring = rain.accumulator.currentTime ?? null;

      // After storm stops, ambient rain may spawn on free cols again.
      scene.stopStorm();
      scene.enterMode("revealed");
      dm.settleDrops(0.1);
      assert.ok(
        dm.getDropsOn(4).length + dm.getDropsOn(5).length >= 1,
        "ambient rain resumes after storm",
      );
      if (rainTimeDuring != null && rain.accumulator.currentTime != null) {
        assert.ok(
          rain.accumulator.currentTime > rainTimeDuring,
          "rain clock advances only after storm",
        );
      }

      stateMod.weatherScale = null;
      stateMod.allowStormStack = null;
    }

    // --- Large dt: paint before kill flushes tip rows (Matrix frame order) ---
    {
      const { default: stateMod } = await import("./State.mjs");
      const { default: DropScene } = await import("./DropScene.mjs");
      const { default: Rain } = await import("./Rain.mjs");
      const { default: SceneManager } = await import("./SceneManager.mjs");
      const { VariableRateAccumulator } = await import("./util.mjs");
      if (typeof globalThis.performance === "undefined") {
        globalThis.performance = { now: () => Date.now() };
      }

      stateMod.config = {
        COLS: 4,
        ROWS: 20,
        DROP_SPEED_MIN: 10,
        DROP_SPEED_MAX: 20,
        STORM_DROP_SPEED_MIN: 20,
        STORM_DROP_SPEED_MAX: 20,
        DROP_LENGTH_MIN: 4,
        DROP_LENGTH_MAX: 8,
      };

      const rain = Rain({
        cols: 4,
        accumulator: VariableRateAccumulator(0.001, Infinity, () => 0.001),
      });
      const pts = [
        { r: 5, c: 1, char: "A", revealed: true },
        { r: 12, c: 1, char: "B", revealed: true },
      ];
      const scene = DropScene({
        name: "large-dt-hide",
        points: pts,
        priority: 20,
        // Burst: all units in one settle tick.
        stormAccumulator: VariableRateAccumulator(4, 1, () => 1),
      });
      stateMod.rain = rain;
      stateMod.dropScenes = [scene];
      stateMod.contentLayers = [];
      stateMod.sceneManager = SceneManager({ scenes: [scene] });
      stateMod.sceneManager.applyLogicalForScene(scene);

      const dm = DropManager();
      stateMod.dropManager = dm;

      const lastTip = new WeakMap();
      const paintLikeDom = () => {
        for (const d of dm.getDrops()) {
          const r = d.getRow();
          const pr = lastTip.has(d) ? lastTip.get(d) : null;
          const from = pr == null ? 0 : pr + 1;
          const to = Math.min(r, 19);
          for (let row = from; row <= to; row++) {
            if (row >= 0) stateMod.sceneManager.applyTip(row, d.col, d);
          }
          lastTip.set(d, r);
        }
      };

      scene.enterMode("hiding");
      // Rebuild burst after enterMode reset.
      scene.stormAccumulator = VariableRateAccumulator(4, 0.05, () => 1);
      scene.startStorm();

      // Spawn (settle after empty paint — new drops appear post-paint).
      dm.advanceDrops(0.05);
      paintLikeDom();
      dm.settleDrops(0.05);
      assert.ok(dm.getDrops().length >= 1, "storm spawned");
      assert.equal(scene.columnsSelected.has(1), false, "col claimed on spawn");

      // Force a completing jump; paint while still live, then settle.
      for (const d of dm.getDrops()) {
        d.speed = 80;
        d._row = 0;
      }
      dm.advanceDrops(1); // → row 80, complete
      const stillLive = dm.getDrops().filter((d) => d.isComplete);
      assert.ok(stillLive.length >= 1, "completed drops still in set for paint");
      paintLikeDom();
      assert.equal(pts.every((p) => !p.revealed), true, "tips flushed before kill");
      assert.equal(scene.mode, "hidden", "hide settles from large-dt flush");
      dm.settleDrops(0.05);
      assert.equal(dm.getDrops().filter((d) => d.isComplete).length, 0);
    }

    // --- Concurrent budget: max starts at COLS; fast path stays there ---
    {
      const { default: stateMod } = await import("./State.mjs");
      const { default: Rain } = await import("./Rain.mjs");
      const { VariableRateAccumulator } = await import("./util.mjs");

      stateMod.config = {
        COLS: 16,
        ROWS: 20,
        DROP_SPEED_MIN: 8,
        DROP_SPEED_MAX: 18,
        DROP_LENGTH_MIN: 4,
        DROP_LENGTH_MAX: 8,
        FRAME_DELAY: 75,
        INITIAL_DROP_MAX: 16,
        MIN_DROP_MAX: 12,
      };
      stateMod.weatherScale = null;
      stateMod.allowStormStack = null;

      if (typeof globalThis.performance === "undefined") {
        globalThis.performance = { now: () => Date.now() };
      }

      const rain = Rain({
        cols: 16,
        accumulator: VariableRateAccumulator(500, Infinity, () => 100),
      });
      stateMod.rain = rain;
      stateMod.dropScenes = [];
      stateMod.contentLayers = [];

      const dm = DropManager();
      assert.equal(dm.getMaxActiveDrops(), 16, "max starts at INITIAL/COLS");
      assert.equal(dm.getDropBudgetPhase(), "climb");

      // Grow live drops with cheap frame times; lock at COLS when full.
      for (let n = 0; n < 80 && dm.getDropBudgetPhase() === "climb"; n++) {
        dm.settleDrops(0.05);
        dm.noteFrameTiming(50, 1);
      }
      assert.equal(dm.getDropBudgetPhase(), "stable", "locks after filling COLS");
      assert.equal(dm.getMaxActiveDrops(), 16, "stays at INITIAL on fast path");
      assert.ok(
        dm.getActiveDropCount() <= dm.getMaxActiveDrops(),
        "live never exceeds maxActive",
      );
    }

    // --- 200ms 10-frame avg clamps max to current live (at/above MIN) ---
    {
      const { default: stateMod } = await import("./State.mjs");
      const { default: Rain } = await import("./Rain.mjs");
      const { VariableRateAccumulator } = await import("./util.mjs");

      stateMod.config = {
        COLS: 24,
        ROWS: 20,
        DROP_SPEED_MIN: 8,
        DROP_SPEED_MAX: 18,
        DROP_LENGTH_MIN: 4,
        DROP_LENGTH_MAX: 8,
        FRAME_DELAY: 75,
        INITIAL_DROP_MAX: 24,
        MIN_DROP_MAX: 12,
      };
      stateMod.weatherScale = null;
      stateMod.allowStormStack = null;
      if (typeof globalThis.performance === "undefined") {
        globalThis.performance = { now: () => Date.now() };
      }
      stateMod.rain = Rain({
        cols: 24,
        accumulator: VariableRateAccumulator(500, Infinity, () => 100),
      });
      stateMod.dropScenes = [];
      stateMod.contentLayers = [];

      const dm = DropManager();
      assert.equal(dm.getMaxActiveDrops(), 24, "starts open at COLS");

      // Grow live with expensive frames; must not clamp before MIN (12).
      for (let n = 0; n < 200 && dm.getActiveDropCount() < 12; n++) {
        dm.settleDrops(0.05);
        dm.noteFrameTiming(250, 1);
      }
      assert.ok(dm.getActiveDropCount() >= 12, "reached MIN live drops");
      assert.equal(dm.getDropBudgetPhase(), "climb", "still open below settle");
      assert.equal(dm.getMaxActiveDrops(), 24, "max still INITIAL before clamp");

      // Hold live ≥12 for 10 frames at 210ms → clamp to that live count.
      const liveAtClamp = dm.getActiveDropCount();
      for (let i = 0; i < 15; i++) {
        dm.noteFrameTiming(210, 1);
        if (dm.getDropBudgetPhase() === "stable") break;
      }
      assert.equal(dm.getDropBudgetPhase(), "stable", "200ms avg settles");
      assert.equal(
        dm.getMaxActiveDrops(),
        Math.max(12, liveAtClamp),
        "clamps max to live count at trip",
      );
    }

    // --- Rain pause for storm resets rate clock to trough ---
    {
      const { default: stateMod } = await import("./State.mjs");
      const { default: Rain } = await import("./Rain.mjs");

      stateMod.config = {
        COLS: 8,
        ROWS: 20,
        DROP_SPEED_MIN: 10,
        DROP_SPEED_MAX: 20,
        DROP_LENGTH_MIN: 4,
        DROP_LENGTH_MAX: 8,
        FRAME_DELAY: 75,
        ACTIVE_DROPS_MIN: 8,
        ACTIVE_DROPS_MAX: 8,
        PAUSE_RAIN_DURING_STORM: true,
        ALLOW_STORM_STACK: false,
      };
      stateMod.weatherScale = null;
      stateMod.allowStormStack = null;
      if (typeof globalThis.performance === "undefined") {
        globalThis.performance = { now: () => Date.now() };
      }

      let rainTime = 0;
      const acc = {
        advance(dt) {
          rainTime += dt;
          return 0;
        },
        reset() {
          rainTime = 0;
        },
        refund() {},
      };
      const rain = Rain({ cols: 8, accumulator: acc });
      stateMod.rain = rain;
      // Fake content storm active.
      stateMod.dropScenes = [
        {
          isActive: true,
          stormEnabled: true,
          stormStartSeq: 1,
          stormAccumulator: {
            advance: () => 0,
            refund() {},
          },
          columnsSelected: new Set([0, 1]),
          columns: new Set([0, 1]),
          priority: 10,
          infinite: false,
          isComplete: false,
          pickColumns: () => [],
          syncCompletion() {},
          stopStorm() {
            this.stormEnabled = false;
          },
        },
      ];
      stateMod.contentLayers = [];

      const dm = DropManager();
      // Advance rain rate clock a bit first (simulate mid-cycle).
      acc.advance(3);
      assert.ok(rainTime > 0, "rain clock advanced");
      // settleDrops runs startNewDrops — storm active should pause rain + reset.
      dm.settleDrops(0.05);
      assert.equal(rainTime, 0, "rain accumulator reset on storm pause");
    }

    // --- Max drops: ambient rain rate resets to 0 while cap is full ---
    {
      const { default: stateMod } = await import("./State.mjs");
      const { default: Rain } = await import("./Rain.mjs");
      const { VariableRateAccumulator } = await import("./util.mjs");

      stateMod.config = {
        COLS: 4,
        ROWS: 20,
        DROP_SPEED_MIN: 1,
        DROP_SPEED_MAX: 2,
        DROP_LENGTH_MIN: 4,
        DROP_LENGTH_MAX: 5,
        FRAME_DELAY: 75,
        ACTIVE_DROPS_MIN: 1,
        ACTIVE_DROPS_MAX: 1,
        ACTIVE_DROPS_CALIBRATE: false,
        PAUSE_RAIN_DURING_STORM: true,
        ALLOW_STORM_STACK: false,
      };
      if (typeof globalThis.performance === "undefined") {
        globalThis.performance = { now: () => Date.now() };
      }

      let rainTime = 0;
      let resetCount = 0;
      const acc = {
        advance(dt) {
          rainTime += dt;
          return 1;
        },
        reset() {
          rainTime = 0;
          resetCount += 1;
        },
        refund() {},
      };
      const rain = Rain({ cols: 4, accumulator: acc });
      stateMod.rain = rain;
      stateMod.dropScenes = [];
      stateMod.contentLayers = [];

      const dm = DropManager();
      // First tick fills the single drop slot.
      dm.settleDrops(0.05);
      assert.equal(dm.getDrops().length, 1, "one live drop at cap");
      // Mid-cycle advance then another tick at cap → must reset, not advance.
      acc.advance(2);
      assert.ok(rainTime > 0, "simulated mid-cycle rain time");
      const resetsBefore = resetCount;
      dm.settleDrops(0.05);
      assert.equal(dm.getDrops().length, 1, "still at cap");
      assert.ok(resetCount > resetsBefore, "rain reset while at max drops");
      assert.equal(rainTime, 0, "rain rate at trough while cap full");
    }

    // --- Storm FIFO: second activated storm waits until first finishes columns ---
    {
      const { default: stateMod } = await import("./State.mjs");
      const { default: DropScene } = await import("./DropScene.mjs");
      const { default: Rain } = await import("./Rain.mjs");
      const { VariableRateAccumulator } = await import("./util.mjs");

      stateMod.config = {
        COLS: 6,
        ROWS: 20,
        DROP_SPEED_MIN: 10,
        DROP_SPEED_MAX: 20,
        STORM_DROP_SPEED_MIN: 12,
        STORM_DROP_SPEED_MAX: 20,
        DROP_LENGTH_MIN: 4,
        DROP_LENGTH_MAX: 6,
        FRAME_DELAY: 75,
        ACTIVE_DROPS_MIN: 20,
        ACTIVE_DROPS_MAX: 20,
        ACTIVE_DROPS_CALIBRATE: false,
        PAUSE_RAIN_DURING_STORM: true,
        ALLOW_STORM_STACK: false,
      };
      stateMod.weatherScale = null;
      stateMod.allowStormStack = false;
      stateMod.stormStartSeq = 0;
      if (typeof globalThis.performance === "undefined") {
        globalThis.performance = { now: () => Date.now() };
      }

      // Quiet ambient rain so only storms spawn.
      const rain = Rain({
        cols: 6,
        accumulator: VariableRateAccumulator(0, Infinity, () => 0),
      });
      rain.firstPass = new Set();

      const first = DropScene({
        name: "storm-first",
        points: [
          { r: 1, c: 0, char: "A", revealed: false },
          { r: 1, c: 1, char: "B", revealed: false },
        ],
        priority: 10,
        // High unit budget so a single settle tick yields spawns.
        stormAccumulator: VariableRateAccumulator(20, 1, () => 1),
      });
      const second = DropScene({
        name: "storm-second",
        points: [
          { r: 2, c: 2, char: "C", revealed: false },
          { r: 2, c: 3, char: "D", revealed: false },
        ],
        priority: 10,
        stormAccumulator: VariableRateAccumulator(20, 1, () => 1),
      });
      first.enterMode("revealing");
      first.startStorm();
      // Re-arm burst after startStorm reset (same unit window, denser for smoke).
      first.stormAccumulator = VariableRateAccumulator(20, 1, () => 1);
      second.enterMode("revealing");
      second.startStorm();
      second.stormAccumulator = VariableRateAccumulator(20, 1, () => 1);
      assert.ok(
        first.stormStartSeq < second.stormStartSeq,
        "activation order recorded",
      );

      stateMod.rain = rain;
      stateMod.dropScenes = [second, first]; // reverse list order; FIFO by seq
      stateMod.contentLayers = [];

      const dm = DropManager();
      dm.settleDrops(0.2);

      // First storm may have spawned; second must not until first is done.
      assert.equal(
        second.columnsSelected.size,
        2,
        "second storm still full while first unfinished",
      );
      assert.equal(
        dm.getDropsOn(2).length + dm.getDropsOn(3).length,
        0,
        "no drops on second storm cols yet",
      );
      assert.ok(
        first.columnsSelected.size < 2 ||
          dm.getDropsOn(0).length + dm.getDropsOn(1).length >= 1,
        "first storm made progress",
      );

      // Finish first by covering its columns.
      first.columnsSelected = new Set();
      first.stopStorm();
      dm.settleDrops(0.2);
      assert.ok(
        dm.getDropsOn(2).length + dm.getDropsOn(3).length >= 1 ||
          second.columnsSelected.size < 2,
        "second storm starts after first completes",
      );
    }

    const green = (t) => `\x1b[32m${t}\x1b[0m`;
    console.log(`DropManager smoke tests passed! ${green("✓")}`);

  })();
}

