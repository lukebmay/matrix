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

import state from "./State.mjs";

/** Starting order for the “one of each color” phase. */
export const THEME_ORDER = [
  "green",
  "blue",
  "purple",
  "red",
  "orange",
  "yellow",
];

/**
 * Super-cycle: 3× green, then one cycle of each non-green color in THEME_ORDER
 * (starting order), then repeat. Built once; ThemeDirector walks it forever.
 */
export function buildThemeCycle(order = THEME_ORDER) {
  const rest = order.filter((n) => n !== "green");
  return ["green", "green", "green", ...rest];
}

export const THEME_CYCLE = buildThemeCycle(THEME_ORDER);

/** @deprecated use THEME_CYCLE — kept for older call sites. */
export const THEME_INTRO = [...THEME_CYCLE];
/** @deprecated pool no longer used for random picks. */
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

/** Debug HUD accents (fade with ambient low on theme commit). */
export function applyDebugColors(hi, med, body) {
  const root = document.documentElement;
  if (hi) root.style.setProperty("--debug-hi", hi);
  if (med) root.style.setProperty("--debug-med", med);
  if (body) root.style.setProperty("--debug-body", body);
}

function applyDebugFromPalette(palette) {
  if (!palette) return;
  applyDebugColors(
    palette.hi,
    palette.med,
    palette.body ?? palette.med,
  );
}

/** Settled + drop defaults (not residual cell memory — that is per-cell). */
export function applyTheme(nameOrPalette, opts = {}) {
  const palette = resolvePalette(nameOrPalette);
  const root = document.documentElement;
  const skipLow = opts.skipLow === true;
  const skipDebug = opts.skipDebug === true;
  if (!skipLow) root.style.setProperty("--col-low", palette.low);
  root.style.setProperty("--col-med", palette.med);
  root.style.setProperty("--col-body", palette.body ?? palette.med);
  root.style.setProperty("--col-hi", palette.hi);
  root.style.setProperty("--col-link", palette.link);
  root.style.setProperty("--col-link-hover", palette.linkHover);
  if (!skipDebug) applyDebugFromPalette(palette);
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

/**
 * Owns active palette + dual-color spawn + residual slug-track fade.
 *
 * Cycle: 3 greens, then one of each non-green color in THEME_ORDER, repeat.
 *
 * Color change timeline (homepage):
 *  1) saying hide **activates** → beginSpawnBlend (new color drops may spawn;
 *     old still allowed; coverage pool refilled for next; no drain storm)
 *  2) saying hide **completes** → startVisualTransition (~2s blank): residual
 *     tracks + debug HUD + ambient low lerp with the empty window
 *  3) visual ends → commit: only new color; old stops; settled roles snap
 *
 * Column ownership: once a next-theme drop spawns on a column, old-theme
 * drops may not spawn there for the rest of the blend.
 */
export function ThemeDirector(opts = {}) {
  const cycle =
    opts.cycle?.length > 0
      ? [...opts.cycle]
      : buildThemeCycle(opts.order ?? THEME_ORDER);
  // Index of the *next* theme in cycle (start already applied).
  let cycleIndex = 1 % cycle.length;
  let activeName = opts.start ?? cycle[0] ?? "green";
  let nextName = null;
  // steady | blend (spawn dual from hide start; visual may lag until empty)
  let phase = "steady";
  let visualActive = false;
  let blendElapsed = 0;
  let blendSec = 3;
  /** @type {Set<number>} */
  const claimedByNext = new Set();
  // Ambient --col-low + debug HUD lerp during visual fade.
  let fadeFromLow = null;
  let fadeToLow = null;
  let fadeFromHi = null;
  let fadeToHi = null;
  let fadeFromMed = null;
  let fadeToMed = null;
  let fadeFromBody = null;
  let fadeToBody = null;
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

  const clearFades = () => {
    fadeFromLow = null;
    fadeToLow = null;
    fadeFromHi = null;
    fadeToHi = null;
    fadeFromMed = null;
    fadeToMed = null;
    fadeFromBody = null;
    fadeToBody = null;
  };

  const commit = () => {
    if (!nextName) {
      phase = "steady";
      visualActive = false;
      return;
    }
    activeName = nextName;
    nextName = null;
    phase = "steady";
    visualActive = false;
    blendElapsed = 0;
    claimedByNext.clear();
    cycleIndex = (cycleIndex + 1) % cycle.length;

    applyTheme(activeName);
    state.domManager?.endResidualTransition?.();
    clearFades();

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
    get visualActive() {
      return visualActive;
    },
    get cycle() {
      return cycle;
    },
    /** @deprecated alias of cycle */
    get intro() {
      return cycle;
    },
    get pool() {
      return THEME_ORDER;
    },
    get inIntro() {
      return false;
    },
    on,

    peekNext() {
      return cycle[cycleIndex] ?? "green";
    },

    /**
     * Saying-hide activation: allow next-theme drops alongside old.
     * Does not start residual/debug fade (that is startVisualTransition).
     */
    beginSpawnBlend(toName) {
      const to = toName ?? self.peekNext();
      if (!to || !THEMES[to]) return self;
      if (phase !== "steady") return self;

      nextName = to;
      phase = "blend";
      visualActive = false;
      blendElapsed = 0;
      claimedByNext.clear();
      clearFades();

      emit("started", { from: activeName, to: nextName });
      return self;
    },

    /**
     * Start residual slug-track + debug/ambient fade (post-hide empty window).
     * Commits when blendSec elapses — old-color spawns stop at commit.
     */
    startVisualTransition(timing = {}) {
      if (phase !== "blend" || !nextName) {
        // Same-color / no spawn blend: still hold empty window then complete.
        if (phase === "steady") {
          nextName = activeName;
          phase = "blend";
          claimedByNext.clear();
        } else {
          return self;
        }
      }
      if (visualActive) return self;

      blendSec = Math.max(0.2, Number(timing.blendSec) || 3);
      blendElapsed = 0;
      visualActive = true;

      const fromPal = THEMES[activeName];
      const toPal = THEMES[nextName];
      const colorChange = activeName !== nextName && fromPal && toPal;
      if (colorChange) {
        fadeFromLow = fromPal.low;
        fadeToLow = toPal.low;
        fadeFromHi = fromPal.hi;
        fadeToHi = toPal.hi;
        fadeFromMed = fromPal.med;
        fadeToMed = toPal.med;
        fadeFromBody = fromPal.body ?? fromPal.med;
        fadeToBody = toPal.body ?? toPal.med;
        applyLowColor(fadeFromLow);
        applyDebugColors(fadeFromHi, fadeFromMed, fadeFromBody);
        state.domManager?.beginResidualTransition?.(toPal.low, {
          fromAmbient: fromPal.low,
        });
      } else {
        clearFades();
      }

      emit("visual", { from: activeName, to: nextName, blendSec });
      return self;
    },

    /**
     * Combined: spawn blend + visual immediately (compat / tests).
     * Prefer beginSpawnBlend + startVisualTransition on the homepage.
     */
    beginTransition(toName, timing = {}) {
      self.beginSpawnBlend(toName);
      return self.startVisualTransition(timing);
    },

    beginNextTransition(timing = {}) {
      return self.beginTransition(self.peekNext(), timing);
    },

    /** Frame advance (seconds). Call from Matrix *after* paint so residuals stick. */
    tick(dtSec) {
      const dt = Number(dtSec);
      if (!(dt > 0)) return;
      if (phase !== "blend" || !nextName || !visualActive) return;

      blendElapsed += dt;
      const t = Math.min(1, blendElapsed / blendSec);
      // Smoothstep mid-cross (matches debug HUD feel).
      const u = t * t * (3 - 2 * t);

      if (fadeFromLow && fadeToLow) {
        applyLowColor(lerpHex(fadeFromLow, fadeToLow, u));
      }
      if (fadeFromHi && fadeToHi) {
        applyDebugColors(
          lerpHex(fadeFromHi, fadeToHi, u),
          lerpHex(fadeFromMed, fadeToMed, u),
          lerpHex(fadeFromBody, fadeToBody, u),
        );
      }
      state.domManager?.tickResidualTransition?.(u);

      if (t >= 1) commit();
    },

    /**
     * Theme for a new drop. Dual-color while blending; only next after commit.
     * New color is eligible from spawn-blend start (saying hide activation).
     */
    pickSpawnTheme() {
      if (phase === "steady" || !nextName) return activeName;
      // Before visual: allow a steady stream of new color (not only ease-in).
      // During visual: ease toward next so old fades out of the mix.
      if (!visualActive) {
        return Math.random() < 0.45 ? nextName : activeName;
      }
      const t = Math.min(1, blendElapsed / blendSec);
      const p = 0.35 + 0.65 * (t * t);
      return Math.random() < p ? nextName : activeName;
    },

    /** Once next-theme hits a column, old-theme may not spawn there. */
    canSpawnOn(col, themeName) {
      if (phase !== "blend" || !nextName) return true;
      if (themeName === nextName) return true;
      if (themeName === activeName && claimedByNext.has(col)) return false;
      return true;
    },

    notifySpawn(col, themeName) {
      if (phase !== "blend" || !nextName) return;
      if (themeName === nextName) claimedByNext.add(col);
    },

    /** True while residual/debug visual fade is running. */
    isResidualTransitioning() {
      return visualActive && phase === "blend";
    },

    /** Next-theme name during blend (for residual stamp policy). */
    residualTargetTheme() {
      return visualActive ? nextName : null;
    },

    paletteFor(name) {
      return THEMES[name] ?? THEMES[activeName];
    },

    /** Call fn when idle; else once on next commit. Returns off. */
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
  THEME_CYCLE,
  THEME_INTRO,
  THEME_POOL,
  buildThemeCycle,
  applyTheme,
  applyLowColor,
  applyDebugColors,
  getPalette,
  themeAt,
  lerpHex,
  ThemeDirector,
};
