# Ideas backlog

The parking lot for morganvanv.com. Nothing here is a commitment. When something gets picked up, move it into a PR and delete it from here; when a decision gets made about it, add a line to `decisions.md`.

**Legend** — effort: `S` an evening · `M` a weekend · `L` several sessions. `backend` = needs a Cloudflare Worker in morganvanv.com-backend (the site itself stays static). `data` = needs data fetched at deploy, or committed history (see "Patterns" at the bottom).

Last big refresh: 2026-10-25 (audit of the repo at `4890dba`; sections 1–2 executed in PR #74 the same day). Wind-down after "Visitors take part": 2026-10-27.

---

## 1. Tech debt & housekeeping

Most of the 2026-10-25 audit list shipped in PR #74 (fonts, icons/Material, view transitions, reduced motion, zoneless, signal inputs, derived navbar, scroll regions, `site.config.ts`, API cache, OsrsStats split, type clamp, h1s, webp, Dependabot groups, `npm run check`, Vitest + real tests, Lighthouse CI). What's left:

- **Stale remote branches.** `S` — ~30 branches are still on `origin` (the git proxy in Claude's sandbox can't delete branches). Keep `master` and **never delete `archived-old-website`** (the original 2019 site; see `CLAUDE.md`). Run locally once #87 is merged; the first line deletes everything already merged into `master`, the second the face-lift branch (in case it was squash-merged) and two branches whose Dependabot PRs were closed:
  `git fetch --prune && git branch -r --merged origin/master | sed 's|^ *origin/||' | grep -v -e '^HEAD' -e '^master$' -e '^archived-old-website$' | xargs -n1 git push origin --delete`
  `for b in feature/face-lift dependabot/npm_and_yarn/angular/material-22.0.1 dependabot/npm_and_yarn/npm_and_yarn-b6205c8ac9; do git push origin --delete "$b"; done`
  ("Automatically delete head branches" is on. The `archived-old-website` ruleset is in the 2026-10-27 security report's settings list.)
- **Leftovers from the "Visitors take part" sessions (2026-10-27).** `S` each —
  - Stale branches to delete on GitHub: site `feat/name-a-star`, `test/referrer-policy`, `visitor/question/2026-10-27-how-did-you-make-your-website-so-good-41afb6c1` (its PR, #111, was closed); backend `feat/submission-kinds`, `fix/ask-hardening`. The backend repo doesn't auto-delete merged branches yet; turn that on.
  - Closed (rejected) visitor PRs leave their `visitor/*` branch behind. A tiny workflow on `pull_request: closed` that deletes `visitor/*` heads would keep the repo tidy (needs `contents: write`).
  - Morgan's CI/CD pass: backend ruleset required checks (`Campfire tests`, `Ask tests`), backend CodeQL default setup, backend auto-delete head branches, and a look at whether the site's required checks and auto-merge are where he wants them.
  - Backend Dependabot #7 bumps the campfire's dev tools to TypeScript 7 + a new Vitest (green). The campfire isn't Angular, so TS 7 is fine there; merging redeploys the Worker.
  - The mailbag panel stretches to the shoutbox's height on wide screens, so with one letter there's empty space under it. It fills as letters arrive; revisit if it still looks bare at three or four.
- **TypeScript 7.** `M` — Dependabot ignores TypeScript ≥ 6.1 because Angular 22's compiler only accepts 6.0. Lift the ignore in `.github/dependabot.yml` when a new Angular accepts 7 (the Angular blog mentions TSGo support in the application builder).
- **Dev-dependency audit.** `S` — `npm audit` is clean (prod and dev) since 2026-10-27. The six Dependabot alerts were all `vite` 8.3.0, which `@angular/build` 22.2.x pins exactly (dev server only, incl. launch-editor); `package.json` `overrides` lifts it to 8.3.5. **Drop the override** once an `@angular/build` release depends on vite ≥ 8.3.3 (`npm view @angular/build dependencies.vite`), then `npm install` and check `npm ls vite`. Don't take `npm audit fix --force`: it "fixes" `@angular/build` by downgrading it.
- **Content-Security-Policy.** `M` — none yet (GitHub Pages can't send headers, so it'd be a `<meta http-equiv>`). Angular's `security.autoCsp` refuses to run with prerendering, and the prerendered pages carry inline scripts (event dispatch, the stylesheet `media` swap, a per-page `__jsaction_bootstrap`) whose hashes change with templates, so it needs a small post-build script that hashes each page's inline scripts and writes the meta after `<meta charset>`, run inside `npm run build` so Layout exercises it. A policy drafted and tested 2026-10-27 (all 8 pages + the 3D model, no violations): `default-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'` + hashes (model-viewer needs wasm), `style-src 'self' 'unsafe-inline'` (Angular's style blocks and `[style.--brand-color]`), `img-src 'self' data: blob: https:` (narrow once stats.fm's image CDN is known), `connect-src` = the API hosts in `site.config.ts` + the campfire, `worker-src 'self' blob:`, `object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'`. A meta CSP can't do `frame-ancestors`, so the site stays frameable; only a header from a proxy in front of Pages could change that. Worth it most once the campfire stores a host key in localStorage.
- **Ask Morgan rate limit.** `M` — the function has no throttle, so a script can flood Morgan's Discord. Options: Cloudflare Turnstile verified in the function, or move the endpoint into the campfire Worker (which already rate-limits) and keep the webhook as a Worker secret.
- **Lighthouse, shelved for now (2026-10-26).** Kept out to stay nimble; pick up only if a need shows up. *User flows:* measure the interactions (← → slides, ☾ menu, Interests tiles, Music toggles) for INP/CLS with Lighthouse's timespan mode; best done alongside the Playwright checker below. *Live-site run:* a warn-only run against morganvanv.com after deploy, to see GitHub Pages' real headers and caching. *Version:* `@lhci/cli` 0.15.1 (June 2025) bundles Lighthouse 12.6; Lighthouse 13 renamed many performance audits to "insights", so check audit IDs if assertions ever name specific audits. Also note: axe can't read the canvas, so the accessibility score doesn't prove text over a bright sky is readable; that belongs in the layout checker with `?sky-light=day`.
- **Tests still thin in places.** `S` each — no coverage yet for `SeoTitleStrategy` edge cases (query strings), `ScrollHint`, `IconComponent`, or the OSRS parent component's data shaping.
- **More browser checks, on top of the layout check.** `S`–`M` — `scripts/check-layout.mjs` runs in CI since #95 (every sitemap page × six sizes: sideways scroll, one h1, 44px targets, ☾ vs pager), with third-party APIs blocked. Morgan's #87 checker went further, worth folding in when a bug calls for it: real API responses replayed from a fixtures file (long titles, full panels), every Interests state, console errors, and readability with `?sky-light=day`. A short keyboard smoke test (deep link → ← → → Escape → dialog Escape) would pin the scroll-region bug the audit once caught.


## 2. SEO & discoverability

Shipped in PR #74: meta/OG/Twitter tags, prerendering of every route, `robots.txt` + `sitemap.xml` (test-enforced), JSON-LD `Person`, `og-image.jpg`, PNG icons + web manifest, title pattern, `rel="me"` + h-card, `humans.txt`. Left:

- **Per-page OG images.** `S` — one generic card today. The generator is a 30-line Pillow script (background crop + JetBrains Mono); a per-route variant with the page title is easy once there's a place to run it (a `scripts/` folder, or a GitHub Action).
- **SVG favicon.** `S` — the icon is pixel art, so the current `.ico` + PNGs are right; an SVG would only make sense with a vector mark. Skip unless one appears.
- **Submit the sitemap to Google Search Console / Bing Webmaster Tools.** `S` — manual, one-time, and it needs Morgan's accounts.
- **Verify `rel="me"` from the other side.** `S` — add the site URL to the GitHub, Mastodon (if any) and other profiles so the links are reciprocal; that's what makes IndieAuth and Mastodon verification work.
- **`humans.txt` copy is a draft.** `S` — written in Morgan's voice by Claude; edit freely.

## 3. Features: Morgan's seeds, worked out

### Copy pass (waiting on Morgan's words)
`S` — One sitting to put every drafted line into Morgan's voice. Everything below was written by Claude and marked as a draft; edit in place, no logic changes needed (specs pin a few strings, so update those alongside):
- ~~**Sky** and **Badges**~~: approved by Morgan 2026-10-28 (the ☾ menu, show my sky, back to the page, the compass, the naming panel, Up tonight's notes, the weather verdicts, plus the new sky hint and greeting line).
- ~~**Home**, **Social**, **Interests**, **Projects** and the colophon~~: approved by Morgan 2026-10-28 (four edits taken). Nothing drafted by Claude is left unreviewed.
- Morgan's own: Favorite Media's two missing books and any blurbs (`favorite-media.const.ts`), and the `/now` note (`now.content.ts`).

### Letterboxd, what's left
The data path shipped (2026-10-27: deploy-time `letterboxd.json`, daily deploy, Watched on `/now`), and the diary sits under Favorite Media as its own feed. Not done, on purpose:
- **Posters.** `S` — the feed's `tmdb:movieId` makes them a TMDB lookup at deploy (free for non-commercial use with attribution, but it needs a TMDB API key as a repo secret and a credit line on the site). Not Letterboxd's own CDN: its terms rule out in-line linking.
- **History and stats.** `M` — "this year in film" (count, average rating, decades) needs more than the feed's 50 entries: seed from the account export (`diary.csv`) and merge each deploy's feed into it. Merging into the live copy alone would lose the history on one bad deploy, so the history would have to be committed.
- **A greeting subtitle** ("recently watched: X, gave it 2 stars") from the same JSON. `S`

### Favorite Media, polish later
Live since #104, covers in #105 (2026-10-27). Morgan parked these for a later pass; none block anything:
- **Two more books.** `S` — the Books shelf shows two outlined slots. Add the picks to `FAVORITE_MEDIA` (title, author) and their covers with `scripts/build-media-covers.py`.
- **A sharper *East of Eden*.** `S` — the current cover came from a 292px image, slightly soft on high-DPI screens. Drop in a bigger one and rerun the script.
- **Blurbs and links.** `S` — each pick can take a short `blurb` (Morgan's words only) and an `href` (its Letterboxd, Goodreads or similar page); both render already.
- **Confirm the Letterboxd feed from GitHub.** `S` — run the deploy once from "Run workflow" and check the "Read the Letterboxd diary" step read entries; if GitHub's runners are blocked, the diary stays hidden and needs another route.

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

- **History charts from scheduled snapshots.** `M`, `data` — A nightly GitHub Action appends WOM total XP / EHP and stats.fm top artist to a JSON file. After a month there's enough for sparklines: "XP over time", "music taste drift". Needs committed history; see Patterns.
- **Site changelog.** `S` — `/changelog` or a "What's new" box on Home, generated from `git log` at build or a hand-kept `CHANGELOG.md`. Makes "check back in sometime" concrete.
- **Colophon, next.** *(shipped 2026-10-28 at `/colophon`, off the navbar, linked from the site's poster on Projects.)* `S` — a "what's new" line from the site's own commits; a note about analytics or visitor countries if either is ever added (none today, and the page says so).
- **Vinyl shelf.** `M` — Discogs has a public API for public collections. A shelf of cover art under Interests; hover/expand for pressing details. Discogs is already linked from the Music card.
- **Podcasts.** `S` — He mentions podcasts on Background. An OPML export → a simple list with artwork.
- **Tonight's sky, next.** `S` each — A lines on/off toggle in the sky menu; the Milky Way (d3-celestial ships `mw.json`); an "astrophotography tonight?" hint when the Moon is down in astronomical night (a bridge to My Photos); split the landscape into real layers (trees, mountains, house) for subtle parallax; more lived-in details in the spirit of the farmhouse light and campfire (pillar 7): chimney smoke on cold nights, snow in winter. The shooting star shipped (2026-10-28: on arrival, and rarely after); **parked by Morgan for a later session: a meteor-shower mode** on peak nights (`SHOWERS` in `sky-tonight.ts` already knows them), more streaks for an hour or so, still quiet. Rotate the stars when switching to "show my sky" (it crossfades today). Name a star, next (2026-10-27): approving is now one click (Discord → "Publish as PR" → merge; `content/stars/`). Also a "visitor stars" highlight and a permalink that opens look-up on a visitor's star. Free look, next (2026-10-28): the shelved turntable (Vision A: turn only, Mercator cylinder, no tilt) lives on branch `feat/sky-turntable` at `29bd52f` (PR #125, closed unmerged), should the camera ever feel like too much; turn the gradient and the horizon glow with the view (they stay put today, so a sunset glow stays in the valley facing north); fade the painting out once the camera is well up, instead of (or as well as) sliding it; a mouse wheel or pinch to tilt; the normal view's softer, wider stereographic look inside the camera (WebGL, a few-line fragment shader over the same five faces).
- **Astrophotography gallery (My Photos).** `M` — Drop a photo into `public/photos/`, a build script generates thumbnails + a JSON manifest from EXIF (camera, exposure, ISO, stacked frames, location). Lightbox reuses the photo-wall overlay. The stub already exists.

### Visitors take part
*From the 2026-10-26 interactivity brainstorm, Morgan picked guest subtitles, Hotline Webring, real IRC, Name a star, the shoutbox and the odometer. All six shipped 2026-10-27 (see `roadmap.md` §5), plus the mailbag, free look, one-click publishing and the avatar that speaks. Everything below is what's left.*

**The campfire, next (options offered 2026-10-27, not picked):**
- **Mute.** `S` — A host-only "mute" beside × that stops that visitor's hashed IP posting for a week (kept in the Durable Object, not in memory). Morgan picked Discord pings and the close switch instead; add if deleting isn't enough.
- **Hold for approval.** `M` — Shouts wait until Morgan OKs them. Safest, but it stops being a live chat; not picked.
- **Live instead of polling.** `M` — The campfire's WebSocket side (hibernatable Durable Object sockets) would make the log live and is what shared shooting stars and fireflies-as-visitors below need.
- **A permalink per mailbag letter, and an RSS feed of answers.** `S`

**Shelved by Morgan as follow-ups (2026-10-27):**
- ~~**Ask Morgan: the mailbag.**~~ Built 2026-10-27.
- **Friends' buttons.** `S` — Friends' 88×31s as a link exchange: a "friends" row in the Buttons panel on `/now` (the webring moved to the line under every page), or the logbook below; copied with permission rather than hotlinked so they don't rot `[TODO: Morgan: whose]`.

**Not picked yet (2026-10-26 brainstorm):**
- **The logbook (guestbook).** `M`, `backend` — Sign the logbook by the farmhouse door: name, a line, optional website and their own 88×31 (so it doubles as the friends'-buttons wall). The "Publish as PR" pipe that now carries subtitles, star names and the mailbag (`content/`) could carry it too: one file per entry in a `content/logbook/` folder; merging is moderation; the site stays static.
- **Draw a constellation.** `L`, `backend` — Connect stars into your own figure and name it; approved ones join a "community constellations" toggle in the ☾ menu. Name a star's bigger sibling.
- **Fireflies are visitors.** `M`, `backend` — Each firefly over the field is someone on the site right now (campfire presence). Variant: the farmhouse window lights only when someone else is here.
- **Shared shooting stars.** `M`, `backend` — "Make a wish" sends a shooting star across the sky for everyone on the site at that moment. Wishes are never shown, so nothing to moderate. Needs the campfire's WebSocket side.
- **Lanterns until dawn.** `M`, `backend` — Light a lantern in the field with a few words; it burns until local sunrise.
- **Message in a bottle.** `M`, `backend` — Leave a note for a stranger, get one from a previous visitor.
- **Polls, with Ada as host.** `M`, `backend` — "Ada asks: is the campfire too bright?" Campfire counters.
- **Listening along.** `S`, `backend` — "2 others listening along" while stats.fm shows something playing.
- **Visitor pixel canvas** (r/place in miniature). `L`, `backend` — The campfire is the backend pattern this was waiting for; one pixel per visitor per hour, maybe an 88×31 the community paints.
- **Where the light came from.** `S`, `backend` — Tonight's visitors by country only (Cloudflare's coarse header, nothing stored). Privacy-adjacent: needs a colophon note.
- **Secret hunt.** `S` — Seven hidden easter eggs, progress kept only in the visitor's browser; finishers get a mark in the logbook.
- **Bluesky replies as comments.** `S` — For blog posts: replies to a linked Bluesky post, read from Bluesky's public API, no backend.
- **Webmentions.** `S` — `webmention.io` + Bridgy to receive replies/likes from the fediverse on blog posts. Pairs with `rel="me"`.
- **Spirograph wall.** see Games.
- **Photo wall self-serve.** `M`, `backend` — Upload into a pending queue Morgan approves (the logbook pipe could carry it). Until then, the wall's "your photo here" slot opens a prefilled `mailto:` (subject + caption prompt; built 2026-10-27).

### Playful to navigate
- **Command palette (Cmd+K / `/`).** `M` — Fuzzy jump to pages and Interests items, plus joke commands (`:q`, `sudo`, `ada`). Fits "now navigable via keyboard".
- **First-visit boot sequence.** `S` — A BIOS-style text crawl that types out for ~2 s, skippable with any key, once per session. The old web without the pain.
- **Favicon reflects state.** `S` — Swap the favicon to a ♪ while "now playing" is recent.
- **Custom cursor toggle.** `S` — The OSRS gold pointer, opt-in.
- **Scroll-hint everywhere there's hidden content.** `S` — Already a component; audit which panels lack it on mobile.
- **Mobile keyboard parity.** `S` — Swipe left/right between pages on touch devices (the slide transitions already imply it).

### Look
- **Handwritten annotations.** `S` — Caveat is only used on polaroid captions. Small margin notes ("← this is Ada", "yes this is live") across pages would spread the handwritten accent and the voice.
- **More badges (88×31 buttons).** `S` each — The Buttons panel on `/now` exists (2026-10-26); every badge is an `app-badge` (`src/shared/badges/`). Left on the bench from the brainstorm: a live OSRS total-level badge, XP this week, collection log, "best viewed at night" (live: night here ✓ / come back after dark), arrow keys welcome, QA: Ada, campfire: lit, a carbon estimate from page weight, the honest uptime joke ("100% of the times you've checked"), and causes Morgan wants to rep `[TODO: Morgan]`. Same rules: real data or a real joke, nothing that needs tending.
- **Shelved badges, to revisit as a different kind of thing.** `M` — Built, shipped for a day, and taken off `/now` on 2026-10-26 because they don't fit cleanly into the 88×31 strip (Morgan: revisit "with the intention of considering other solutions for incorporating buttons of these types, for tracking my hobby/interest, or user interaction with the site"). The code is in git at `ae31b2a` (`src/shared/badges/{photo-wall,vinyl,under-construction}-badge/`, tests in the grouped `*-badges.spec.ts` there) if a version of them comes back:
  - **Photo Wall** — community photo count + newest caption, linking to `/social` (visitor interaction).
  - **Vinyl Collection** — Discogs public collection count + newest record from one request (`/users/morganvanv/collection/folders/0/releases?sort=added&sort_order=desc&per_page=1`, `pagination.items`); unverified whether Discogs allows the browser request (hobby tracking; see also "Vinyl shelf" above).
  - **Under construction** — counted `UNDER_CONSTRUCTION` (the list the pages still read), hazard-stripe glyph or the real gif.
  - Directions to consider: a "collections" or "stats" band per hobby on Interests, a visitor-activity strip on Social, or a different small format than 88×31 for counts that change.
- **Unify under-construction.** `S` — Pages use the gif; Interests items use a text banner. Make `UnderConstructionComponent` take a `variant` and use it everywhere.
- **Loading states.** `S` — The live panels show "Loading…" text; skeleton rows in the site's dark/translucent style would feel less static.
- **OSRS item icons from RuneLite's CDN.** note — Works, but it's a third-party hotlink; if it ever breaks, the Action pattern can cache them.

### Projects page (shipped 2026-10-28)
- Projects are data in `shared/constants/projects.const.ts`: four posters (`app-project-poster`) on `/projects` (Valkenburg, VideoJoker, the site, the VTT), the pinned one as a card on `/now`. Next (v5's art and its red corner sash shipped 2026-10-31; pin another project with `pinned: true`, take the sash down by deleting `ribbon`): a real VideoJoker image or logo if one appears (the CSS chat log stands in meanwhile); non-code projects (the astro rig); a per-project changelog from the repo's commits; a ribbon driven by `pushed_at` instead of by hand (the `ribbon` field and `app-project-ribbon` exist now). The "latest push" line on `/now` reads `pushed_at` (any branch), not the last commit on `main`; close enough and one request per repo.
- **The table, elsewhere** (Morgan, 2026-10-28, parked): the VTT on `/now`, maybe as a button, or folded into the Playing row; and links to the other things he hosts (the Minecraft server at wakaliwood.morganvanv.com, Jellyfin at vanvtv.morganvanv.com, the Foundry server), perhaps as one "what I host" spot. Other places floated: a greeting subtitle or two, one line in About Me, an Interests tile for tabletop, a session-night glow in the farmhouse window, campaign recaps as the blog's first posts. Revisit together.

### Blog (currently 🚧)
- `M`/`L` — Markdown posts in `src/content/`, converted at build time (`marked` in a Node script, not at runtime) to JSON + prerendered routes. **RSS/Atom feed is non-negotiable** for the IndieWeb crowd. Reading time, tags, a `/blog/feed.xml`. Consider a "notes" microblog format (short, frequent) alongside or instead of long posts — it fits the voice better.

## 5. Patterns worth establishing

- **Fetch at deploy, deploy on a schedule.** The deploy reads a CORS-blocked or keyed source into same-origin JSON (`lighthouse.json`, `site-status.json`, `letterboxd.json`), each step `continue-on-error` over a committed placeholder, and the deploy runs daily. No runtime backend, no CORS, no keys in the browser. It can't keep history: anything that accumulates (XP or music history) needs its data committed, and the `master` ruleset requires a PR for that, so think about where history lives before reaching for it.
- **Guestbook-as-PR.** For anything visitors write that Morgan should moderate: function → PR → merge = publish.
- **DO function.** For anything that needs a secret or must not be in the browser (already used by Ask Morgan).

## 6. Parked / probably not

- Strava/cycling stats — OAuth-only API; not worth the dance for "cycling on occasion".
- Light theme — explicitly against the vibe doc. (A "darker mode" joke toggle is fine.)
- Full CMS / Analog / Astro rewrite — the Angular setup is working; the blog can be a build script.
- Analytics — if ever, something cookieless and self-respecting (Plausible, GoatCounter), and a `/colophon` note about it.
