/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */
import { randomChar } from "./util.mjs";
import state from "./State.mjs";

function DomManager(...args) {
  if (!new.target) return new DomManager(...args);
  const self = this;

  const cfg = state.config;
  const grid = state.grid;
  const dropManager = state.dropManager;

  const matrixEl = document.querySelector("#matrix");

  const constructMatrixDom = () => {
    for (let c = 0; c < cfg.COLS; c++) {
      const columnEl = document.createElement("div");
      columnEl.style.visibility = "visible";
      columnEl.classList.add("m-col");
      for (let r = 0; r < cfg.ROWS; r++) {
        const el = document.createElement("code");
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

  const initializeContent = () => {
    const layers = state.contentLayers ?? [];

    for (const layer of layers) {
      if (!layer.href) continue;

      const onClick = (event) => {
        if (event.ctrlKey) {
          open(layer.href, "_blank");
          event.clickHandled = "Display Text Navigation";
        } else {
          window.location.href = layer.href;
        }
      };
      const onMouseOver = (event) => {
        const targetEl = event.target;
        if (!layer.isComplete && targetEl.textContent.trim() !== "") {
          for (const p of layer.positions) {
            const el = grid.get(p.r, p.c);
            if (el) el.textContent = p.char;
          }
          layer.complete?.();
        }
        for (const p of layer.positions) {
          const el = grid.get(p.r, p.c);
          if (el && layer.href && p.char) {
            el.classList.add("m-link-hover");
          }
        }
      };
      const onMouseOut = () => {
        for (const p of layer.positions) {
          const el = grid.get(p.r, p.c);
          if (el && layer.href && p.char && p.char !== " ") {
            el.classList.remove("m-link-hover");
          }
        }
      };

      for (const p of layer.positions) {
        const el = grid.get(p.r, p.c);
        if (!el) continue;
        if (layer.href && p.char && p.char !== " ") {
          el.setAttribute("data-static-char", p.char);
          el.classList.add("m-link");
        }
        el.classList.add("m-static");
        el.addEventListener("click", onClick);
        el.addEventListener("mouseover", onMouseOver);
        el.addEventListener("mouseout", onMouseOut);
      }
    }
  };
  initializeContent();

  self.updateDom = () => {
    for (const d of dropManager.getDrops()) {
      const r = d.getRow();
      const c = d.col;
      const pr = d.prevRow;
      const l = d.length;

      const colEl = grid.getColumn(c);
      if (colEl) colEl.setAttribute("data-drop-id", d.id);

      const tipEl = grid.get(r, c);
      if (tipEl) {
        const staticChar = tipEl.getAttribute("data-static-char");
        if (staticChar === null) {
          tipEl.textContent = randomChar();
        } else if (tipEl.textContent !== staticChar) {
          tipEl.textContent = staticChar;
        }
      }

      if (pr === r) continue;

      if (tipEl) tipEl.classList.add("m-drop-tip");

      const lastTipEl = grid.get(pr, c);
      if (lastTipEl) {
        lastTipEl.classList.remove("m-drop-tip");
        lastTipEl.classList.add("m-drop");
      }

      for (let i = r - 1; i >= 0; i--) {
        const el = grid.get(i, c);
        if (!el) continue;

        if (i > r - l) {
          el.classList.add("m-drop");
        } else if (i > pr - l) {
          el.classList.remove("m-drop");
        }

        if (el.textContent === " ") {
          const staticChar = el.getAttribute("data-static-char");
          if (staticChar === null) {
            el.textContent = randomChar();
          } else if (el.textContent !== staticChar) {
            el.textContent = staticChar;
          }
        }
      }
    }
  };
}

export { DomManager };
export default DomManager;
