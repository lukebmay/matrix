/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */
import { randomRainGlyph } from "./RainGlyphs.mjs";
import { getPalette } from "./themes.mjs";
import state from "./State.mjs";

function DomManager(...args) {
  if (!new.target) return new DomManager(...args);
  const self = this;

  const cfg = state.config;
  const grid = state.grid;
  const dropManager = state.dropManager;

  // Last tip row resolved per drop (paint ownership). Not Drop motion state.
  const lastTipRow = new WeakMap();
  // Dirty trail paint: last role + theme written on each cell.
  const trailRole = new WeakMap(); // el → "tip" | "body"
  const trailTheme = new WeakMap(); // el → theme name last applied to --drop-*
  // Reused per frame / per column (avoid Map alloc on the hot path).
  const rowPaint = new Map(); // row → { kind: 'tip'|'body', drop }

  const matrixEl = document.querySelector("#matrix");

  // Glyph lives in .m-glyph so rain can scaleY without stretching the cell box.
  const glyphOf = (el) => {
    let span = el.firstElementChild;
    if (!span || !span.classList.contains("m-glyph")) {
      span = document.createElement("span");
      span.className = "m-glyph";
      el.replaceChildren(span);
    }
    return span;
  };

  const getGlyph = (el) => glyphOf(el).textContent ?? "";

  // face: "matrix" | "english" | null (settled content / blank).
  const setGlyph = (el, ch, face = null) => {
    const span = glyphOf(el);
    if (span.textContent !== ch) span.textContent = ch;
    el.classList.toggle("m-rain-mx", face === "matrix");
    el.classList.toggle("m-rain-en", face === "english");
  };

  const setRainGlyph = (el) => {
    const { ch, face } = randomRainGlyph();
    setGlyph(el, ch, face);
  };

  const constructMatrixDom = () => {
    for (let c = 0; c < cfg.COLS; c++) {
      const columnEl = document.createElement("div");
      columnEl.style.visibility = "visible";
      columnEl.classList.add("m-col");
      for (let r = 0; r < cfg.ROWS; r++) {
        const el = document.createElement("code");
        el.id = `_${r}_${c}`;
        el.classList.add("m-char");
        setGlyph(el, " ");
        grid.set(r, c, el);
        columnEl.appendChild(el);
      }
      grid.setColumn(c, columnEl);
    }
    matrixEl.replaceChildren(...grid.columns);
  };
  constructMatrixDom();

  const clearDropPaint = (el) => {
    el.classList.remove("m-drop", "m-drop-tip");
    el.style.removeProperty("--drop-low");
    el.style.removeProperty("--drop-med");
    el.style.removeProperty("--drop-hi");
    // Keep --res-low: residual glyph color only changes when a drop visits.
    trailRole.delete(el);
    trailTheme.delete(el);
  };

  const applyDropPalette = (el, themeName) => {
    if (trailTheme.has(el) && trailTheme.get(el) === themeName) return;

    const p =
      getPalette(themeName) ??
      getPalette(state.themeDirector?.active) ??
      null;
    if (!p) {
      el.style.removeProperty("--drop-low");
      el.style.removeProperty("--drop-med");
      el.style.removeProperty("--drop-hi");
      trailTheme.set(el, themeName);
      return;
    }
    el.style.setProperty("--drop-low", p.low);
    el.style.setProperty("--drop-med", p.med);
    el.style.setProperty("--drop-hi", p.hi);
    // Stamp residual: after the trail leaves, glyph keeps this theme's low.
    el.style.setProperty("--res-low", p.low);
    trailTheme.set(el, themeName);
  };

  // Tip / body role + palette only when kind or theme flips.
  const applyTrailRole = (el, kind, themeName) => {
    const prevKind = trailRole.get(el);
    const themeSame = trailTheme.has(el) && trailTheme.get(el) === themeName;
    if (prevKind === kind && themeSame) return;

    applyDropPalette(el, themeName);
    if (prevKind !== kind) {
      if (kind === "tip") {
        el.classList.add("m-drop-tip");
        el.classList.remove("m-drop");
      } else {
        el.classList.add("m-drop");
        el.classList.remove("m-drop-tip");
      }
      trailRole.set(el, kind);
    }
  };

  const clearColumnTrail = (c) => {
    for (let r = 0; r < cfg.ROWS; r++) {
      const el = grid.get(r, c);
      if (!el) continue;
      clearDropPaint(el);
    }
  };

  // Sync one cell from logical. rainIfEmpty: paint noise when no content.
  // Otherwise blank the cell (force-clear / settled empty).
  const paintFromLogical = (r, c, el, { rainIfEmpty = false } = {}) => {
    const sm = state.sceneManager;
    const g = sm ? sm.paintGlyph(r, c) : { revealed: false, text: null };

    if (g.revealed && g.text) {
      setGlyph(el, g.text, null);
      el.classList.add("m-revealed");
      // Link chrome follows *logical* href. Shared cells (e.g. mobile quote
      // col 1 vs email vertical) may still carry m-link from another layer's
      // init stamp — that made settled quote glyphs stick at link brightness.
      if (g.href) {
        el.classList.add("m-link");
      } else {
        el.classList.remove("m-link", "m-link-hover");
      }
      return;
    }

    // Capture before remove: hide must replace intentional glyph, not keep it as "rain".
    const wasContent = el.classList.contains("m-revealed");
    el.classList.remove("m-revealed", "m-link-hover");
    if (rainIfEmpty) {
      // Fresh noise on blank or after hide; keep existing rain glyph otherwise.
      const cur = getGlyph(el);
      if (wasContent || cur === " " || cur === "") {
        setRainGlyph(el);
      }
    } else {
      setGlyph(el, " ", null);
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
    setRainGlyph(el);
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

        // Style only — hasten / re-reveal live on play units (bindHover).
        const onMouseOver = () => {
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

    // Paint each live column's union trail (stacks share the column).
    // Uses DropManager.forEachColumnDrops — no Array.from / regroup Map.
    dropManager.forEachColumnDrops?.((c, colDrops) => {
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

      // Per-row owner so mixed-theme stacks keep each drop's palette.
      // kind tip always wins; body prefers higher tip (leader).
      rowPaint.clear();
      for (const d of colDrops) {
        const r = d.getRow();
        const l = d.length;
        if (r >= 0 && r < cfg.ROWS) {
          rowPaint.set(r, { kind: "tip", drop: d });
        }
        // Body band only (not a full-ROWS probe per drop).
        const bodyStart = Math.max(0, r - l + 1);
        const bodyEnd = Math.min(r - 1, cfg.ROWS - 1);
        for (let i = bodyStart; i <= bodyEnd; i++) {
          const prev = rowPaint.get(i);
          if (prev?.kind === "tip") continue;
          if (!prev || d._row > prev.drop._row) {
            rowPaint.set(i, { kind: "body", drop: d });
          }
        }
      }

      const colEl = grid.getColumn(c);
      if (colEl) {
        const id = colDrops[colDrops.length - 1].id;
        if (colEl.getAttribute("data-drop-id") !== id) {
          colEl.setAttribute("data-drop-id", id);
        }
      }

      // Only restyle tip enter (above), trail leave, or role/theme flip.
      for (let i = 0; i < cfg.ROWS; i++) {
        const el = grid.get(i, c);
        if (!el) continue;

        const paint = rowPaint.get(i);
        if (paint?.kind === "tip" || paint?.kind === "body") {
          applyTrailRole(el, paint.kind, paint.drop.theme);
          // Glyph / logical already applied on tip-enter; steady trail is CSS only.
        } else if (trailRole.has(el)) {
          clearDropPaint(el);
          // Settled content stays; empty cells not re-noised off-trail.
          if (state.sceneManager?.isContentRevealed?.(i, c)) {
            paintFromLogical(i, c, el, { rainIfEmpty: false });
          }
        }
      }
    });

    for (let c = 0; c < cfg.COLS; c++) {
      if (dropManager.isColumnLive?.(c)) continue;
      const colEl = grid.getColumn(c);
      if (colEl?.hasAttribute("data-drop-id")) {
        clearColumnTrail(c);
        colEl.removeAttribute("data-drop-id");
      }
    }
  };
}

export { DomManager };
export default DomManager;
