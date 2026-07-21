/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Python-like range generator.
// Supports positive/negative steps (improvement over original; no breakage for positive use cases).
//
// range(end)
// range(start, end)
// range(start, end, step)
//
// Generator, to complete iteration up front, call the Array version below.
function* range(...args) {
  let start = 0;
  let end;
  let step = 1;

  if (args.length === 1) {
    end = args[0];
  } else if (args.length === 2) {
    [start, end] = args;
  } else if (args.length === 3) {
    [start, end, step] = args;
  } else {
    throw new Error(`range() takes 1-3 arguments (got ${args.length})`);
  }

  if (step === 0) {
    throw new Error("range() step argument must not be zero");
  }

  if (step > 0) {
    for (let i = start; i < end; i += step) yield i;
  } else {
    for (let i = start; i > end; i += step) yield i;
  }
}

// Maps a function over range values (generator).
// Last argument must be the mapping function.
// Generator, to complete iteration up front, call the Array version below.
function* rangeMap(...args) {
  const fn = args.pop();
  if (typeof fn !== "function") {
    throw new Error("rangeMap() final argument must be a function");
  }
  for (let i of range(...args)) {
    yield fn(i);
  }
}

// Completes iteration resulting in an array.
const rangeArray = (...args) => Array.from(range(...args));
const rangeMapArray = (...args) => Array.from(rangeMap(...args));

export { range, rangeArray, rangeMap, rangeMapArray };

export default {
  range,
  rangeArray,
  rangeMap,
  rangeMapArray,
};

// ===========================================================
// Tests
// ===========================================================
// Smoke: async IIFE only (no top-level await — Safari/WebKit / DDG iOS).
if (import.meta.main) {
  void (async () => {

    const assert = (await import("node:assert/strict")).default;

    console.log("Running tests...");

    // range tests
    assert.deepStrictEqual(rangeArray(5), [0, 1, 2, 3, 4]);
    assert.deepStrictEqual(rangeArray(2, 6), [2, 3, 4, 5]);
    assert.deepStrictEqual(rangeArray(1, 10, 2), [1, 3, 5, 7, 9]);
    assert.deepStrictEqual(rangeArray(10, 0, -2), [10, 8, 6, 4, 2]);
    assert.deepStrictEqual(rangeArray(5, 5), []);
    assert.deepStrictEqual(rangeArray(5, -1, -1), [5, 4, 3, 2, 1, 0]);

    // rangeMap / rangeMapArray tests
    let arr = ["a", "b", "c", "d", "e", "f", "g"];
    assert.deepStrictEqual(
      rangeMapArray(1, 6, 2, (i) => arr[i].toUpperCase()),
      ["B", "D", "F"],
    );
    assert.deepStrictEqual(
      rangeMapArray(5, (x) => x * x),
      [0, 1, 4, 9, 16],
    );

    // error cases
    assert.throws(() => Array.from(range(1, 2, 3, 4)), /takes 1-3 arguments/);
    assert.throws(() => Array.from(rangeMap(5, "not fn")), /final argument must be a function/);
    assert.throws(() => Array.from(range(1, 5, 0)), /step argument must not be zero/);

    const green = (text) => `\x1b[32m${text}\x1b[0m`;

    console.log(`All tests passed! ${green("✓")}`);

  })();
}
