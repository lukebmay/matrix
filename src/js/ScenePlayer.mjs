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
    const dueAt = performance.now() + Math.max(0, delayMs);
    entry.dueAt = dueAt;
    delete entry.remaining;
    entry.timeoutId = setTimeout(() => {
      pending.delete(id);
      if (!cancelled && !paused) entry.fn();
    }, Math.max(0, delayMs));
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

  self.pause = () => {
    if (cancelled || paused) return;
    paused = true;
    const now = performance.now();
    for (const entry of pending.values()) {
      if (entry.timeoutId != null) {
        clearTimeout(entry.timeoutId);
        entry.timeoutId = null;
        entry.remaining = Math.max(0, (entry.dueAt ?? now) - now);
        delete entry.dueAt;
      }
    }
  };

  self.unpause = () => {
    if (cancelled || !paused) return;
    paused = false;
    for (const entry of [...pending.values()]) {
      arm(entry, entry.remaining ?? 0);
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

  if (Array.isArray(opts.cues)) {
    for (const cue of opts.cues) {
      if (cue && typeof cue.run === "function") {
        self.at(cue.at ?? 0, cue.run);
      }
    }
  }
}

// Abort an active reveal/hide: clear logical content for its cells + blank DOM.
// Without this, phase transitions leave stale glyphs (garbled quote/card).
const forceStableHidden = (scene) => {
  if (!scene) return;
  scene.stopStorm?.();
  if (scene.mode === "hiding" || scene.mode === "revealing") {
    const keys = state.sceneManager?.clearLogicalForScene?.(scene) ?? [];
    scene.enterMode("hidden");
    state.domManager?.repaintKeys?.(keys, { rainIfEmpty: false });
  }
};

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

// Roles then email reveals + delayed storms.
function cardRevealPhase(scenes, opts = {}) {
  const { rolesReveal, emailReveal, cardHide } = scenes;
  const rolesAt = opts.rolesAtMs ?? 3_000;
  const emailAfterRolesMs = opts.emailAfterRolesMs ?? 2_000;
  const rolesStormAfterMs = opts.rolesStormAfterMs ?? 3_000;
  const emailStormAfterMs = opts.emailStormAfterMs ?? 5_000;
  const cardMs = opts.cardPhaseMs ?? 20_000;

  return Phase("card-reveal", () => ({
    durationMs: cardMs,
    schedule: (t) => {
      t(rolesAt, () => {
        forceStableHidden(cardHide);
        rolesReveal.enterMode("revealing");
      });
      t(rolesAt + emailAfterRolesMs, () => emailReveal.enterMode("revealing"));
      t(rolesAt + rolesStormAfterMs, () => rolesReveal.startStorm());
      t(
        rolesAt + emailAfterRolesMs + emailStormAfterMs,
        () => emailReveal.startStorm(),
      );
    },
  }));
}

// Hide card + show quote; storms; later hide quote. Then outer loop gaps.
function quotePhase(scenes, opts = {}) {
  const {
    rolesReveal,
    emailReveal,
    cardHide,
    quoteReveal,
    quoteHide,
  } = scenes;
  const quoteHoldMs = opts.quoteHoldMs ?? 10_000;
  const stormAfterActivateMs = opts.stormAfterActivateMs ?? 3_000;

  // Hold + hide kickoff; storm after hide is still within duration.
  const durationMs = Math.max(quoteHoldMs + stormAfterActivateMs, quoteHoldMs);

  return Phase("quote", () => ({
    durationMs,
    schedule: (t) => {
      t(0, () => {
        rolesReveal.stopStorm();
        emailReveal.stopStorm();
        forceStableHidden(quoteHide);
        cardHide.enterMode("hiding");
        quoteReveal.enterMode("revealing");
      });
      t(stormAfterActivateMs, () => {
        cardHide.startStorm();
        quoteReveal.startStorm();
      });
      t(quoteHoldMs, () => {
        quoteReveal.stopStorm();
        cardHide.stopStorm();
        forceStableHidden(cardHide);
        quoteHide.enterMode("hiding");
      });
      t(quoteHoldMs + stormAfterActivateMs, () => {
        quoteHide.startStorm();
      });
    },
  }));
}

// Homepage: card phase → quote phase → gap → loop.
function cardQuoteLoop(scenes, opts = {}) {
  const player = ScenePlayer();
  const card = cardRevealPhase(scenes, opts);
  const quote = quotePhase(scenes, opts);
  const gapMs = opts.restartGapMs ?? 20_000;

  loopPhases(player, [card, quote], {
    gapMs,
    onCycleStart: () => {
      forceStableHidden(scenes.quoteHide);
      forceStableHidden(scenes.cardHide);
    },
  });

  return player;
}

export {
  ScenePlayer,
  Phase,
  loopPhases,
  cardRevealPhase,
  quotePhase,
  cardQuoteLoop,
};
export default ScenePlayer;

// ===========================================================
// Smoke tests: node src/js/ScenePlayer.mjs
// ===========================================================
const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (await import("node:url")).pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  const assert = (await import("node:assert/strict")).default;

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

  const green = (t) => `\x1b[32m${t}\x1b[0m`;
  console.log(`ScenePlayer smoke tests passed! ${green("✓")}`);
}
