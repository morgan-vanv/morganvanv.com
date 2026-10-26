# CLAUDE.md

Coding conventions for this repo live in one place, shared with Copilot:

@.github/copilot-instructions.md

Update conventions there, not here. This file only holds Claude-specific rules.

## Hard rules

- **Never delete `archived-old-website`.** It's the original 2019 site and its history (head `3df4744`). Exclude it from every branch cleanup, and never force-push, rebase or merge into it. A copy also lives in Morgan's Google Drive ("morganvanv.com — archived-old-website backup").
- **`master` deploys.** Every push to `master` ships to morganvanv.com. Work on a branch and open a PR; never push to `master` directly.
- **Before calling work done**, all three CI checks must pass locally (`npm run check` runs them in order):
  ```bash
  npm run lint
  npm run build -- --configuration=production
  npm run test:ci
  ```
- **Copy is Morgan's voice.** Draft visible text in a casual, dry, first-person tone, keep it short, and flag it as a draft. Never invent facts about Morgan's life, opinions, or projects; use `[TODO: Morgan]` instead.
- **Static site only.** No server code in this app. Anything needing a backend is a serverless function called over HTTP (see `ask-morgan-form`).
- **Images** go in `public/` as compressed `.webp`, with real `alt` text.

## Project docs

- `docs/decisions.md` — append a dated one-liner when a design or architecture decision is made.
- `docs/ideas-later.md` — park future ideas here instead of building them unasked.
