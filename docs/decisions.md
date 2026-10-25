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
