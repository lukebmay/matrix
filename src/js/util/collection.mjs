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
// `fn` receives `(key, value)` and must return `[newKey, newValue]`.
const objMap = (obj, fn) => {
  if (typeof fn !== "function") {
    throw new Error("objMap() second argument must be a function");
  }
  if (obj === null || typeof obj !== "object") {
    throw new Error("objMap() first argument must be a plain object");
  }

  return Object.fromEntries(Object.entries(obj).map(([key, value]) => fn(key, value)));
};

export { objMap };

export default { objMap };

// ===========================================================
// Tests
// ===========================================================
if (import.meta.main) {
  const assert = (await import("node:assert/strict")).default;

  console.log("Running tests...");

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

  const green = (text) => `\x1b[32m${text}\x1b[0m`;
  console.log(`All tests passed! ${green("✓")}`);
}
