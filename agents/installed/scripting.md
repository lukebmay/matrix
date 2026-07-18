# Scripting

Assume **Linux** (latest Ubuntu LTS unless stated). Prefer portable choices when cheap.

Language-specific style: `agents/languages/<lang>.md`. **In-repo** formatter/LSP/style configs override those files.

## Scripts → `bin/` (install)

`installer/build-scripts.py` flattens tools into `$shellrc/bin/` on PATH.

| Kind | How it installs |
| --- | --- |
| **Standalone** | One file under `scripts/` → `bin/<stem>` (extension stripped) |
| **Multi-file project** | Language-specific **package/project markers**; only the entry lands in `bin/` |

**Do not** treat shebang as “this file is a bin entry.” Libraries often use shebangs and `if __name__ == "__main__":` for smoke tests.

Full rules, Python package layout, and planned multi-language markers: **`agents/scripts-build.md`**.

## All scripts

- Hashbang always (including sourced files).
- Support `--help` and `--version`; list dependencies in help.
- Check deps before run; offer install if missing.
- Fail gracefully; solid error handling, logging, exit codes.
- ANSI colors: `agents/ansi-colors.md`.
- Comments: `agents/comments.md`.
- Prefer single-file scripts under ~500–1000 lines; larger work → multi-file project (`agents/scripts-build.md`).
- Readability first; optimize only when cost approaches seconds.
- Short names only for obvious locals (`i`, `k`/`v`, `f`) or conventional math (comment the terms).
- Almost never emoji/unicode in code. Exceptions: test/task results — green `✓` / red `X`.

## Dependency checks (required)

Scripts and non-trivial functions **must fail early and clearly** when a required tool is missing. Never continue with a half-broken PATH or a cryptic downstream error.

| Rule | Detail |
| --- | --- |
| **When** | Before first use of an external binary, package, or service the tool cannot run without |
| **How** | `command -v tool` (shell) / `shutil.which` (Python) / equivalent — check each hard dependency |
| **Message** | Name the missing tool; say what the script was trying to do; prefer **install instructions** when known |
| **Exit code** | **127** when the failure is “command not found” / missing binary; **1** (or domain code) for other precondition failures; never exit 0 on a hard missing dep |
| **Optional deps** | Soft features may degrade (warn once, continue) — document in `--help` as optional |
| **Help text** | List hard + optional dependencies in `--help` / `--version` area so humans see them without failing first |

### Install instructions (prefer concrete)

When the platform is likely Ubuntu/Debian (this project’s default), include a copy-pasteable install line:

```text
error: `fzf` not found (needed for interactive path pick)
Install: sudo apt install fzf
# or: user-install-… / install-… when shellrc has a dedicated installer
```

When a shellrc installer exists, point at it first (`install-yazi`, `user-install-yazi`, `install-rg`, …). When the tool is third-party only, give the distro package name and/or upstream URL — do not invent package names.

### Consistency

| Kind | Convention |
| --- | --- |
| Prefix | `scriptname: ` on stderr for errors (match existing tools) |
| Colors | Red/error for fatal; yellow for warn; see `ansi-colors.md` |
| Non-interactive | No prompts to “install now?” unless TTY + safe; always print the install command |
| Source modules | Optional tools: guard and `return 0` quietly (or debug note); installers remain the place for hard errors |

## Interactive vs script mode (non-trivial tools)

Detect whether a human is driving the command (typical: both stdin and stdout are TTYs). Behavior should fork:

| Mode | Detect | Safe defaults | Destructive / irreversible |
| --- | --- | --- | --- |
| **Interactive** | e.g. `stdin` + `stdout` are TTYs | Prompt for confirmations, optional edits, descriptions | Ask explicitly (prefer exact answer `yes`, not bare `y`, for high risk) |
| **Script / CI / pipe** | not a TTY (or stdin closed) | Keep existing state; no prompts; no surprise writes | **Refuse** unless the user passes **`--force`** (or an equally explicit flag) |

Rules of thumb:

1. **Never** assume “yes” in non-interactive mode for delete, overwrite, wipe, host wipe, raw config edit, or foreign-host apply.
2. **`--force`** means “I know; do it anyway” — document it in `--help` next to every dangerous op.
3. Interactive prompts should print a short **what will happen** (paths, names) before asking.
4. Optional niceties (open `$EDITOR`, “modify description?”) are **TTY-only**; script mode skips them and keeps prior values unless flags set them.
5. Mismatched hardware / foreign machine apply: warn in color and require `--force` even on a TTY when risk is high (or always require it for foreign hosts — be consistent per tool).
6. Same pattern in zsh/Python: `[[ -t 0 && -t 1 ]]` / `sys.stdin.isatty() and sys.stdout.isatty()`.

Example (`gdisplays`; shellrc also aliases `displays=gdisplays`):

- `gdisplays delete name` → interactive `yes`; non-interactive needs `--force`
- `gdisplays delete-host oldpc` → same
- `gdisplays copy a b` when `b` exists → confirm / `--force`
- `gdisplays load otherhost/name` on connector mismatch → `--force`
- `gdisplays save name` without `-d` → prompt only on TTY; scripts keep existing description

## Args

- **Python:** `argparse` (`--key value` and `--key=value`).
- **zsh:** prefer `--key=value`; `zparseopts` unless unusual opts need hand parsing.
- Otherwise use the language’s standard/popular parser when option sets grow.
- Destructive ops: pair with `--force` for non-interactive use (see above).

## Shell

- `set -euo pipefail`
- `local` in functions; quote `"$var"` and `"$(cmd)"`
- Prefer `[[ ]]` over `[ ]`
- `trap` for cleanup on `EXIT`/`ERR`
- Defend against caller env: `emulate -L zsh` (script top or function top if sourced); set `-euo pipefail`; save/restore `IFS` if changed
- Wrappers that only set env then run another program: `exec` the final command

## Language choice

| Prefer | When |
| --- | --- |
| **zsh** | Wrappers, small installers, simple utilities |
| **bash/POSIX sh** | Must run where only sh is available |
| **Python 3** | Complex logic/options, data work, heavier control flow |
| **Lua** | Minimal footprint / high efficiency; typings only if scale warrants |
| **JS (node/bun/deno)** | Same niche as Python when the project is already JS-based |

Python: system `python3` from apt unless stated; no hard-coded venv hashbang; document deps / optional venv.

## Cross-refs

- **Scripts → bin build:** `agents/scripts-build.md`
- Languages: `agents/languages/<name>.md` (zsh, bash, python, lua, javascript, typescript, …)
- Web: `web-frontend.md`, `web-backend.md`
- Data: `postgres.md`, `mysql.md`, `sqlite.md`, `redis.md`, `mongodb.md`
- Runtime env: `docker.md`, `kubernetes.md`, `podman.md`, `qemu.md`
