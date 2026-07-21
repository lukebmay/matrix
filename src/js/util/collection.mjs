/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Maps over an object's entries, transforming keys and/or values.
// `fn` receives `(key, value, obj)` and must return `[newKey, newValue]`.
const objMap = (obj, fn) => {
  if (typeof fn !== "function") {
    throw new Error("objMap() second argument must be a function");
  }
  if (obj === null || typeof obj !== "object") {
    throw new Error("objMap() first argument must be a plain object");
  }

  return Object.fromEntries(Object.entries(obj).map(([key, value]) => fn(key, value, obj)));
};

// Filters an object's key/value pairs.
// `fn` receives `(key, value, obj)` and should return truthy to keep the pair.
const objFilter = (obj, fn) => {
  if (typeof fn !== "function") {
    throw new Error("objFilter() second argument must be a function");
  }
  if (obj === null || typeof obj !== "object") {
    throw new Error("objFilter() first argument must be a plain object");
  }

  return Object.fromEntries(Object.entries(obj).filter(([key, value]) => fn(key, value, obj)));
};

export { objMap, objFilter };

export default { objMap, objFilter };

// ===========================================================
// Tests
// ===========================================================
// Smoke: async IIFE only (no top-level await — Safari/WebKit / DDG iOS).
if (import.meta.main) {
  void (async () => {

    const assert = (await import("node:assert/strict")).default;

    console.log("Running tests...");

    // ------------
    // objMap tests
    // ------------
    // Basic mapping (keys + values)
    const result1 = objMap({ a: 1, b: 2, c: 3 }, (key, val) => [key.toUpperCase(), val * 10]);
    assert.deepStrictEqual(result1, { A: 10, B: 20, C: 30 });

    // Values only (keys unchanged)
    const result2 = objMap({ x: 5, y: 10 }, (key, val) => [key, val + 1]);
    assert.deepStrictEqual(result2, { x: 6, y: 11 });

    // Keys only (values unchanged)
    const result3 = objMap({ first: "John", last: "Doe" }, (key, val) => [`_${key}`, val]);
    assert.deepStrictEqual(result3, { _first: "John", _last: "Doe" });

    // Empty object
    assert.deepStrictEqual(
      objMap({}, (k, v) => [k, v]),
      {},
    );

    // Error cases
    assert.throws(() => objMap({ a: 1 }, "not a function"), /must be a function/);
    assert.throws(() => objMap(null, (k, v) => [k, v]), /must be a plain object/);
    assert.throws(() => objMap(undefined, (k, v) => [k, v]), /must be a plain object/);

    // ---------------
    // objFilter tests
    // ---------------
    const filter1 = objFilter({ a: 1, b: 2, c: 3, d: 4 }, (k, v) => v % 2 === 0);
    assert.deepStrictEqual(filter1, { b: 2, d: 4 });

    const filter2 = objFilter({ name: "John", age: 30, city: "St. Louis" }, (k) => k !== "age");
    assert.deepStrictEqual(filter2, { name: "John", city: "St. Louis" });

    const data = { a: 5, b: 10, c: 15 };
    const filter3 = objFilter(data, (k, v, o) => v > o.a);
    assert.deepStrictEqual(filter3, { b: 10, c: 15 });

    assert.deepStrictEqual(
      objFilter({}, (k, v) => true),
      {},
    );
    assert.deepStrictEqual(
      objFilter({ x: 1, y: 2 }, () => false),
      {},
    );

    // Error cases for objFilter
    assert.throws(() => objFilter({ a: 1 }, "not a function"), /must be a function/);
    assert.throws(() => objFilter(null, (k, v) => true), /must be a plain object/);
    assert.throws(() => objFilter(undefined, (k, v) => true), /must be a plain object/);

    const green = (text) => `\x1b[32m${text}\x1b[0m`;
    console.log(`All tests passed! ${green("✓")}`);

  })();
}
