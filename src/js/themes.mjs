/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Palette roles (CSS --col-* for settled; per-drop --drop-* while falling):
//   low   — residual / dark fill
//   med   — drop tails
//   body  — settled non-link text (slightly whiter than med)
//   hi    — drop tip (bright, still on-hue)
//   link / linkHover — settled links (brighter; hover closest to white)

/** Fixed open sequence, then random from THEME_POOL. */
export const THEME_INTRO = [
  "green",
  "blue",
  "purple",
  "red",
  "orange",
  "yellow",
  "green",
];

/** All selectable themes (random pool after intro). */
export const THEME_ORDER = [
  "green",
  "blue",
  "purple",
  "red",
  "orange",
  "yellow",
];

export const THEME_POOL = [...THEME_ORDER];

// hi/link: bright but keep a touch of hue (not pure white).
export const THEMES = {
  green: {
    low: "#000e00",
    med: "#0d731a",
    body: "#149428",
    hi: "#c0ffd0",
    link: "#d8ffe4",
    linkHover: "#ecfff2",
  },
  blue: {
    low: "#00000e",
    med: "#0d3a73",
    body: "#1450a0",
    hi: "#c0d8ff",
    link: "#d8e8ff",
    linkHover: "#ecf4ff",
  },
  purple: {
    low: "#08000e",
    med: "#4a1873",
    body: "#5e22a0",
    hi: "#e0c0ff",
    link: "#ecd8ff",
    linkHover: "#f6ecff",
  },
  red: {
    low: "#0e0000",
    med: "#73100d",
    body: "#9a1a14",
    hi: "#ffc0c0",
    link: "#ffd8d8",
    linkHover: "#ffecec",
  },
  orange: {
    low: "#0e0500",
    med: "#a04a0a",
    body: "#c45c12",
    hi: "#ffd0a0",
    link: "#ffe4c0",
    linkHover: "#fff2e0",
  },
  yellow: {
    low: "#100e00",
    med: "#b8a014",
    body: "#d4bc1c",
    hi: "#fff0a0",
    link: "#fff6c0",
    linkHover: "#fffcdd",
  },
};

export function getPalette(name) {
  return THEMES[name] ?? null;
}

function parseHex(hex) {
  const s = String(hex ?? "").replace("#", "").trim();
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16);
    const g = parseInt(s[1] + s[1], 16);
    const b = parseInt(s[2] + s[2], 16);
    return [r, g, b];
  }
  if (s.length >= 6) {
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
    ];
  }
  return null;
}

function toHex([r, g, b]) {
  const h = (n) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Linear RGB mix; t in [0,1]. */
export function lerpHex(a, b, t) {
  const A = parseHex(a);
  const B = parseHex(b);
  if (!A || !B) return b ?? a;
  const u = Math.max(0, Math.min(1, Number(t) || 0));
  return toHex([
    A[0] + (B[0] - A[0]) * u,
    A[1] + (B[1] - A[1]) * u,
    A[2] + (B[2] - A[2]) * u,
  ]);
}

function resolvePalette(nameOrPalette) {
  const palette =
    typeof nameOrPalette === "string"
      ? THEMES[nameOrPalette]
      : nameOrPalette;
  if (!palette) {
    throw new Error(`themes: unknown theme ${nameOrPalette}`);
  }
  return palette;
}

/** Settled + drop defaults (not residual cell memory — that is per-cell). */
export function applyTheme(nameOrPalette, opts = {}) {
  const palette = resolvePalette(nameOrPalette);
  const root = document.documentElement;
  const skipLow = opts.skipLow === true;
  if (!skipLow) root.style.setProperty("--col-low", palette.low);
  root.style.setProperty("--col-med", palette.med);
  root.style.setProperty("--col-body", palette.body ?? palette.med);
  root.style.setProperty("--col-hi", palette.hi);
  root.style.setProperty("--col-link", palette.link);
  root.style.setProperty("--col-link-hover", palette.linkHover);
  return palette;
}

export function applyLowColor(hex) {
  document.documentElement.style.setProperty("--col-low", hex);
}

export function themeAt(index, order = THEME_ORDER) {
  const n = order.length;
  if (!n) return null;
  const i = ((index % n) + n) % n;
  return order[i];
}

function pickRandomTheme(pool, exclude) {
  const choices = pool.filter((n) => n !== exclude && THEMES[n]);
  if (!choices.length) {
    const any = pool.filter((n) => THEMES[n]);
    return any[Math.floor(Math.random() * any.length)] ?? exclude;
  }
  return choices[Math.floor(Math.random() * choices.length)];
}

/**
 * Owns active palette + blended spawn of next-theme drops.
 * Intro sequence first, then random picks from the pool.
 */
export function ThemeDirector(opts = {}) {
  const intro = opts.intro?.length ? [...opts.intro] : [...THEME_INTRO];
  const pool = opts.pool?.length ? [...opts.pool] : [...THEME_POOL];
  // introStep: index of the next intro theme (1 after start on intro[0]).
  let introStep = 1;
  let activeName = opts.start ?? intro[0] ?? "green";
  let nextName = null;
  let phase = "steady"; // steady | ramp | full
  let blendElapsed = 0;
  let blendSec = 5;
  let fullSec = 1.5;
  // Ambient --col-low fade (unstamped residual only; cell text uses --res-low).
  let fadeFromLow = null;
  let fadeToLow = null;
  let fadeElapsed = 0;
  let fadeSec = Math.max(0.2, Number(opts.fadeSec) || 3);
  let fadingLow = false;
  const listeners = new Map();

  applyTheme(activeName);

  const emit = (event, detail) => {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(detail);
      } catch {
        // ignore
      }
    }
  };

  const on = (event, fn) => {
    if (typeof fn !== "function") return () => {};
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(fn);
    return () => set.delete(fn);
  };

  const commit = () => {
    if (!nextName) {
      phase = "steady";
      return;
    }
    const fromPal = THEMES[activeName];
    const toPal = THEMES[nextName];
    activeName = nextName;
    nextName = null;
    phase = "steady";
    blendElapsed = 0;
    if (introStep < intro.length) introStep += 1;

    // Settled roles snap for the next card; ambient low fades.
    // Residual glyphs keep --res-low until a drop visits the cell.
    applyTheme(activeName, { skipLow: true });
    if (fromPal && toPal && fromPal.low !== toPal.low) {
      fadeFromLow = fromPal.low;
      fadeToLow = toPal.low;
      fadeElapsed = 0;
      fadingLow = true;
      applyLowColor(fadeFromLow);
    } else if (toPal) {
      applyLowColor(toPal.low);
      fadingLow = false;
    }

    emit("committed", { theme: activeName });
    emit("completed", { theme: activeName });
  };

  const self = {
    get active() {
      return activeName;
    },
    get next() {
      return nextName;
    },
    get phase() {
      return phase;
    },
    get intro() {
      return intro;
    },
    get pool() {
      return pool;
    },
    /** True while still walking THEME_INTRO. */
    get inIntro() {
      return introStep < intro.length;
    },
    on,

    peekNext() {
      if (introStep < intro.length) return intro[introStep];
      return pickRandomTheme(pool, activeName);
    },

    /** Start ramping spawn toward `to` (default: next intro / random). */
    beginTransition(toName, timing = {}) {
      const to = toName ?? self.peekNext();
      if (!to || !THEMES[to]) return self;
      if (to === activeName && phase === "steady") return self;

      nextName = to;
      blendSec = Math.max(0.2, Number(timing.blendSec) || 5);
      fullSec = Math.max(0, Number(timing.fullSec) || 1.5);
      if (timing.fadeSec != null) {
        fadeSec = Math.max(0.2, Number(timing.fadeSec) || 3);
      }
      blendElapsed = 0;
      phase = "ramp";
      emit("started", { from: activeName, to: nextName });
      return self;
    },

    beginNextTransition(timing = {}) {
      return self.beginTransition(self.peekNext(), timing);
    },

    /** Frame advance (seconds). Call from Matrix loop. */
    tick(dtSec) {
      const dt = Number(dtSec);
      if (!(dt > 0)) return;

      // Ambient low fade continues after commit (independent of blend phase).
      if (fadingLow && fadeFromLow && fadeToLow) {
        fadeElapsed += dt;
        const t = Math.min(1, fadeElapsed / fadeSec);
        // Smoothstep so the mid-cross feels softer.
        const u = t * t * (3 - 2 * t);
        applyLowColor(lerpHex(fadeFromLow, fadeToLow, u));
        if (t >= 1) fadingLow = false;
      }

      if (phase === "steady" || !nextName) return;
      blendElapsed += dt;

      if (phase === "ramp") {
        if (blendElapsed >= blendSec) {
          phase = "full";
          blendElapsed = 0;
          if (fullSec <= 0) commit();
        }
        return;
      }

      if (phase === "full" && blendElapsed >= fullSec) {
        commit();
      }
    },

    /**
     * Theme name for a newly spawned drop.
     * Ramp: ease-in probability of next (rare new color first, then mix).
     */
    pickSpawnTheme() {
      if (phase === "steady" || !nextName) return activeName;
      if (phase === "full") return nextName;
      const t = Math.min(1, blendElapsed / blendSec);
      const p = t * t;
      return Math.random() < p ? nextName : activeName;
    },

    paletteFor(name) {
      return THEMES[name] ?? THEMES[activeName];
    },

    /** Call fn when idle; else once on next commit. Returns off.
     * Immediate case is async so thread.wait can finish arming. */
    whenIdle(fn) {
      if (typeof fn !== "function") return () => {};
      if (phase === "steady") {
        let cancelled = false;
        queueMicrotask(() => {
          if (!cancelled) fn({ theme: activeName });
        });
        return () => {
          cancelled = true;
        };
      }
      return on("committed", fn);
    },

    forceCommit() {
      if (phase !== "steady") commit();
      return self;
    },
  };

  return self;
}

export default {
  THEMES,
  THEME_ORDER,
  THEME_INTRO,
  THEME_POOL,
  applyTheme,
  applyLowColor,
  getPalette,
  themeAt,
  lerpHex,
  ThemeDirector,
};
