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

// Returns a random character from the given alphabet.
// Defaults to printable ASCII (33-126).
const randomChar = (alphabet = charset) => {
  if (typeof alphabet !== "string" || alphabet.length === 0) {
    throw new Error("randomChar() expects a non-empty string");
  }
  return alphabet[Math.floor(Math.random() * alphabet.length)];
};

// Returns a random element from a string, array, Set, or iterable.
const randomChoice = (collection) => {
  if (typeof collection === "string") {
    if (collection.length === 0) {
      throw new Error("randomChoice() cannot choose from an empty string");
    }
    return collection[Math.floor(Math.random() * collection.length)];
  }

  let arr;
  if (Array.isArray(collection)) {
    arr = collection;
  } else if (collection instanceof Set) {
    arr = Array.from(collection);
  } else if (collection && typeof collection === "object") {
    arr = Array.from(collection);
  } else {
    throw new Error("randomChoice() expects a string, array, Set or iterable");
  }

  if (arr.length === 0) {
    throw new Error("randomChoice() cannot choose from an empty collection");
  }

  return arr[Math.floor(Math.random() * arr.length)];
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
