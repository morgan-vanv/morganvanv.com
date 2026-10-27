# morganvanv.com

My personal website — live at [morganvanv.com](https://morganvanv.com). Angular, TypeScript and SCSS, prerendered to static HTML and hosted on GitHub Pages.

## Development

```bash
nvm use            # Node 24 (.nvmrc); npm 10 on Node 22 can't install the test runner
npm install
npm start          # dev server at http://localhost:4200
npm run check      # lint + production build + tests
npm run layout     # after a build: every page at every size in Chrome (CI also runs Lighthouse and this)
```

Pushing to `master` deploys. Work on a branch and open a PR.

## Docs

- `.github/copilot-instructions.md` — conventions and architecture (also imported by `CLAUDE.md`)
- `docs/decisions.md` — dated one-line decisions
- `docs/roadmap.md` — what's being built next, with the decisions already made
- `docs/ideas-later.md` — the ideas backlog

## Art

The lossless original of the background painting is `art/painting.png` (not served). `scripts/build-landscape.py` turns it into the relit landscape looks in `public/landscape/`; edit the script and rerun it rather than editing the images.
