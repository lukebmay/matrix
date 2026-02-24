import { randomChar } from "./util.mjs";
import state from "./State.mjs";

function DomManager(...args) {
  if (!new.target) return new DomManager(...args);
  let self = this;

  let cfg = state.config;
  let grid = state.grid;
  let dropManager = state.dropManager;

  let matrixEl = document.querySelector("#matrix");

  const constructMatrixDom = () => {
    for (let c = 0; c < cfg.COLS; c++) {
      let columnEl = document.createElement("div");
      columnEl.style.visibility = "visible";
      columnEl.classList.add("m-col");
      for (let r = 0; r < cfg.ROWS; r++) {
        let el = document.createElement("code");
        el.id = `_${r}_${c}`;
        el.classList.add("m-char");
        el.textContent = " ";
        grid.set(r, c, el);
        columnEl.appendChild(el);
      }
      grid.setColumn(c, columnEl);
    }
    matrixEl.replaceChildren(...grid.columns);
  };
  constructMatrixDom();

  const initializeStaticTexts = () => {
    let grid = state.grid;
    let staticTexts = state.staticTexts;

    for (let st of staticTexts) {
      if (st.href) {
        let onClick = () => {
          if (window.event.ctrlKey) {
            window.open(st.href, "_blank");
            window.event.clickHandeled = "Static Text Navigation";
          } else {
            window.location.href = st.href;
          }
        };
        let onMouseOver = () => {
          let targetEl = window.event.target;
          if (!st.isComplete && targetEl.textContent.trim() !== "") {
            for (let p of st.positions) {
              let el = grid.get(p.r, p.c);
              el.textContent = p.char;
            }
            st.complete();
          }
          for (let p of st.positions) {
            let el = grid.get(p.r, p.c);
            if (st.href && p.char) {
              el.classList.add("m-link-hover");
            }
          }
        };
        let onMouseOut = () => {
          for (let p of st.positions) {
            let el = grid.get(p.r, p.c);
            if (st.href && p.char && p.char !== " ") {
              el.classList.remove("m-link-hover");
            }
          }
        };
        for (let p of st.positions) {
          let el = grid.get(p.r, p.c);
          if (st.href && p.char && p.char !== " ") {
            el.setAttribute("data-static-char", p.char);
            el.classList.add("m-link");
          }
          el.classList.add("m-static");
          el.addEventListener("click", onClick);
          el.addEventListener("mouseover", onMouseOver);
          el.addEventListener("mouseout", onMouseOut);
        }
      }
    }

    return staticTexts;
  };
  initializeStaticTexts();

  self.updateDom = (seconds_) => {
    for (let d of dropManager.getDrops()) {
      let r = d.getRow();
      let c = d.col;
      let pr = d.prevRow;
      let l = d.length;

      // Label column with drop ID for debugging.
      let colEl = grid.getColumn(c);
      colEl.setAttribute("data-drop-id", d.id);
      // if (colEl) colEl.style.visibility = "hidden";

      let tipEl = grid.get(r, c);
      if (tipEl) {
        let staticChar = tipEl.getAttribute("data-static-char");
        if (staticChar === null) {
          tipEl.textContent = randomChar();
        } else if (tipEl.textContent !== staticChar) {
          tipEl.textContent = staticChar;
        }
      }

      // Check if drop has moved, if not, we're done.
      if (pr === r) continue;

      if (tipEl) tipEl.classList.add("m-drop-tip");

      let lastTipEl = grid.get(pr, c);
      if (lastTipEl) lastTipEl.classList.remove("m-drop-tip");
      if (lastTipEl) lastTipEl.classList.add("m-drop");

      for (let i = r - 1; i >= 0; i--) {
        let el = grid.get(i, c);
        if (!el) continue;

        if (i > r - l) {
          el.classList.add("m-drop");
        } else if (i > pr - l) {
          el.classList.remove("m-drop");
        }

        if (el.textContent === " ") {
          let staticChar = el.getAttribute("data-static-char");
          if (staticChar === null) {
            el.textContent = randomChar();
          } else if (el.textContent !== staticChar) {
            el.textContent = staticChar;
          }
        }
      }
      // if (colEl) colEl.style.visibility = "visible";
    }
  };
}

export { DomManager };

export default DomManager;

