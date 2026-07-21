/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

/**
 * Central performance levels (high / medium / low).
 *
 * All runtime weather, glow, and drop-budget levers that depend on device
 * quality live here. Call sites should read settings via `getPerfSettings`
 * (or frozen cfg fields baked at construction) instead of scattering
 * IS_MOBILE / cheap-glow / weather-scale checks.
 *
 * Levels only escalate mid-session (high → medium → low); never relax.
 */

export const PERF_HIGH = "high";
export const PERF_MEDIUM = "medium";
export const PERF_LOW = "low";

export const PERF_ORDER = [PERF_HIGH, PERF_MEDIUM, PERF_LOW];

/** CSS class on <html> for each level (high = full neon, no thrift class). */
export const PERF_CSS = {
  [PERF_HIGH]: null,
  [PERF_MEDIUM]: "m-perf-med",
  [PERF_LOW]: "m-perf-low",
};

// Absolute rain speed band on high (rows/s). Other levels sample a fraction
// of this span so "20–100% of high" raises the floor without raising max.
export const HIGH_RAIN_SPEED_MIN = 10;
export const HIGH_RAIN_SPEED_MAX = 20;

// Base content-storm window (seconds) on high. Medium/low stretch by scale.
export const HIGH_STORM_DURATION_SEC = 3;

/**
 * @typedef {object} PerfSettings
 * @property {string} level
 * @property {number} rainSpeedFracMin  // of high rain span [0,1]
 * @property {number} rainSpeedFracMax
 * @property {number} stormSpeedFracMin // of high rain span
 * @property {number} stormSpeedFracMax
 * @property {number} dropLengthFrac    // max length = frac * max(ROWS,COLS)
 * @property {number} dropLengthMinFloor // tip + body; absolute min length
 * @property {number} frameAvgClampMs   // 10-frame wall-gap avg → clamp drop max
 * @property {boolean} pauseRainDuringStorm
 * @property {'continue'|'preserve'|'restart'} rainResume
 *   continue  — ambient rain keeps running through storms
 *   preserve  — pause; resume mid-curve after storm
 *   restart   — pause; resume from trough (rate clock 0)
 * @property {boolean} allowStormStack
 * @property {number} stormDurationScale // multiplies HIGH_STORM_DURATION_SEC
 * @property {number} frameDelayMs
 * @property {string|null} cssClass
 * @property {boolean} tipOverStatic     // high: tip brightens settled cells
 */

/** @type {Record<string, PerfSettings>} */
export const PERF_LEVELS = {
  // Full neon, slow long drops, rain through storms, violent short storms.
  [PERF_HIGH]: {
    level: PERF_HIGH,
    rainSpeedFracMin: 0,
    rainSpeedFracMax: 1,
    stormSpeedFracMin: 0.3,
    stormSpeedFracMax: 1,
    dropLengthFrac: 0.6,
    dropLengthMinFloor: 5, // tip + 4 tails
    frameAvgClampMs: 200,
    pauseRainDuringStorm: false,
    rainResume: "continue",
    allowStormStack: true,
    stormDurationScale: 1,
    frameDelayMs: 45,
    cssClass: PERF_CSS[PERF_HIGH],
    tipOverStatic: true,
  },
  // Thrift rain glow; settled text glow fixed under drops; pause rain mid-curve.
  [PERF_MEDIUM]: {
    level: PERF_MEDIUM,
    rainSpeedFracMin: 0.2,
    rainSpeedFracMax: 1,
    stormSpeedFracMin: 0.5,
    stormSpeedFracMax: 1,
    dropLengthFrac: 0.5,
    dropLengthMinFloor: 5, // tip + 4 tails
    frameAvgClampMs: 150,
    pauseRainDuringStorm: true,
    rainResume: "preserve",
    allowStormStack: false,
    stormDurationScale: 1.5,
    frameDelayMs: 75,
    cssClass: PERF_CSS[PERF_MEDIUM],
    tipOverStatic: false,
  },
  // Flattest rain paint; shortest tails; rain restarts at trough after storms.
  [PERF_LOW]: {
    level: PERF_LOW,
    rainSpeedFracMin: 0.4,
    rainSpeedFracMax: 1,
    stormSpeedFracMin: 0.7,
    stormSpeedFracMax: 1,
    dropLengthFrac: 0.4,
    dropLengthMinFloor: 4, // tip + 3 tails
    frameAvgClampMs: 150,
    pauseRainDuringStorm: true,
    rainResume: "restart",
    allowStormStack: false,
    stormDurationScale: 2.5,
    frameDelayMs: 75,
    cssClass: PERF_CSS[PERF_LOW],
    tipOverStatic: false,
  },
};

export function isPerfLevel(name) {
  return name === PERF_HIGH || name === PERF_MEDIUM || name === PERF_LOW;
}

export function getPerfSettings(level) {
  return PERF_LEVELS[level] ?? PERF_LEVELS[PERF_HIGH];
}

/** Next harsher level, or null if already low. */
export function nextPerfLevel(level) {
  const i = PERF_ORDER.indexOf(level);
  if (i < 0 || i >= PERF_ORDER.length - 1) return null;
  return PERF_ORDER[i + 1];
}

/**
 * Static gate only (viewport + client hints). Runtime ratchet may escalate.
 * Narrow or low-power → medium; capable desktop → high.
 */
export function detectInitialPerfLevel({ isMobile = false, isLowPower = false } = {}) {
  if (isMobile || isLowPower) return PERF_MEDIUM;
  return PERF_HIGH;
}

/** Sample [min,max] from a fraction of the high rain speed span. */
export function speedBandFromHighFrac(fracMin, fracMax) {
  const span = HIGH_RAIN_SPEED_MAX - HIGH_RAIN_SPEED_MIN;
  const lo = Math.max(0, Number(fracMin) || 0);
  const hi = Math.max(lo, Number(fracMax) || 1);
  return {
    min: HIGH_RAIN_SPEED_MIN + lo * span,
    max: HIGH_RAIN_SPEED_MIN + hi * span,
  };
}

export function rainSpeedBand(levelOrSettings) {
  const s =
    typeof levelOrSettings === "string"
      ? getPerfSettings(levelOrSettings)
      : levelOrSettings;
  return speedBandFromHighFrac(s.rainSpeedFracMin, s.rainSpeedFracMax);
}

export function stormSpeedBand(levelOrSettings) {
  const s =
    typeof levelOrSettings === "string"
      ? getPerfSettings(levelOrSettings)
      : levelOrSettings;
  return speedBandFromHighFrac(s.stormSpeedFracMin, s.stormSpeedFracMax);
}

/**
 * Drop length band for a grid size.
 * Max = floor(frac * max(rows,cols)); min = floor (or a softer high floor).
 */
export function dropLengthBand(rows, cols, levelOrSettings) {
  const s =
    typeof levelOrSettings === "string"
      ? getPerfSettings(levelOrSettings)
      : levelOrSettings;
  const gridMax = Math.max(1, Number(rows) || 1, Number(cols) || 1);
  const floor = Math.max(1, Math.floor(s.dropLengthMinFloor || 1));
  const maxLen = Math.max(floor, Math.floor(gridMax * s.dropLengthFrac));
  // High: allow shorter-than-max lengths for variety; med/low pin to floor.
  let minLen = floor;
  if (s.level === PERF_HIGH) {
    minLen = Math.max(floor, Math.floor(maxLen * 0.45));
  }
  if (minLen >= maxLen) minLen = Math.max(floor, maxLen - 1);
  return { min: minLen, max: maxLen };
}

export function stormDurationSeconds(levelOrSettings, baseSec = HIGH_STORM_DURATION_SEC) {
  const s =
    typeof levelOrSettings === "string"
      ? getPerfSettings(levelOrSettings)
      : levelOrSettings;
  const base = Number(baseSec);
  const b = Number.isFinite(base) && base > 0 ? base : HIGH_STORM_DURATION_SEC;
  return b * (s.stormDurationScale || 1);
}

/**
 * Active settings: runtime state.perfLevel overrides frozen cfg when set.
 * Prefer this over reading WEATHER_SCALE / IS_CHEAP_GLOW flags.
 */
export function activePerfSettings(stateLike, cfgLike) {
  const level =
    stateLike?.perfLevel ??
    cfgLike?.PERF_LEVEL ??
    PERF_HIGH;
  return getPerfSettings(level);
}

/**
 * Apply HTML thrift classes for the level. Escalate-only safe (clears siblings).
 */
export function applyPerfCss(level, root = document.documentElement) {
  if (!root?.classList) return;
  for (const cls of Object.values(PERF_CSS)) {
    if (cls) root.classList.remove(cls);
  }
  // Legacy aliases removed once CSS uses m-perf-*; keep dual during cutover.
  root.classList.remove("m-cheap-glow", "m-flat-glow");
  const cls = PERF_CSS[level];
  if (cls) root.classList.add(cls);
  root.dataset.perf = level;
}

/**
 * Bake numeric drop/weather fields onto a Configuration instance from a level.
 * Call once at construction; mid-session changes use state.perfLevel + helpers.
 */
export function applyPerfToConfig(cfg, level) {
  const s = getPerfSettings(level);
  const rain = rainSpeedBand(s);
  const storm = stormSpeedBand(s);
  const len = dropLengthBand(cfg.ROWS, cfg.COLS, s);

  cfg.PERF_LEVEL = s.level;
  cfg.DROP_SPEED_MIN = rain.min;
  cfg.DROP_SPEED_MAX = rain.max;
  cfg.STORM_DROP_SPEED_MIN = storm.min;
  cfg.STORM_DROP_SPEED_MAX = storm.max;
  cfg.DROP_LENGTH_MIN = len.min;
  cfg.DROP_LENGTH_MAX = len.max;
  cfg.DROP_LENGTH_MIN_FLOOR = s.dropLengthMinFloor;
  cfg.DROP_LENGTH_FRAC = s.dropLengthFrac;
  cfg.FRAME_AVG_CLAMP_MS = s.frameAvgClampMs;
  cfg.PAUSE_RAIN_DURING_STORM = s.pauseRainDuringStorm;
  cfg.RAIN_RESUME = s.rainResume;
  cfg.ALLOW_STORM_STACK = s.allowStormStack;
  cfg.STORM_DURATION_SCALE = s.stormDurationScale;
  cfg.FRAME_DELAY = s.frameDelayMs;
  cfg.PERF_TIP_OVER_STATIC = s.tipOverStatic;

  // Compat aliases for older call sites / smokes (map level → old flags).
  cfg.IS_CHEAP_GLOW = s.level !== PERF_HIGH;
  cfg.WEATHER_SCALE = s.level !== PERF_HIGH;
  cfg.WEATHER_LENGTH_SCALE = s.dropLengthFrac / PERF_LEVELS[PERF_HIGH].dropLengthFrac;
  cfg.IS_FLAT_GLOW = s.level === PERF_LOW;

  return s;
}

export default {
  PERF_HIGH,
  PERF_MEDIUM,
  PERF_LOW,
  PERF_ORDER,
  PERF_LEVELS,
  PERF_CSS,
  HIGH_RAIN_SPEED_MIN,
  HIGH_RAIN_SPEED_MAX,
  HIGH_STORM_DURATION_SEC,
  isPerfLevel,
  getPerfSettings,
  nextPerfLevel,
  detectInitialPerfLevel,
  rainSpeedBand,
  stormSpeedBand,
  dropLengthBand,
  stormDurationSeconds,
  activePerfSettings,
  applyPerfCss,
  applyPerfToConfig,
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

    console.log("Running performance smoke tests...");

    assert.equal(detectInitialPerfLevel({}), PERF_HIGH);
    assert.equal(detectInitialPerfLevel({ isMobile: true }), PERF_MEDIUM);
    assert.equal(detectInitialPerfLevel({ isLowPower: true }), PERF_MEDIUM);
    assert.equal(nextPerfLevel(PERF_HIGH), PERF_MEDIUM);
    assert.equal(nextPerfLevel(PERF_MEDIUM), PERF_LOW);
    assert.equal(nextPerfLevel(PERF_LOW), null);

    const hiRain = rainSpeedBand(PERF_HIGH);
    const medRain = rainSpeedBand(PERF_MEDIUM);
    const lowRain = rainSpeedBand(PERF_LOW);
    assert.equal(hiRain.min, HIGH_RAIN_SPEED_MIN);
    assert.equal(hiRain.max, HIGH_RAIN_SPEED_MAX);
    assert.ok(medRain.min > hiRain.min, "med raises rain floor");
    assert.ok(lowRain.min > medRain.min, "low raises rain floor further");
    assert.equal(medRain.max, hiRain.max);
    assert.equal(lowRain.max, hiRain.max);

    const hiStorm = stormSpeedBand(PERF_HIGH);
    const lowStorm = stormSpeedBand(PERF_LOW);
    assert.ok(hiStorm.min < lowStorm.min, "low storms start faster");
    assert.equal(hiStorm.max, lowStorm.max);

    const hiLen = dropLengthBand(40, 20, PERF_HIGH);
    const medLen = dropLengthBand(40, 20, PERF_MEDIUM);
    const lowLen = dropLengthBand(40, 20, PERF_LOW);
    assert.equal(hiLen.max, 24); // 0.6 * 40
    assert.equal(medLen.max, 20); // 0.5 * 40
    assert.equal(lowLen.max, 16); // 0.4 * 40
    assert.equal(medLen.min, 5);
    assert.equal(lowLen.min, 4);

    assert.equal(stormDurationSeconds(PERF_HIGH, 3), 3);
    assert.equal(stormDurationSeconds(PERF_MEDIUM, 3), 4.5);
    assert.equal(stormDurationSeconds(PERF_LOW, 3), 7.5);

    const cfg = { ROWS: 30, COLS: 40 };
    applyPerfToConfig(cfg, PERF_MEDIUM);
    assert.equal(cfg.PERF_LEVEL, PERF_MEDIUM);
    assert.equal(cfg.PAUSE_RAIN_DURING_STORM, true);
    assert.equal(cfg.RAIN_RESUME, "preserve");
    assert.equal(cfg.ALLOW_STORM_STACK, false);
    assert.equal(cfg.FRAME_AVG_CLAMP_MS, 150);

    applyPerfToConfig(cfg, PERF_HIGH);
    assert.equal(cfg.PAUSE_RAIN_DURING_STORM, false);
    assert.equal(cfg.ALLOW_STORM_STACK, true);
    assert.equal(cfg.FRAME_AVG_CLAMP_MS, 200);

    const green = (t) => `\x1b[32m${t}\x1b[0m`;
    console.log(`performance smoke tests passed! ${green("✓")}`);

  })();
}

