/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import { shuffle } from "./util/random.mjs";

/**
 * Homepage interlude playlist: sayings (quotes, adages, jokes, asides).
 *
 * Entry shape:
 *   { content, attribution?, context? }
 *
 * Layout (fixed saying window; see Configuration SAYING_MAX_WIDTH):
 *   content lines…          ← centered in window
 *                 - Author  ← right-justified (if present)
 *      (optional context)   ← right-justified, parentheses (if present)
 */
export const SAYINGS = Object.freeze([
  // Opener: always first draw of each deck; rest of deck is shuffled without it.
  {
    content:
      "Most people are willing to sacrifice their own liberty, and yours, for the illusion of safety.",
    attribution: "Luke Benjamin May",
  },
  {
    content:
      "The instrument of labour, when it takes the form of a machine, immediately becomes a competitor of the workman himself.",
    attribution: "Karl Marx",
    context: "in opposition to the shovel",
  },
  {
    content: "Liberty and responsibility are inseparable.",
    attribution: "Friedrich Hayek",
  },
  {
    content: "The smallest minority on earth is the individual.",
    attribution: "Ayn Rand",
  },
  {
    content: "Government can't give anything without depriving us of something else.",
    attribution: "Henry Hazlitt",
  },
  {
    content: "There is no such thing as a free lunch.",
  },
  {
    content:
      "A free country is one in which every citizen is free to fashion his life according to his own plans.",
    attribution: "Ludwig von Mises",
  },
  {
    content:
      "Capitalism will continue to eliminate mass poverty... if it is merely permitted to do so.",
    attribution: "Henry Hazlitt",
  },
  {
    content:
      "All people, however fanatical they may be in their zeal to disparage and to fight capitalism, implicitly pay homage to it by passionately clamoring for the products it turns out.",
    attribution: "Ludwig von Mises",
  },
  {
    content:
      "The foundation of any and every civilization... is private ownership of the means of production.",
    attribution: "Ludwig von Mises",
  },
  {
    content:
      "The noblest charity is to preclude a man from accepting charity, and the best alms are to show and enable a man to dispense with alms.",
    attribution: "Moses Maimonides",
  },
  {
    content:
      "Of every thousand dollars spent in so-called charity today, it is probable that nine hundred and fifty dollars is unwisely spent... as to produce the very evils which it hopes to mitigate or cure.",
    attribution: "Andrew Carnegie",
  },
  {
    content:
      "Capitalism is the greatest creation humanity has done for social cooperation. It has lifted humanity out of the dirt.",
  },
  {
    content:
      "The fundamental social phenomenon is the division of labor and its counterpart human cooperation.",
    attribution: "Ludwig von Mises",
  },
  {
    content:
      "Valuable achievement can sprout from human society only when it is sufficiently loosened to make possible the free development of an individual's abilities.",
    attribution: "Albert Einstein",
  },
  {
    content:
      "The great achievements of civilization have not come from government bureaus... In the only cases in which the masses have escaped from... grinding poverty... are where they have had capitalism and largely free trade.",
    attribution: "Milton Friedman",
  },
  {
    content:
      "Every individual is an expression of the whole realm of nature, a unique action of the total universe.",
    attribution: "Alan Watts",
  },
  {
    content:
      "When a man no longer confuses himself with the definition of himself that others have given him, he is at once universal and unique.",
    attribution: "Alan Watts",
  },
  {
    content: "He who is not charitable out of his own free will is not charitable at all.",
  },
  {
    content: "The only true charity is that which helps a man to help himself.",
  },
  {
    content: "Society is a cooperative venture for mutual advantage.",
  },
  {
    content: "Any sufficiently advanced technology is indistinguishable from magic.",
    attribution: "Arthur C. Clarke",
  },
  {
    content:
      "There are 10 types of people in the world: those who understand binary and those who don't.",
  },
  {
    content: "There are 2 types of people: those who can extrapolate from incomplete data.",
  },
  {
    content: "The best thing about a Boolean is even if you are wrong, you are only off by a bit.",
  },
  {
    content:
      "There are two hard things in computer science: cache invalidation, naming things, and off-by-one errors.",
  },
]);

/**
 * Strip quotation marks, map dashes → single hyphen, ellipses → "...".
 * Keeps apostrophes (don't, individual's) and parentheses.
 */
export function normalizeSayingText(raw) {
  if (raw == null) return "";
  let s = String(raw).trim();
  // Double quotes / guillemets / primes used as quotation marks.
  s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036"«»„]/g, "");
  // Ellipsis glyphs → three periods.
  s = s.replace(/[\u2026\u22EF\u2025]/g, "...");
  // Any dash-like run → single ASCII hyphen.
  s = s.replace(
    /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D-]+/g,
    "-",
  );
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Attribution line: "- Author". Empty when no author. */
export function formatAttribution(attribution) {
  const who = normalizeSayingText(attribution);
  if (!who) return "";
  return `- ${who}`;
}

/**
 * Context line: "(aside…)" right-aligned under attribution (or body).
 * Strips outer parens from source then re-wraps once.
 */
export function formatContext(context) {
  let ctx = normalizeSayingText(context);
  if (!ctx) return "";
  // Drop a single outer ( … ) pair if the author already wrapped it.
  if (ctx.startsWith("(") && ctx.endsWith(")") && ctx.length >= 2) {
    ctx = ctx.slice(1, -1).trim();
  }
  if (!ctx) return "";
  return `(${ctx})`;
}

/**
 * Normalized content + footer strings for layout.
 * Accepts `content` (preferred) or legacy `text`.
 * @returns {{
 *   content: string,
 *   body: string,
 *   attribution: string,
 *   attributionLine: string,
 *   context: string,
 *   contextLine: string,
 * }}
 */
export function sayingParts(entry) {
  if (entry == null) {
    return {
      content: "",
      body: "",
      attribution: "",
      attributionLine: "",
      context: "",
      contextLine: "",
    };
  }
  if (typeof entry === "string") {
    const body = normalizeSayingText(entry);
    return {
      content: body,
      body,
      attribution: "",
      attributionLine: "",
      context: "",
      contextLine: "",
    };
  }
  // Prefer `content`; accept legacy `text` so old callers/data still work.
  const body = normalizeSayingText(entry.content ?? entry.text ?? "");
  const attribution = normalizeSayingText(entry.attribution ?? "");
  const context = normalizeSayingText(entry.context ?? "");
  return {
    content: body,
    body,
    attribution,
    attributionLine: formatAttribution(attribution),
    context,
    contextLine: formatContext(context),
  };
}

/**
 * Multi-line string for tests/logs. Prefer sayingParts() for layout.
 */
export function formatSaying(entry) {
  const { body, attributionLine, contextLine } = sayingParts(entry);
  const lines = [];
  if (body) lines.push(body);
  if (attributionLine) lines.push(attributionLine);
  if (contextLine) lines.push(contextLine);
  return lines.join("\n");
}

/**
 * Draw without replacement from a shuffled pool; refill + reshuffle when empty.
 *
 * @param {readonly unknown[]} items
 * @param {{ leadWithFirst?: boolean }} [opts]
 *   When true, each new deck draws `items[0]` first, then the remaining
 *   items in random order (opener is not re-shuffled into the rest). Pure
 *   shuffle of the full list when false.
 */
export function createShuffledPool(items, opts = {}) {
  const source = Array.isArray(items) ? [...items] : [];
  if (source.length === 0) {
    throw new Error("createShuffledPool() expects a non-empty collection");
  }
  const leadWithFirst = opts.leadWithFirst === true;
  /** @type {unknown[]} */
  let pool = [];

  const refill = () => {
    if (leadWithFirst && source.length > 0) {
      const [lead, ...rest] = source;
      // Rest only — opener is not in the random segment.
      pool = shuffle(rest);
      pool.push(lead); // pop() → lead first
    } else {
      pool = shuffle([...source]);
    }
  };
  refill();

  return {
    get remaining() {
      return pool.length;
    },
    get size() {
      return source.length;
    },
    next() {
      if (pool.length === 0) refill();
      return pool.pop();
    },
    refill,
  };
}

/**
 * Playlist over SAYINGS.
 * Default: each deck opens with SAYINGS[0] (liberty / Luke Benjamin May),
 * then a shuffle of the remaining sayings only.
 */
export function createSayingPlaylist(items = SAYINGS, opts = {}) {
  const leadWithFirst = opts.leadWithFirst !== false;
  const pool = createShuffledPool(items, { leadWithFirst });
  return {
    get remaining() {
      return pool.remaining;
    },
    get size() {
      return pool.size;
    },
    next() {
      return pool.next();
    },
    nextParts() {
      return sayingParts(pool.next());
    },
    nextText() {
      return formatSaying(pool.next());
    },
    refill() {
      pool.refill();
    },
  };
}

export default {
  SAYINGS,
  normalizeSayingText,
  formatAttribution,
  formatContext,
  sayingParts,
  formatSaying,
  createShuffledPool,
  createSayingPlaylist,
};

// ===========================================================
// Smoke tests (async IIFE — no top-level await).
// Safari/WebKit TLA module-graph bugs break DDG iOS (WebKit).
// ===========================================================
if (typeof process !== "undefined" && process.argv?.[1]) {
  void (async () => {
    const { pathToFileURL } = await import("node:url");
    if (pathToFileURL(process.argv[1]).href !== import.meta.url) return;

    const assert = (await import("node:assert/strict")).default;

    const p = createShuffledPool([1, 2, 3]);
    const seen = new Set();
    for (let i = 0; i < 3; i++) seen.add(p.next());
    assert.deepStrictEqual(seen, new Set([1, 2, 3]));
    assert.strictEqual(p.remaining, 0);
    const a = p.next();
    assert.ok([1, 2, 3].includes(a));
    assert.strictEqual(p.remaining, 2);

    const pinned = createShuffledPool(["lead", "b", "c"], { leadWithFirst: true });
    assert.strictEqual(pinned.next(), "lead");
    // Rest of deck excludes lead until refill.
    const rest = new Set([pinned.next(), pinned.next()]);
    assert.deepStrictEqual(rest, new Set(["b", "c"]));
    assert.strictEqual(pinned.next(), "lead"); // next deck opens with lead again

    const pl = createSayingPlaylist();
    assert.ok(pl.size >= 20);
    const first = pl.next();
    assert.strictEqual(first.attribution, "Luke Benjamin May");
    assert.match(first.content, /sacrifice their own liberty/);
    // Second draw is not the opener again (pool rest only).
    const second = pl.next();
    assert.notStrictEqual(second, first);

    assert.strictEqual(
      formatSaying({
        content: "Hi",
        attribution: "Bob",
        context: "aside",
      }),
      "Hi\n- Bob\n(aside)",
    );
    // Legacy `text` field still resolves.
    assert.strictEqual(formatSaying({ text: "Legacy" }), "Legacy");
    assert.strictEqual(
      normalizeSayingText('"Hello" — world\u2026'),
      "Hello - world...",
    );
    assert.strictEqual(formatAttribution("Ada Lovelace"), "- Ada Lovelace");
    assert.strictEqual(
      formatContext("(in opposition to the shovel)"),
      "(in opposition to the shovel)",
    );
    const parts = sayingParts({
      content: "\u201CLiberty\u201D",
      attribution: "Hayek",
      context: "note",
    });
    assert.strictEqual(parts.content, "Liberty");
    assert.strictEqual(parts.body, "Liberty");
    assert.strictEqual(parts.attributionLine, "- Hayek");
    assert.strictEqual(parts.contextLine, "(note)");
    assert.strictEqual(SAYINGS[0].attribution, "Luke Benjamin May");
    assert.ok(SAYINGS[0].content);
    assert.strictEqual(SAYINGS[0].text, undefined);

    const green = (text) => `\x1b[32m${text}\x1b[0m`;
    console.log(`sayings.mjs tests passed! ${green("✓")}`);

  })();
}

