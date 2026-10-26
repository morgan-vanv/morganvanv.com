# Decisions

One line per decision: what was decided and why. Newest at the bottom.

- **2025-07-27** Migrated the site to the Angular CLI project structure.
- **2026-05-25** Pivoted from a classic portfolio to a personal site inspired by the IndieWeb, Web Revival, and neocities. Professional info stays, but isn't the focus.
- **2026-05-25** Added arrow-key navigation between pages with directional slide transitions. Route order is the navigation order.
- **2026-05-25** Interests pull live data (stats.fm, Wise Old Man, later RuneProfile) instead of hand-maintained lists, so the site stays current on its own.
- **2026-05-26** Replaced the WOM achievements feed with RuneProfile's activities endpoint.
- **2026-05-28** All main routes are lazy-loaded with OnPush change detection; shared constants extracted (e.g. `SOCIAL_LINKS`).
- **2026-06-05** Anonymous "Ask Morgan" form posts to a DigitalOcean serverless function with a honeypot field — the site itself stays static.
- **2026-06-07** Community Photo Wall: visitors email photos, Morgan adds them as compressed webp. 12 fixed polaroid slots, empty ones invite submissions.
- **2026-06-07** Interests page uses a shared keyboard-navigable vertical nav component.
- *(undated)* `withViewTransitions()` is intentionally not used; it conflicts with `@routeAnimations`.
- **2026-10-24** Set up the Claude project workflow: briefing docs in the Claude project, `CLAUDE.md` imports `.github/copilot-instructions.md` so conventions live in one file.
- **2026-10-25** Restructured `docs/ideas-later.md` into a categorized backlog (tech debt, SEO, features, patterns) with effort tags, seeded from a full repo audit.
- **2026-10-25** Fonts are bundled from `@fontsource` (latin subsets); no Google Fonts. The production build must never need the network.
- **2026-10-25** Dropped Angular Material and icon fonts for an inline-SVG `app-icon` component; kept `@angular/cdk` for the focus trap.
- **2026-10-25** Route transitions moved to the View Transitions API (`withViewTransitions`), replacing the deprecated `@angular/animations`; this supersedes the earlier note about avoiding `withViewTransitions()`. Only `<main>` slides; the background stays.
- **2026-10-25** Zoneless change detection, signal inputs and `host` metadata everywhere.
- **2026-10-25** Navbar links derive from `MAIN_ROUTES`; arrow-key scrolling targets are registered with `[appScrollRegion]` instead of hardcoded selectors.
- **2026-10-25** All handles/URLs live in `SITE_CONFIG`; API reads go through `ApiCacheService` (sessionStorage, 10 min).
- **2026-10-25** Tests run on Vitest (happy-dom), not Karma. `vitest` pinned to `~4.0` until npm 10's optional-peer crash is fixed.
- **2026-10-25** Every route is prerendered (`@angular/ssr`, `outputMode: static`) and hydrated; no runtime server. Prerendered pages never embed live API data.
- **2026-10-25** SEO lives in `SeoTitleStrategy` + `index.html`; canonical URLs and the sitemap use trailing slashes to match GitHub Pages' directory redirects.
- **2026-10-25** Lighthouse CI runs on PRs; accessibility (axe-core) and SEO scores below 0.95 fail the check, performance/best-practices only warn.
- **2026-10-25** Promoted three "alive" features (last listened, `/now`, Tonight's sky) to `docs/roadmap.md` with decisions: `/now` is a main route after Home; the sky is stars + Moon + planets via lazy-loaded `astronomy-engine`, Cincinnati by default with an opt-in "my sky" toggle; last-listened appears on the greeting and the Music card.
- **2026-10-25** "Last listened" is a root `RecentStreamService` that polls stats.fm every 90 s while the tab is visible (and on becoming visible), tries `streams/current` first so "right now" is true, then falls back to `streams/recent`. Shown as a rotating greeting subtitle and a card atop Music. `ApiCacheService.get(url, 0)` bypasses the cache.
- **2026-10-25** Music tab layout: now-playing is a full-width centred band; top lists are framed panels with rank numbers (top three in gold), "plays" and whole-unit playtime. Expanded Interests cards (shared) put Esc in the title row and use a smaller title; projected description content is styled via the item's `is-expanded` host class. No playback progress bar: the site shows only what stats.fm reports at fetch time.
- **2026-10-25** `/now` is a main route after Home. Its "Site" row comes from `scripts/write-build-info.mjs` (the `prebuild` hook), which writes a gitignored `src/build-info.prod.ts` swapped in by `fileReplacements`; the committed `src/build-info.ts` holds dev placeholders and the type lives in `build-info.model.ts` (a replaced file can't import from itself). The generated file has no imports, so a stale copy left by a branch switch still compiles anywhere. Dates show the commit's own calendar day. GitHub merge commits are shown by PR title.
- **2026-10-25** OSRS section refresh (PR #81): character band, framed Skills / Progress / Pets panels, Achievements · Drops row, full-width named Boss Kills grid sorted by kills. Panel styling lives in shared mixins (`panel`, `panel-heading`, `progress-bar`) used by Music too.
- **2026-10-25** Bands and notes use the same neutral surface as panels (`surface` mixin: dark fill, faint border); the gold gradient was dropped as clashing. Gold stays for labels, ranks and the "playing now" border.
- **2026-10-25** Projects start as data (`shared/constants/projects.const.ts`) rendered by a reusable `app-project-card`, shown under "Building" on /now. "Updated N ago" comes live from the public GitHub API (cached 30 min). The future Projects page lists the same entries.
- **2026-10-26** Tonight's sky: the real sky (stars ≤ mag 4.5, 30 constellation figures, Moon with phase, naked-eye planets, Sun) drawn as 3×-upscaled pixel art on a canvas between `background.webp` and a cut-out `foreground.webp`. Stars and the Sun use our own tested math; the Moon and planets come from `astronomy-engine`, lazy-loaded. Cincinnati unless the visitor clicks "show my sky" in the sky menu; their location is rounded to 0.1° and kept in `localStorage`, so it's only ever requested on that click. Redrawn once a minute while visible, never on a timer under reduced motion. The painted sky is the first paint and the fallback. Page cards darken by `--daylight` so text stays readable under a noon sky.
- **2026-10-26** The sky defaults to **darkness** (real star positions, Sun ignored). A top-right ☾ menu offers real time, sunrise, sunset and day, remembered per visitor. Sunrise and sunset are staged: the Sun sits in the valley between the painted mountains, not where it really is.
- **2026-10-26** Design pillar: **night is home.** Dark is the default and the design target; brighter looks are opt-in settings, never the landing state.
