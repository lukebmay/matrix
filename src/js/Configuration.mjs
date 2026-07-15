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
import SpawnPolicy from "./SpawnPolicy.mjs";
import { VariableRateAccumulator } from "./util.mjs";

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
  // max reduced ~30% vs prior avg±0.85avg peak (was ~1.85*avg).
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
    // Placeholder for unfinished portfolio destinations.
    const site = "https://www.lukemay.com";

    // One reveal group; each line has its own link.
    const roles = DisplayText({
      lines: [
        {
          text: "Luke Benjamin May",
          location: [2, -4],
          orientation: "horizontal",
          href: `${site}/resume`,
        },
        {
          text: "Full Stack Web Developer",
          location: [3, -4],
          orientation: "horizontal",
          href: `${site}/game-of-life`,
        },
        {
          text: "Software Engineer",
          location: [4, -4],
          orientation: "horizontal",
          href: site,
        },
        {
          text: "Agentic Engineer",
          location: [5, -4],
          orientation: "horizontal",
          href: site,
        },
        {
          text: "Graduate CS Instructor",
          location: [6, -4],
          orientation: "horizontal",
          href: "https://isu.lukemay.com",
        },
        {
          text: "YouTube",
          location: [7, -4],
          orientation: "horizontal",
          href: "https://www.youtube.com/lukebeenjammin",
        },
      ],
    });

    const email = DisplayText({
      lines: [
        {
          text: "lukebmay at gmail dot com",
          location: [-3, 3],
          orientation: "horizontal",
          href: `${site}/resume`,
        },
        {
          text: "LukeBMay at gmail",
          location: [-3, 3],
          orientation: "vertical",
          href: `${site}/resume`,
        },
      ],
    });

    const contentLayers = [roles, email];

    // Baseline: keep low troughs (often ≥1 drop, brief gaps); peak ~30% lower.
    const baselineAvg = Math.max(2, self.COLS / 14);
    const baselineMin = baselineAvg * 0.15;
    const baselineMax = baselineAvg * 1.3; // was ~1.85*avg

    const baseline = SpawnPolicy({
      name: "baseline",
      columns: null,
      infinite: true,
      priority: 0,
      activateAfterMs: 0,
      accumulator: VariableRateAccumulator(
        (baselineMin + baselineMax) / 2,
        Infinity,
        softSquare(baselineMin, baselineMax, 14, 2.6),
      ),
    });

    const rolesReveal = SpawnPolicy({
      name: "reveal-roles",
      getEligibleColumns: () => roles.unrevealedColumns(),
      infinite: false,
      priority: 10,
      activateAfterMs: 3500,
      accumulator: VariableRateAccumulator(
        Math.max(roles.columns.size, 1),
        5,
        revealPulse(8, 10, 5),
      ),
    });

    const emailReveal = SpawnPolicy({
      name: "reveal-email",
      getEligibleColumns: () => email.unrevealedColumns(),
      infinite: false,
      priority: 10,
      activateAfterMs: 9000,
      accumulator: VariableRateAccumulator(
        Math.max(email.columns.size, 1),
        5,
        revealPulse(8, 10, 5),
      ),
    });

    return {
      contentLayers,
      spawnPolicies: [baseline, rolesReveal, emailReveal],
    };
  };

  Object.freeze(self);
}

export default Configuration;
