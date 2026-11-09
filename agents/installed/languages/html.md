---
title: HTML
order: 200
---

# HTML

When to use: Writing or reviewing HTML.

**Precedence:** `.htmlhintrc`, Prettier, ESLint HTML plugin, and project templates override this file.

## Style

- Semantic elements over div soup
- Accessibility: labels for inputs, meaningful alt text, keyboard-reachable controls
- Indent 2 spaces; UTF-8
- Keep structure flat when possible; avoid deep nesting without reason
- Inline JS/CSS only when tiny or required by context; prefer external assets in apps

## Tools

- Format: Prettier
- Lint: HTMLHint / ESLint html plugin as configured
