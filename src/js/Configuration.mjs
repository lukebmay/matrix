/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import DisplayText from "./DisplayText.mjs";
import DropScene from "./DropScene.mjs";
import Rain from "./Rain.mjs";
import SceneManager from "./SceneManager.mjs";
import ScenePlayer from "./ScenePlayer.mjs";
import { homepagePlay } from "./play/homepage.mjs";
import { resolveKiosk } from "./kiosk.mjs";
import { applyTheme, THEMES, ThemeDirector, THEME_INTRO, THEME_POOL } from "./themes.mjs";
import state from "./State.mjs";
import { VariableRateAccumulator } from "./util.mjs";
import Grid from "./layout/Grid.mjs";
import TextLine from "./layout/TextLine.mjs";
import Group from "./layout/Group.mjs";
import { stackVertical } from "./layout/stack.mjs";
import { Anchors } from "./layout/Anchor.mjs";
import { solveLayout } from "./layout/attach.mjs";

// Word-wrap to maxWidth. Long tokens are hard-split. Variable line count.
function wrapWords(text, maxWidth) {
  const width = Math.max(1, Number(maxWidth) || 1);
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  let cur = "";

  const pushHard = (token) => {
    for (let i = 0; i < token.length; i += width) {
      lines.push(token.slice(i, i + width));
    }
  };

  for (const word of words) {
    if (word.length > width) {
      if (cur) {
        lines.push(cur);
        cur = "";
      }
      pushHard(word);
      continue;
    }
    const next = cur ? `${cur} ${word}` : word;
    if (next.length <= width) {
      cur = next;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Homepage copy (shared by grid sizing + createScene so grid tracks content).
const SITE = "https://www.lukemay.com";
const ROLE_SPECS = [
  { text: "Luke Benjamin May", href: `${SITE}/resume` },
  { text: "Full Stack Web Developer", href: `${SITE}/game-of-life` },
  { text: "Software Engineer", href: SITE },
  { text: "Agentic Engineer", href: SITE },
  { text: "Graduate CS Instructor", href: "https://isu.lukemay.com" },
  { text: "YouTube", href: "https://www.youtube.com/lukebeenjammin" },
];
const EMAIL_H_TEXT = "lukebmay at gmail dot com";
const EMAIL_V_TEXT = "LukeBMay at gmail";
const QUOTE_TEXT =
  "Most people are willing to sacrifice their own liberty, and yours, for the illusion of safety.";

// Card geometry from copy. When cards change, update copy — grid tracks this.
function cardContentMetrics({ emailVertical = true } = {}) {
  const rolesH = ROLE_SPECS.length;
  const rolesW = Math.max(0, ...ROLE_SPECS.map((s) => s.text.length));
  // Horizontal email is 1 row; vertical L-arm is length×1 when enabled.
  const emailH = emailVertical
    ? Math.max(1, EMAIL_V_TEXT.length)
    : 1;
  const emailW = Math.max(1, EMAIL_H_TEXT.length);
  return { rolesH, rolesW, emailH, emailW, emailVertical };
}

// Widest fixed line (roles + horizontal email). Quote wraps separately.
const MAX_CONTENT_WIDTH = Math.max(
  EMAIL_H_TEXT.length,
  ...ROLE_SPECS.map((s) => s.text.length),
);

// Narrow viewports: fewer cells (performance); content-driven COLS.
const MOBILE_MAX_WIDTH = 768;
// Extra columns beyond longest line (breathing room + side pads).
const MOBILE_COLS_MARGIN = 5;
// Large displays: cap quote column window (≈ prior 3-way split line length).
const QUOTE_WRAP_MAX_DESKTOP = 40;

// Weather scale when quality is low or viewport is tight (fewer painted cells).
// Peak rain units/s multiplier; length band multiplier; storm stack off.
const WEATHER_RAIN_PEAK_SCALE = 0.65;
const WEATHER_LENGTH_SCALE = 0.6;
// Drop length includes tip: min body trail 4 + tip 1 → total length ≥ 5.
const DROP_LENGTH_MIN_FLOOR = 5;
// Soft-square trough floor (units/s): ambient never idles at zero.
// (Was 5; quartered — still pulses, less dense at rest.)
const RAIN_TROUGH_MIN_RATE = 1.25;
// Constrained devices: another 2× on top of homepage storm windows
// (homepage already doubled for capable machines). Same unit budget.
const WEATHER_STORM_DURATION_SCALE = 2;

/**
 * Static hints that multi-blur text-shadow is a bad idea on this client.
 * Incomplete on purpose — Matrix can still ratchet cheap-glow on after slow frames.
 * (Adaptive performance: capable devices keep full neon; others downgrade.)
 */
function detectLowPowerClient() {
  if (typeof navigator === "undefined") return false;
  // User asked for less motion / data — honor as cheaper paint.
  try {
    if (
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  const conn = navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection;
  if (conn?.saveData) return true;
  // deviceMemory is Chrome-ish (GiB, floored). ≤4 → older / constrained boxes.
  const mem = navigator.deviceMemory;
  if (typeof mem === "number" && mem > 0 && mem <= 4) return true;
  // Dual-core (or unknown-as-1) machines still show up in the wild.
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores > 0 && cores <= 2) return true;
  return false;
}

function Configuration(...args) {
  if (!new.target) return new Configuration(...args);

  const self = this;

  const viewWidth = document.documentElement.clientWidth;
  const viewHeight = document.documentElement.clientHeight;

  const minCharCount = 24;
  const defaultCharSize = 32;
  // Ubuntu Sans Mono advance ≈ 0.56em; line box ≈ 1.2em.
  // Cell aspect target: width/height = advanceEm/heightEm (same spacing as desktop).
  const advanceEm = 0.56;
  const heightEm = 1.2;

  const targetSize =
    viewWidth / defaultCharSize > minCharCount
      ? defaultCharSize
      : Math.floor(viewWidth / minCharCount);

  // Density grid: target glyph size, then exact-fill the viewport.
  const densityCols = Math.max(
    1,
    Math.floor(viewWidth / (targetSize * advanceEm)),
  );
  const densityRows = Math.max(
    1,
    Math.floor(viewHeight / (targetSize * heightEm)),
  );

  // Aspect before grid size (portrait vs landscape row policy).
  self.ASPECT_RATIO = viewWidth / viewHeight;
  const aspect_upper_bound = 10 / 7;
  const aspect_lower_bound = 1 / aspect_upper_bound;
  self.DISPLAY_MODE = "square";
  self.DISPLAY_MODE =
    self.ASPECT_RATIO > aspect_upper_bound ? "landscape" : self.DISPLAY_MODE;
  self.DISPLAY_MODE =
    self.ASPECT_RATIO < aspect_lower_bound ? "portrait" : self.DISPLAY_MODE;

  // Orientation-invariant: short side ≤ 768 catches phones in landscape too.
  self.IS_MOBILE = Math.min(viewWidth, viewHeight) <= MOBILE_MAX_WIDTH;
  self.IS_MOBILE_LANDSCAPE =
    self.IS_MOBILE && self.DISPLAY_MODE === "landscape";
  // Cheap glow CSS: quality (any slow device), not layout. Narrow + low-power.
  self.IS_LOW_POWER = detectLowPowerClient();
  self.IS_CHEAP_GLOW = self.IS_MOBILE || self.IS_LOW_POWER;
  // Weather scale: same static gate; runtime ratchet can escalate via state.
  // Lower rain peak, shorter tails, no storm stack, pause rain during storms,
  // longer storm windows (less concurrent paint).
  self.WEATHER_SCALE = self.IS_CHEAP_GLOW;
  self.WEATHER_RAIN_PEAK_SCALE = WEATHER_RAIN_PEAK_SCALE;
  self.WEATHER_LENGTH_SCALE = WEATHER_LENGTH_SCALE;
  self.WEATHER_STORM_DURATION_SCALE = WEATHER_STORM_DURATION_SCALE;
  self.ALLOW_STORM_STACK = !self.WEATHER_SCALE;
  // Ambient rain off while any storm runs (constrained only).
  self.PAUSE_RAIN_DURING_STORM = self.WEATHER_SCALE;
  // Portrait + square mobile: full email L. Landscape: horizontal email only
  // (row budget is pad + roles + gap + 1 email line + pad).
  self.EMAIL_VERTICAL = self.IS_MOBILE ? !self.IS_MOBILE_LANDSCAPE : true;

  const card = cardContentMetrics({ emailVertical: self.EMAIL_VERTICAL });

  // Mobile: tight side pads + 1-row top/bottom + 1 blank between cards.
  // Desktop: prior 2/3 visual insets (corner cards may share a vertical band).
  self.ROLES_PAD_TOP = self.IS_MOBILE ? 1 : 2;
  self.ROLES_PAD_RIGHT = self.IS_MOBILE ? 1 : 3;
  self.EMAIL_PAD_LEFT = self.IS_MOBILE ? 1 : 3;
  self.EMAIL_PAD_BOTTOM = self.IS_MOBILE ? 1 : 2;
  self.CARD_GAP = self.IS_MOBILE ? 1 : 0;

  // Content floor: padTop + roles + gap + email + padBottom.
  const contentRows =
    self.ROLES_PAD_TOP +
    card.rolesH +
    self.CARD_GAP +
    card.emailH +
    self.EMAIL_PAD_BOTTOM;
  const contentCols = Math.max(
    1,
    card.emailW + self.EMAIL_PAD_LEFT,
    card.rolesW + self.ROLES_PAD_RIGHT,
    MAX_CONTENT_WIDTH + (self.IS_MOBILE ? MOBILE_COLS_MARGIN : 0),
  );

  // Ideal mono cell: CHAR_W/CHAR_H = advanceEm/heightEm.
  // COLS from ROWS:  COLS = viewW * ROWS * heightEm / (viewH * advanceEm)
  // ROWS from COLS:  ROWS = viewH * COLS * advanceEm / (viewW * heightEm)
  const colsFromRows = (rows) =>
    Math.max(
      1,
      Math.floor((viewWidth * rows * heightEm) / (viewHeight * advanceEm)),
    );
  const rowsFromCols = (cols) =>
    Math.max(
      1,
      Math.floor((viewHeight * cols * advanceEm) / (viewWidth * heightEm)),
    );

  if (self.IS_MOBILE_LANDSCAPE) {
    // Rows first (compact card stack), then columns from cell aspect.
    self.ROWS = contentRows;
    self.COLS = Math.max(contentCols, colsFromRows(self.ROWS));
  } else if (self.IS_MOBILE) {
    // Portrait / square: columns from roles+email, then rows from aspect.
    self.COLS = contentCols;
    self.ROWS = Math.max(contentRows, rowsFromCols(self.COLS));
  } else {
    self.COLS = densityCols;
    self.ROWS = densityRows;
  }

  self.CHAR_WIDTH = viewWidth / self.COLS;
  self.CHAR_HEIGHT = viewHeight / self.ROWS;
  self.CHAR_SIZE = self.CHAR_WIDTH / advanceEm;

  self.TOP = 0;
  self.MIDDLE = Math.floor(self.ROWS / 2);
  self.BOTTOM = self.ROWS - 1;
  self.LEFT = 0;
  self.CENTER = Math.floor(self.COLS / 2);
  self.RIGHT = self.COLS - 1;

  // Quote window: mobile 1-col side pads; desktop capped near prior line width.
  const quoteSidePad = Math.max(self.EMAIL_PAD_LEFT, self.ROLES_PAD_RIGHT);
  self.QUOTE_MAX_WIDTH = self.IS_MOBILE
    ? Math.max(1, self.COLS - 2 * quoteSidePad)
    : Math.max(
        12,
        Math.min(QUOTE_WRAP_MAX_DESKTOP, self.COLS - 2 * quoteSidePad),
      );

  self.DROP_SPEED_MIN = 8;
  // ~10% under prior 20 — slightly slower tips, easier to read on short grids.
  self.DROP_SPEED_MAX = 18;
  // Storm: floor +25% of span; max matches rain max.
  const dropSpeedSpan = self.DROP_SPEED_MAX - self.DROP_SPEED_MIN;
  self.STORM_DROP_SPEED_MIN = self.DROP_SPEED_MIN + 0.25 * dropSpeedSpan;
  self.STORM_DROP_SPEED_MAX = self.DROP_SPEED_MAX;

  const threadAvgLength = self.ROWS * 0.4;
  const threadLengthVariance = 0.5;
  const lengthScale = self.WEATHER_SCALE ? WEATHER_LENGTH_SCALE : 1;
  // Length = tip + body band. Floor keeps ≥4 body glyphs even on short
  // mobile-landscape ROWS (weather scale used to floor at 2).
  self.DROP_LENGTH_MIN = Math.max(
    DROP_LENGTH_MIN_FLOOR,
    Math.floor(threadAvgLength * (1 - threadLengthVariance) * lengthScale),
  );
  self.DROP_LENGTH_MAX = Math.max(
    self.DROP_LENGTH_MIN + 1,
    Math.floor(threadAvgLength * (1 + threadLengthVariance) * lengthScale),
  );
  self.DROP_LENGTH_MIN_FLOOR = DROP_LENGTH_MIN_FLOOR;

  // Frame scheduler base target (ms). rAF-throttled; not setTimeout-after-work.
  self.FRAME_DELAY = 90;
  // Adaptive ceiling when frame work spikes (prefer fewer frames over thrash).
  self.FRAME_DELAY_MAX = 180;
  // Max sim step (ms) for one tick after a hitch (paint-before-kill still ok).
  self.FRAME_DT_MAX_MS = 250;
  // 1 = realtime; <1 slows drops + play cues (e.g. 0.2 = 5× slower for debug).
  self.TIME_SCALE = 1;
  // /kiosk path, ?kiosk=1 / ?wall=1, #kiosk, or __MATRIX_KIOSK__.
  self.KIOSK = resolveKiosk();
  // 0 = off (kiosk); portfolio default ~10 minutes.
  self.AUTOPAUSE_TIME = self.KIOSK ? 0 : 10 * 60 * 1000;
  // Play-chain: force-settle stuck revealing/hiding after this wait on completed.
  self.COMPLETION_WATCHDOG_MS = 60_000;
  // Optional full page reload for multi-day wall runs; 0 = off.
  self.SOFT_RELOAD_MS = 0;

  // Palette via ThemeDirector (intro then random; blend on quote hide).
  const green = THEMES.green;
  self.LOW_COLOR = green.low;
  self.MED_COLOR = green.med;
  self.BODY_COLOR = green.body;
  self.HI_COLOR = green.hi;
  self.LINK_COLOR = green.link;
  self.LINK_HOVER_COLOR = green.linkHover;
  self.RED_COLOR = "#bb2222";

  const htmlEl = document.getElementsByTagName("html")[0];
  // Quality CSS (trails/tip/settled). Runtime may escalate via enableCheapGlow().
  htmlEl.classList.toggle("m-cheap-glow", self.IS_CHEAP_GLOW);
  state.themeDirector = ThemeDirector({
    intro: THEME_INTRO,
    pool: THEME_POOL,
    start: "green",
  });
  applyTheme(state.themeDirector.active);
  htmlEl.style.setProperty("--col-red", self.RED_COLOR);
  htmlEl.style.setProperty("--char-size", `${self.CHAR_SIZE}`);
  htmlEl.style.setProperty("--char-width", `${self.CHAR_WIDTH}`);
  htmlEl.style.setProperty("--char-height", `${self.CHAR_HEIGHT}`);
  htmlEl.style.setProperty("--rows", `${self.ROWS}`);
  htmlEl.style.setProperty("--cols", `${self.COLS}`);

  // Soft square with independent min/max so peak can drop without lifting trough.
  const softSquare =
    (minRate, maxRate, period = 14, sharpness = 2.6) =>
    (t) => {
      const w = Math.tanh(sharpness * Math.sin((t * Math.PI * 2) / period)); // [-1,1]
      const u = (w + 1) / 2; // [0,1]
      return minRate + (maxRate - minRate) * u;
    };

  self.createScene = () => {
    const grid = Grid({ rows: self.ROWS, cols: self.COLS });

    const rolesPadTop = self.ROLES_PAD_TOP;
    const rolesPadRight = self.ROLES_PAD_RIGHT;
    const emailPadLeft = self.EMAIL_PAD_LEFT;
    const emailPadBottom = self.EMAIL_PAD_BOTTOM;

    const roleLines = ROLE_SPECS.map((s, i) =>
      TextLine({
        text: s.text,
        href: s.href,
        lineId: i,
        name: `role-${i}`,
      })
    );
    const rolesGroup = stackVertical(roleLines, {
      align: "left",
      name: "roles",
    });
    rolesGroup.attach({
      this: Anchors.topRight(rolesGroup),
      that: [
        Anchors.top(grid).plus(rolesPadTop),
        Anchors.right(grid).minus(rolesPadRight),
      ],
    });

    const emailHref = `${SITE}/resume`;
    const emailH = TextLine({
      text: EMAIL_H_TEXT,
      href: emailHref,
      lineId: 0,
      name: "email-h",
    });
    // Landscape mobile: horizontal only (row budget is a single email line).
    const emailV = self.EMAIL_VERTICAL
      ? TextLine({
          text: EMAIL_V_TEXT,
          orientation: "vertical",
          href: emailHref,
          lineId: 1,
          name: "email-v",
        })
      : null;
    const emailChildren = emailV ? [emailH, emailV] : [emailH];
    const emailGroup = Group({
      name: "email",
      children: emailChildren,
      width: Math.max(emailH.width, emailV?.width ?? 0),
      height: Math.max(emailH.height, emailV?.height ?? 0),
    });
    emailH.attach({
      this: Anchors.bottomLeft(emailH),
      that: Anchors.bottomLeft(emailGroup),
    });
    if (emailV) {
      emailV.attach({
        this: Anchors.bottomLeft(emailV),
        that: Anchors.bottomLeft(emailGroup),
      });
    }
    emailGroup.attach({
      this: Anchors.bottomLeft(emailGroup),
      that: [
        Anchors.bottom(grid).minus(emailPadBottom),
        Anchors.left(grid).plus(emailPadLeft),
      ],
    });

    // wrapWords: mobile COLS−2; desktop min(40, COLS−2×pad).
    const quoteLineStrs = wrapWords(QUOTE_TEXT, self.QUOTE_MAX_WIDTH);
    const quoteLines = quoteLineStrs.map((text, i) =>
      TextLine({
        text,
        lineId: i,
        name: `quote-${i}`,
      }),
    );
    const quoteGroup = stackVertical(quoteLines, {
      align: "center",
      name: "quote",
    });
    quoteGroup.attach({
      this: Anchors.middleCenter(quoteGroup),
      that: Anchors.middleCenter(grid),
    });

    solveLayout([
      grid,
      rolesGroup,
      ...roleLines,
      emailGroup,
      emailH,
      ...(emailV ? [emailV] : []),
      quoteGroup,
      ...quoteLines,
    ]);

    // Rain: ambient forever; slow → heavy by ~3s; max ~20% below prior peak.
    // softSquare peaks at period/4 ≈ 3s when period is 12.
    // Weather scale: lower peak only; trough is floored so rate never idles
    // near zero (empty grid gaps stay short when free columns exist).
    const rainPeakScale = self.WEATHER_SCALE ? WEATHER_RAIN_PEAK_SCALE : 1;
    const baselineAvg = Math.max(2, self.COLS / 14);
    const baselineMin = Math.max(baselineAvg * 0.12, RAIN_TROUGH_MIN_RATE);
    // Peak keeps a clear pulse above the floored trough (not a flat band).
    const baselineMax = Math.max(
      baselineMin * 2.2,
      baselineAvg * 1.3 * 0.8 * rainPeakScale,
    );

    const rain = Rain({
      name: "rain",
      cols: self.COLS,
      priority: 0,
      // First-pass + color-change pool: only this theme drains coverage.
      coverageTheme: "green",
      accumulator: VariableRateAccumulator(
        (baselineMin + baselineMax) / 2,
        Infinity,
        softSquare(baselineMin, baselineMax, 12, 2.6),
      ),
    });

    // Placeholder until ScenePlayer.storm rebuilds.
    const revealStorm = (colCount) =>
      VariableRateAccumulator(
        Math.max(colCount, 1),
        5,
        VariableRateAccumulator.rates.stormMild(5),
      );

    // Roles / email start deactivated; ScenePlayer activates on a timed loop.
    const rolesReveal = DropScene.from(rolesGroup, {
      name: "roles-reveal",
      mode: "hidden",
      priority: 10,
    });
    rolesReveal.stormAccumulator = revealStorm(rolesReveal.columns.size);

    const emailReveal = DropScene.from(emailGroup, {
      name: "email-reveal",
      mode: "hidden",
      priority: 10,
    });
    emailReveal.stormAccumulator = revealStorm(emailReveal.columns.size);

    // Shared points so hide/reveal stay in sync with paint layers.
    const roles = DisplayText({ cells: rolesReveal.points });
    const email = DisplayText({ cells: emailReveal.points });

    const cardHide = DropScene({
      name: "card-hide",
      points: [...rolesReveal.points, ...emailReveal.points],
      mode: "hidden",
      priority: 20,
    });
    cardHide.stormAccumulator = revealStorm(cardHide.columns.size);

    const quoteReveal = DropScene.from(quoteGroup, {
      name: "quote-reveal",
      mode: "hidden",
      priority: 10,
    });
    quoteReveal.stormAccumulator = revealStorm(quoteReveal.columns.size);

    const quote = DisplayText({ cells: quoteReveal.points });

    const quoteHide = DropScene({
      name: "quote-hide",
      points: quoteReveal.points,
      mode: "hidden",
      priority: 20,
    });
    quoteHide.stormAccumulator = revealStorm(quoteHide.columns.size);

    const contentLayers = [roles, email, quote];
    const dropScenes = [
      rolesReveal,
      emailReveal,
      cardHide,
      quoteReveal,
      quoteHide,
    ];

    const sceneManager = SceneManager({ scenes: dropScenes });

    const scenePlayer = ScenePlayer();
    homepagePlay(
      scenePlayer,
      {
        rolesReveal,
        emailReveal,
        cardHide,
        quoteReveal,
        quoteHide,
      },
      {
        afterCardGoneMs: 3_000,
        quoteHoldMs: 5_000,
        restartGapMs: 0,
        completionWatchdogMs: self.COMPLETION_WATCHDOG_MS,
      },
    );

    return {
      contentLayers,
      rain,
      dropScenes,
      sceneManager,
      spawnPolicies: [],
      scenePlayer,
      layout: { grid, rolesGroup, emailGroup, quoteGroup },
    };
  };

  Object.freeze(self);
}

export default Configuration;
