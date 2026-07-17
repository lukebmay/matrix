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

  // Last tip row resolved per drop (paint ownership). Not Drop motion state.
  const lastTipRow = new WeakMap();

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

  // Sync one cell from logical. rainIfEmpty: paint noise when no content.
  // Otherwise blank the cell (force-clear / settled empty).
  const paintFromLogical = (r, c, el, { rainIfEmpty = false } = {}) => {
    const sm = state.sceneManager;
    const g = sm ? sm.paintGlyph(r, c) : { revealed: false, text: null };

    if (g.revealed && g.text) {
      if (el.textContent !== g.text) el.textContent = g.text;
      el.classList.add("m-revealed");
      // href/style stamped at init (m-static / m-link); keep settled look.
      return;
    }

    // Capture before remove: hide must replace intentional glyph, not keep it as "rain".
    const wasContent = el.classList.contains("m-revealed");
    el.classList.remove("m-revealed", "m-link-hover");
    if (rainIfEmpty) {
      // Fresh noise on blank or after hide; keep existing rain glyph otherwise.
      if (wasContent || el.textContent === " " || el.textContent === "") {
        el.textContent = randomChar();
      }
    } else {
      el.textContent = " ";
    }
  };

  // Tip entered this row: resolve once, then paint (rain if no content).
  const applyTipEnter = (r, c, el, drop) => {
    const sm = state.sceneManager;
    if (sm) {
      sm.applyTip(r, c, drop);
      paintFromLogical(r, c, el, { rainIfEmpty: true });
      return;
    }
    el.textContent = randomChar();
  };

  // Public: repaint after ScenePlayer force-clears logical cells.
  self.paintCell = (r, c, opts = {}) => {
    const el = grid.get(r, c);
    if (!el) return;
    paintFromLogical(r, c, el, opts);
  };

  self.repaintKeys = (keys, opts = {}) => {
    if (!keys?.length) return;
    for (const key of keys) {
      const parts = String(key).split(",");
      const r = Number(parts[0]);
      const c = Number(parts[1]);
      if (!Number.isFinite(r) || !Number.isFinite(c)) continue;
      self.paintCell(r, c, opts);
    }
  };

  // Pre-stamp static/link metadata for CSS + click handlers.
  // Visibility still comes only from logical + m-revealed.
  const initializeContent = () => {
    const layers = state.contentLayers ?? [];

    for (const layer of layers) {
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
            const fakeDrop = { spawnAt: performance.now() };
            for (const q of linePositions) {
              const cell = grid.get(q.r, q.c);
              if (!cell) continue;
              state.sceneManager?.applyTip?.(q.r, q.c, fakeDrop);
              paintFromLogical(q.r, q.c, cell, { rainIfEmpty: false });
            }
          }
          for (const q of linePositions) {
            const cell = grid.get(q.r, q.c);
            if (cell?.classList.contains("m-revealed")) {
              cell.classList.add("m-link-hover");
            }
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
    for (const c of dropManager.takeFinishedColumns?.() ?? []) {
      clearColumnTrail(c);
    }

    // Group live drops by column so multi-tip stacks paint as a union trail.
    const dropsByCol = new Map();
    for (const d of dropManager.getDrops()) {
      let list = dropsByCol.get(d.col);
      if (!list) {
        list = [];
        dropsByCol.set(d.col, list);
      }
      list.push(d);
    }

    for (const [c, colDrops] of dropsByCol) {
      // Resolve tip-enter per drop (spawn-order; stacker may cover pre-activation).
      for (const d of colDrops) {
        const r = d.getRow();
        const pr = lastTipRow.has(d) ? lastTipRow.get(d) : null;
        const from = pr == null ? 0 : pr + 1;
        const to = Math.min(r, cfg.ROWS - 1);
        for (let row = from; row <= to; row++) {
          if (row < 0) continue;
          const el = grid.get(row, c);
          if (el) applyTipEnter(row, c, el, d);
        }
        lastTipRow.set(d, r);
      }

      // Union trail CSS: any tip → m-drop-tip; else body; else clear trail.
      const tipRows = new Set();
      const trailRows = new Set();
      for (const d of colDrops) {
        const r = d.getRow();
        const l = d.length;
        if (r >= 0 && r < cfg.ROWS) tipRows.add(r);
        for (let i = 0; i < cfg.ROWS; i++) {
          if (i < r && i > r - l) trailRows.add(i);
        }
      }
      for (const tr of tipRows) trailRows.delete(tr);

      const colEl = grid.getColumn(c);
      if (colEl) {
        colEl.setAttribute("data-drop-id", colDrops[colDrops.length - 1].id);
      }

      for (let i = 0; i < cfg.ROWS; i++) {
        const el = grid.get(i, c);
        if (!el) continue;

        if (tipRows.has(i)) {
          el.classList.add("m-drop-tip");
          el.classList.remove("m-drop");
          paintFromLogical(i, c, el, { rainIfEmpty: true });
        } else if (trailRows.has(i)) {
          el.classList.add("m-drop");
          el.classList.remove("m-drop-tip");
          paintFromLogical(i, c, el, { rainIfEmpty: true });
        } else {
          el.classList.remove("m-drop", "m-drop-tip");
          // Settled content stays; empty cells not re-noised off-trail.
          if (state.sceneManager?.isContentRevealed?.(i, c)) {
            paintFromLogical(i, c, el, { rainIfEmpty: false });
          }
        }
      }
    }

    for (let c = 0; c < cfg.COLS; c++) {
      if (!dropsByCol.has(c)) {
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
