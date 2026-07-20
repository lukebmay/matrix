/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

const charsetArr = [];
for (let i = 33; i < 127; i++) {
  charsetArr.push(String.fromCharCode(i));
}
const charset = charsetArr.join("");

// Code-point arrays for repeated randomChar(alphabet) — avoid Array.from each pick.
const alphabetCache = new Map();
const charsOf = (alphabet) => {
  let chars = alphabetCache.get(alphabet);
  if (chars) return chars;
  chars = Array.from(alphabet);
  if (chars.length === 0) {
    throw new Error("randomChar() expects a non-empty string");
  }
  alphabetCache.set(alphabet, chars);
  return chars;
};

// Pick index i from a Set without allocating an array (O(n) walk).
const pickFromSet = (set) => {
  const n = set.size;
  if (n === 0) {
    throw new Error("randomChoice() cannot choose from an empty collection");
  }
  let i = Math.floor(Math.random() * n);
  for (const item of set) {
    if (i === 0) return item;
    i -= 1;
  }
  // Unreachable if size is stable during iteration.
  throw new Error("randomChoice() cannot choose from an empty collection");
};

// Returns a random character from the given alphabet.
// Defaults to printable ASCII (33-126). Code-point safe (not UTF-16 units).
const randomChar = (alphabet = charset) => {
  if (typeof alphabet !== "string" || alphabet.length === 0) {
    throw new Error("randomChar() expects a non-empty string");
  }
  const chars = charsOf(alphabet);
  return chars[Math.floor(Math.random() * chars.length)];
};

// Returns a random element from a string, array, Set, or iterable.
const randomChoice = (collection) => {
  if (typeof collection === "string") {
    if (collection.length === 0) {
      throw new Error("randomChoice() cannot choose from an empty string");
    }
    // Code-point safe via cache (UTF-16 index would break multi-unit glyphs).
    const chars = charsOf(collection);
    return chars[Math.floor(Math.random() * chars.length)];
  }

  if (Array.isArray(collection)) {
    if (collection.length === 0) {
      throw new Error("randomChoice() cannot choose from an empty collection");
    }
    return collection[Math.floor(Math.random() * collection.length)];
  }

  if (collection instanceof Set) {
    return pickFromSet(collection);
  }

  if (collection && typeof collection === "object") {
    const arr = Array.from(collection);
    if (arr.length === 0) {
      throw new Error("randomChoice() cannot choose from an empty collection");
    }
    return arr[Math.floor(Math.random() * arr.length)];
  }

  throw new Error("randomChoice() expects a string, array, Set or iterable");
};

// Returns a random float where lowerBoundInclusive ≤ result < upperBoundExclusive.
const randomInterval = (lowerBoundInclusive, upperBoundExclusive) => {
  if (upperBoundExclusive <= lowerBoundInclusive) {
    throw new Error("randomInterval() upper bound must be greater than lower bound");
  }
  return Math.random() * (upperBoundExclusive - lowerBoundInclusive) + lowerBoundInclusive;
};

// Shuffles an array **in-place** (Fisher-Yates / Durstenfeld) and returns it.
const shuffle = (arr) => {
  if (!Array.isArray(arr)) {
    throw new Error("shuffle() expects an array");
  }

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export { randomChar, randomChoice, randomInterval, shuffle };

export default {
  randomChar,
  randomChoice,
  randomInterval,
  shuffle,
};

// ===========================================================
// Tests
// ===========================================================
if (import.meta.main) {
  const assert = (await import("node:assert/strict")).default;

  console.log("Running tests...");

  // randomInterval tests
  for (let i = 0; i < 50; i++) {
    const val = randomInterval(10, 20);
    assert.ok(val >= 10 && val < 20);
  }
  assert.throws(() => randomInterval(5, 5), /upper bound must be greater/);

  // randomChar tests
  const sample = "xyz123";
  for (let i = 0; i < 30; i++) {
    const ch = randomChar(sample);
    assert.strictEqual(ch.length, 1);
    assert.ok(sample.includes(ch));
  }
  assert.throws(() => randomChar(""), /non-empty string/);

  // randomChoice tests
  const colors = ["red", "green", "blue"];
  for (let i = 0; i < 30; i++) {
    assert.ok(colors.includes(randomChoice(colors)));
  }
  assert.throws(() => randomChoice([]), /empty collection/);

  // shuffle tests
  const nums = [1, 2, 3, 4, 5];
  const copy = [...nums];
  const shuffled = shuffle(copy);
  assert.strictEqual(shuffled.length, nums.length);
  assert.deepStrictEqual(new Set(shuffled), new Set(nums));

  const green = (text) => `\x1b[32m${text}\x1b[0m`;
  console.log(`All tests passed! ${green("✓")}`);
}
