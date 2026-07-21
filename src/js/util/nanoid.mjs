/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import { randomChoice } from "./random.mjs";

/**
 * URL-friendly nanoid-style ID generator.
 * Default length 21 (standard low-collision size).
 */
const DEFAULT_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-";

const nanoid = (length = 21, alphabet = DEFAULT_ALPHABET) => {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error("nanoid() length must be a positive integer");
  }
  if (typeof alphabet !== "string" || alphabet.length === 0) {
    throw new Error("nanoid() alphabet must be a non-empty string");
  }

  return Array.from({ length }, () => randomChoice(alphabet)).join("");
};

export { nanoid };

export default { nanoid };

// ===========================================================
// Tests
// ===========================================================
// Smoke: async IIFE only (no top-level await — Safari/WebKit / DDG iOS).
if (import.meta.main) {
  void (async () => {

    const assert = (await import("node:assert/strict")).default;

    console.log("Running tests...");

    // default
    const id1 = nanoid();
    assert.strictEqual(id1.length, 21);

    // custom length
    assert.strictEqual(nanoid(10).length, 10);
    assert.strictEqual(nanoid(1).length, 1);

    // custom alphabet
    const custom = "abcdef123";
    const id2 = nanoid(12, custom);
    assert.strictEqual(id2.length, 12);
    for (const char of id2) assert.ok(custom.includes(char));

    // uniqueness (probabilistic check)
    const ids = new Set(Array.from({ length: 50 }, () => nanoid()));
    assert.ok(ids.size > 45);

    // errors
    assert.throws(() => nanoid(0), /positive integer/);
    assert.throws(() => nanoid(10, ""), /non-empty string/);

    const green = (text) => `\x1b[32m${text}\x1b[0m`;
    console.log(`All tests passed! ${green("✓")}`);

  })();
}
