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
import { applyTheme, THEMES, ThemeDirector } from "./themes.mjs";
import {
  applyPerfCss,
  applyPerfToConfig,
  detectInitialPerfLevel,
  HIGH_STORM_DURATION_SEC,
  stormDurationSeconds,
} from "./performance.mjs";
import state from "./State.mjs";
import { VariableRateAccumulator } from "./util.mjs";
import Grid from "./layout/Grid.mjs";
import TextLine from "./layout/TextLine.mjs";
import Group from "./layout/Group.mjs";
import { stackVertical } from "./layout/stack.mjs";
import { Anchors } from "./layout/Anchor.mjs";
import { solveLayout } from "./layout/attach.mjs";
import {
  createSayingPlaylist,
  sayingParts,
  SAYINGS,
} from "./sayings.mjs";

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
// Bootstrap only — live playlist draws from SAYINGS via createSayingPlaylist().
const SAYING_BOOTSTRAP_TEXT = sayingParts(SAYINGS[0]).body;

// Card geometry from copy. When cards change, update copy — grid tracks this.
function cardContentMetrics({ emailVertical = true } = {}) {
  const rolesH = ROLE_SPECS.length;
  const rolesW = Math.max(0, ...ROLE_SPECS.map((s) => s.text.length));
  // Horizontal email is 1 row; vertical L-arm is length×1 when enabled.
  const emailH = emailVertical ? Math.max(1, EMAIL_V_TEXT.length) : 1;
  const emailW = Math.max(1, EMAIL_H_TEXT.length);
  return { rolesH, rolesW, emailH, emailW, emailVertical };
}

// Widest fixed line (roles + horizontal email). Sayings wrap separately.
const MAX_CONTENT_WIDTH = Math.max(EMAIL_H_TEXT.length, ...ROLE_SPECS.map((s) => s.text.length));

// Narrow viewports: fewer cells (performance); content-driven COLS.
const MOBILE_MAX_WIDTH = 768;
// Extra columns beyond longest line (breathing room + side pads).
const MOBILE_COLS_MARGIN = 5;
// Wide grids: fixed saying column window (chars). COLS ≤ this+2 uses COLS−2.
const SAYING_WRAP_MAX = 50;
// At or below this COLS, saying uses 1-col side pads (width = COLS − 2).
const SAYING_NARROW_COLS = SAYING_WRAP_MAX + 2;

// Ambient rain cosine period (seconds). Area under one period = COLS.
// Trough (t=0) is RAIN_START_RATE; amplitude set so mean = COLS/T.
const RAIN_PERIOD_SECONDS = 30;
const RAIN_START_RATE = 1;

/**
 * Static hints that full neon is a bad idea on this client.
 * Incomplete on purpose — Matrix can still escalate perf level after slow frames.
 */
function detectLowPowerClient() {
  if (typeof navigator === "undefined") return false;
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
  const mem = navigator.deviceMemory;
  if (typeof mem === "number" && mem > 0 && mem <= 4) return true;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores > 0 && cores <= 2) return true;
  return false;
}

function Configuration(...args) {
  if (!new.target) return new Configuration(...args);

  const self = this;

  // Prefer layout size; fall back to visual viewport (some mobile WebViews report
  // 0×0 on documentElement during early script). Never allow 0 — avoids NaN grid.
  const viewWidth = Math.max(
    1,
    document.documentElement.clientWidth || window.innerWidth || 1,
  );
  const viewHeight = Math.max(
    1,
    document.documentElement.clientHeight || window.innerHeight || 1,
  );

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
  const densityCols = Math.max(1, Math.floor(viewWidth / (targetSize * advanceEm)));
  const densityRows = Math.max(1, Math.floor(viewHeight / (targetSize * heightEm)));

  // Aspect before grid size (portrait vs landscape row policy).
  self.ASPECT_RATIO = viewWidth / viewHeight;
  const aspect_upper_bound = 10 / 7;
  const aspect_lower_bound = 1 / aspect_upper_bound;
  self.DISPLAY_MODE = "square";
  self.DISPLAY_MODE = self.ASPECT_RATIO > aspect_upper_bound ? "landscape" : self.DISPLAY_MODE;
  self.DISPLAY_MODE = self.ASPECT_RATIO < aspect_lower_bound ? "portrait" : self.DISPLAY_MODE;

  // Orientation-invariant: short side ≤ 768 catches phones in landscape too.
  self.IS_MOBILE = Math.min(viewWidth, viewHeight) <= MOBILE_MAX_WIDTH;
  self.IS_MOBILE_LANDSCAPE = self.IS_MOBILE && self.DISPLAY_MODE === "landscape";
  // Quality hints (not layout). Perf level owns glow/weather levers.
  self.IS_LOW_POWER = detectLowPowerClient();
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
    self.ROLES_PAD_TOP + card.rolesH + self.CARD_GAP + card.emailH + self.EMAIL_PAD_BOTTOM;
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
    Math.max(1, Math.floor((viewWidth * rows * heightEm) / (viewHeight * advanceEm)));
  const rowsFromCols = (cols) =>
    Math.max(1, Math.floor((viewHeight * cols * advanceEm) / (viewWidth * heightEm)));

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

  // Saying window (fixed box for center/right alignment of components):
  //   COLS ≤ 52 → 1-col pad each side → width COLS − 2
  //   COLS > 52 → cap at 50 chars (window centered on the grid)
  self.SAYING_MAX_WIDTH =
    self.COLS <= SAYING_NARROW_COLS
      ? Math.max(1, self.COLS - 2)
      : SAYING_WRAP_MAX;

  // --- Performance level (high / medium / low) ---
  // All drop speed, length, storm, rain-pause, and glow thrift settings are
  // applied here via performance.mjs so call sites stay free of ad-hoc gates.
  const initialPerf = detectInitialPerfLevel({
    isMobile: self.IS_MOBILE,
    isLowPower: self.IS_LOW_POWER,
  });
  applyPerfToConfig(self, initialPerf);

  // Adaptive ceiling when frame work spikes (prefer fewer frames over thrash).
  self.FRAME_DELAY_MAX = 180;
  // Max sim step (ms) for one tick after a hitch (paint-before-kill still ok).
  self.FRAME_DT_MAX_MS = 250;
  // Concurrent live-drop budget (DropManager): max starts at INITIAL (=COLS).
  // Clamp threshold is FRAME_AVG_CLAMP_MS from the active perf level.
  self.INITIAL_DROP_MAX = self.COLS;
  self.MIN_DROP_MAX = 12;
  // Aliases kept for older tests / overlays.
  self.ACTIVE_DROPS_MIN = self.MIN_DROP_MAX;
  self.ACTIVE_DROPS_MAX = self.INITIAL_DROP_MAX;
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

  // Palette via ThemeDirector (3× green then one of each color; blend on saying hide).
  const green = THEMES.green;
  self.LOW_COLOR = green.low;
  self.MED_COLOR = green.med;
  self.BODY_COLOR = green.body;
  self.HI_COLOR = green.hi;
  self.LINK_COLOR = green.link;
  self.LINK_HOVER_COLOR = green.linkHover;
  self.RED_COLOR = "#bb2222";

  const htmlEl = document.getElementsByTagName("html")[0];
  // Quality CSS (m-perf-med / m-perf-low). Runtime may escalate via Matrix.
  applyPerfCss(self.PERF_LEVEL, htmlEl);
  state.perfLevel = self.PERF_LEVEL;
  // Theme cycle: 3× green, then one of each remaining color, repeat.
  state.themeDirector = ThemeDirector({ start: "green" });
  applyTheme(state.themeDirector.active);
  htmlEl.style.setProperty("--col-red", self.RED_COLOR);
  htmlEl.style.setProperty("--char-size", `${self.CHAR_SIZE}`);
  htmlEl.style.setProperty("--char-width", `${self.CHAR_WIDTH}`);
  htmlEl.style.setProperty("--char-height", `${self.CHAR_HEIGHT}`);
  htmlEl.style.setProperty("--rows", `${self.ROWS}`);
  htmlEl.style.setProperty("--cols", `${self.COLS}`);

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
      }),
    );
    const rolesGroup = stackVertical(roleLines, {
      align: "left",
      name: "roles",
    });
    rolesGroup.attach({
      this: Anchors.topRight(rolesGroup),
      that: [Anchors.top(grid).plus(rolesPadTop), Anchors.right(grid).minus(rolesPadRight)],
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
      that: [Anchors.bottom(grid).minus(emailPadBottom), Anchors.left(grid).plus(emailPadLeft)],
    });

    // Fixed saying window (SAYING_MAX_WIDTH): content centered; footers right.
    //   content lines…
    //                     - Author
    //          (optional context)
    // Playlist swaps cells each cycle (bootstrap group is scaffolding only).
    const materializeSayingCells = (entry) => {
      const windowW = self.SAYING_MAX_WIDTH;
      const { body, attributionLine, contextLine } = sayingParts(entry);
      const bodyStrs = wrapWords(body || " ", windowW);
      const bodyLines = bodyStrs.map((lineText, i) =>
        TextLine({
          text: lineText,
          lineId: i,
          name: `saying-${i}`,
        }),
      );
      // Center body lines within the fixed window (not shrink-wrap to longest).
      const group = stackVertical(bodyLines, {
        align: "center",
        name: "saying",
      });
      group.width = windowW;

      const allLines = [...bodyLines];
      let lineId = bodyLines.length;
      let below = bodyLines[bodyLines.length - 1];

      // Attribution then context: wrap to window, each line right-justified.
      const appendFooter = (text, nameBase) => {
        if (!text) return;
        const strs = wrapWords(text, windowW);
        for (let i = 0; i < strs.length; i++) {
          const footer = TextLine({
            text: strs[i],
            lineId: lineId++,
            name: strs.length === 1 ? nameBase : `${nameBase}-${i}`,
          });
          group.height = (group.height || 0) + 1;
          group.add(footer);
          footer.attach({
            this: [Anchors.top(footer), Anchors.right(footer)],
            that: [Anchors.bottom(below).plus(1), Anchors.right(group)],
          });
          allLines.push(footer);
          below = footer;
        }
      };
      appendFooter(attributionLine, "saying-attr");
      appendFooter(contextLine, "saying-context");

      // Whole window centered on the grid (horiz + vert).
      group.attach({
        this: Anchors.middleCenter(group),
        that: Anchors.middleCenter(grid),
      });
      solveLayout([grid, group, ...allLines]);
      return group.cells();
    };

    const sayingLineStrs = wrapWords(SAYING_BOOTSTRAP_TEXT, self.SAYING_MAX_WIDTH);
    const sayingLines = sayingLineStrs.map((text, i) =>
      TextLine({
        text,
        lineId: i,
        name: `saying-${i}`,
      }),
    );
    const sayingGroup = stackVertical(sayingLines, {
      align: "center",
      name: "saying",
    });
    // Match live playlist window so bootstrap geometry is representative.
    sayingGroup.width = self.SAYING_MAX_WIDTH;
    sayingGroup.attach({
      this: Anchors.middleCenter(sayingGroup),
      that: Anchors.middleCenter(grid),
    });

    solveLayout([
      grid,
      rolesGroup,
      ...roleLines,
      emailGroup,
      emailH,
      ...(emailV ? [emailV] : []),
      sayingGroup,
      ...sayingLines,
    ]);

    // Rain: ambient forever. Cosine trough-start period T:
    //   r(t) = r0 + A (1 − cos(2π t / T)), r(0)=r0, peak r0+2A at T/2.
    // Mean = r0+A; set r0+A = COLS/T so ∫_0^T r = COLS.
    // Same mean on constrained devices (weather scale does not thin rate).
    const rainAvg = self.COLS / RAIN_PERIOD_SECONDS;
    const rainAmp = Math.max(0, rainAvg - RAIN_START_RATE);
    const rainRate = (t) =>
      RAIN_START_RATE +
      rainAmp * (1 - Math.cos((t * Math.PI * 2) / RAIN_PERIOD_SECONDS));

    const rain = Rain({
      name: "rain",
      cols: self.COLS,
      priority: 0,
      // First-pass + color-change pool: only this theme drains coverage.
      coverageTheme: "green",
      accumulator: VariableRateAccumulator(rainAvg, Infinity, rainRate),
    });

    // Seed storm VRA; play-chain storm(seconds) rebuilds coverage duration.
    // Duration scale comes from perf level (high violent / med / low stretched).
    const baseStormSec = stormDurationSeconds(self.PERF_LEVEL, HIGH_STORM_DURATION_SEC);
    const revealStorm = (colCount, durationSeconds = baseStormSec) => {
      const units = Math.max(colCount, 1);
      const T = Math.max(durationSeconds, 0.001);
      return VariableRateAccumulator(
        units,
        T,
        VariableRateAccumulator.rates.stormMild(T),
      );
    };

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

    const sayingReveal = DropScene.from(sayingGroup, {
      name: "saying-reveal",
      mode: "hidden",
      priority: 10,
    });
    sayingReveal.stormAccumulator = revealStorm(sayingReveal.columns.size);

    const saying = DisplayText({ cells: sayingReveal.points });

    const sayingHide = DropScene({
      name: "saying-hide",
      points: sayingReveal.points,
      mode: "hidden",
      priority: 20,
    });
    sayingHide.stormAccumulator = revealStorm(sayingHide.columns.size);

    // Shuffled pool: draw without replacement; refill + reshuffle when empty.
    // Each deck: SAYINGS[0] (liberty / LBM) first, then shuffle of the rest.
    const sayingPlaylist = createSayingPlaylist(SAYINGS);
    let currentSaying = null;
    const loadNextSaying = () => {
      const entry = sayingPlaylist.next();
      currentSaying = entry;
      const cells = materializeSayingCells(entry);
      // Shared points array (reveal + hide); mutate in place then resync maps.
      sayingReveal.setPoints(cells);
      sayingHide.resyncGeometry();
      saying.setCells(sayingReveal.points);
      // Seed storm size for new column footprint (play-chain rebuilds on storm()).
      sayingReveal.stormAccumulator = revealStorm(sayingReveal.columns.size);
      sayingHide.stormAccumulator = revealStorm(sayingHide.columns.size);
      // Hover hit-map was built from the previous saying's cells — rebind so
      // hasten / hold-extend land on the new footprint.
      state.scenePlayer?.attachHover?.();
      return entry;
    };
    const getCurrentSaying = () => currentSaying;
    // First cycle: pin-first entry (not bootstrap layout alone).
    loadNextSaying();

    const contentLayers = [roles, email, saying];
    const dropScenes = [
      rolesReveal,
      emailReveal,
      cardHide,
      sayingReveal,
      sayingHide,
    ];

    const sceneManager = SceneManager({ scenes: dropScenes });

    const scenePlayer = ScenePlayer();
    // Hold / gap timings (all perf levels): 3s rain open (first cycle only);
    // reveal rain lead then storm; 6s full text (+1.5s if long saying);
    // 2s empty after card hide and after saying hide (see homepagePlay).
    const stormSec = stormDurationSeconds(self.PERF_LEVEL, HIGH_STORM_DURATION_SEC);
    homepagePlay(
      scenePlayer,
      {
        rolesReveal,
        emailReveal,
        cardHide,
        sayingReveal,
        sayingHide,
      },
      {
        rolesAtMs: 3_000,
        revealRainLeadMs: 3_000,
        rolesStormSec: stormSec,
        emailStormSec: stormSec,
        cardHideStormSec: stormSec,
        sayingStormSec: stormSec,
        sayingHideStormSec: stormSec,
        cardHoldAfterEmailMs: 6_000,
        sayingHoldMs: 6_000,
        sayingHoldLongExtraMs: 1_500,
        afterCardGoneMs: 2_000,
        afterSayingGoneMs: 2_000,
        completionWatchdogMs: self.COMPLETION_WATCHDOG_MS,
        loadNextSaying,
        getCurrentSaying,
      },
    );

    return {
      contentLayers,
      rain,
      dropScenes,
      sceneManager,
      scenePlayer,
      layout: { grid, rolesGroup, emailGroup, sayingGroup },
      sayingPlaylist,
      loadNextSaying,
      getCurrentSaying,
    };
  };

  Object.freeze(self);
}

export default Configuration;
