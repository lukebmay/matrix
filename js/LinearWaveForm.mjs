/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */
import { integralOfLinearEq } from "./util.mjs";
import LinearSection from "./LinearSection.mjs";

// A collection of discrete LinearSections from which the area under their collective "curve" can be provided in chunks for each new value of an increasing x.

function LinearWaveForm(...args) {
  if (!new.target) return new LinearWaveForm(...args);
  const self = this;

  let linearSections = args[0];
  let sectionNumber = 0;

  let currentX = 0;
  let currentArea = 0;
  let areaRemainder = 0;

  self.getNextAreaChunk = (x, areaChunk = 0) => {
    let ls = linearSections[sectionNumber];
    areaChunk = areaChunk === 0 ? areaRemainder : areaChunk;
    // if overflowing into new LinearSection, accumulate remaining area and reset variables
    if (currentX + x > ls.length) {
      areaChunk += ls.area - currentArea;
      currentArea = 0;
      x = currentX + x - ls.length;
      currentX = 0;
      sectionNumber = (sectionNumber + 1) % linearSections.length;
      return self.getNextAreaChunk(x, areaChunk);
    }
    let intervalArea = integralOfLinearEq(ls.m, ls.b, currentX, currentX + x);
    currentX += x;
    areaChunk += intervalArea;
    currentArea += intervalArea;
    areaRemainder = areaChunk % 1;
    return Math.floor(areaChunk);
  };
}

LinearWaveForm.linearSectionsFromDropNumberAndTime = (dropNum, t) => {
  dropNum = Math.floor(dropNum);
  t = Math.floor(t);
  let q = Math.floor(dropNum / t);
  let r = dropNum % t;
  let r2 = t - r;
  return [LinearSection(0, q + 1, r), LinearSection(0, q, Math.ceil(r2))];
};

LinearWaveForm.linearSectionsFromStartingPointAndSlopeTimePairs = (startingY, slopeTimePairs) => {
  let linearSections = [];
  let b = startingY;
  for (let [m, x] of slopeTimePairs) {
    linearSections.push(LinearSection(m, b, x));
    b += m * x;
  }
  return linearSections;
};

export { LinearWaveForm };

export default LinearWaveForm;

