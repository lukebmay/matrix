/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Classic script (not a module): surfaces a hint if ES modules never paint.
// DuckDuckGo mobile can silently fail the module graph and leave a black body.
(function () {
  if (typeof window === "undefined") return;
  window.setTimeout(function () {
    if (window.__MATRIX_OK__) return;
    var matrix = document.querySelector("#matrix");
    if (matrix && matrix.children && matrix.children.length > 0) return;
    if (document.getElementById("matrix-boot-error")) return;
    try {
      var msg = document.createElement("pre");
      msg.id = "matrix-boot-timeout";
      msg.style.cssText =
        "color:#0f0;padding:1rem;white-space:pre-wrap;font:14px monospace;position:relative;z-index:9999";
      msg.textContent =
        "Matrix did not start (8s).\n" +
        "On DuckDuckGo: clear site data for lukemay.com, or try Safari/Chrome.\n" +
        "Hard refresh may also help.";
      if (document.body) document.body.appendChild(msg);
    } catch (_) {
      /* ignore */
    }
  }, 8000);
})();
