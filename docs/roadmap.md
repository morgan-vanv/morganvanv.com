# Roadmap

What's being built next, in order, with the decisions already made. This is the "we agreed on this" doc; `ideas-later.md` is the parking lot. When a feature ships, delete its section here and add a line to `decisions.md`.

Agreed 2026-10-25, after PR #74 landed. Theme: **make the site visibly alive** — three features that change on their own.

---

## 1. Last listened — shipped

PR #80. `RecentStreamService` (`src/shared/services/recent-stream.service.ts`) is the shared source for §2's **Listening** row.

## 2. `/now` page (`S`/`M`)

**What:** the IndieWeb "now page", mostly auto-generated. **Main route, second in order: Home → Now → Background → …** (arrow keys, navbar, sitemap all follow `MAIN_ROUTES`).

**Layout** (top to bottom):
1. **A hand-written paragraph** — Morgan's words, updated when he feels like it. Lives in `src/app/now-page/now.content.ts` as a `{ updated: '2026-10-25', text: '…' }` const so the "last updated" date is honest and the copy is a one-line PR. Ships with short placeholder copy marked `[TODO: Morgan]`; Morgan supplies the real paragraph after the page exists.
2. **Auto rows**, each "label · value · when", in this order, each hidden when its source is empty:
   - **Listening** — last listened (from §1's `RecentStreamService`).
   - **Playing** — last OSRS achievement + last drop (RuneProfile; already fetched for Interests, cached).
   - **Watching** — *slot reserved* for the Letterboxd feed (`ideas-later.md` §3); renders nothing until that data file exists.
   - **Community** — newest photo on the wall (last entry of `SUBMITTED_PHOTOS`; static).
   - **Site** — last commit: message, date, short SHA, linked to GitHub.

**How:**
- **Last commit is baked at build time**, not fetched: `scripts/write-build-info.mjs` runs as the `prebuild` npm hook and writes a **gitignored** `src/build-info.prod.ts` (`{ sha, date, message }`) from `git log -1`; the **committed** `src/build-info.ts` holds dev placeholder values and the production configuration swaps it via `fileReplacements`. Zero API calls, no rate limits, prerender-friendly, and `ng serve` / tests work from a fresh checkout. (Design per Copilot's review of #79: a path can't be both tracked and ignored.)
- Rows are small presentational components reused from Interests where they exist (the activity-row look).
- Page shell: `<app-base-page pageTitle="Now">`, `appScrollRegion` on its content, scroll hint on.
- Add to `MAIN_ROUTES` (title "Now", description drafted), `lazyRouteComponents`, `public/sitemap.xml` (the test will insist). Navbar updates itself.

**Needs from Morgan:** the paragraph, after the page ships. Everything else is automatic.

**Done when:** `/now` prerenders with the paragraph, date and commit row; live rows fill in in the browser; the Letterboxd slot is a no-op; arrow keys traverse Home → Now → Background.

## 3. Tonight's sky (`M`)

**What:** replace the static `background.webp` with a canvas rendering of the **actual sky over Cincinnati right now** — stars, **major constellation lines**, Moon (with correct phase), and the naked-eye planets — behind every page. The pixel-art foreground (trees, field, fence) stays; only the sky band changes.

**Decisions made:**
- **Scope:** stars + constellation lines + Moon + planets. `astronomy-engine` (~49 kB gz) is the one new dependency, **lazy-loaded after first paint**; the static image is the first thing visitors see and remains the fallback.
- **Style: pixel-art sky.** The canvas renders at roughly 1/3 resolution and is upscaled with nearest-neighbour (`image-rendering: pixelated`), so stars are chunky 2–3 px dots, the Moon is a blocky disc, and constellation lines are 1-px stepped segments — part of the same drawing as the trees and fence, not a photo behind a cutout. Bonus: 1/9th the pixels to fill per frame.
- **Source art:** only the flattened `background.webp` exists. The foreground is cut out programmatically along the treeline (offline, Pillow, hand-fixed edge) and committed as `public/foreground.webp`; the current image stays as the fallback. Morgan can replace the foreground with a redrawn layer any time.
- **Location:** Cincinnati by default (39.10° N, 84.51° W). A small, unobtrusive **"show my sky" toggle** (probably in the page footer area or the greeting) requests geolocation on demand; the choice is remembered in `localStorage`. Never prompts unasked.
- **Motion:** the sky advances with real time (one re-render a minute is plenty — stars move 0.25°/min). `prefers-reduced-motion` gets the same real sky but no twinkle and no gradual drift (re-render only on load/visibility change). No continuous `requestAnimationFrame` loop; the page is otherwise static and should stay cheap.

**How:**
- **Stars:** a build-time-generated `public/data/stars.json` from the Yale Bright Star Catalog filtered to mag ≤ 4.5 (~900 stars; RA, Dec, mag, B-V for a hint of color). Alt/az via local sidereal time — plain math, no library. Draw as 1–2 px dots, brightness by magnitude, slight color from B-V; skip anything below the horizon or inside the foreground silhouette.
- **Constellation lines:** from the [d3-celestial](https://github.com/ofrohn/d3-celestial) `constellations.lines.json` dataset (BSD-3; RA/Dec polylines for all 88), filtered at build time to a curated **"major" set visible from 39° N** — the zodiac plus Orion, Ursa Major/Minor, Cassiopeia, Cepheus, Perseus, Andromeda, Pegasus, Cygnus, Lyra, Aquila, Boötes, Corona Borealis, Hercules, Canis Major/Minor, Auriga, Draco (~30). Drawn faint (low-alpha accent colour) under the stars; always on in v1. ~10 kB JSON.
- **Moon & planets:** `astronomy-engine` → `Equator` + `Horizon` for Moon, Mercury–Saturn; Moon drawn with its illuminated fraction and bright-limb angle; planets as slightly larger tinted dots. Loaded via dynamic `import()` after the stars are up.
- **Sky gradient:** keep the existing palette (`$background-sky-color` at zenith → horizon glow), but **tint by sun altitude**: astronomical night, twilight, and — because people do open websites at noon — a daytime sky with no stars. Twilight via `astronomy-engine`'s `SearchAltitude`/sun position.
- **Foreground:** the current `background.webp` is split once (offline, Pillow) into `sky-fallback.webp` + `foreground.webp` (transparent above the treeline). The canvas sits between the page's `.canvas` div background and the foreground image. If the canvas never initialises (old browser, error), the fallback sky is already there — no flash.
- **Where the code lives:** `src/shared/sky/` — `sky-canvas.component.ts` (sizing, DPR, visibility), `sky-math.ts` (LST, alt/az, projection — pure, tested), `sky-bodies.ts` (astronomy-engine wrapper, lazy). `App` renders `<app-sky-canvas>` inside `.canvas`.
- **Projection:** stereographic looking roughly south, horizon at the treeline, ~120° field so it reads as "the sky" rather than a planetarium dome. Tune by eye.
- **Prerender/hydration:** the canvas is inert on the server; everything happens in `afterNextRender`.

**Done when:** at night in Cincinnati the Moon is where it actually is and Orion is recognisable in winter; at noon the sky is blue with no stars; reduced-motion users see a correct, still sky; the first paint is unchanged from today; `sky-math.ts` has tests against a couple of known positions (e.g. Polaris altitude ≈ latitude; a published Moon alt/az for a given timestamp); the Big Dipper's stick figure connects the right seven stars.

**Nice-to-haves after v1:** a lines on/off toggle beside "show my sky", constellation names on hover, hover tooltips naming bright stars/planets, an "astrophotography tonight?" hint when the Moon is down and it's astronomical night — a natural bridge to the My Photos gallery.

---

## Order and sizing

1 → 2 → 3. §1 is an evening and §2 reuses its service; §3 is the weekend project and the one people will notice. Each ships as its own PR.
