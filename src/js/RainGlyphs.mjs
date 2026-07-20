/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

import { randomChar } from "./util/random.mjs";

// Classic Matrix rain alphabet — codepoints present in Matrix-Code.ttf
// (github.com/Rezmason/matrix, MIT). Space/© omitted as rain noise.
export const MATRIX_CODE_GLYPHS =
  '"*+012345789:<>z|¦╌▪アウエオカキケコサシスセソタツテナニヌネハヒホマミムメモヤヨラリワー꞊\ue937';

// Printable ASCII (33–126) — English body face (Ubuntu Sans Mono).
export const ASCII_GLYPHS = Array.from({ length: 94 }, (_, i) =>
  String.fromCharCode(33 + i),
).join("");

// "matrix" | "ascii" | "mix"
// mix = 50/50 pool pick so ASCII length does not drown Matrix glyphs.
export const RAIN_GLYPH_MODE = "mix";

const uniqueJoin = (...parts) => {
  const seen = new Set();
  let out = "";
  for (const part of parts) {
    for (const ch of part) {
      if (seen.has(ch)) continue;
      seen.add(ch);
      out += ch;
    }
  }
  return out;
};

// Flat union for callers that want one string (e.g. tests).
export const RAIN_GLYPHS =
  RAIN_GLYPH_MODE === "ascii"
    ? ASCII_GLYPHS
    : RAIN_GLYPH_MODE === "mix"
      ? uniqueJoin(MATRIX_CODE_GLYPHS, ASCII_GLYPHS)
      : MATRIX_CODE_GLYPHS;

/** @returns {{ ch: string, face: "matrix" | "english" }} */
export const randomRainGlyph = () => {
  if (RAIN_GLYPH_MODE === "ascii") {
    return { ch: randomChar(ASCII_GLYPHS), face: "english" };
  }
  if (RAIN_GLYPH_MODE === "mix") {
    if (Math.random() < 0.5) {
      return { ch: randomChar(MATRIX_CODE_GLYPHS), face: "matrix" };
    }
    return { ch: randomChar(ASCII_GLYPHS), face: "english" };
  }
  return { ch: randomChar(MATRIX_CODE_GLYPHS), face: "matrix" };
};

export const randomRainChar = () => randomRainGlyph().ch;

export default {
  MATRIX_CODE_GLYPHS,
  ASCII_GLYPHS,
  RAIN_GLYPH_MODE,
  RAIN_GLYPHS,
  randomRainGlyph,
  randomRainChar,
};
