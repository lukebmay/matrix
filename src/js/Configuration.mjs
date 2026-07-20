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

// Always exactly 3 lines; balance words, truncate to maxWidth if needed.
function wrapLinesAlways3(text, maxWidth) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ["", "", ""];
  const width = Math.max(1, maxWidth);
  const n = words.length;
  const cut1 = Math.ceil(n / 3);
  const cut2 = Math.ceil((2 * n) / 3);
  const raw = [
    words.slice(0, cut1).join(" "),
    words.slice(cut1, cut2).join(" "),
    words.slice(cut2).join(" "),
  ];
  return raw.map((line) => (line.length <= width ? line : line.slice(0, width)));
}

function Configuration(...args) {
  if (!new.target) return new Configuration(...args);

  const self = this;

  const viewWidth = document.documentElement.clientWidth;
  const viewHeight = document.documentElement.clientHeight;

  const minCharCount = 24;
  const defaultCharSize = 32;
  // Ubuntu Sans Mono advance ≈ 0.56em; line box ≈ 1.2em.
  const advanceEm = 0.56;
  const heightEm = 1.2;

  const targetSize =
    viewWidth / defaultCharSize > minCharCount
      ? defaultCharSize
      : Math.floor(viewWidth / minCharCount);

  // Integer grid from target size, then stretch cells so the scene fills
  // the viewport edge-to-edge (no letterbox black border).
  self.COLS = Math.max(1, Math.floor(viewWidth / (targetSize * advanceEm)));
  self.ROWS = Math.max(1, Math.floor(viewHeight / (targetSize * heightEm)));
  self.CHAR_WIDTH = viewWidth / self.COLS;
  self.CHAR_HEIGHT = viewHeight / self.ROWS;
  self.CHAR_SIZE = self.CHAR_WIDTH / advanceEm;

  self.ASPECT_RATIO = viewWidth / viewHeight;

  const aspect_upper_bound = 10 / 7;
  const aspect_lower_bound = 1 / aspect_upper_bound;
  self.DISPLAY_MODE = "square";
  self.DISPLAY_MODE = self.ASPECT_RATIO > aspect_upper_bound ? "landscape" : self.DISPLAY_MODE;
  self.DISPLAY_MODE = self.ASPECT_RATIO < aspect_lower_bound ? "portrait" : self.DISPLAY_MODE;

  self.TOP = 0;
  self.MIDDLE = Math.floor(self.ROWS / 2);
  self.BOTTOM = self.ROWS - 1;
  self.LEFT = 0;
  self.CENTER = Math.floor(self.COLS / 2);
  self.RIGHT = self.COLS - 1;

  self.DROP_SPEED_MIN = 8;
  self.DROP_SPEED_MAX = 20;
  // Storm: floor +25% of span; max unchanged.
  const dropSpeedSpan = self.DROP_SPEED_MAX - self.DROP_SPEED_MIN;
  self.STORM_DROP_SPEED_MIN = self.DROP_SPEED_MIN + 0.25 * dropSpeedSpan;
  self.STORM_DROP_SPEED_MAX = self.DROP_SPEED_MAX;

  const threadAvgLength = self.ROWS * 0.4;
  const threadLengthVariance = 0.5;
  self.DROP_LENGTH_MIN = Math.floor(threadAvgLength * (1 - threadLengthVariance));
  self.DROP_LENGTH_MAX = Math.floor(threadAvgLength * (1 + threadLengthVariance));

  self.FRAME_DELAY = 90;
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
    const site = "https://www.lukemay.com";
    const grid = Grid({ rows: self.ROWS, cols: self.COLS });

    const rolesPadTop = 2;
    const rolesPadRight = 3;
    const emailPadLeft = 3;
    const emailPadBottom = 2;

    const roleSpecs = [
      { text: "Luke Benjamin May", href: `${site}/resume` },
      { text: "Full Stack Web Developer", href: `${site}/game-of-life` },
      { text: "Software Engineer", href: site },
      { text: "Agentic Engineer", href: site },
      { text: "Graduate CS Instructor", href: "https://isu.lukemay.com" },
      { text: "YouTube", href: "https://www.youtube.com/lukebeenjammin" },
    ];

    const roleLines = roleSpecs.map((s, i) =>
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

    const emailHref = `${site}/resume`;
    const emailH = TextLine({
      text: "lukebmay at gmail dot com",
      href: emailHref,
      lineId: 0,
      name: "email-h",
    });
    const emailV = TextLine({
      text: "LukeBMay at gmail",
      orientation: "vertical",
      href: emailHref,
      lineId: 1,
      name: "email-v",
    });
    const emailGroup = Group({
      name: "email",
      children: [emailH, emailV],
      width: Math.max(emailH.width, emailV.width),
      height: Math.max(emailH.height, emailV.height),
    });
    emailH.attach({
      this: Anchors.bottomLeft(emailH),
      that: Anchors.bottomLeft(emailGroup),
    });
    emailV.attach({
      this: Anchors.bottomLeft(emailV),
      that: Anchors.bottomLeft(emailGroup),
    });
    emailGroup.attach({
      this: Anchors.bottomLeft(emailGroup),
      that: [
        Anchors.bottom(grid).minus(emailPadBottom),
        Anchors.left(grid).plus(emailPadLeft),
      ],
    });

    const quoteText =
      "Most people are willing to sacrifice their own liberty, and yours, for the illusion of safety.";
    const quoteMaxWidth = Math.max(12, self.COLS - 4);
    const quoteLineStrs = wrapLinesAlways3(quoteText, quoteMaxWidth);
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
      emailV,
      quoteGroup,
      ...quoteLines,
    ]);

    // Rain: ambient forever; slow → heavy by ~3s; max ~20% below prior peak.
    // softSquare peaks at period/4 ≈ 3s when period is 12.
    const baselineAvg = Math.max(2, self.COLS / 14);
    const baselineMin = baselineAvg * 0.12;
    const baselineMax = baselineAvg * 1.3 * 0.8;

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
