/*
 * Author: Luke Benjamin May
 * Website: lukemay.com
 *
 * Copyright © 2022-2026 Luke B. May. All rights reserved.
 *
 * This is part of my personal portfolio.
 * No permission is granted to copy, modify, distribute, or use this code.
 */

// Detection: override → hostname → production.

function normalizeMode(raw) {
  const v = String(raw).toLowerCase().trim();
  if (v === "dev" || v === "development") return "dev";
  if (v === "prod" || v === "production") return "production";
  return "production";
}

function isLocalhost(hostname) {
  if (!hostname) return false;
  const h = String(hostname).toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
}

function queryEnv(search) {
  if (search == null || search === "") return null;
  try {
    const q = new URLSearchParams(
      String(search).startsWith("?") ? String(search).slice(1) : String(search)
    );
    const e = q.get("env");
    return e != null && e !== "" ? e : null;
  } catch {
    return null;
  }
}

/** Pure-ish mode resolve; pass hints to override globals (tests). */
function resolveMode(hints = {}) {
  const override =
    hints.override ??
    (typeof globalThis.__MATRIX_ENV__ === "string" && globalThis.__MATRIX_ENV__
      ? globalThis.__MATRIX_ENV__
      : null) ??
    queryEnv(
      hints.search ??
        (typeof globalThis.location !== "undefined"
          ? globalThis.location?.search
          : null)
    );

  if (override != null) return normalizeMode(override);

  const hostname =
    hints.hostname ??
    (typeof globalThis.location !== "undefined"
      ? globalThis.location?.hostname
      : null);

  if (isLocalhost(hostname)) return "dev";
  return "production";
}

function envFromMode(MODE) {
  return Object.freeze({
    MODE,
    errorOnCycles: MODE === "dev",
  });
}

const env = envFromMode(resolveMode());

export { resolveMode, envFromMode, normalizeMode, isLocalhost, env };
export const MODE = env.MODE;
export const errorOnCycles = env.errorOnCycles;
export default env;
