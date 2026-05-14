/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Integral of Linear Equation
const integralOfLinearEq = (m, b, x1, x2) => {
  return (m * x2 ** 2) / 2 + b * x2 - ((m * x1 ** 2) / 2 + b * x1);
};

function LinearSectionalArea(...args) {
  if (!new.target) return new LinearSectionalArea(...args);
  const self = this;

  self.m = args[0]; // slope
  self.b = args[1]; // y-intercept
  self.length = args[2]; // interval length [0, length]
  self.area = integralOfLinearEq(self.m, self.b, 0, self.length);
}

export { LinearSectionalArea };

export default LinearSectionalArea;
