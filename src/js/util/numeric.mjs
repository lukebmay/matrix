/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Constrains a value to the closed interval [min, max].
// Automatically swaps min/max if min > max (preserves original behavior).
const constrainToInterval = (x, min, max) => {
  if (typeof x !== "number" || typeof min !== "number" || typeof max !== "number") {
    throw new Error("constrainToInterval() expects numeric arguments");
  }

  if (min > max) [min, max] = [max, min];

  if (x < min) return min;
  if (x > max) return max;
  return x;
};

export { constrainToInterval };

export default { constrainToInterval };

// ===========================================================
// Tests
// ===========================================================
// Smoke: async IIFE only (no top-level await — Safari/WebKit / DDG iOS).
if (import.meta.main) {
  void (async () => {

    const assert = (await import("node:assert/strict")).default;

    console.log("Running tests...");

    // normal cases
    assert.strictEqual(constrainToInterval(5, 0, 10), 5);
    assert.strictEqual(constrainToInterval(-3, 0, 10), 0);
    assert.strictEqual(constrainToInterval(15, 0, 10), 10);

    // min > max auto-swap
    assert.strictEqual(constrainToInterval(5, 10, 0), 5);
    assert.strictEqual(constrainToInterval(-3, 10, 0), 0);
    assert.strictEqual(constrainToInterval(15, 10, 0), 10);

    // edge cases
    assert.strictEqual(constrainToInterval(0, 0, 10), 0);
    assert.strictEqual(constrainToInterval(10, 0, 10), 10);
    assert.strictEqual(constrainToInterval(7, 7, 7), 7);

    // NaN propagates (original behavior)
    assert.ok(Number.isNaN(constrainToInterval(NaN, 0, 10)));

    // error cases
    assert.throws(() => constrainToInterval("5", 0, 10), /numeric arguments/);
    assert.throws(() => constrainToInterval(5, "0", 10), /numeric arguments/);
    assert.throws(() => constrainToInterval(5, 0, "10"), /numeric arguments/);

    const green = (text) => `\x1b[32m${text}\x1b[0m`;
    console.log(`All tests passed! ${green("✓")}`);

  })();
}
