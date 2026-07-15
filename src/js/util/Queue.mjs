/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

function Queue(initial) {
  if (!new.target) return new Queue(initial);

  const q = Array.isArray(initial) ? [...initial] : [];

  /**
   * Add one item or an array of items to the end of the queue.
   */
  this.add = (item) => {
    if (Array.isArray(item)) q.push(...item);
    else q.push(item);
  };

  /**
   * Dequeue (no arg) → throws if empty.
   * Or remove first occurrence of `item` (returns item or undefined if not found).
   */
  this.remove = (item) => {
    if (item === undefined) {
      if (q.length === 0) {
        throw new Error("Cannot remove from empty queue");
      }
      return q.shift();
    }

    const i = q.indexOf(item);
    if (i !== -1) {
      q.splice(i, 1);
      return item;
    }
    return undefined;
  };

  this.clear = () => {
    q.length = 0;
  };

  this.size = () => q.length;

  this.toString = () => q.toString();
}

export { Queue };

export default Queue;

// ===========================================================
// Tests
// ===========================================================
if (import.meta.main) {
  const assert = (await import("node:assert/strict")).default;

  console.log("Running tests...");

  let q = Queue();

  assert.strictEqual(q.size(), 0);
  assert.throws(() => q.remove(), /Cannot remove from empty queue/);

  q.add("a");
  assert.strictEqual(q.size(), 1);
  assert.strictEqual(q.remove(), "a");
  assert.strictEqual(q.size(), 0);

  q.add(["a", "b"]);
  assert.strictEqual(q.remove(), "a");
  assert.strictEqual(q.size(), 1);

  q.add("c");
  assert.strictEqual(q.remove(), "b");
  assert.strictEqual(q.size(), 1);

  q.add(["d", "e"]);
  assert.strictEqual(q.remove(), "c");
  assert.strictEqual(q.size(), 2);

  q.clear();
  assert.strictEqual(q.size(), 0);
  assert.throws(() => q.remove(), /Cannot remove from empty queue/);

  // Test specific item removal
  q.add(["a", "b", "c", "d", "e"]);
  assert.strictEqual(q.remove("b"), "b");
  assert.strictEqual(q.remove(), "a");
  assert.strictEqual(q.remove("e"), "e");
  assert.strictEqual(q.size(), 2);

  // Test removing non-existent item + duplicates (with explicit clear)
  q.clear();
  q.add(["a", "b", "c", "b", "e"]);

  assert.strictEqual(q.size(), 5);
  assert.strictEqual(q.remove("b"), "b");
  assert.strictEqual(q.remove("foo"), undefined);
  assert.strictEqual(q.size(), 4);

  const green = (text) => `\x1b[32m${text}\x1b[0m`;
  console.log(`All tests passed! ${green("✓")}`);
}
