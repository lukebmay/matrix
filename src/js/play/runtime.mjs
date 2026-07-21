/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Unit + Thread play runtime (event substrate, gen-scoped waiters).
// Sugar desugars to start + wait completed — see plans/interactive-play.md.

import {
  configureStormCoverage,
  forceSettleActive,
  forceStableHidden,
  forceStableRevealed,
  softLeaveActive,
  DEFAULT_COMPLETION_WATCHDOG_MS,
} from "../ScenePlayer.mjs";

// ---------------------------------------------------------------------------
// Context registry: cancel disposes all tracked units/threads
// ---------------------------------------------------------------------------

function ensureRegistry(ctx) {
  if (ctx._playRuntime) return ctx._playRuntime;

  const roots = new Set();
  const baseCancel = ctx.cancel.bind(ctx);
  ctx.cancel = () => {
    for (const r of [...roots]) {
      try {
        r.stop?.();
      } catch {
        // ignore
      }
    }
    roots.clear();
    baseCancel();
  };

  ctx._playRuntime = {
    roots,
    track(root) {
      roots.add(root);
      return root;
    },
  };
  return ctx._playRuntime;
}

function ctxAlive(ctx) {
  return ctx != null && !ctx.player?.isCancelled?.();
}

function watchdogMs(ctx) {
  const raw = ctx?.completionWatchdogMs;
  if (raw === 0) return 0;
  if (raw == null) return DEFAULT_COMPLETION_WATCHDOG_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_COMPLETION_WATCHDOG_MS;
}

// ---------------------------------------------------------------------------
// Event bus + waiter set
// ---------------------------------------------------------------------------

function createBus() {
  const listeners = new Map();

  const on = (event, fn) => {
    if (typeof fn !== "function") return () => {};
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(fn);
    return () => set.delete(fn);
  };

  const emit = (event, detail) => {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(detail);
      } catch {
        // ignore
      }
    }
  };

  return { on, emit };
}

function createWaiterSet() {
  const waiters = new Set();

  const track = (off) => {
    if (typeof off !== "function") return () => {};
    const wrapped = () => {
      try {
        off();
      } catch {
        // ignore
      }
      waiters.delete(wrapped);
    };
    waiters.add(wrapped);
    return wrapped;
  };

  const dispose = () => {
    for (const off of [...waiters]) {
      try {
        off();
      } catch {
        // ignore
      }
    }
    waiters.clear();
  };

  return {
    track,
    dispose,
    get size() {
      return waiters.size;
    },
  };
}

// ---------------------------------------------------------------------------
// Side thread (unit.onStart): delay / storm / call — does not gate completed
// ---------------------------------------------------------------------------

function createSideThread(ctx, owner, ownerGen, subjectScene) {
  const steps = [];
  let lastScene = subjectScene ?? null;

  const api = {
    delay(ms) {
      steps.push({ type: "delay", ms: Math.max(0, Number(ms) || 0) });
      return api;
    },
    storm(a, b) {
      if (typeof a === "number") {
        steps.push({ type: "storm", scene: null, seconds: a });
      } else {
        steps.push({ type: "storm", scene: a, seconds: b });
      }
      return api;
    },
    call(fn) {
      if (typeof fn === "function") steps.push({ type: "call", fn });
      return api;
    },
    _flush(track) {
      const player = ctx.player;
      let i = 0;
      const alive = () =>
        ctxAlive(ctx) && owner.gen === ownerGen && !player.isCancelled();

      const next = () => {
        if (!alive()) return;
        const step = steps[i++];
        if (!step) return;

        switch (step.type) {
          case "delay": {
            const id = player.at(step.ms, () => {
              if (alive()) next();
            });
            if (id != null) track(() => player.clear(id));
            return;
          }
          case "storm": {
            const sc = step.scene ?? lastScene;
            if (sc) {
              lastScene = sc;
              configureStormCoverage(sc, step.seconds);
            }
            next();
            return;
          }
          case "call": {
            try {
              step.fn();
            } catch {
              // ignore
            }
            next();
            return;
          }
          default:
            next();
        }
      };

      next();
    },
  };

  return api;
}

// ---------------------------------------------------------------------------
// Unit
// ---------------------------------------------------------------------------

function createUnit(ctx, opts = {}) {
  const reg = ensureRegistry(ctx);
  const bus = createBus();
  const waiters = createWaiterSet();
  let gen = 0;
  let running = false;
  const onStartFns = [];
  let hoverPolicy = opts.onHover ?? null;
  let customCompleteWhen = null;

  const kind = opts.kind ?? "custom";
  const scene = opts.scene ?? null;
  const holdMs = Math.max(0, Number(opts.ms) || 0);

  const complete = (g) => {
    if (gen !== g) return;
    running = false;
    waiters.dispose();
    bus.emit("completed", { unit: self, gen: g });
  };

  const armSceneDone = (mode, g) => {
    const offRaw = scene.on("completed", (d) => {
      if (gen !== g) return;
      if (mode != null && d.mode !== mode) return;
      off();
      complete(g);
    });
    const off = waiters.track(offRaw);

    const wd = watchdogMs(ctx);
    if (wd > 0) {
      const id = ctx.player.at(wd, () => {
        if (gen !== g) return;
        forceSettleActive(scene);
      });
      if (id != null) waiters.track(() => ctx.player.clear(id));
    }
  };

  const armHoldTimer = (ms, g) => {
    const id = ctx.player.at(ms, () => {
      if (gen !== g) return;
      complete(g);
    });
    if (id != null) waiters.track(() => ctx.player.clear(id));
  };

  const self = {
    name: opts.name ?? kind,
    kind,
    scene,
    get gen() {
      return gen;
    },
    get running() {
      return running;
    },
    get hoverPolicy() {
      return hoverPolicy;
    },

    on: bus.on,

    onStart(fn) {
      if (typeof fn === "function") onStartFns.push(fn);
      return self;
    },

    onHover(policy) {
      hoverPolicy = policy;
      return self;
    },

    // Escape: armFn(unit, gen, completeFn) → optional off
    completeWhen(armFn) {
      customCompleteWhen = armFn;
      return self;
    },

    start() {
      waiters.dispose();
      gen += 1;
      const g = gen;
      running = true;

      bus.emit("start", { unit: self, gen: g });

      if (kind === "reveal" && scene) {
        scene.enterMode("revealing");
        armSceneDone("revealed", g);
      } else if (kind === "hide" && scene) {
        scene.enterMode("hiding");
        armSceneDone("hidden", g);
      } else if (kind === "hold") {
        armHoldTimer(holdMs, g);
      }

      if (typeof customCompleteWhen === "function") {
        const off = customCompleteWhen(self, g, () => complete(g));
        if (typeof off === "function") waiters.track(off);
      }

      for (const fn of onStartFns) {
        const side = createSideThread(ctx, self, g, scene);
        try {
          fn(side);
        } catch {
          // ignore
        }
        side._flush(waiters.track);
      }

      return self;
    },

    stop() {
      waiters.dispose();
      gen += 1;
      running = false;
      bus.emit("cancelled", { unit: self });
      return self;
    },

    // Abort without completed, then start a new gen.
    restart() {
      return self.start();
    },

    // Hold re-arm (extend-on-hover).
    rearm(ms) {
      if (kind !== "hold" || !running) return self;
      waiters.dispose();
      const g = gen;
      armHoldTimer(Math.max(0, Number(ms ?? holdMs) || 0), g);
      return self;
    },

    // Same-gen reveal settle → one completed (prefer over restart).
    hasten() {
      if (kind !== "reveal" || !scene) return self;
      if (scene.mode === "revealing") forceSettleActive(scene);
      return self;
    },

    forceRevealed() {
      if (!scene) return self;
      forceStableRevealed(scene);
      return self;
    },

    forceHidden() {
      if (!scene) return self;
      forceStableHidden(scene);
      return self;
    },

    // Policy dispatch from binder (no DomManager business logic).
    handleHover() {
      const policy = hoverPolicy;
      if (policy == null) return self;

      if (kind === "hold") {
        const extend =
          policy === "extend" ||
          (typeof policy === "object" &&
            (policy.whileHolding === "extend" || policy.onHover === "extend"));
        if (extend && running) self.rearm(holdMs);
        return self;
      }

      if (typeof policy === "function") {
        try {
          policy(self);
        } catch {
          // ignore
        }
        return self;
      }

      if (typeof policy !== "object") return self;

      const mode = scene?.mode;

      if (mode === "revealing" && policy.whileRevealing === "hasten") {
        self.hasten();
        return self;
      }

      if (mode === "hiding" && policy.whileHiding != null) {
        if (typeof policy.whileHiding === "function") {
          try {
            policy.whileHiding(self);
          } catch {
            // ignore
          }
        } else if (policy.whileHiding === "restart") {
          softLeaveActive(scene);
          for (const p of scene.points ?? []) p.revealed = true;
          forceStableRevealed(scene);
          self.restart();
        }
        return self;
      }

      return self;
    },
  };

  reg.track(self);
  return self;
}

/** start → enterMode(revealing); completed when scene settles revealed */
function revealUnit(ctx, scene, opts = {}) {
  return createUnit(ctx, { ...opts, kind: "reveal", scene });
}

/** start → enterMode(hiding); completed when scene settles hidden */
function hideUnit(ctx, scene, opts = {}) {
  return createUnit(ctx, { ...opts, kind: "hide", scene });
}

/** start → timer; completed on expire (rearm does not complete early) */
function holdUnit(ctx, opts = {}) {
  return createUnit(ctx, { ...opts, kind: "hold", scene: null });
}

// ---------------------------------------------------------------------------
// Thread (play thread — linear waiter chain)
// ---------------------------------------------------------------------------

function thread(ctx, opts = {}) {
  const reg = ensureRegistry(ctx);
  const bus = createBus();
  const waiters = createWaiterSet();
  const steps = [];
  const children = new Set();
  let gen = 0;

  const alive = (g) =>
    ctxAlive(ctx) && gen === g && !ctx.player.isCancelled();

  const stopChildren = () => {
    for (const c of [...children]) {
      try {
        c.stop?.();
      } catch {
        // ignore
      }
    }
    children.clear();
  };

  const complete = (g) => {
    if (gen !== g) return;
    waiters.dispose();
    bus.emit("completed", { thread: self, gen: g });
  };

  const runFrom = (index, g) => {
    if (!alive(g)) return;

    const step = steps[index];
    if (!step) {
      complete(g);
      return;
    }

    switch (step.type) {
      case "run": {
        const u = step.target;
        children.add(u);
        u.start();
        // Parent wait: any successful completed of U (not frozen U.gen).
        // Restart must not emit completed for aborted runs.
        const offRaw = u.on("completed", () => {
          if (!alive(g)) return;
          off();
          runFrom(index + 1, g);
        });
        const off = waiters.track(offRaw);
        return;
      }
      case "spawn": {
        // Start without waiting; still stop on thread stop/restart.
        const u = step.target;
        children.add(u);
        u.start();
        runFrom(index + 1, g);
        return;
      }
      case "delay": {
        const id = ctx.player.at(step.ms, () => {
          if (alive(g)) runFrom(index + 1, g);
        });
        if (id != null) waiters.track(() => ctx.player.clear(id));
        return;
      }
      case "call": {
        try {
          step.fn();
        } catch {
          // ignore
        }
        runFrom(index + 1, g);
        return;
      }
      case "wait": {
        // Mid-thread barrier: scene.events.* or unit-like completed
        const ev = step.event;
        if (ev && typeof ev === "object" && ev.scene != null && ev.event != null) {
          const offRaw = ev.scene.on(ev.event, (d) => {
            if (!alive(g)) return;
            if (ev.event === "completed" && step.mode != null && d.mode !== step.mode) {
              return;
            }
            off();
            runFrom(index + 1, g);
          });
          const off = waiters.track(offRaw);
          return;
        }
        if (ev && typeof ev.on === "function") {
          const offRaw = ev.on("completed", () => {
            if (!alive(g)) return;
            off();
            runFrom(index + 1, g);
          });
          const off = waiters.track(offRaw);
          return;
        }
        runFrom(index + 1, g);
        return;
      }
      case "clear": {
        forceStableHidden(step.scene);
        runFrom(index + 1, g);
        return;
      }
      case "clearView": {
        for (const s of Object.values(ctx.scenes ?? {})) forceStableHidden(s);
        runFrom(index + 1, g);
        return;
      }
      case "loop": {
        // Full-body restart (new gen); stop children; re-run from 0.
        self.restart();
        return;
      }
      default:
        runFrom(index + 1, g);
    }
  };

  const self = {
    name: opts.name ?? "thread",
    kind: "thread",
    get gen() {
      return gen;
    },

    on: bus.on,

    // start target, wait its completed (Unit or nested Thread)
    run(target) {
      if (target == null || typeof target.start !== "function") {
        throw new Error("thread.run: target needs start()");
      }
      steps.push({ type: "run", target });
      return self;
    },

    // start target without waiting (concurrent); still owned for stop
    spawn(target) {
      if (target == null || typeof target.start !== "function") {
        throw new Error("thread.spawn: target needs start()");
      }
      steps.push({ type: "spawn", target });
      return self;
    },

    delay(ms) {
      steps.push({ type: "delay", ms: Math.max(0, Number(ms) || 0) });
      return self;
    },

    call(fn) {
      if (typeof fn !== "function") {
        throw new Error("thread.call: function required");
      }
      steps.push({ type: "call", fn });
      return self;
    },

    wait(event, mode) {
      steps.push({ type: "wait", event, mode });
      return self;
    },

    clear(scene) {
      steps.push({ type: "clear", scene });
      return self;
    },

    clearView() {
      steps.push({ type: "clearView" });
      return self;
    },

    loop() {
      steps.push({ type: "loop" });
      return self;
    },

    start() {
      waiters.dispose();
      stopChildren();
      gen += 1;
      const g = gen;
      bus.emit("start", { thread: self, gen: g });
      runFrom(0, g);
      return self;
    },

    stop() {
      waiters.dispose();
      stopChildren();
      gen += 1;
      bus.emit("cancelled", { thread: self });
      return self;
    },

    restart() {
      return self.start();
    },
  };

  reg.track(self);
  return self;
}

// Attach factories on a play context (optional convenience).
function attachPlayRuntime(ctx) {
  if (ctx.revealUnit) return ctx;
  ensureRegistry(ctx);
  ctx.revealUnit = (scene, opts) => revealUnit(ctx, scene, opts);
  ctx.hideUnit = (scene, opts) => hideUnit(ctx, scene, opts);
  ctx.holdUnit = (opts) => holdUnit(ctx, opts);
  ctx.thread = (opts) => thread(ctx, opts);
  return ctx;
}

export {
  revealUnit,
  hideUnit,
  holdUnit,
  thread,
  attachPlayRuntime,
  createUnit,
  forceStableHidden,
  forceStableRevealed,
  forceSettleActive,
  softLeaveActive,
  configureStormCoverage,
};

export default {
  revealUnit,
  hideUnit,
  holdUnit,
  thread,
  attachPlayRuntime,
};

// ===========================================================
// Smoke tests (async IIFE — no top-level await).
// Safari/WebKit TLA module-graph bugs break DDG iOS (WebKit).
// ===========================================================
if (typeof process !== "undefined" && process.argv?.[1]) {
  void (async () => {
    const { pathToFileURL } = await import("node:url");
    if (pathToFileURL(process.argv[1]).href !== import.meta.url) return;

    const assert = (await import("node:assert/strict")).default;
    const { ScenePlayer } = await import("../ScenePlayer.mjs");
    const { DropScene } = await import("../DropScene.mjs");

    console.log("Running play runtime smoke tests...");

    const mkScene = (name, cols = [0, 1]) =>
      DropScene({
        name,
        points: cols.map((c) => ({ r: 0, c, char: "X", revealed: false })),
      });

    const settleReveal = (sc) => {
      for (const c of [...sc.columns]) sc.onColumnSpawned(c);
      for (const p of sc.points) sc.notifyPointRevealed(p.r, p.c);
    };

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // --- chain advance: run(a).run(b) ---
    {
      const a = mkScene("a");
      const b = mkScene("b");
      const player = ScenePlayer();
      const ctx = player.context({
        scenes: { a, b },
        completionWatchdogMs: 0,
      });

      const ua = revealUnit(ctx, a, { name: "a" });
      const ub = revealUnit(ctx, b, { name: "b" });
      const order = [];
      ua.on("start", () => order.push("a-start"));
      ua.on("completed", () => order.push("a-done"));
      ub.on("start", () => order.push("b-start"));
      ub.on("completed", () => order.push("b-done"));

      const t = thread(ctx, { name: "chain" }).run(ua).run(ub);
      let threadDone = false;
      t.on("completed", () => {
        threadDone = true;
      });
      t.start();

      assert.equal(a.mode, "revealing");
      assert.equal(b.mode, "hidden");
      settleReveal(a);
      assert.equal(a.mode, "revealed");
      await sleep(5);
      assert.equal(b.mode, "revealing", "b starts after a completed");
      settleReveal(b);
      await sleep(5);
      assert.equal(threadDone, true);
      assert.deepEqual(order, ["a-start", "a-done", "b-start", "b-done"]);
      player.cancel();
    }

    // --- restart without double-complete ---
    {
      const sc = mkScene("r");
      const player = ScenePlayer();
      const ctx = player.context({ scenes: { sc }, completionWatchdogMs: 0 });

      const u = revealUnit(ctx, sc, { name: "r" });
      let advances = 0;
      const t = thread(ctx).run(u).call(() => {
        advances += 1;
      });
      t.start();
      assert.equal(sc.mode, "revealing");

      // Restart mid-reveal: must not emit completed for aborted run.
      u.restart();
      assert.equal(sc.mode, "revealing");
      assert.equal(advances, 0, "no advance on restart");

      settleReveal(sc);
      await sleep(5);
      assert.equal(advances, 1, "exactly one advance after real complete");

      // Stale: complete again should not re-fire parent (already advanced)
      // Parent already moved past run; only one advance.
      player.cancel();
    }

    // --- stop disposes waits (no listener leak / no fire) ---
    {
      const sc = mkScene("stop");
      const player = ScenePlayer();
      const ctx = player.context({ scenes: { sc }, completionWatchdogMs: 0 });

      const u = revealUnit(ctx, sc, { name: "stop" });
      let advanced = false;
      const t = thread(ctx).run(u).call(() => {
        advanced = true;
      });
      t.start();
      t.stop();
      settleReveal(sc);
      await sleep(10);
      assert.equal(advanced, false, "stop: parent must not advance");
      player.cancel();
    }

    // --- ctx cancel disposes ---
    {
      const sc = mkScene("ctxc");
      const player = ScenePlayer();
      const ctx = player.context({ scenes: { sc }, completionWatchdogMs: 0 });

      const u = revealUnit(ctx, sc);
      let bad = false;
      thread(ctx).run(u).call(() => {
        bad = true;
      }).start();
      ctx.cancel();
      settleReveal(sc);
      await sleep(10);
      assert.equal(bad, false, "ctx.cancel disposes waits");
      player.cancel();
    }

    // --- loop gen ---
    {
      const player = ScenePlayer();
      const ctx = player.context({ scenes: {}, completionWatchdogMs: 0 });

      let cycles = 0;
      const t = thread(ctx, { name: "loop" })
        .call(() => {
          cycles += 1;
        })
        .delay(15)
        .loop();
      t.start();
      const gen1 = t.gen;
      await sleep(40);
      assert.ok(cycles >= 2, `loop ran multiple cycles (got ${cycles})`);
      assert.ok(t.gen > gen1, "loop bumps gen");
      t.stop();
      const stoppedAt = cycles;
      await sleep(30);
      assert.equal(cycles, stoppedAt, "stop ends loop");
      player.cancel();
    }

    // --- delay pause ---
    {
      const player = ScenePlayer();
      const ctx = player.context({ scenes: {}, completionWatchdogMs: 0 });

      let fired = false;
      const t = thread(ctx).delay(40).call(() => {
        fired = true;
      });
      t.start();
      player.pause();
      await sleep(60);
      assert.equal(fired, false, "paused delay");
      player.unpause();
      await sleep(50);
      assert.equal(fired, true, "unpause fires delay");
      player.cancel();
    }

    // --- holdUnit timer ---
    {
      const player = ScenePlayer();
      const ctx = player.context({ scenes: {}, completionWatchdogMs: 0 });

      let done = false;
      const h = holdUnit(ctx, { name: "h", ms: 25 });
      h.on("completed", () => {
        done = true;
      });
      h.start();
      await sleep(10);
      assert.equal(done, false);
      await sleep(30);
      assert.equal(done, true, "hold completes");
      player.cancel();
    }

    // --- hold rearm (extend) ---
    {
      const player = ScenePlayer();
      const ctx = player.context({ scenes: {}, completionWatchdogMs: 0 });

      let done = false;
      const h = holdUnit(ctx, { name: "ext", ms: 30, onHover: "extend" });
      h.on("completed", () => {
        done = true;
      });
      h.start();
      await sleep(20);
      h.rearm(40);
      await sleep(25);
      assert.equal(done, false, "rearm extends");
      await sleep(30);
      assert.equal(done, true);
      player.cancel();
    }

    // --- hideUnit + storm onStart ---
    {
      const sc = mkScene("hide", [0, 1]);
      for (const p of sc.points) p.revealed = true;
      const player = ScenePlayer();
      const ctx = player.context({ scenes: { sc }, completionWatchdogMs: 0 });

      const u = hideUnit(ctx, sc, { name: "hide" });
      u.onStart((side) => side.storm(1));
      let done = false;
      u.on("completed", () => {
        done = true;
      });
      u.start();
      assert.equal(sc.mode, "hiding");
      assert.equal(sc.stormEnabled, true, "storm onStart");
      for (const c of [...sc.columns]) sc.onColumnSpawned(c);
      for (const p of sc.points) sc.notifyPointHidden(p.r, p.c);
      assert.equal(sc.mode, "hidden");
      assert.equal(done, true);
      player.cancel();
    }

    // --- spawn concurrent (no wait) ---
    {
      const a = mkScene("sa");
      const b = mkScene("sb");
      const player = ScenePlayer();
      const ctx = player.context({ scenes: { a, b }, completionWatchdogMs: 0 });

      const ua = revealUnit(ctx, a);
      const ub = revealUnit(ctx, b);
      const t = thread(ctx).spawn(ua).run(ub);
      t.start();
      assert.equal(a.mode, "revealing", "spawn starts a");
      assert.equal(b.mode, "revealing", "run starts b without waiting a");
      settleReveal(b);
      await sleep(5);
      // a still revealing is fine
      t.stop();
      player.cancel();
    }

    // --- player.clear ---
    {
      const player = ScenePlayer();
      let n = 0;
      const id = player.at(20, () => {
        n += 1;
      });
      player.clear(id);
      await sleep(40);
      assert.equal(n, 0, "player.clear drops cue");
      player.cancel();
    }

    // --- abort restart does not emit completed ---
    {
      const sc = mkScene("abort");
      const player = ScenePlayer();
      const ctx = player.context({ scenes: { sc }, completionWatchdogMs: 0 });

      const u = revealUnit(ctx, sc);
      let completes = 0;
      u.on("completed", () => {
        completes += 1;
      });
      u.start();
      u.restart();
      u.stop();
      settleReveal(sc);
      await sleep(5);
      assert.equal(completes, 0, "stop/restart: no completed");
      player.cancel();
    }

    // --- hover hasten reveal (same gen, one completed) ---
    {
      const sc = mkScene("hast", [0, 1, 2]);
      const player = ScenePlayer();
      const ctx = player.context({ scenes: { sc }, completionWatchdogMs: 0 });

      const u = revealUnit(ctx, sc, { name: "hast" });
      u.onHover({ whileRevealing: "hasten" });
      let advances = 0;
      thread(ctx).run(u).call(() => {
        advances += 1;
      }).start();
      assert.equal(sc.mode, "revealing");
      u.handleHover();
      await sleep(5);
      assert.equal(sc.mode, "revealed", "hasten settles reveal");
      assert.equal(advances, 1, "hasten: one parent advance");
      u.handleHover();
      await sleep(5);
      assert.equal(advances, 1, "hasten after settle is no-op");
      player.cancel();
    }

    // --- hover mid-hide: re-reveal + restart, never hasten hide ---
    {
      const rev = mkScene("cardR", [0, 1]);
      const hide = DropScene({
        name: "cardH",
        points: rev.points,
      });
      for (const p of rev.points) p.revealed = true;
      const player = ScenePlayer();
      const ctx = player.context({
        scenes: { rev, hide },
        completionWatchdogMs: 0,
      });

      const revealU = revealUnit(ctx, rev, { name: "rev" });
      const hideU = hideUnit(ctx, hide, { name: "hide" });
      hideU.onStart((side) => side.storm(1));
      hideU.onHover({
        whileHiding: () => {
          softLeaveActive(hide);
          revealU.forceRevealed();
          hideU.restart();
        },
      });

      let hideCompletes = 0;
      let advanced = false;
      hideU.on("completed", () => {
        hideCompletes += 1;
      });
      thread(ctx)
        .run(hideU)
        .call(() => {
          advanced = true;
        })
        .start();

      assert.equal(hide.mode, "hiding");
      // Partial hide progress
      hide.notifyPointHidden(0, 0);
      assert.equal(rev.points[0].revealed, false);

      hideU.handleHover();
      await sleep(5);

      assert.equal(advanced, false, "hide hover must not complete aborted run");
      assert.equal(hide.mode, "hiding", "hide restarted");
      assert.equal(hide.stormEnabled, true, "storm re-armed on restart");
      assert.ok(
        rev.points.every((p) => p.revealed),
        "full re-reveal after hide hover",
      );
      assert.equal(hideCompletes, 0, "no completed until real settle");

      // Finish the restarted hide
      for (const c of [...hide.columns]) hide.onColumnSpawned(c);
      for (const p of hide.points) hide.notifyPointHidden(p.r, p.c);
      await sleep(5);
      assert.equal(hide.mode, "hidden");
      assert.equal(advanced, true, "parent advances once after real hide");
      assert.equal(hideCompletes, 1);
      player.cancel();
    }

    // --- hold extend on hover ---
    {
      const player = ScenePlayer();
      const ctx = player.context({ scenes: {}, completionWatchdogMs: 0 });

      let done = false;
      const h = holdUnit(ctx, { name: "hov", ms: 30, onHover: "extend" });
      h.on("completed", () => {
        done = true;
      });
      h.start();
      await sleep(20);
      h.handleHover();
      await sleep(20);
      assert.equal(done, false, "hover extend keeps hold alive");
      await sleep(25);
      assert.equal(done, true, "hold completes after full rearm");
      player.cancel();
    }

    // --- softLeaveActive does not emit completed ---
    {
      const sc = mkScene("soft", [0]);
      for (const p of sc.points) p.revealed = true;
      sc.enterMode("hiding");
      let n = 0;
      sc.on("completed", () => {
        n += 1;
      });
      assert.equal(softLeaveActive(sc), true);
      assert.equal(sc.mode, "hidden");
      assert.equal(n, 0, "soft leave: no completed");
      assert.equal(softLeaveActive(sc), false, "stable: no-op");
    }

    const green = (t) => `\x1b[32m${t}\x1b[0m`;
    console.log(`Play runtime smoke tests passed! ${green("✓")}`);

  })();
}

