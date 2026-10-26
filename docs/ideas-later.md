# Ideas backlog

The parking lot for morganvanv.com. Nothing here is a commitment. When something gets picked up, move it into a PR and delete it from here; when a decision gets made about it, add a line to `decisions.md`.

**Legend** — effort: `S` an evening · `M` a weekend · `L` several sessions. `backend` = needs a serverless function (the site itself stays static). `data` = needs a scheduled data-fetching GitHub Action (see "Patterns" at the bottom).

Last big refresh: 2026-10-25 (audit of the repo at `4890dba`; sections 1–2 executed in PR #74 the same day).

---

## 1. Tech debt & housekeeping

Most of the 2026-10-25 audit list shipped in PR #74 (fonts, icons/Material, view transitions, reduced motion, zoneless, signal inputs, derived navbar, scroll regions, `site.config.ts`, API cache, OsrsStats split, type clamp, h1s, webp, Dependabot groups, `npm run check`, Vitest + real tests, Lighthouse CI). What's left:

- **Stale remote branches.** `S` — ~30 branches are still on `origin` (the git proxy in Claude's sandbox can't delete branches). Keep `master` and `archived-old-website`. Run locally once #87 is merged; the first line deletes everything already merged into `master`, the second the face-lift branch (in case it was squash-merged) and two branches whose Dependabot PRs were closed:
  `git fetch --prune && git branch -r --merged origin/master | sed 's|^ *origin/||' | grep -v -e '^HEAD' -e '^master$' -e '^archived-old-website$' | xargs -n1 git push origin --delete`
  `for b in feature/face-lift dependabot/npm_and_yarn/angular/material-22.0.1 dependabot/npm_and_yarn/npm_and_yarn-b6205c8ac9; do git push origin --delete "$b"; done`
  Then turn on "Automatically delete head branches" in repo settings.
- **Lift the `vitest ~4.0` pin.** `S` — 4.1.x crashes npm 10 during install (`edgesOut` null in arborist). Re-tested 2026-10-26 with npm 10.9.9 (Node 22.23): still crashes. Re-test when Node 22's bundled npm updates, or switch CI/local to npm 11.
- **TypeScript 7.** `M` — Dependabot ignores TypeScript ≥ 6.1 because Angular 22's compiler only accepts 6.0. Lift the ignore in `.github/dependabot.yml` when a new Angular accepts 7 (the Angular blog mentions TSGo support in the application builder).
- **Dev-dependency audit.** `S` — GitHub's Dependabot alerts on `master` (10 at the last push: 1 critical, 1 high) are all dev tooling; `npm audit --omit=dev` is clean. As of 2026-10-26 on the face-lift branch, `npm audit` reports 5: `vitest`, `@vitest/mocker` and `@vitest/coverage-v8` (critical) are fixed only past the `vitest ~4.0` pin, so they clear with the item above; `vite` 8.3.0–8.3.2 inside `@angular/build` 22.2.4 (high; the dev server only) waits for an Angular patch release. Don't take `npm audit fix --force`: it "fixes" `@angular/build` by downgrading it.
- **Tests still thin in places.** `S` each — no coverage yet for `SeoTitleStrategy` edge cases (query strings), `ScrollHint`, `IconComponent`, or the OSRS parent component's data shaping.
- **Playwright smoke and layout checks in CI.** `M` — the headless-browser pass during the audit caught a real bug the unit tests couldn't (scroll-region ordering). A ~10-line Playwright script (deep link → arrow keys → Escape → dialog Escape) would make that permanent. The face-lift (#87) was verified with a throwaway Playwright layout checker worth committing alongside it: every route and Interests state at 320–2560 px wide (incl. 740×360), with real API responses replayed from a fixtures file, failing on horizontal overflow, touch targets under 44 px, ≠ 1 `<h1>`, console errors, and the ☾ overlapping the pager. It was never committed (~100 lines of Python plus a fixtures builder); Morgan has a copy from the #87 session.


## 2. SEO & discoverability

Shipped in PR #74: meta/OG/Twitter tags, prerendering of every route, `robots.txt` + `sitemap.xml` (test-enforced), JSON-LD `Person`, `og-image.jpg`, PNG icons + web manifest, title pattern, `rel="me"` + h-card, `humans.txt`. Left:

- **Per-page OG images.** `S` — one generic card today. The generator is a 30-line Pillow script (background crop + JetBrains Mono); a per-route variant with the page title is easy once there's a place to run it (a `scripts/` folder, or a GitHub Action).
- **SVG favicon.** `S` — the icon is pixel art, so the current `.ico` + PNGs are right; an SVG would only make sense with a vector mark. Skip unless one appears.
- **Submit the sitemap to Google Search Console / Bing Webmaster Tools.** `S` — manual, one-time, and it needs Morgan's accounts.
- **Verify `rel="me"` from the other side.** `S` — add the site URL to the GitHub, Mastodon (if any) and other profiles so the links are reciprocal; that's what makes IndieAuth and Mastodon verification work.
- **`humans.txt` copy is a draft.** `S` — written in Morgan's voice by Claude; edit freely.

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
*Now-playing, the `/now` page and Tonight's sky were promoted to `docs/roadmap.md` on 2026-10-25.*

- **History charts from scheduled snapshots.** `M`, `data` — A nightly GitHub Action appends WOM total XP / EHP and stats.fm top artist to a JSON file. After a month there's enough for sparklines: "XP over time", "music taste drift". Same Action pattern as Letterboxd.
- **Site changelog.** `S` — `/changelog` or a "What's new" box on Home, generated from `git log` at build or a hand-kept `CHANGELOG.md`. Makes "check back in sometime" concrete.
- **Colophon.** `S` — How the site is built, what powers each live panel, fonts, hosting. IndieWeb staple; also where the tech stack can live without being the headline.
- **Vinyl shelf.** `M` — Discogs has a public API for public collections. A shelf of cover art under Interests; hover/expand for pressing details. Discogs is already linked from the Music card.
- **Podcasts.** `S` — He mentions podcasts on Background. An OPML export → a simple list with artwork.
- **Tonight's sky, next.** `S` each — A lines on/off toggle in the sky menu; the Milky Way (d3-celestial ships `mw.json`); an "astrophotography tonight?" hint when the Moon is down in astronomical night (a bridge to My Photos); split the landscape into real layers (trees, mountains, house) for subtle parallax; more lived-in details in the spirit of the farmhouse light and campfire (pillar 7): a rare shooting star, chimney smoke on cold nights, snow in winter. Rotate the stars when switching to "show my sky" (it crossfades today).
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
- `M` — **Started as a stub (2026-10-25):** projects are data in `shared/constants/projects.const.ts`, rendered by `app-project-card` (screenshot, blurb, play/source links, live "updated N ago" from the GitHub API). `/now` shows them under "Building". The Projects page itself can list the same cards, then add non-code projects (the astro rig, the site itself with its changelog) and maybe a per-project changelog from the repo's commits.

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
