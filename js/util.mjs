/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */
// Range
const range = function* (...args) {
  let [start, end, inc] = [0, null, 1];
  if (args.length === 1) end = args[0];
  else if (args.length === 2) [start, end] = args;
  else if (args.length === 3) [start, end, inc] = args;
  else
    throw new Error(
      `
Error range(): takes 1-3 arguments.
    range(end)
    range(start, end)
    range(start, end, increment)
`.trim(),
    );
  for (let i = start; i < end; i += inc) {
    yield i;
  }
};

const rangeArray = (...args) => {
  let arr = [];
  for (let value of range(...args)) {
    arr.push(value);
  }
  return arr;
};

const rangeMap = function* (...args) {
  const fn = args.pop();
  const rangeArgs = args;
  if (typeof fn !== "function" || (rangeArgs.length < 1) | (rangeArgs.length > 3)) {
    throw new Error(
      `
Error rangeMap(): takes 2-4 arguments.
    rangeMap(end, function)
    rangeMap(start, end, function)
    rangeMap(start, end, increment, function)
`.trim(),
    );
  }

  for (let i of range(...rangeArgs)) {
    yield fn(i);
  }
};

const rangeMapArray = (...args) => {
  let arr = [];
  for (let value of rangeMap(...args)) {
    arr.push(value);
  }
  return arr;
};

// const rangeMapTest = function () {
//     let arr = ["a", "b", "c", "d", "e", "f", "g"];

//     let out = rangeMapArray(1, 6, 2, function (i) {
//         return arr[i].toUpperCase();
//     });

//     let expected = ["B", "D", "F"];
//     if (JSON.stringify(out) === JSON.stringify(expected))
//         console.log("Test passed!");
//     else {
//         console.log("Test FAILED!");
//         console.log(`output: ${out}`);
//         console.log(`expected: ${expected}`);
//     }
// };
// rangeMapTest();

// Random character generation
const charsetArr = [];
for (let i = 33; i < 127; i++) {
  charsetArr.push(String.fromCharCode(i));
}
const charset = charsetArr.join("");

const randomChar = (alphabet) => {
  alphabet = alphabet ?? charset;
  return charset[Math.floor(Math.random() * alphabet.length)];
};

// Shuffle array (Durstenfeld version of Fisher-Yates)
const shuffle = (arr) => {
  for (let i = 0; i < arr.length - 1; i++) {
    let j = Math.floor(Math.random() * (arr.length - i)) + i;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Random choice from an array
const randomChoice = (collection) => {
  if (collection instanceof Set) {
    collection = Array.from(collection);
  } else if (!Array.isArray(collection) && typeof collection === "object") {
    collection = Array.from(collection);
  }
  return collection[Math.floor(Math.random() * collection.length)];
};

// Random choice from an array
const randomInterval = (lowerBoundInclusive, upperBoundExclusive) => {
  let scale = upperBoundExclusive - lowerBoundInclusive;
  let shift = lowerBoundInclusive;
  return Math.random() * scale + shift;
};

// Nanoid
const nanoidChars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-";
const nanoid = (length = 21, alphabet = nanoidChars) => {
  return rangeArray(length)
    .map(() => randomChoice(alphabet))
    .join("");
};

// Integral of Linear Equation
const integralOfLinearEq = (m, b, x1, x2) => {
  return (m * x2 ** 2) / 2 + b * x2 - ((m * x1 ** 2) / 2 + b * x1);
};

// Constrain a value to a provided interval
const constrainToInterval = (x, min, max) => {
  if (min > max) [min, max] = [max, min];
  if (x < min) return min;
  if (x > max) return max;
  return x;
};

export {
  randomChar,
  range,
  rangeArray,
  rangeMap,
  rangeMapArray,
  shuffle,
  randomChoice,
  randomInterval,
  nanoid,
  integralOfLinearEq,
  constrainToInterval,
};

export default {
  randomChar,
  range,
  rangeArray,
  rangeMap,
  rangeMapArray,
  shuffle,
  randomChoice,
  randomInterval,
  nanoid,
  integralOfLinearEq,
  constrainToInterval,
};

