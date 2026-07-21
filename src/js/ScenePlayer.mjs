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
import { VariableRateAccumulator } from "./util.mjs";

// Wall ms for a logical play delay (TIME_SCALE < 1 slows cues).
const scaledDelayMs = (ms) => {
  const raw = Math.max(0, Number(ms) || 0);
  const scale = state.config?.TIME_SCALE;
  if (typeof scale !== "number" || !(scale > 0) || scale === 1) return raw;
  return raw / scale;
};

// Pause-aware timed cue runner for DropScene mode/storm sequences.
function ScenePlayer(...args) {
  if (!new.target) return new ScenePlayer(...args);
  const self = this;
  const opts = args[0] ?? {};

  const pending = new Map();
  let cancelled = false;
  let paused = false;
  let nextId = 1;

  self.isCancelled = () => cancelled;
  self.isPaused = () => paused;

  const arm = (entry, delayMs) => {
    const id = entry.id;
    const wallMs = scaledDelayMs(delayMs);
    const dueAt = performance.now() + wallMs;
    entry.dueAt = dueAt;
    // Logical remaining for pause (unpause re-scales via arm).
    entry.logicalMs = Math.max(0, Number(delayMs) || 0);
    delete entry.remaining;
    entry.timeoutId = setTimeout(() => {
      pending.delete(id);
      if (!cancelled && !paused) entry.fn();
    }, wallMs);
    pending.set(id, entry);
    return id;
  };

  self.at = (ms, fn) => {
    if (cancelled || typeof fn !== "function") return null;
    const id = nextId++;
    const entry = { id, fn };
    if (paused) {
      entry.remaining = Math.max(0, ms);
      pending.set(id, entry);
      return id;
    }
    return arm(entry, ms);
  };

  // Drop one armed cue (Unit/Thread delay dispose).
  self.clear = (id) => {
    if (id == null) return false;
    const entry = pending.get(id);
    if (!entry) return false;
    if (entry.timeoutId != null) clearTimeout(entry.timeoutId);
    pending.delete(id);
    return true;
  };

  self.pause = () => {
    if (cancelled || paused) return;
    paused = true;
    const now = performance.now();
    for (const entry of pending.values()) {
      if (entry.timeoutId != null) {
        clearTimeout(entry.timeoutId);
        entry.timeoutId = null;
        // Convert wall remaining back to logical ms for TIME_SCALE.
        const wallLeft = Math.max(0, (entry.dueAt ?? now) - now);
        const scale = state.config?.TIME_SCALE;
        const s =
          typeof scale === "number" && scale > 0 && scale !== 1 ? scale : 1;
        entry.remaining = wallLeft * s;
        delete entry.dueAt;
      }
    }
  };

  self.unpause = () => {
    if (cancelled || !paused) return;
    paused = false;
    for (const entry of [...pending.values()]) {
      arm(entry, entry.remaining ?? entry.logicalMs ?? 0);
    }
  };

  self.cancel = () => {
    cancelled = true;
    paused = false;
    for (const entry of pending.values()) {
      if (entry.timeoutId != null) clearTimeout(entry.timeoutId);
    }
    pending.clear();
  };

  // Thin play context + cue chains (Style A multi-chain, Style C linear).
  self.context = (ctxOpts = {}) => createPlayContext(self, ctxOpts);

  if (Array.isArray(opts.cues)) {
    for (const cue of opts.cues) {
      if (cue && typeof cue.run === "function") {
        self.at(cue.at ?? 0, cue.run);
      }
    }
  }
}

// Default wait on scene.completed before force-settling a stuck active mode.
const DEFAULT_COMPLETION_WATCHDOG_MS = 60_000;

// Abort active reveal/hide or settle revealed → hidden; clear logical + blank DOM.
// Without this, phase transitions leave stale glyphs (garbled saying/card).
// Does not emit completed — use forceSettleActive to unblock play waits.
const forceStableHidden = (scene) => {
  if (!scene) return;
  scene.stopStorm?.();
  if (scene.mode === "hidden") return;
  if (scene.mode === "hiding" || scene.mode === "revealing") {
    const keys = state.sceneManager?.clearLogicalForScene?.(scene) ?? [];
    scene.enterMode("hidden");
    state.domManager?.repaintKeys?.(keys, { rainIfEmpty: false });
    return;
  }
  // revealed (or other stable): mode only — hide path already cleared logical.
  const keys = state.sceneManager?.clearLogicalForScene?.(scene) ?? [];
  scene.enterMode("hidden");
  if (keys.length) state.domManager?.repaintKeys?.(keys, { rainIfEmpty: false });
};

// Finish a stuck revealing/hiding scene and emit completed (play-chain recovery).
const forceSettleActive = (scene) => {
  if (!scene) return false;
  scene.stopStorm?.();
  if (scene.mode === "revealing") {
    const keys = state.sceneManager?.applyLogicalForScene?.(scene) ?? [];
    const ok = scene.forceSettle?.() ?? false;
    if (keys.length) state.domManager?.repaintKeys?.(keys, { rainIfEmpty: false });
    return ok;
  }
  if (scene.mode === "hiding") {
    const keys = state.sceneManager?.clearLogicalForScene?.(scene) ?? [];
    const ok = scene.forceSettle?.() ?? false;
    if (keys.length) state.domManager?.repaintKeys?.(keys, { rainIfEmpty: false });
    return ok;
  }
  return false;
};

// Leave revealing/hiding without completed (hide-hover abort before re-reveal).
// Points unchanged so callers can re-show content then restart hide.
const softLeaveActive = (scene) => {
  if (!scene) return false;
  if (scene.mode !== "revealing" && scene.mode !== "hiding") return false;
  scene.stopStorm?.();
  const next = scene.mode === "revealing" ? "revealed" : "hidden";
  scene.mode = next;
  scene.stormEnabled = false;
  scene.columnsSelected = new Set();
  scene.modeEnteredAt = null;
  scene.isComplete = next === "revealed";
  return true;
};

// Ensure points + logical + paint show content (shared-point hide re-reveal).
const forceStableRevealed = (scene) => {
  if (!scene) return;
  scene.stopStorm?.();
  if (scene.mode === "revealing") {
    forceSettleActive(scene);
    return;
  }
  if (scene.mode === "hiding") {
    softLeaveActive(scene);
  }
  for (const p of scene.points ?? []) p.revealed = true;
  if (scene.mode !== "revealed") {
    scene.mode = "revealed";
    scene.isComplete = true;
    scene.stormEnabled = false;
    scene.columnsSelected = new Set();
    scene.modeEnteredAt = null;
  }
  const keys = state.sceneManager?.applyLogicalForScene?.(scene) ?? [];
  if (keys.length) state.domManager?.repaintKeys?.(keys, { rainIfEmpty: false });
};

const SCENE_EVENT_NAMES = new Set([
  "started",
  "completed",
  "modeEnter",
  "dropSelected",
  "pointRevealed",
  "pointHidden",
  "stormStart",
  "stormStop",
]);

// Storm coverage VRA: remaining columnsSelected over `seconds` (play length).
// stormMild: high floor → apex at end. VRA normalizes so ∫ = column count.
// Skip when nothing left to cover (rain may have already drained the set).
// Same window on constrained devices (no weather-scale duration stretch).
const configureStormCoverage = (scene, seconds) => {
  if (!scene) return false;
  // Only remaining work — do not fall back to full columns when selection is empty.
  const pool = scene.columnsSelected?.size ?? 0;
  if (pool <= 0) return false;
  const units = pool;
  const durationSeconds = Math.max(Number(seconds) || 0, 0.001);
  scene.stormAccumulator = VariableRateAccumulator(
    units,
    durationSeconds,
    VariableRateAccumulator.rates.stormMild(durationSeconds),
  );
  scene.startStorm();
  return true;
};

function createPlayContext(player, opts = {}) {
  const scenes = opts.scenes ?? {};
  const completionWatchdogMs = (() => {
    const raw = opts.completionWatchdogMs;
    if (raw === 0) return 0;
    if (raw == null) return DEFAULT_COMPLETION_WATCHDOG_MS;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_COMPLETION_WATCHDOG_MS;
  })();
  let ctxCancelled = false;
  const synthetic = new Map();
  const allOffs = new Set();

  const ctxAlive = () => !ctxCancelled && !player.isCancelled();

  const clearAllOffs = () => {
    for (const off of [...allOffs]) off();
    allOffs.clear();
  };

  const resolveScene = (ref) => {
    if (ref == null) return null;
    if (typeof ref === "string") return scenes[ref] ?? null;
    return ref;
  };

  // Handles: { scene, event }. Strings: scene event on lastSubject, else synthetic.
  const resolveEvent = (ev, lastScene) => {
    if (ev != null && typeof ev === "object" && ev.event != null && ev.scene != null) {
      return { kind: "scene", scene: ev.scene, name: ev.event };
    }
    if (typeof ev === "string") {
      if (lastScene && SCENE_EVENT_NAMES.has(ev)) {
        return { kind: "scene", scene: lastScene, name: ev };
      }
      return { kind: "synthetic", name: ev };
    }
    throw new Error("PlayContext: invalid event (use string, or scene.events.*)");
  };

  const ctx = {
    scenes,
    player,
    completionWatchdogMs,

    emit(name, detail) {
      const set = synthetic.get(name);
      if (!set) return ctx;
      for (const fn of [...set]) {
        try {
          fn(detail);
        } catch {
          // ignore
        }
      }
      return ctx;
    },

    // Kickoff: emit synthetic "appStart" (chains arm with .on("appStart")).
    start() {
      return ctx.emit("appStart");
    },

    cancel() {
      ctxCancelled = true;
      clearAllOffs();
      return ctx;
    },

    clearView() {
      for (const s of Object.values(scenes)) forceStableHidden(s);
      return ctx;
    },

    on(event) {
      return startChain(event);
    },

    wait(event) {
      return startChain(event);
    },
  };

  const prevCancel = player.cancel.bind(player);
  player.cancel = () => {
    ctx.cancel();
    prevCancel();
  };

  function startChain(entryEvent) {
    const steps = [];
    const labels = new Map();
    let lastSubject = null;
    let chainGen = 0;
    const chainOffs = new Set();

    const chainAlive = (gen) => ctxAlive() && gen === chainGen;

    const trackOff = (off) => {
      const wrapped = () => {
        off();
        chainOffs.delete(wrapped);
        allOffs.delete(wrapped);
      };
      chainOffs.add(wrapped);
      allOffs.add(wrapped);
      return wrapped;
    };

    const clearChainOffs = () => {
      for (const off of [...chainOffs]) off();
      chainOffs.clear();
    };

    const armOne = (spec, gen, onFire) => {
      if (!chainAlive(gen)) return;

      if (spec.kind === "synthetic") {
        let set = synthetic.get(spec.name);
        if (!set) {
          set = new Set();
          synthetic.set(spec.name, set);
        }
        const handler = (detail) => {
          set.delete(handler);
          chainOffs.delete(wrappedOff);
          allOffs.delete(wrappedOff);
          if (chainAlive(gen)) onFire(detail);
        };
        set.add(handler);
        const wrappedOff = () => {
          set.delete(handler);
        };
        chainOffs.add(wrappedOff);
        allOffs.add(wrappedOff);
        return;
      }

      const rawOff = spec.scene.on(spec.name, (detail) => {
        wrappedOff();
        if (chainAlive(gen)) onFire(detail);
      });
      const wrappedOff = trackOff(rawOff);
    };

    const runFrom = (index) => {
      const gen = chainGen;
      if (!chainAlive(gen)) return;

      const step = steps[index];
      if (!step) {
        armEntry();
        return;
      }

      switch (step.type) {
        case "wait": {
          const spec = resolveEvent(step.event, lastSubject);
          let advanced = false;
          armOne(spec, gen, () => {
            advanced = true;
            runFrom(index + 1);
          });
          // Stuck revealing/hiding: force settle so completed unblocks the chain.
          if (
            completionWatchdogMs > 0 &&
            spec.kind === "scene" &&
            spec.name === "completed" &&
            spec.scene
          ) {
            const sc = spec.scene;
            player.at(completionWatchdogMs, () => {
              if (!chainAlive(gen) || advanced) return;
              if (forceSettleActive(sc)) return;
              // Already stable but no completed (e.g. abort path): hard-advance.
              if (!advanced && chainAlive(gen)) {
                advanced = true;
                runFrom(index + 1);
              }
            });
          }
          return;
        }
        case "delay": {
          player.at(step.ms, () => {
            if (chainAlive(gen)) runFrom(index + 1);
          });
          return;
        }
        case "activate": {
          const sc = resolveScene(step.scene);
          if (sc) {
            sc.enterMode("revealing");
            lastSubject = sc;
          }
          runFrom(index + 1);
          return;
        }
        case "hide": {
          const sc = resolveScene(step.scene);
          if (sc) {
            sc.enterMode("hiding");
            lastSubject = sc;
          }
          runFrom(index + 1);
          return;
        }
        case "storm": {
          const sc = resolveScene(step.scene) ?? lastSubject;
          if (sc) {
            lastSubject = sc;
            configureStormCoverage(sc, step.seconds);
          }
          runFrom(index + 1);
          return;
        }
        case "clear": {
          forceStableHidden(resolveScene(step.scene));
          runFrom(index + 1);
          return;
        }
        case "clearView": {
          for (const s of Object.values(scenes)) forceStableHidden(s);
          runFrom(index + 1);
          return;
        }
        case "call": {
          try {
            step.fn();
          } catch {
            // ignore step errors
          }
          runFrom(index + 1);
          return;
        }
        case "loop": {
          restartBody(0);
          return;
        }
        case "loopFrom": {
          const at = labels.has(step.label) ? labels.get(step.label) : 0;
          restartBody(at);
          return;
        }
        default:
          runFrom(index + 1);
      }
    };

    const restartBody = (at) => {
      if (!ctxAlive()) return;
      chainGen += 1;
      clearChainOffs();
      for (const s of Object.values(scenes)) forceStableHidden(s);
      lastSubject = null;
      runFrom(at);
    };

    const armEntry = () => {
      const gen = chainGen;
      // Entry strings are always synthetic (handles for scene events).
      let spec;
      if (
        entryEvent != null &&
        typeof entryEvent === "object" &&
        entryEvent.event != null &&
        entryEvent.scene != null
      ) {
        spec = { kind: "scene", scene: entryEvent.scene, name: entryEvent.event };
      } else if (typeof entryEvent === "string") {
        spec = { kind: "synthetic", name: entryEvent };
      } else {
        throw new Error("PlayContext.on: invalid entry event");
      }
      armOne(spec, gen, () => {
        if (chainAlive(gen)) runFrom(0);
      });
    };

    const chain = {
      on(event) {
        steps.push({ type: "wait", event });
        return chain;
      },
      wait(event) {
        return chain.on(event);
      },
      delay(ms) {
        steps.push({ type: "delay", ms: Math.max(0, Number(ms) || 0) });
        return chain;
      },
      activate(scene) {
        steps.push({ type: "activate", scene });
        return chain;
      },
      hide(scene) {
        steps.push({ type: "hide", scene });
        return chain;
      },
      storm(a, b) {
        if (typeof a === "number") {
          steps.push({ type: "storm", scene: null, seconds: a });
        } else {
          steps.push({ type: "storm", scene: a, seconds: b });
        }
        return chain;
      },
      clear(scene) {
        steps.push({ type: "clear", scene });
        return chain;
      },
      clearView() {
        steps.push({ type: "clearView" });
        return chain;
      },
      call(fn) {
        if (typeof fn !== "function") {
          throw new Error("PlayContext.call: function required");
        }
        steps.push({ type: "call", fn });
        return chain;
      },
      label(name) {
        labels.set(name, steps.length);
        return chain;
      },
      loop() {
        steps.push({ type: "loop" });
        return chain;
      },
      loopFrom(label) {
        steps.push({ type: "loopFrom", label });
        return chain;
      },
    };

    armEntry();
    return chain;
  }

  return ctx;
}

// Reusable timed phase: { durationMs, schedule(t) } where t(ms, fn) is relative.
function Phase(name, build) {
  if (!new.target) return new Phase(name, build);
  const self = this;
  self.name = name;
  const built = typeof build === "function" ? build() : build;
  self.durationMs = built.durationMs ?? 0;
  self.schedule = built.schedule ?? (() => {});
}

// Run phases in order on a ScenePlayer, then loop (optional gap after full cycle).
function loopPhases(player, phases, opts = {}) {
  const gapMs = opts.gapMs ?? 0;
  const onCycleStart = opts.onCycleStart;

  const runCycle = () => {
    if (player.isCancelled()) return;
    onCycleStart?.();

    let offset = 0;
    for (const phase of phases) {
      const p = phase;
      const base = offset;
      p.schedule((ms, fn) => player.at(base + ms, fn));
      offset += p.durationMs;
    }
    player.at(offset + gapMs, runCycle);
  };

  runCycle();
  return player;
}

export {
  ScenePlayer,
  Phase,
  loopPhases,
  forceStableHidden,
  forceStableRevealed,
  forceSettleActive,
  softLeaveActive,
  configureStormCoverage,
  DEFAULT_COMPLETION_WATCHDOG_MS,
};
export default ScenePlayer;

// ===========================================================
// Smoke tests (async IIFE — no top-level await).
// Safari/WebKit TLA module-graph bugs break DDG iOS (WebKit).
// ===========================================================
if (typeof process !== "undefined" && process.argv?.[1]) {
  void (async () => {
    const { pathToFileURL } = await import("node:url");
    if (pathToFileURL(process.argv[1]).href !== import.meta.url) return;

    const assert = (await import("node:assert/strict")).default;
    const { DropScene } = await import("./DropScene.mjs");

    console.log("Running ScenePlayer smoke tests...");

    const player = ScenePlayer();
    let n = 0;
    player.at(30, () => {
      n += 1;
    });
    player.pause();
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(n, 0, "paused: cue must not fire");
    player.unpause();
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(n, 1, "unpause: remaining delay fires");

    const player2 = ScenePlayer();
    let m = 0;
    player2.at(20, () => {
      m += 1;
    });
    player2.cancel();
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(m, 0, "cancel: no fire");

    const player3 = ScenePlayer();
    let hits = 0;
    const phase = Phase("t", () => ({
      durationMs: 20,
      schedule: (t) => {
        t(5, () => {
          hits += 1;
        });
      },
    }));
    loopPhases(player3, [phase], { gapMs: 1000 });
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(hits >= 1, "phase scheduled");
    player3.cancel();

    // --- Play context: register + Style C linear arm/delay/activate ---
    const mkScene = (name, cols = [0, 1]) =>
      DropScene({
        name,
        points: cols.map((c) => ({ r: 0, c, char: "X", revealed: false })),
      });

    const roles = mkScene("roles");
    const email = mkScene("email");
    const pCtx = ScenePlayer();
    const ctx = pCtx.context({ scenes: { roles, email } });
    assert.equal(ctx.scenes.roles, roles, "context registers scenes");

    let activated = [];
    ctx
      .on("appStart")
      .delay(20)
      .activate(roles)
      .storm(2)
      .call(() => activated.push("roles"))
      .on(roles.events.completed)
      .delay(10)
      .activate(email)
      .call(() => activated.push("email"));

    ctx.start(); // kickoff = emit("appStart")
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(roles.mode, "hidden", "delay not yet elapsed");
    await new Promise((r) => setTimeout(r, 25));
    assert.equal(roles.mode, "revealing", "activate after delay");
    assert.equal(roles.stormEnabled, true, "storm starts");
    assert.ok(roles.stormAccumulator, "storm VRA rebuilt");
    assert.deepEqual(activated, ["roles"]);

    // Finish roles so mid-chain wait proceeds.
    roles.onColumnSpawned(0);
    roles.onColumnSpawned(1);
    roles.notifyPointRevealed(0, 0);
    roles.notifyPointRevealed(0, 1);
    assert.equal(roles.mode, "revealed");
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(email.mode, "revealing", "mid-chain completed → activate email");
    assert.deepEqual(activated, ["roles", "email"]);
    pCtx.cancel();

    // --- Style A multi-chain ---
    const a = mkScene("a");
    const b = mkScene("b");
    const pA = ScenePlayer();
    const ctxA = pA.context({ scenes: { a, b } });
    const order = [];
    ctxA.on("appStart").delay(10).activate(a).call(() => order.push("a"));
    ctxA
      .on(a.events.completed)
      .delay(10)
      .activate(b)
      .call(() => order.push("b"));
    ctxA.start();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(a.mode, "revealing");
    a.onColumnSpawned(0);
    a.onColumnSpawned(1);
    a.notifyPointRevealed(0, 0);
    a.notifyPointRevealed(0, 1);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(b.mode, "revealing", "Style A second chain");
    assert.deepEqual(order, ["a", "b"]);
    pA.cancel();

    // --- storm(seconds) coverage VRA ---
    const st = mkScene("storm", [0, 1, 2, 3]);
    st.enterMode("revealing");
    configureStormCoverage(st, 3);
    assert.equal(st.stormEnabled, true);
    assert.ok(st.stormAccumulator);
    // Finite accumulator: units ≈ pool size, duration = 3
    let total = 0;
    for (let i = 0; i < 60; i++) total += st.stormAccumulator.advance(0.05);
    assert.ok(total >= 3 && total <= 5, `storm units ~4 got ${total}`);

    // Empty selection: storm is skipped (nothing left to cover).
    const stEmpty = mkScene("storm-empty", [0, 1]);
    stEmpty.enterMode("revealing");
    stEmpty.columnsSelected = new Set();
    assert.equal(configureStormCoverage(stEmpty, 3), false, "skip empty storm");
    assert.equal(stEmpty.stormEnabled, false, "no storm when no columns");

    // storm on chain with explicit scene
    const st2 = mkScene("st2", [0, 1]);
    const pS = ScenePlayer();
    const ctxS = pS.context({ scenes: { st2 } });
    ctxS.on("appStart").activate(st2).storm(st2, 1);
    ctxS.start();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(st2.stormEnabled, true);
    pS.cancel();

    // --- pause / cancel safety on chains ---
    const pc = mkScene("pc");
    const pPause = ScenePlayer();
    const ctxP = pPause.context({ scenes: { pc } });
    let fired = false;
    ctxP.on("appStart").delay(40).activate(pc).call(() => {
      fired = true;
    });
    ctxP.start();
    pPause.pause();
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(fired, false, "paused chain delay");
    assert.equal(pc.mode, "hidden");
    pPause.unpause();
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(fired, true, "unpause chain continues");
    assert.equal(pc.mode, "revealing");
    pPause.cancel();

    const pCan = ScenePlayer();
    const cCan = mkScene("can");
    const ctxC = pCan.context({ scenes: { cCan } });
    let bad = false;
    ctxC.on("appStart").delay(30).activate(cCan).call(() => {
      bad = true;
    });
    ctxC.start();
    pCan.cancel();
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(bad, false, "cancel: chain must not continue");
    assert.equal(cCan.mode, "hidden");

    // wait ≡ on
    const w = mkScene("w");
    const pW = ScenePlayer();
    const ctxW = pW.context({ scenes: { w } });
    ctxW.wait("go").activate(w);
    ctxW.emit("go");
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(w.mode, "revealing", "wait ≡ on");
    pW.cancel();

    // --- completion watchdog: stuck reveal unblocks chain ---
    const hung = mkScene("hung", [0, 1]);
    const next = mkScene("next", [0]);
    const pWd = ScenePlayer();
    const ctxWd = pWd.context({
      scenes: { hung, next },
      completionWatchdogMs: 40,
    });
    let afterHang = false;
    ctxWd
      .on("appStart")
      .activate(hung)
      .on(hung.events.completed)
      .activate(next)
      .call(() => {
        afterHang = true;
      });
    ctxWd.start();
    await new Promise((r) => setTimeout(r, 15));
    assert.equal(hung.mode, "revealing");
    assert.equal(next.mode, "hidden");
    // Do not cover columns / points — wait for watchdog.
    await new Promise((r) => setTimeout(r, 60));
    assert.equal(hung.mode, "revealed", "watchdog force-settled hung reveal");
    assert.equal(next.mode, "revealing", "chain advanced after watchdog");
    assert.equal(afterHang, true);
    pWd.cancel();

    // Watchdog disabled (0): chain stays stuck
    const hung2 = mkScene("hung2", [0]);
    const pOff = ScenePlayer();
    const ctxOff = pOff.context({
      scenes: { hung2 },
      completionWatchdogMs: 0,
    });
    let never = false;
    ctxOff
      .on("appStart")
      .activate(hung2)
      .on(hung2.events.completed)
      .call(() => {
        never = true;
      });
    ctxOff.start();
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(hung2.mode, "revealing");
    assert.equal(never, false, "watchdog 0: no force settle");
    pOff.cancel();

    // forceSettleActive hides with completed
    const hideSc = mkScene("hideSc", [0, 1]);
    hideSc.enterMode("hiding");
    for (const p of hideSc.points) p.revealed = true;
    let hideDone = false;
    hideSc.on("completed", () => {
      hideDone = true;
    });
    assert.equal(forceSettleActive(hideSc), true);
    assert.equal(hideSc.mode, "hidden");
    assert.equal(hideDone, true);

    const green = (t) => `\x1b[32m${t}\x1b[0m`;
    console.log(`ScenePlayer smoke tests passed! ${green("✓")}`);

  })();
}

