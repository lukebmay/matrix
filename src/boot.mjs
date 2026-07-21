/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Entry boot: dynamic import only (no top-level await — Safari/WebKit / DDG iOS).
// HTML injects ?v=BUILD_ID; build rewrites nested imports to the same id.

import("./app.mjs")
  .catch((err) => {
    console.error("[matrix] module load failed", err);
    try {
      const msg = document.createElement("pre");
      msg.id = "matrix-boot-error";
      msg.style.cssText =
        "color:#0f0;padding:1rem;white-space:pre-wrap;font:14px monospace;position:relative;z-index:9999";
      msg.textContent =
        "Matrix failed to load:\n" + (err && (err.stack || err));
      document.body?.appendChild(msg);
    } catch {
      /* ignore */
    }
  });
