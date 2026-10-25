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
