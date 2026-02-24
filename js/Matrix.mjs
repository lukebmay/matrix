/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */
import state from "./State.mjs";
import Grid from "./Grid.mjs";
import DomManager from "./DomManager.mjs";
import DropManager from "./DropManager.mjs";
import StaticText from "./StaticText.mjs";

let runTimeoutId, autopauseTimeoutId, pauseDifference;

function Matrix(...args) {
  if (!new.target) return new Matrix(...args);
  let self = this;

  const cfg = state.config;

  state.staticTexts = [
    StaticText({
      href: "https://isu.lukemay.com",
      activationDelay: 6000,
      durationDelay: 10000,
      repeat: true,
      repititionDelay: 10000,
      texts: [
        ["Luke Benjamin May       ", [2, -4], "horizontal"],
        ["Full Stack Web Developer", [3, -4], "horizontal"],
        ["Software Engineer       ", [4, -4], "horizontal"],
      ],
    }),
    StaticText({
      href: "https://isu.lukemay.com",
      activationDelay: 10000,
      durationDelay: 10000,
      repeat: true,
      repititionDelay: 10000,
      texts: [
        ["lukebmay at gmail dot com", [-3, 3], "horizontal"],
        ["LukeBMay at gmail", [-3, 3], "vertical"],
      ],
    }),
    // StaticText({
    //     href: "https://isu.lukemay.com",
    //     activationDelay:  0,
    //     showOnActive: true,
    //     durationDelay:   10000,
    //     repeat: true,
    //     repititionDelay: 10000,
    //     texts: [
    //         [ "abcdefghijklmnopqrstuvwxyz", [ Math.floor(cfg.ROWS/2), cfg.COLS-2], "horizontal" ],
    //         [ "abcdefghijklmnopqrstuvwxyz", [ Math.floor(cfg.ROWS/2)+1, -cfg.COLS+1], "horizontal" ],
    //         [ "abcdefghijklmnopqrstuvwxyz", [ cfg.ROWS-2, Math.floor(cfg.COLS/2)], "vertical" ],
    //         [ "abcdefghijklmnopqrstuvwxyz", [ -cfg.ROWS+1, Math.floor(cfg.COLS/2)+1], "vertical" ],
    //         [ " __A__", [ 0,  0], "horizontal" ],
    //         [ " __B__", [ 0, -1], "horizontal" ],
    //         [ " __C__", [-1,  0], "horizontal" ],
    //         [ " __D__", [-1, -1], "horizontal" ],
    //         [ " ||1||", [ 0,  0], "vertical" ],
    //         [ " ||2||", [ 0, -1], "vertical" ],
    //         [ " ||3||", [-1,  0], "vertical" ],
    //         [ " ||4||", [-1, -1], "vertical" ],
    //         [ "*", [ 0,  0], "horizontal" ],
    //         [ "*", [ 0, -1], "horizontal" ],
    //         [ "*", [-1,  0], "horizontal" ],
    //         [ "*", [-1, -1], "horizontal" ],
    //     ],
    // }),
  ];

  self.isRunning = false;
  self.isPaused = false;

  let then = Date.now() - 1;

  self.start = () => {
    self.isRunning = true;
    runTimeoutId = setTimeout(updateMatrix, cfg.FRAME);
    autopauseTimeoutId = setTimeout(() => {
      self.pause();
      console.log("Application auto-paused after time limit.");
    }, cfg.AUTOPAUSE_TIME);
    then = Date.now() - pauseDifference;
  };
  self.stop = () => {
    pauseDifference = Date.now() - then;
    self.isRunning = false;
    if (runTimeoutId) clearTimeout(runTimeoutId);
    if (autopauseTimeoutId) clearTimeout(autopauseTimeoutId);
  };
  self.unpause = () => {
    self.isPaused = false;
    self.start();
  };
  self.pause = () => {
    self.isPaused = true;
    self.stop();
  };

  self.stop();

  state.grid = Grid();
  state.dropManager = DropManager();
  state.domManager = DomManager();

  const updateMatrix = () => {
    const now = Date.now();
    const seconds = (now - then) / 1000;
    state.dropManager.updateDrops(seconds);
    state.domManager.updateDom(seconds);
    state.dropManager.killCompletedDrops();
    then = now;
    runTimeoutId = setTimeout(updateMatrix, cfg.FRAME_DELAY);
  };
}

export { Matrix };

export default Matrix;

