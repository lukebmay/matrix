/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Wall / unattended mode. Portfolio defaults stay on unless this resolves true.

function truthyFlag(raw) {
  if (raw == null) return false;
  const v = String(raw).toLowerCase().trim();
  if (v === "" || v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  return true;
}

/** Path segment: /kiosk, /matrix/kiosk, trailing slash OK. */
function pathLooksLikeKiosk(pathname) {
  if (pathname == null || pathname === "") return false;
  const p = String(pathname).replace(/\/+$/, "") || "/";
  return p === "/kiosk" || p.endsWith("/kiosk");
}

function queryLooksLikeKiosk(search) {
  if (search == null || search === "") return false;
  try {
    const q = new URLSearchParams(
      String(search).startsWith("?") ? String(search).slice(1) : String(search),
    );
    if (truthyFlag(q.get("kiosk"))) return true;
    if (truthyFlag(q.get("wall"))) return true;
    return false;
  } catch {
    return false;
  }
}

function hashLooksLikeKiosk(hash) {
  if (hash == null || hash === "") return false;
  const h = String(hash).replace(/^#/, "").toLowerCase().trim();
  return h === "kiosk" || h === "wall" || h.startsWith("kiosk=") || h.startsWith("wall=");
}

/**
 * Pure-ish resolve; pass hints to override globals (tests).
 * Order: explicit hint / __MATRIX_KIOSK__ → path → query → hash.
 */
function resolveKiosk(hints = {}) {
  if (hints.kiosk === true) return true;
  if (hints.kiosk === false) return false;

  if (typeof hints.override === "boolean") return hints.override;

  if (typeof globalThis.__MATRIX_KIOSK__ === "boolean") {
    return globalThis.__MATRIX_KIOSK__;
  }

  const pathname =
    hints.pathname ??
    (typeof globalThis.location !== "undefined"
      ? globalThis.location?.pathname
      : null);
  if (pathLooksLikeKiosk(pathname)) return true;

  const search =
    hints.search ??
    (typeof globalThis.location !== "undefined"
      ? globalThis.location?.search
      : null);
  if (queryLooksLikeKiosk(search)) return true;

  const hash =
    hints.hash ??
    (typeof globalThis.location !== "undefined"
      ? globalThis.location?.hash
      : null);
  if (hashLooksLikeKiosk(hash)) return true;

  return false;
}

export {
  resolveKiosk,
  pathLooksLikeKiosk,
  queryLooksLikeKiosk,
  hashLooksLikeKiosk,
  truthyFlag,
};
export default resolveKiosk;

// --- smoke (node: node --check or direct import) ---
if (
  typeof process !== "undefined" &&
  process.argv?.[1] &&
  String(process.argv[1]).endsWith("kiosk.mjs")
) {
  const assert = await import("node:assert/strict");
  console.log("Running kiosk smoke tests...");

  assert.equal(pathLooksLikeKiosk("/kiosk"), true);
  assert.equal(pathLooksLikeKiosk("/kiosk/"), true);
  assert.equal(pathLooksLikeKiosk("/matrix/kiosk"), true);
  assert.equal(pathLooksLikeKiosk("/matrix/kiosk/"), true);
  assert.equal(pathLooksLikeKiosk("/matrix"), false);
  assert.equal(pathLooksLikeKiosk("/"), false);
  assert.equal(pathLooksLikeKiosk("/kiosk-extra"), false);

  assert.equal(queryLooksLikeKiosk("?kiosk=1"), true);
  assert.equal(queryLooksLikeKiosk("?wall=true"), true);
  assert.equal(queryLooksLikeKiosk("?kiosk=0"), false);
  assert.equal(queryLooksLikeKiosk("?env=dev"), false);

  assert.equal(hashLooksLikeKiosk("#kiosk"), true);
  assert.equal(hashLooksLikeKiosk("#wall"), true);
  assert.equal(hashLooksLikeKiosk("#other"), false);

  assert.equal(resolveKiosk({ pathname: "/matrix/kiosk" }), true);
  assert.equal(resolveKiosk({ search: "?kiosk=1", pathname: "/" }), true);
  assert.equal(resolveKiosk({ hash: "#kiosk", pathname: "/" }), true);
  assert.equal(resolveKiosk({ kiosk: false, pathname: "/kiosk" }), false);
  assert.equal(resolveKiosk({ kiosk: true, pathname: "/" }), true);
  assert.equal(resolveKiosk({ pathname: "/", search: "", hash: "" }), false);

  console.log("kiosk smoke tests passed! ✓");
}
