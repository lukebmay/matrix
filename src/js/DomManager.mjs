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

  const clearColumnTrail = (c) => {
    for (let r = 0; r < cfg.ROWS; r++) {
      const el = grid.get(r, c);
      if (!el) continue;
      el.classList.remove("m-drop", "m-drop-tip");
    }
  };

  // Paint static glyph and notify reveal tracking.
  const revealStaticAt = (r, c, el) => {
    const staticChar = el.getAttribute("data-static-char");
    if (staticChar === null) return false;
    if (el.textContent !== staticChar) {
      el.textContent = staticChar;
    }
    dropManager.notifyCellRevealed?.(r, c);
    return true;
  };

  const initializeContent = () => {
    const layers = state.contentLayers ?? [];

    for (const layer of layers) {
      // Index positions by cell for per-line link handlers.
      for (const p of layer.positions) {
        const el = grid.get(p.r, p.c);
        if (!el || !p.char || p.char === " ") continue;

        el.setAttribute("data-static-char", p.char);
        el.classList.add("m-static");
        if (p.href) {
          el.classList.add("m-link");
          el.dataset.href = p.href;
          el.dataset.lineId = String(p.lineId);
        }

        if (!p.href) continue;

        const linePositions = layer.positions.filter((q) => q.lineId === p.lineId);

        const onClick = (event) => {
          event.stopPropagation();
          event.clickHandled = "Display Text Navigation";
          if (event.ctrlKey) {
            open(p.href, "_blank");
          } else {
            window.location.href = p.href;
          }
        };

        const onMouseOver = (event) => {
          const targetEl = event.target;
          if (!layer.isComplete && targetEl.textContent.trim() !== "") {
            for (const q of linePositions) {
              const cell = grid.get(q.r, q.c);
              if (cell) {
                cell.textContent = q.char;
                dropManager.notifyCellRevealed?.(q.r, q.c);
              }
            }
          }
          for (const q of linePositions) {
            const cell = grid.get(q.r, q.c);
            if (cell) cell.classList.add("m-link-hover");
          }
        };

        const onMouseOut = () => {
          for (const q of linePositions) {
            const cell = grid.get(q.r, q.c);
            if (cell) cell.classList.remove("m-link-hover");
          }
        };

        el.addEventListener("click", onClick);
        el.addEventListener("mouseover", onMouseOver);
        el.addEventListener("mouseout", onMouseOut);
      }
    }
  };
  initializeContent();

  self.updateDom = () => {
    // Clear trails on columns whose drops just finished (stuck m-drop fix).
    for (const c of dropManager.takeFinishedColumns?.() ?? []) {
      clearColumnTrail(c);
    }

    const activeCols = new Set();

    for (const d of dropManager.getDrops()) {
      const r = d.getRow();
      const c = d.col;
      const pr = d.prevRow;
      const l = d.length;
      activeCols.add(c);

      const colEl = grid.getColumn(c);
      if (colEl) colEl.setAttribute("data-drop-id", d.id);

      const tipEl = grid.get(r, c);
      if (tipEl) {
        const staticChar = tipEl.getAttribute("data-static-char");
        if (staticChar === null) {
          tipEl.textContent = randomChar();
        } else {
          revealStaticAt(r, c, tipEl);
        }
      }

      if (pr === r) continue;

      if (tipEl) tipEl.classList.add("m-drop-tip");

      const lastTipEl = grid.get(pr, c);
      if (lastTipEl) {
        lastTipEl.classList.remove("m-drop-tip");
        lastTipEl.classList.add("m-drop");
      }

      // Clear any cells above the trail head that are no longer in the drop body.
      for (let i = 0; i < cfg.ROWS; i++) {
        const el = grid.get(i, c);
        if (!el) continue;

        const inTrail = i < r && i > r - l;
        const isTip = i === r;

        if (isTip) {
          // tip class set above
        } else if (inTrail) {
          el.classList.add("m-drop");
          el.classList.remove("m-drop-tip");
        } else {
          el.classList.remove("m-drop", "m-drop-tip");
        }

        // Fill empty rain cells; reveal static if tip/trail crossed space.
        if (inTrail || isTip) {
          if (el.textContent === " " || el.getAttribute("data-static-char")) {
            const staticChar = el.getAttribute("data-static-char");
            if (staticChar === null) {
              if (el.textContent === " ") el.textContent = randomChar();
            } else {
              revealStaticAt(i, c, el);
            }
          }
        }
      }
    }

    // Safety: no active drop on column → no med/hi trail classes.
    for (let c = 0; c < cfg.COLS; c++) {
      if (!activeCols.has(c)) {
        // Only walk columns that still look active (cheap attr check via first trail)
        const colEl = grid.getColumn(c);
        if (colEl?.hasAttribute("data-drop-id")) {
          clearColumnTrail(c);
          colEl.removeAttribute("data-drop-id");
        }
      }
    }
  };
}

export { DomManager };
export default DomManager;
