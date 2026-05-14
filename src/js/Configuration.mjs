/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Configuration is the single source of truth for all user-configurable settings in the application (display content, colors, grid dimensions, etc.).

import DropScene from "./DropScene.mjs";
import { objMap } from "./utils.mjs";

function Configuration(...args) {
  if (!new.target) return new Configuration(...args);

  let self = this;

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
  self.DISPLAY_MODE = "square"; // "square" | "portrait" | "landscape"
  self.DISPLAY_MODE = self.ASPECT_RATIO > aspect_upper_bound ? "landscape" : self.DISPLAY_MODE;
  self.DISPLAY_MODE = self.ASPECT_RATIO < aspect_lower_bound ? "portrait" : self.DISPLAY_MODE;

  self.ROWS = Math.floor(viewHeight / self.CHAR_HEIGHT);
  self.COLS = Math.floor(viewWidth / self.CHAR_WIDTH);

  // console.log(`DISPLAY_MODE: ${self.DISPLAY_MODE}`);

  // ROW/COL maximums
  // self.ROWS = Math.min(self.ROWS, Math.floor(1.5 * self.COLS));
  // self.COLS = Math.min(self.COLS, 3 * self.ROWS);

  self.TOP = 0;
  self.MIDDLE = Math.floor(self.ROWS / 2);
  self.BOTTOM = self.ROWS - 1;

  self.LEFT = 0;
  self.CENTER = Math.floor(self.COLS / 2);
  self.RIGHT = self.COLS - 1;

  self.DROP_SPEED_MIN = 8;
  self.DROP_SPEED_MAX = 20;

  self.DROP_CREATION_RATE_MIN = 0;
  self.DROP_CREATION_RATE_MAX = 3;
  self.DROP_CREATION_PERIOD = 20;

  let threadAvgLength = self.ROWS * 0.4;
  let threadLengthVariance = 0.5;
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

  let htmlEl = document.getElementsByTagName("html")[0];
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

  const textSceneData = {
    professionalRoles: {
      orientation: "horizontal",
      alignment: "left",
      childAttachment: ["top", "right"],
      partentAttachment: [2, -3],
      texts: [
        {
          text: "Luke Benjamin May",
          href: "https://isu.lukemay.com/resume",
        },
        {
          text: "Software Engineer",
          href: "https://isu.lukemay.com/portfolio",
        },
        {
          text: "Full Stack Web Developer",
          href: "https://www.lukemay.com/game-of-life",
        },
        {
          text: "Grad CS Instructor",
          href: "https://isu.lukemay.com",
        },
        {
          text: "You Tube",
          href: "https://www.youtube.com/lukebeenjammin",
        },
      ],
    },
    email: [
      {
        orientation: "vertical",
        alignment: "left",
        childAttachment: ["bottom", "left"],
        partentAttachment: [-3, 3],
        texts: [
          {
            text: "LukeBMay at Gmail",
            href: "https://www.lukemay.com/resume",
          },
        ],
      },
      {
        orientation: "horizontal",
        alignment: "left",
        childAttachment: ["bottom", "left"],
        partentAttachment: [-3, 3],
        texts: [
          {
            text: "lukebmay at gmail dot com",
            href: "https://www.lukemay.com/resume",
          },
        ],
      },
    ],
  };

  const videoSceneData = {
    // luke: {
    //   videoFile: "luke.mp4",
    //   9,
    //   16,
    //   child-attachment: ["middle", "center"], // keywords translate to integer row/col
    //   parent-attachment: ["middle", "center"], // keywords translate to integer row/col
    // },
  };

  self.dropScenes = {
    default: DropScene({
      type: "default",
      name: "default",
    }),
    ...objMap(textSceneData, (sceneName, sceneData) => [
      sceneName,
      DropScene({
        name: sceneName,
        type: "text",
        ...sceneData,
      }),
    ]),
    ...objMap(videoSceneData, (sceneName, sceneData) => [
      sceneName,
      DropScene({
        name: sceneName,
        type: "video",
        ...sceneData,
      }),
    ]),
  };

  Object.freeze(self);
}

export default Configuration;
