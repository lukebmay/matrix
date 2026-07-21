/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

/**
 * VariableRateAccumulator - Produces a variable integer rate of units (drops, particles,
 * objects, etc.) over time by integrating any continuous rate function r(t).
 *
 * It numerically integrates the area under your rate curve, returns whole numbers of units
 * per call to advance(), and carries the fractional remainder forward. This creates smooth,
 * natural-looking variable spawning without bursts or perfect regularity.
 *
 * Two modes are supported:
 * - Finite duration (e.g. text reveal scenes)
 * - Infinite duration (e.g. default repeating matrix scene)
 *
 * @param {number} units
 *        Finite mode:  Total number of units to produce over the full duration.
 *        Infinite mode: Target average units per second.
 *
 * @param {number} durationSeconds
 *        Duration of the scene in seconds. Use `Infinity` for indefinite/repeating scenes.
 *
 * @param {(t: number) => number} rateFn
 *        Function that returns the instantaneous rate (units/second) at absolute time t (seconds).
 *        Should be non-negative. For best results, make it start at its trough for the infinite scene.
 *
 * @param {number} [sampleCount=2000]
 *        Number of samples used for numerical integration when computing the normalizer.
 *        2000 provides excellent accuracy for smooth curves (sine, etc.) with negligible cost.
 *
 * @param {number} [minRemainder=undefined]
 *        Optional lower bound for the internal remainder after credit adjustment.
 *        If undefined (default), remainder can go deeply negative (unbounded).
 *        If set (e.g. 0 or -1), remainder is clamped to this value. Useful for tuning
 *        overlapping-scene behavior without long pauses on the default scene.
 */
function VariableRateAccumulator(
  units,
  durationSeconds,
  rateFn,
  sampleCount = 2000,
  minRemainder = undefined,
) {
  if (!new.target)
    return new VariableRateAccumulator(units, durationSeconds, rateFn, sampleCount, minRemainder);
  const self = this;

  const isInfinite =
    !isFinite(durationSeconds) || durationSeconds === null || durationSeconds === undefined;
  let remainder = 0;
  let currentTime = 0;
  let normalizer = null;
  let issued = 0; // raw units emitted by integration (before credit)

  const computeNormalizer = () => {
    if (normalizer !== null) return;

    if (isInfinite) {
      const sampleDuration = 60;
      const samples = sampleCount;
      const dt = sampleDuration / samples;
      let integral = 0;
      let prev = rateFn(0);
      for (let i = 1; i <= samples; i++) {
        const t = i * dt;
        const curr = rateFn(t);
        integral += ((prev + curr) / 2) * dt;
        prev = curr;
      }
      const avgRate = integral / sampleDuration;
      normalizer = units / (avgRate || 1);
    } else {
      const samples = sampleCount;
      const dt = durationSeconds / samples;
      let integral = 0;
      let prev = rateFn(0);
      for (let i = 1; i <= samples; i++) {
        const t = Math.min(i * dt, durationSeconds);
        const curr = rateFn(t);
        integral += ((prev + curr) / 2) * dt;
        prev = curr;
      }
      normalizer = units / (integral || 1);
    }
  };

  /**
   * Advance the accumulator by one frame and return how many *new* units to spawn this frame.
   *
   * @param {number} deltaSeconds - Time since last frame (standard animation delta).
   * @param {number} [credit=0] - Units already satisfied this frame by a higher-priority scene
   *        (e.g. overlapping columns from scene B when processing scene A). These are *not* spawned again.
   */
  self.advance = (deltaSeconds, credit = 0) => {
    if (deltaSeconds <= 0) return 0;
    computeNormalizer();

    const then = currentTime;
    const now = currentTime + deltaSeconds;
    const rate1 = rateFn(then);
    const rate2 = rateFn(now);
    const delta = ((rate1 + rate2) / 2) * deltaSeconds * normalizer;

    remainder += delta;
    let rawAmount = Math.floor(remainder);
    remainder -= rawAmount;

    // Finite window: never overshoot units; flush any shortfall at the end.
    if (!isInfinite) {
      const room = Math.max(0, units - issued);
      if (rawAmount > room) {
        remainder += rawAmount - room;
        rawAmount = room;
      }
      if (now >= durationSeconds && issued + rawAmount < units) {
        rawAmount = units - issued;
        remainder = 0;
      }
    }

    issued += rawAmount;

    const effectiveAmount = Math.max(0, rawAmount - credit);

    // credited units were satisfied externally → do NOT carry them back into remainder
    if (minRemainder !== undefined) {
      remainder = Math.max(remainder, minRemainder);
    }

    currentTime = now;
    return effectiveAmount;
  };

  // Return units that advance() issued but could not be spawned (occupied cols, etc.).
  // Keeps finite storm budgets from evaporating while columns still need coverage.
  self.refund = (n) => {
    const k = Math.min(Math.max(0, Math.floor(n)), issued);
    if (k <= 0) return;
    issued -= k;
    remainder += k;
  };

  self.reset = () => {
    remainder = 0;
    currentTime = 0;
    issued = 0;
  };

  /**
   * Returns true when a finite scene has fully completed its accumulation.
   */
  self.isComplete = () => {
    return !isInfinite && currentTime >= durationSeconds && issued >= units;
  };
}

// Standard rate functions (exported for convenience)
VariableRateAccumulator.rates = {
  // Fixed rate forever. r(t) = value
  constant: (value) => () => value,

  // Linear increase from startRate to endRate over rampSec seconds, then holds.
  // Best for finite scenes only.
  linearRamp:
    (startRate, endRate, rampSec = 10) =>
    (t) =>
      startRate + (endRate - startRate) * Math.min(t / rampSec, 1),

  // Sine wave that starts at its trough (slowest point). Your default infinite scene rate.
  // r(t) = avg - amplitude * cos(t * freq)
  sineTroughStart:
    (avg, amplitude, freq = 2.2) =>
    (t) =>
      avg - amplitude * Math.cos(t * freq),

  // Gentle sine cycle that eases in/out smoothly. Good for both finite and infinite.
  // r(t) = avg + amplitude * sin(t * 2π / period)
  easeInOutSine:
    (avg, amplitude, period = 10) =>
    (t) =>
      avg + amplitude * Math.sin((t * Math.PI * 2) / period),

  // Periodic short high-rate bursts on top of a base. Dramatic "wave" effect.
  pulse:
    (base, peak, cycle = 8, width = 2) =>
    (t) =>
      base + peak * Math.max(0, 1 - Math.abs(((t % cycle) - cycle / 2) / width)),

  // Base rate modulated by squared sine → sharper peaks, flatter troughs.
  quadratic:
    (avg, strength = 2) =>
    (t) =>
      avg * (1 + strength * Math.pow(Math.sin(t * 1.5), 2)),

  // Soft square wave: plateaus with rounded corners (tanh of sine).
  softSquare:
    (avg, amp, period = 12, sharpness = 2.4) =>
    (t) =>
      Math.max(0, avg + amp * Math.tanh(sharpness * Math.sin((t * Math.PI * 2) / period))),

  // Soft square on [minRate, maxRate]. t=0 is the trough (minRate).
  softSquareRange:
    (minRate, maxRate, period = 12, sharpness = 2.6) =>
    (t) => {
      const w = Math.tanh(
        sharpness * Math.sin((t * Math.PI * 2) / period - Math.PI / 2),
      );
      const u = (w + 1) / 2;
      return minRate + (maxRate - minRate) * u;
    },

  // Storm spawn: ease-in floorFrac*max → max (no tail dip; denser late so last
  // unit is not parked in a slower trough). Scale free — VRA normalizes.
  stormMild:
    (duration = 5, floorFrac = 0.75, maxRate = 1) =>
    (t) => {
      const d = Math.max(duration, 1e-6);
      const u = Math.min(Math.max(t / d, 0), 1);
      // 1 - cos(π/2 u): ease-in 0→1 (rate highest at end of window).
      const rise = 1 - Math.cos((Math.PI / 2) * u);
      return maxRate * (floorFrac + (1 - floorFrac) * rise);
    },

  // Storm cosine trough-start (matches ambient rain shape).
  // r(t) = r0 + A (1 − cos(2π t / T)), r(0)=r0, mean = r0+A.
  // Pass meanRate = units/T so ∫_0^T r ≈ units (VRA still normalizes).
  // If meanRate < startRate, amp=0 → flat startRate (normalizer scales down).
  stormCosine:
    (duration = 5, startRate = 2, meanRate = null) =>
    (t) => {
      const T = Math.max(duration, 1e-6);
      const r0 = Math.max(0, Number(startRate) || 0);
      const mean =
        meanRate != null && Number.isFinite(meanRate) && meanRate >= 0
          ? meanRate
          : r0;
      const amp = Math.max(0, mean - r0);
      return r0 + amp * (1 - Math.cos((t * Math.PI * 2) / T));
    },
};

export { VariableRateAccumulator };
export default VariableRateAccumulator;

// ===========================================================
// Tests
// ===========================================================
// Smoke: async IIFE only (no top-level await — Safari/WebKit / DDG iOS).
if (import.meta.main) {
  void (async () => {

    const assert = (await import("node:assert/strict")).default;

    console.log("Running VariableRateAccumulator tests...");

    const rates = VariableRateAccumulator.rates;

    // === Finite mode tests (all rates) ===
    const finiteTestCases = [
      { name: "constant", fn: rates.constant(5), target: 200 },
      { name: "linearRamp", fn: rates.linearRamp(2, 12), target: 200 },
      { name: "sineTroughStart", fn: rates.sineTroughStart(4, 3.5), target: 200 },
      { name: "easeInOutSine", fn: rates.easeInOutSine(10, 7.5), target: 200 },
      { name: "pulse", fn: rates.pulse(3, 12), target: 200 },
      { name: "quadratic", fn: rates.quadratic(8), target: 200 },
    ];

    for (const tc of finiteTestCases) {
      const acc = new VariableRateAccumulator(tc.target, 20, tc.fn);
      let total = 0;
      const steps = 200;
      const delta = 20 / steps;
      for (let i = 0; i < steps; i++) {
        total += acc.advance(delta);
      }
      assert.ok(
        Math.abs(total - tc.target) <= 15,
        `${tc.name} finite total ${total} close to ${tc.target}`,
      );
    }

    // === Infinite mode tests (only rates with stable long-term average) ===
    const infiniteTestCases = [
      { name: "constant", fn: rates.constant(5), avgRate: 5 },
      { name: "sineTroughStart", fn: rates.sineTroughStart(4, 3.5), avgRate: 4 },
      { name: "easeInOutSine", fn: rates.easeInOutSine(10, 7.5), avgRate: 10 },
      { name: "pulse", fn: rates.pulse(3, 12), avgRate: 6 },
      { name: "quadratic", fn: rates.quadratic(8), avgRate: 12 },
    ];

    // Storm mild: 75% → max ease-in; no tail dip.
    {
      const fn = rates.stormMild(5, 0.75, 1);
      assert.ok(Math.abs(fn(0) - 0.75) < 1e-9, `stormMild start ${fn(0)}`);
      assert.ok(fn(2.5) > 0.75 && fn(2.5) < 1, `stormMild mid ${fn(2.5)}`);
      assert.ok(Math.abs(fn(5) - 1) < 1e-9, `stormMild end ${fn(5)}`);
      assert.ok(fn(4) > fn(1), "stormMild denser later");
    }

    // Storm cosine: trough startRate, mean units/T, peak start+2·amp.
    {
      const T = 6;
      const units = 18;
      const start = 2;
      const mean = units / T; // 3
      const fn = rates.stormCosine(T, start, mean);
      assert.ok(Math.abs(fn(0) - start) < 1e-9, `stormCosine start ${fn(0)}`);
      assert.ok(Math.abs(fn(T / 2) - (start + 2 * (mean - start))) < 1e-9, "stormCosine peak");
      const acc = new VariableRateAccumulator(units, T, fn);
      let total = 0;
      for (let i = 0; i < 120; i++) total += acc.advance(T / 120);
      assert.equal(total, units, `stormCosine finite total ${total}`);
    }

    // Finite flush: exact unit count even when remainder would strand the last drop.
    {
      const acc = new VariableRateAccumulator(7, 2, rates.stormMild(2));
      let total = 0;
      for (let i = 0; i < 40; i++) total += acc.advance(0.05);
      assert.equal(total, 7, `finite storm flush total ${total}`);
      assert.ok(acc.isComplete(), "finite complete after window");
    }

    // Refund: blocked spawns do not consume the finite budget permanently.
    {
      const acc = new VariableRateAccumulator(4, 1, rates.constant(1));
      let got = 0;
      for (let i = 0; i < 20; i++) {
        const want = acc.advance(0.05);
        // Simulate: only 1 free column while VRA wants more.
        const spawn = Math.min(want, 1);
        if (want > spawn) acc.refund(want - spawn);
        got += spawn;
      }
      // After window, keep refunding until all 4 succeed across frames.
      for (let i = 0; i < 10 && got < 4; i++) {
        const want = acc.advance(0.05);
        const spawn = Math.min(want, 1);
        if (want > spawn) acc.refund(want - spawn);
        got += spawn;
      }
      assert.equal(got, 4, `refund eventually covers all units got=${got}`);
    }

    for (const tc of infiniteTestCases) {
      const acc = new VariableRateAccumulator(tc.avgRate, Infinity, tc.fn);
      let total = 0;
      for (let i = 0; i < 250; i++) {
        // 10 seconds
        total += acc.advance(0.04);
      }
      const expected = tc.avgRate * 10;
      assert.ok(
        Math.abs(total - expected) <= 18,
        `${tc.name} infinite total ${total} close to ${expected}`,
      );
    }

    // === Overlapping priority test (validates credit system) ===
    // Both scenes target 50 units over 10 s. With 60% credit, sceneA should spawn noticeably fewer.
    const sceneB = new VariableRateAccumulator(50, 10, rates.easeInOutSine(10, 7.5));
    const sceneA = new VariableRateAccumulator(50, 10, rates.easeInOutSine(10, 7.5), 2000, 0);

    let totalB = 0,
      totalA = 0;
    for (let i = 0; i < 100; i++) {
      const numB = sceneB.advance(0.1);
      totalB += numB;

      const creditToA = Math.floor(numB * 0.6);
      const numA = sceneA.advance(0.1, creditToA);
      totalA += numA;
    }
    assert.ok(
      totalB > 45 && totalA <= totalB,
      `Overlap test: B=${totalB}, A=${totalA} (A got credit for shared)`,
    );

    const green = (text) => `\x1b[32m${text}\x1b[0m`;
    console.log(`All tests passed! ${green("✓")}`);

  })();
}
