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

  const rates = VariableRateAccumulator.rates;

  // Soft square: recognizable plateaus, not jarring hard edges.
  // r(t) = avg + amp * tanh(k * sin(ωt))
  const softSquare =
    (avg, amp, period = 12, sharpness = 2.4) =>
    (t) =>
      Math.max(0, avg + amp * Math.tanh(sharpness * Math.sin((t * Math.PI * 2) / period)));

  // Burst for reveal: higher average over a short window.
  const revealPulse =
    (avg, amp, period = 6) =>
    (t) =>
      Math.max(0, avg + amp * Math.max(0, Math.sin((t * Math.PI * 2) / period)));

  self.createScene = () => {
    const roles = DisplayText({
      href: "https://isu.lukemay.com/resume",
      texts: [
        ["Luke Benjamin May       ", [2, -4], "horizontal"],
        ["Full Stack Web Developer", [3, -4], "horizontal"],
        ["Software Engineer       ", [4, -4], "horizontal"],
      ],
    });
    // Mark complete after hover-force; optional duration not required for paint.
    roles.isComplete = false;
    roles.complete = () => {
      roles.isComplete = true;
    };

    const email = DisplayText({
      href: "https://www.lukemay.com/resume",
      texts: [
        ["lukebmay at gmail dot com", [-3, 3], "horizontal"],
        ["LukeBMay at gmail", [-3, 3], "vertical"],
      ],
    });
    email.isComplete = false;
    email.complete = () => {
      email.isComplete = true;
    };

    const contentLayers = [roles, email];

    // Avg drops/sec for ambient; soft-square wave is visibly wavy.
    const baselineAvg = Math.max(2, self.COLS / 14);

    const baseline = SpawnPolicy({
      name: "baseline",
      columns: null,
      infinite: true,
      priority: 0,
      activateAfterMs: 0,
      accumulator: VariableRateAccumulator(
        baselineAvg,
        Infinity,
        softSquare(baselineAvg, baselineAvg * 0.85, 14, 2.6),
      ),
    });

    const rolesCols = Array.from(roles.columns);
    const emailCols = Array.from(email.columns);

    const rolesReveal = SpawnPolicy({
      name: "reveal-roles",
      columns: rolesCols,
      infinite: false,
      priority: 10,
      activateAfterMs: 3500,
      accumulator: VariableRateAccumulator(
        Math.max(rolesCols.length, 1),
        5,
        revealPulse(8, 10, 5),
      ),
    });

    const emailReveal = SpawnPolicy({
      name: "reveal-email",
      columns: emailCols,
      infinite: false,
      priority: 10,
      activateAfterMs: 9000,
      accumulator: VariableRateAccumulator(
        Math.max(emailCols.length, 1),
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
