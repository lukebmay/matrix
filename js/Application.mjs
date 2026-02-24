import Configuration from "./Configuration.mjs";
import Matrix from "./Matrix.mjs";
import state from "./State.mjs";

function Application(...args) {
  if (!new.target) return new Application(...args);
  const self = this;

  self.matrix = null;

  self.onClick = (event_) => {
    if (!window.event.clickHandeled) {
      self.togglePause();
    }
  };

  let timeoutId;
  self.onResize = (event_) => {
    self.matrix.stop();
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      self.restart();
    }, 300);
  };

  self.togglePause = () => {
    if (self.matrix?.isPaused) self.matrix?.unpause();
    else self.matrix?.pause();
  };

  self.restart = () => {
    console.log("Application restarted...");
    self.matrix.stop();
    state.config = Configuration();
    console.log(`rows: ${state.config.ROWS} x cols: ${state.config.COLS}`);
    self.matrix = Matrix();
    self.matrix.start();
  };

  self.run = () => {
    console.log("Application started...");
    state.config = Configuration();
    console.log(`rows: ${state.config.ROWS} x cols: ${state.config.COLS}`);
    self.matrix = Matrix();
    self.matrix.start();
    window.addEventListener("click", self.onClick);
    window.addEventListener("resize", self.onResize, true);
  };

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && !self.matrix?.isPaused) {
      console.log("Application unpaused - visibility change.");
      self.matrix?.start();
    } else if (!self.matrix?.isPaused) {
      console.log("Application paused - visibility change.");
      self.matrix?.stop();
    }
  });
}

const app = Application();

export { app };

export default app;

