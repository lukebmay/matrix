function State(...args) {
  if (!new.target) return new State(...args);
  const self = this;

  self.config = null;
}

const state = State();

export { state };

export default state;

