# Ideas backlog

The parking lot for morganvanv.com. Nothing here is a commitment. When something gets picked up, move it into a PR and delete it from here; when a decision gets made about it, add a line to `decisions.md`.

**Legend** — effort: `S` an evening · `M` a weekend · `L` several sessions. `backend` = needs a serverless function (the site itself stays static). `data` = needs a scheduled data-fetching GitHub Action (see "Patterns" at the bottom).

Last big refresh: 2026-10-25 (audit of the repo at `4890dba`).

---

## 1. Tech debt & housekeeping

Found during the 2026-10-25 audit. Roughly ordered by payoff-per-effort.

- **Self-host Caveat; drop the Google Fonts `<link>`.** `S` — `index.html` loads JetBrains Mono from Google Fonts *and* bundles it via `@fontsource`; Caveat only comes from Google. Worse, the production build does a network fetch to `fonts.googleapis.com` to inline that CSS, so the build fails anywhere Google Fonts is unreachable (confirmed in a sandbox: `Inlining of fonts failed … 403`). Add `@fontsource/caveat`, remove the `<link>` + preconnects. Build becomes offline-deterministic and visitors stop pinging Google.
- **Replace Material icons with inline SVG, then probably drop Angular Material.** `M` — The site uses exactly four glyphs (`keyboard_arrow_down/left/right`, `exit_to_app`) and one `mat-icon-button`. For that it ships ~2 MB of icon font files to `dist/media` (10 woff/woff2 variants; browsers actually download ~280 kB of the regular + outlined woff2). Inline SVG chevrons + a plain `<button>` would let `@angular/material` and `material-icons` go (keep `@angular/cdk` for `cdkTrapFocus`, or hand-roll the trap), shrinking the 268 kB vendor chunk.
- **Migrate off `@angular/animations`.** `M` — Deprecated since Angular 20.2. The documented replacement for route transitions is the View Transitions API via `withViewTransitions()` — the thing `decisions.md` says we avoid, but only because it conflicted with `@routeAnimations`; once the trigger is gone, the conflict is gone. Directional slides: in `onViewTransitionCreated`, compare from/to route indexes (reuse `getMainRouteAnimation`) and set `data-transition="left|right|vertical"` on `<html>`; animate `::view-transition-old/new(root)` in CSS. Also removes `provideAnimations()` and the animations chunk.
- **Honor `prefers-reduced-motion`.** `S` — Zero handling today. Full-viewport 120vh slides, infinite bouncing nav arrows, bouncing subtitle, auto-rotating 3D model. One global `@media (prefers-reduced-motion: reduce)` block that shortens/kills these. Do this with (or before) the animations migration.
- **Go zoneless.** `S`/`M` — Zoneless is the Angular 21 default; this repo still carries `zone.js` because it was upgraded in place (35 kB polyfill chunk). Components are mostly OnPush + signals already. Convert `AskMorganFormComponent`'s plain fields + `markForCheck()` to signals, add `provideZonelessChangeDetection()`, remove the polyfill entries and the dependency.
- **Signal inputs / host bindings everywhere.** `S` — 11 remaining `@Input` / `@HostListener` decorators (`BasePage`, `ScrollHint`, `VerticalNavItem`, `SocialPage`). `vertical-nav-container` already uses `host:` metadata; make the rest match. The Angular signal-input migration schematic does most of it.
- **Derive the navbar from `MAIN_ROUTES`.** `S` — `navLinks` is a hand-copied list, and three docs warn that it's easy to forget. Add optional `icon`/`ariaLabel` to `MAIN_ROUTES`, have the navbar map `[greeting, ...MAIN_ROUTES]`, delete the warning from the docs. Adding a page becomes two places instead of three.
- **Decouple `KeyboardNavService` from page internals.** `S` — It `querySelector`s `.right-scroll-container`, `.expanded .item-card`, `.page-content` by route name. Replace with a tiny `ScrollRegionService` pages register their active scroll element with (or a `[appScrollRegion]` directive). Then new pages with scroll areas Just Work with arrow keys.
- **Real tests.** `M` — 16 specs, 15 of them "should create". Worth actually testing: `KeyboardNavService` (route order, editable-target guard, Escape → greeting), `VerticalNavContainer` (arrow/enter/escape state machine), `AskMorganForm` (honeypot short-circuit, error state), `MAIN_ROUTES`/`lazyRouteComponents`/navbar consistency.
- **Karma → Vitest.** `M` — Vitest is Angular 21's default runner; Karma needs a Chrome binary (tests couldn't run in the audit sandbox for exactly that reason). Angular ships a migration schematic. Pairs well with the item above.
- **Split `OsrsStatsComponent`.** `M` — 540 lines, and its SCSS sits at 8,042 bytes against an 8 kB `anyComponentStyle` budget warning. Natural seams: character panel (model + badges), overview list, pets, activity lists, boss grid. While there: `bosses` is set via a `tap` side effect into a mutable field inside an OnPush component — make it a `computed`/`map` off `player$`. And filter the boss grid to `kills > 0` (every WOM boss currently renders, zeros included).
- **One `site.config.ts`.** `S` — `STATSFM_USERNAME` lives in a component, `WOM_USERNAME` in a const file, social handles in `SOCIAL_LINKS`, the DO function URL in the form. Pull every handle/URL into one config object. Also feeds JSON-LD `sameAs` (see SEO).
- **Cache API responses across navigations.** `S` — Interests is destroyed and recreated on every arrow-key visit, re-hitting stats.fm, WOM and RuneProfile (seven requests) each time. `sessionStorage` with a 10-minute TTL in each service, or move the observables into the `providedIn: 'root'` services with `shareReplay`.
- **`font-size: 2.5dvh` on `body`.** `S` — Type scales with viewport *height*, so a landscape phone gets tiny text and the user's browser text-size preference is partly overridden. Consider `clamp(1rem, 2.5dvh, 1.4rem)` or a rem base with page-level scaling where the full-bleed layouts need it.
- **Heading hierarchy.** `S` — The greeting title is a `<div>`; every other page starts at `<h2>` with no `<h1>`. Fix for screen readers and SEO in one go.
- **Convert the OSRS PNGs.** `S` — ~100 PNGs under `public/osrs/` (skills, bosses, icons) plus `osrs-character.png` while the repo rule says webp. Batch convert, or sprite-sheet the 24 skill icons.
- **Stale remote branches.** `S` — ~20 merged feature branches still on `origin`. Turn on "Automatically delete head branches" in repo settings and prune once.
- **README drift.** `S` — Its page table is missing `/social` and duplicates `site-state.md`. Trim it to setup + a pointer to `docs/`.
- **Dependabot grouping.** `S` — Add `groups:` (e.g. `angular`, `eslint`) to `dependabot.yml` so framework bumps arrive as one PR instead of five.
- **`npm run check`.** `S` — One script that runs lint + prod build + headless tests, since `CLAUDE.md` asks for all three before calling work done.
- **Drop `CommonModule` from `AskMorganForm`.** trivial — only `NgClass` is used; class bindings would remove the import entirely.
- **Lighthouse + axe in CI.** `M` — `treosh/lighthouse-ci-action` (or `lhci`) with budgets, and `pa11y-ci`/`axe-core` against the built `dist/` on PRs. Keeps "old web spirit, modern craft" honest.

## 2. SEO & discoverability

- **Meta tags.** `S` — `index.html` has a `<title>` and nothing else: no description, no Open Graph / Twitter card, no `theme-color`, no canonical. Add site-wide defaults in `index.html` and per-route overrides via `Meta`/`Title` from route `data` (extend `MAIN_ROUTES` with `description`).
- **Prerender every route.** `M` — `ng add @angular/ssr` with `prerender` only (no server). GitHub Pages then serves real HTML for `/interests` etc. instead of a 404-status `index.html` copy, link previews work, and crawlers see content. Gotchas: `KeyboardNavService` touches `window` in its constructor and `model-viewer` needs `isPlatformBrowser`/`afterNextRender` guards; external API calls stay client-side (fine).
- **`robots.txt` + `sitemap.xml`.** `S` — Generate the sitemap at build from `MAIN_ROUTES` (tiny Node script in the build step, or a static file until routes change).
- **JSON-LD `Person`.** `S` — On `/home`: name, `sameAs` = `SOCIAL_LINKS` hrefs, `jobTitle`, `alumniOf`. Pulls straight from the config object.
- **OG image.** `S` — One 1200×630 card in the site palette (name + a rotating subtitle frozen in time). Per-page variants later.
- **Favicon set.** `S` — Only `favicon.ico` today. Add an SVG favicon, `apple-touch-icon`, `site.webmanifest` with the teal/gold colors.
- **Title pattern.** `S` — `Interests · morganvanv.com` rather than just `Interests`.
- **IndieWeb identity.** `S` — `rel="me"` on the social links and an `h-card` microformat on `/home`. This is the IndieWeb's version of SEO: it enables IndieAuth, Mastodon profile verification, and webmentions later. Very on-brand.
- **`humans.txt`.** trivial — Old-web staple, and a place for a joke.

## 3. Features: Morgan's seeds, worked out

### Letterboxd diary → Favorite Media
`M`, `data`
- **Data path.** Letterboxd has a per-user RSS feed (`letterboxd.com/<user>/rss/`) with `letterboxd:filmTitle`, `filmYear`, `memberRating`, `watchedDate`, `rewatch`, and the poster + review text in `description`. It is CORS-blocked and only holds recent entries, so: a scheduled GitHub Action fetches it, parses to `public/data/letterboxd.json`, commits. No runtime backend. For history, import the one-time Letterboxd CSV export (`diary.csv`, `reviews.csv`) as the seed file.
- **UI.** A vertical diary: date rail on the left, poster (lazy, from Letterboxd's CDN), title/year, star rating rendered as gold stars, review text collapsed to two lines with "more". Rewatches get a tiny ↻ badge. Lives under Interests → Favorite Media, which is already stubbed.
- **Extras.** A "this year in film" strip at the top (count, average rating, most-watched decade). Filter by rating. Link each entry to the Letterboxd page.
- **Later.** The same JSON feeds the `/now` page and a greeting subtitle ("recently watched: X, gave it 2 stars").

### Bad UI showcase
`M`
- A page (or Projects section) titled something like **"Hall of Shame"**: hand-built, interactive recreations of UI crimes. Each is a self-contained component with a title card and one sentence of deadpan commentary. Ideas: a volume slider that's a slot machine; a date picker that's a rotary dial; a "Cancel / OK" dialog whose buttons swap on hover; a checkbox that runs from the cursor; a cookie banner that follows you; a CAPTCHA that asks you to select all squares containing Ada; a password field with increasingly unreasonable rules; a form where the submit button is a scrollbar; a dropdown of all 195 countries in random order; a progress bar that goes to 110%.
- **Keep it accessible:** every exhibit has a real, keyboard-reachable "fine, just do it" escape hatch, and the page itself is navigable normally. The joke is the UI, not the exclusion.
- **Participation hook:** "Submit a UI crime" via the Ask Morgan form. Later, a timed "complete this form" speedrun with a leaderboard (`backend`).

### Physics simulations
`L` (each sim is `S`)
- A `/lab` page (or Interests item) with canvas sims, each ~100–200 lines on top of a shared `SimulationCanvas` component: play/pause/reset, parameter sliders, `requestAnimationFrame` loop, DPR-aware canvas, pauses when off-screen.
- Candidates, roughly in order of visual payoff: double pendulum (chaos, trails); n-body / orbital mechanics (ties to astrophotography; let visitors fling planets); projectile with drag; wave interference / double slit; spring-mass resonance with a driving-frequency slider; ideal gas / Brownian motion with a temperature knob; Lissajous figures; charged particle in E and B fields; Snell's law ray tracer; Brachistochrone race; Galton board; Rutherford scattering. A Møller-scattering nod would be the deep cut for anyone who reads the Background page.
- Each sim: a one-paragraph "what you're looking at" in Morgan's voice, with the equation rendered plainly (no MathJax dependency unless it earns it).
- Share state in the URL (`?g=9.8&drag=0.1`) so a specific configuration can be linked.

### Simple games
`M`
- **Spirograph** first: hypotrochoid with sliders for the two radii, pen offset, and color; "download PNG"; parameters in the URL so visitors can share a design. Natural tie-in: a "spirograph wall" next to the photo wall where visitors' shared URLs become thumbnails (hand-curated, same model as the photo wall).
- Then, in rough order of fit: Conway's Life; "click on virtual trees and rocks" — a literal tiny woodcutting idle game (the greeting subtitle made the promise); an OSRS item quiz (guess the item from its RuneLite icon, using data the site already fetches); Minesweeper; Snake (coordinate with `KeyboardNavService`: games should claim the arrow keys while focused); 2048; Pong vs Ada; Asteroids.
- A shared "game frame" component: title, controls legend, focus management that suspends page-level arrow-key nav while a game has focus.

### Easter eggs
`S` each
- Konami code → pick one: CRT scanlines + curvature mode; "Ada mode" (every image becomes Ada); page elements fall with gravity; an OSRS level-up fireworks + jingle (audio only on explicit interaction).
- Typing `ada` anywhere (outside inputs) triggers a cat.
- Clicking the profile picture N times cycles through old profile pictures / Ada.
- `console.log` ASCII art + a note for people who open devtools, with a link to the repo.
- A hidden `/secret` route that's not in the nav and not in the sitemap.
- Time-aware greeting subtitles: "it's 3am, why are you here", "happy friday", holiday variants.
- A 404 that's a tiny game instead of a redirect to the greeting (needs prerender or a real `404.html`).
- An 88×31 button for the site, plus a row of other people's buttons (classic).
- "Best viewed in…" badge that's actually accurate (whatever browser the visitor is using).
- A "darker mode" toggle that makes the site 2% darker and nothing else.
- View-source comment art in `index.html`.
- Long-press / hold on the title for a progress ring that reveals something.
- The 100th subtitle cycle in one session gets a special subtitle.

## 4. Features: pitches from the audit

Grouped by the design pillars.

### Alive (changes on its own)
- **Now-playing / last-played.** `S` — `StatsFmService.getRecentStreams()` already exists and is unused. A one-line "last listened: *track* · *N* min ago" on the greeting or in the Music card. Cheapest "alive" win in the repo.
- **`/now` page.** `S`/`M` — The IndieWeb "now page" convention, but mostly auto-generated: last played, last watched (Letterboxd JSON), last OSRS achievement (RuneProfile), newest community photo, last commit to the site. One hand-written paragraph at the top that Morgan updates when he feels like it.
- **History charts from scheduled snapshots.** `M`, `data` — A nightly GitHub Action appends WOM total XP / EHP and stats.fm top artist to a JSON file. After a month there's enough for sparklines: "XP over time", "music taste drift". Same Action pattern as Letterboxd.
- **Tonight's sky.** `M` — Replace the static `background.webp` with a lightweight canvas starfield showing the real sky over Cincinnati right now (the `astronomy-engine` package is small; constellation lines optional). Ties the astrophotography interest into the one thing every visitor sees. Respect reduced-motion; fall back to the static image.
- **Site changelog.** `S` — `/changelog` or a "What's new" box on Home, generated from `git log` at build or a hand-kept `CHANGELOG.md`. Makes "check back in sometime" concrete.
- **Colophon.** `S` — How the site is built, what powers each live panel, fonts, hosting. IndieWeb staple; also where the tech stack can live without being the headline.
- **Vinyl shelf.** `M` — Discogs has a public API for public collections. A shelf of cover art under Interests; hover/expand for pressing details. Discogs is already linked from the Music card.
- **Podcasts.** `S` — He mentions podcasts on Background. An OPML export → a simple list with artwork.
- **Astrophotography gallery (My Photos).** `M` — Drop a photo into `public/photos/`, a build script generates thumbnails + a JSON manifest from EXIF (camera, exposure, ISO, stacked frames, location). Lightbox reuses the photo-wall overlay. The stub already exists.

### Visitors take part
- **IRC Shoutbox, three ways.** `M`–`L`, `backend`
  1. *Guestbook-as-PR* — the form posts to a DO function that opens a GitHub PR appending to `public/data/guestbook.json`. Morgan merging the PR is moderation; the site stays static; entries deploy like everything else. Very IndieWeb.
  2. *KV-backed* — DO function + a small free store (Upstash Redis / DO Spaces JSON), honeypot + rate limit, hard cap on length, a moderation list. Real-time-ish.
  3. *giscus* — zero backend, GitHub Discussions-backed, but requires GitHub login, which fights the anonymous-visitor vibe.
  Option 1 reuses the entire existing workflow and is the most "on brand".
- **Webmentions.** `S` — `webmention.io` + Bridgy to receive replies/likes from the fediverse on blog posts. Pairs with `rel="me"`.
- **Spirograph wall.** see Games.
- **Photo wall self-serve.** `M`, `backend` — Upload via a DO function to Spaces with a pending queue Morgan approves. Until then, a "Submit a photo" pill that opens a prefilled `mailto:` (subject + caption prompt) is an `S` improvement.
- **Webring / 88×31 buttons.** `S` — Join an IndieWeb/Yesterweb ring; show the buttons.
- **Visitor pixel canvas** (r/place in miniature). `L`, `backend` — Fun, needs real-time state. Park until a backend pattern exists.
- **Polls** ("which subtitle is best?"). `M`, `backend` — Same dependency.

### Playful to navigate
- **Command palette (Cmd+K / `/`).** `M` — Fuzzy jump to pages and Interests items, plus joke commands (`:q`, `sudo`, `ada`). Fits "now navigable via keyboard".
- **First-visit boot sequence.** `S` — A BIOS-style text crawl that types out for ~2 s, skippable with any key, once per session. The old web without the pain.
- **Favicon reflects state.** `S` — Swap the favicon to a ♪ while "now playing" is recent.
- **Custom cursor toggle.** `S` — The OSRS gold pointer, opt-in.
- **Scroll-hint everywhere there's hidden content.** `S` — Already a component; audit which panels lack it on mobile.
- **Mobile keyboard parity.** `S` — Swipe left/right between pages on touch devices (the slide transitions already imply it).

### Look
- **Handwritten annotations.** `S` — Caveat is only used on polaroid captions. Small margin notes ("← this is Ada", "yes this is live") across pages would spread the handwritten accent and the voice.
- **Unify under-construction.** `S` — Pages use the gif; Interests items use a text banner. Make `UnderConstructionComponent` take a `variant` and use it everywhere.
- **Loading states.** `S` — The live panels show "Loading…" text; skeleton rows in the site's dark/translucent style would feel less static.
- **OSRS item icons from RuneLite's CDN.** note — Works, but it's a third-party hotlink; if it ever breaks, the Action pattern can cache them.
- **Subtitle list as data.** `S` — Move `SUBTITLES` out of the component into a data file so adding one doesn't touch TS (and time-aware ones have somewhere to live).

### Projects page (currently 🚧)
- `M` — A curated allowlist of repos with blurbs in a constant, enriched live from the public GitHub REST API (`/users/morgan-vanv/repos`: language, stars, last push). Plus non-code projects (the astro rig, the site itself with its changelog). Each project is a card; no logo grids.

### Blog (currently 🚧)
- `M`/`L` — Markdown posts in `src/content/`, converted at build time (`marked` in a Node script, not at runtime) to JSON + prerendered routes. **RSS/Atom feed is non-negotiable** for the IndieWeb crowd. Reading time, tags, a `/blog/feed.xml`. Consider a "notes" microblog format (short, frequent) alongside or instead of long posts — it fits the voice better.

## 5. Patterns worth establishing

- **GitHub Action as the cron backend.** A scheduled workflow fetches an external source (Letterboxd RSS, WOM snapshot, Discogs), writes JSON into `public/data/`, and commits if changed. Deploy happens automatically. No runtime backend, no CORS, no API keys in the browser, and the site stays "alive" on a schedule. First use: Letterboxd. Candidates after: XP history, music history, cached RuneLite icons.
- **Guestbook-as-PR.** For anything visitors write that Morgan should moderate: function → PR → merge = publish.
- **DO function.** For anything that needs a secret or must not be in the browser (already used by Ask Morgan).

## 6. Parked / probably not

- Strava/cycling stats — OAuth-only API; not worth the dance for "cycling on occasion".
- Light theme — explicitly against the vibe doc. (A "darker mode" joke toggle is fine.)
- Full CMS / Analog / Astro rewrite — the Angular setup is working; the blog can be a build script.
- Analytics — if ever, something cookieless and self-respecting (Plausible, GoatCounter), and a `/colophon` note about it.
