# Product checks

**Owner:** human. Agents may propose edits; apply only with explicit permission.

This file is an incomplete list of what the product should do, written
so a test can confirm it. The handbook calls it acceptance. It is not
the design. Bugs live in [`issues.md`](./issues.md).

## When to run

Test the change you just made with the checks that change names.
The checks in this file are a periodic acceptance, not that test.

Run them after a large workload, about once or twice a week, or
once at the end of a stretch of active development that is landing
many changes. A change that cannot affect product behavior does not
wait on this run. That includes the handbook and documentation.
The push rule is catalog `git.md`.

When a plan ships and gets archived, ask human for approval if you believe any of the plan acceptance criteria stay durable and should be promoted into this document.

When a new plan would change old behavior, **amend this file** (with permission)
before or with the plan.

## Required minimum

- On the portfolio page, rain keeps falling and the card reveals
  the roles, the email, and the saying. Settled text can be a link.
- A window click toggles pause. The page also pauses on its own
  after about 10 minutes, and it stops while the tab is hidden.
- `/matrix/kiosk/`, `?kiosk=1`, and `#kiosk` do not autopause, ignore
  that window click, and keep running when the tab is hidden. Links
  still navigate. When this app is the homepage, `/kiosk/` is the
  same mode.
- A click on the top-left character cell shows the debug overlay.
  A second click hides it and does not toggle pause.
- While a line is revealing, hover finishes that reveal. While it
  is hiding, hover does not finish the hide. It shows the text again.
- `npm test` says that no tests are defined and exits 0.
- `npm run dev -- --help` exits 0 and does not start a server.
- `npm run deploy plan` prints `rsync -avz --delete` of `dist/` to
  `luke@lukemay.com:/home/luke/www/matrix` and exits 0. It does not
  build and it does not rsync.
- Tests confirm these gestures; they are not a substitute for them.
- A regression is a test that fails without the fix and passes with it. Do not keep a second ledger of failure classes.

## Notes

Confirm the way [`testing.md`](./testing.md) (project or catalog) describes.
