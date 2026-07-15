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

  self.CHAR_SIZE =
    viewWidth / defaultCharSize > minCharCount
      ? defaultCharSize
      : Math.floor(viewWidth / minCharCount);
  self.CHAR_WIDTH = self.CHAR_SIZE * 0.6;
  self.CHAR_HEIGHT = self.CHAR_SIZE * 1.122;

  self.ASPECT_RATIO = viewWidth / viewHeight;

  const aspect_upper_bound = 10 / 7;
  const aspect_lower_bound = 1 / aspect_upper_bound;
  self.DISPLAY_MODE = "square";
  self.DISPLAY_MODE = self.ASPECT_RATIO > aspect_upper_bound ? "landscape" : self.DISPLAY_MODE;
  self.DISPLAY_MODE = self.ASPECT_RATIO < aspect_lower_bound ? "portrait" : self.DISPLAY_MODE;

  self.ROWS = Math.floor(viewHeight / self.CHAR_HEIGHT);
  self.COLS = Math.floor(viewWidth / self.CHAR_WIDTH);

  self.TOP = 0;
  self.MIDDLE = Math.floor(self.ROWS / 2);
  self.BOTTOM = self.ROWS - 1;
  self.LEFT = 0;
  self.CENTER = Math.floor(self.COLS / 2);
  self.RIGHT = self.COLS - 1;

  self.DROP_SPEED_MIN = 8;
  self.DROP_SPEED_MAX = 20;

  const threadAvgLength = self.ROWS * 0.4;
  const threadLengthVariance = 0.5;
  self.DROP_LENGTH_MIN = Math.floor(threadAvgLength * (1 - threadLengthVariance));
  self.DROP_LENGTH_MAX = Math.floor(threadAvgLength * (1 + threadLengthVariance));

  self.FRAME_DELAY = 90;
  self.AUTOPAUSE_TIME = 10 * 60 * 1000;

  self.LOW_COLOR = "#001600";
  self.MED_COLOR = "#119922";
  self.HI_COLOR = "#aaffbb";
  self.LINK_COLOR = "#aaffff";
  self.LINK_HOVER_COLOR = "#ccffff";
  self.RED_COLOR = "#bb2222";

  const htmlEl = document.getElementsByTagName("html")[0];
  htmlEl.style.setProperty("--col-low", self.LOW_COLOR);
  htmlEl.style.setProperty("--col-med", self.MED_COLOR);
  htmlEl.style.setProperty("--col-hi", self.HI_COLOR);
  htmlEl.style.setProperty("--col-link", self.LINK_COLOR);
  htmlEl.style.setProperty("--col-link-hover", self.LINK_HOVER_COLOR);
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

  const revealPulse =
    (avg, amp, period = 6) =>
    (t) =>
      Math.max(0, avg + amp * Math.max(0, Math.sin((t * Math.PI * 2) / period)));

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
      accumulator: VariableRateAccumulator(
        (baselineMin + baselineMax) / 2,
        Infinity,
        softSquare(baselineMin, baselineMax, 12, 2.6),
      ),
    });

    const revealStorm = (colCount) =>
      VariableRateAccumulator(
        Math.max(colCount, 1),
        5,
        revealPulse(8, 10, 5),
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
