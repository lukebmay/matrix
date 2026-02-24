import { integralOfLinearEq } from "./util.mjs";

function LinearSection(...args) {
  if (!new.target) return new LinearSection(...args);
  const self = this;

  self.m = args[0]; // slope
  self.b = args[1]; // y-intercept
  self.length = args[2]; // interval length [0, length]
  self.area = integralOfLinearEq(self.m, self.b, 0, self.length);
}

export { LinearSection };

export default LinearSection;

