---
title: CSS
order: 200
---

# CSS

When to use: Writing or reviewing CSS.

**Precedence:** Stylelint, Prettier, Tailwind/PostCSS configs override this file.

## Style

- Indent 2 spaces
- Prefer class-based styling; avoid `#id` selectors for reuse
- Logical properties when they simplify RTL/LTR (`margin-inline`, …)
- Custom properties for theme tokens
- Mobile-first media queries unless the project does the opposite
- With Tailwind: utility-first in markup; extract components when class strings hurt readability
- No `!important` except escape hatches

## Tools

- Lint: Stylelint
- Format: Prettier (and Stylelint --fix if configured)
