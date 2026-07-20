/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

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

// Pre-split code-point pools once — tip-enter used to Array.from each pick.
const MATRIX_POOL = Array.from(MATRIX_CODE_GLYPHS);
const ASCII_POOL = Array.from(ASCII_GLYPHS);

const pickPool = (pool) => pool[Math.floor(Math.random() * pool.length)];

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
    return { ch: pickPool(ASCII_POOL), face: "english" };
  }
  if (RAIN_GLYPH_MODE === "mix") {
    if (Math.random() < 0.5) {
      return { ch: pickPool(MATRIX_POOL), face: "matrix" };
    }
    return { ch: pickPool(ASCII_POOL), face: "english" };
  }
  return { ch: pickPool(MATRIX_POOL), face: "matrix" };
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
