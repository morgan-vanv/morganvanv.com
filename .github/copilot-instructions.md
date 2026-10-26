# Copilot Instructions

Personal website built with Angular 21 (zoneless, signals, prerendered to static HTML) and SCSS. Deployed to GitHub Pages via GitHub Actions.

## Commands

```bash
npm start            # dev server at http://localhost:4200
npm run build        # production build: regenerates build info, prerenders every route into dist/browser
npm test             # unit tests (Vitest, watch mode)
npm run test:ci      # unit tests, single run — what CI runs
npm run lint         # ESLint (TS + HTML)
npm run check        # lint + production build + test:ci, in that order
```

**Single test file:**
```bash
ng test --include='src/app/home-page/home-page.component.spec.ts'
```

Tests run on Vitest with happy-dom; no browser is needed. `vitest` is pinned to `~4.0` because 4.1.x's optional peer graph crashes npm 10 (`Cannot read properties of null (reading 'edgesOut')`); lift the pin once Node 22's bundled npm is fixed or CI moves to npm 11.

## Architecture

```
src/
  app/               # Page components (one folder per route)
    app.config.ts            # providers: zoneless, router + view transitions, hydration, HTTP
    app.config.server.ts     # server providers for prerendering
    app.routes.ts            # lazy route table, built from MAIN_ROUTES
    app.routes.server.ts     # RenderMode.Prerender for everything
  shared/            # Reusable components, directives, services, styles
    base-page/       # Shell component wrapping CustomNavbarComponent (+ optional visually-hidden <h1>)
    custom-navbar/   # Navigation bar; links derived from MAIN_ROUTES
    icon/            # <app-icon name="…">: the site's few glyphs as inline SVG
    scroll-region/   # ScrollRegionService + [appScrollRegion] for arrow-key scrolling
    config/site.config.ts    # every handle, URL and endpoint the site uses
    services/        # KeyboardNavService, SeoTitleStrategy, ApiCacheService, API clients
    sky/             # Tonight's sky: live canvas behind every page (see below)
    route-transition.ts  # View Transitions direction logic
    main-routes.ts       # the main pages: path, title, description
    shared-styles.scss   # Shared utility mixins (e.g. scrollbar-styled)
  styles.scss        # Global styles, color variables, route-transition CSS
public/              # static assets, robots.txt, sitemap.xml, humans.txt, site.webmanifest, data/sky/
scripts/             # build-info (prebuild hook); sky data and landscape generators (one-off)
art/                 # source art (the painting, lossless); not served
```

**Page structure:** Each route has its own folder under `src/app/<name>-page/`. Pages import `BasePageComponent` to get the navbar. Complex pages may contain nested sub-components in subfolders (e.g. `interests-page/osrs-stats/` is one data-fetching parent plus one small component per panel).

**Routing:** Main routes are declared once in `MAIN_ROUTES` (`src/shared/main-routes.ts`) with a `path`, `title` and `description`. Their order drives arrow-key navigation (`KeyboardNavService`), the navbar, slide direction, titles and meta tags. `src/app/app.routes.ts` maps each path to a lazy `loadComponent` via `lazyRouteComponents` and derives `data.animation` / `data.description` from the route. Don't hand-write `animation` values.

**Adding a page:** add the entry to `MAIN_ROUTES`, add its loader to `lazyRouteComponents` in `app.routes.ts` (the `MainRoutePath` type fails the build if you forget), add the URL to `public/sitemap.xml` (a test fails if you forget), and give the page `<app-base-page pageTitle="…">` unless it renders its own `<h1>`. The navbar updates itself.

**Build info:** `npm run build` runs `scripts/write-build-info.mjs` first (the `prebuild` hook), writing the gitignored `src/build-info.prod.ts` that the production configuration swaps in for `src/build-info.ts`. Always build production through `npm run build`; a bare `ng build` skips the hook and fails on the missing file.

**Prerendering:** every route is rendered to static HTML at build time (`outputMode: "static"`, `RenderMode.Prerender`) and hydrated in the browser. Code that touches `window`/`document` outside an event handler must be guarded (`typeof window !== 'undefined'`, `isPlatformServer`, or `afterNextRender`). Anything shown on first paint must be deterministic so hydration matches (e.g. the greeting picks its random subtitle after render). `ApiCacheService` returns `EMPTY` on the server and the HTTP transfer cache is disabled, so live panels are always fetched live in the browser.

**Tonight's sky** (`src/shared/sky/`): `app-sky` sits inside `App`'s `.canvas` div, over the painted `public/background.webp` (first paint and fallback), and draws the real sky with the painting in front on a canvas at device resolution (capped at 2×; `layout.artPixel` = CSS px per buffer px). The component paints the gradient and horizon glow with canvas gradients; `sky-render.ts` draws stars, lines, Sun and Moon into a transparent RGBA buffer (pure and tested, like `sky-math.ts`), laid over it; then glows, the landscape and the farmhouse light. `sky-bodies.ts` wraps `astronomy-engine`, which is only ever loaded with a dynamic `import()`. The landscape is `public/landscape/<look>.webp` (darkness, sunrise, sunset, day; 1920×1279, soft alpha), built by `scripts/build-landscape.py` from `art/painting.png` (soft matte, relighting, sunrise fog); `sky-landscape.ts` decides how much of each look to use and places the dusk fireflies (CSS-animated spans, still under reduced motion). Hover highlights live on a second canvas (`.overlay`) so they never redraw the sky. Star, name and constellation data are committed JSON in `public/data/sky/`, generated by `scripts/build-sky-data.mjs` from d3-celestial. Nothing draws until the star data and the darkness look have loaded; if either fails the painting stays (if only astronomy-engine fails, the sky draws without the Moon and planets; other looks load when first needed). `SkyService` holds whose sky it is and how it's lit (`Lighting`: `darkness` by default, then `real`, `sunrise`, `sunset`, `day`; staged sunrise/sunset put the Sun in the valley at `BACKGROUND_VALLEY`). Both are chosen in `app-sky-menu` (top-right ☾) and remembered in `localStorage`; only its "show my sky" button (`app-sky-toggle`) may call geolocation. Hovering or tapping open sky names what's there (`sky-hover.ts`; `HOVER_BLOCKERS` lists what blocks it — add a selector there if new content should). The menu's "up right now" list (`sky-up-now.ts`) is the text equivalent of the canvas. `?sky-at=<ISO>` pins the time and `?sky-light=<lighting>` forces a lighting. `app-sky` sets `--daylight` (0 at night, 1 in daylight) on `<html>`; anything with text over the sky should darken with it, as `base-page`'s card does. To change the landscape, edit `scripts/build-landscape.py` and rerun it; never hand-edit the webps. If the painting's composition changes, check `BACKGROUND_SIZE` / `BACKGROUND_HORIZON_Y` / `BACKGROUND_VALLEY` / `BACKGROUND_WINDOW` in `sky-render.ts`.

**SEO:** `SeoTitleStrategy` (registered as the router `TitleStrategy`) sets `Page · morganvanv.com`, the route description, Open Graph/Twitter tags, the canonical link and a JSON-LD `Person`. Site-wide defaults live in `index.html`. Canonical URLs and the sitemap use trailing slashes because GitHub Pages serves prerendered routes as directories.

## Conventions

**Design pillar — night is home:** the site is dark by default and designed against a night sky first. Anything brighter (daylight, sunrise, a light variant) is an opt-in the visitor chooses, never the landing state. When "accurate" and "looks like night" conflict, default to night and offer accuracy as a setting. New UI must still be readable if a visitor opts into a brighter sky.

**Design pillar — cultivate an atmosphere:** set a vibe and reward people for noticing it. Small flavor and easter eggs (a light left on in the farmhouse after dark, the Moon in its real phase) are worth building. Keep them quiet and discoverable, never in the way, never at the cost of accessibility.


**Standalone components:** All components are standalone. Never use NgModule. Do **not** set `standalone: true`.

**Zoneless + signals:** `provideZonelessChangeDetection()` is on; there is no zone.js. Components use `ChangeDetectionStrategy.OnPush`, hold state in `signal()`/`computed()`, read observables with `toSignal()` or `AsyncPipe`, and never call `markForCheck()`. Use `input()` / `input.required()` and `host: { … }` metadata, never `@Input`, `@Output` or `@HostListener`. In tests, prefer `await fixture.whenStable()` to `fixture.detectChanges()`.

**Dependency injection:** Use `inject()` — not constructor injection.
```ts
private myService = inject(MyService);
```
For navigation, prefer `routerLink` over imperative `Router.navigate()` whenever possible.

**Icons:** `<app-icon name="chevron-down" />`. Add a path to `ICON_PATHS` in `src/shared/icon/icon.component.ts` for a new glyph. No icon fonts, no Angular Material.

**Fonts:** JetBrains Mono and Caveat are bundled from `@fontsource` (latin subsets, listed in `angular.json` `styles`). Never add a Google Fonts `<link>`; the build must not need the network.

**Scroll regions:** Put `appScrollRegion` on the element arrow keys should scroll (`[appScrollRegion]="false"` withdraws it). The innermost registered region wins.

**Config:** External handles, usernames, URLs and the Ask Morgan endpoint live in `SITE_CONFIG` (`src/shared/config/site.config.ts`). API clients go through `ApiCacheService.get(url, ttlMs?)` (sessionStorage, 10-minute TTL by default; `0` bypasses the cache).

**Live data that must stay fresh** (anything a visitor would notice going stale) polls from a root service while the tab is visible — see `RecentStreamService` for the pattern (`visibilitychange` + `timer`, `switchMap` to the fetch, errors → `null`, nothing rendered). Components only read its signals.

**Component metadata style:** Use `styleUrl` (singular) and `templateUrl`. Imports should have spaces after `{`. Top-level page components follow the `*.component.ts/html/scss` naming convention. Sub-components may omit the `.component.` infix — both patterns exist.
```ts
@Component({
  selector: 'app-my-page',
  imports: [BasePageComponent],
  templateUrl: './my-page.component.html',
  styleUrl: './my-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
```

**SCSS — global variables:** Import and use the global color variables and breakpoint rather than hardcoding values.
```scss
@use '../../styles' as *;
// Available: $background-color, $background-sky-color, $main-color, $accent-color, $osrs-gold, $danger-color, $breakpoint-mobile
```
A `--accent-color` CSS custom property is also set on `body` for inline template styles.

**Data-driven lists:** Use typed arrays in the component class + `@for` loops for any repeated structural elements.

**SCSS — shared utilities:** Cards use `@include shared.surface` (dark fill + faint border) or `shared.panel` (surface + padding/radius), with `shared.panel-heading` for a title + dim qualifier; bars use `shared.progress-bar`. Use `@include shared.scrollbar-styled` in any scrollable container's SCSS. Import it with `@use '../../shared/shared-styles.scss' as shared;`. Sub-components that should lay out as if they were their parent's flex item use `:host { display: contents; }`.

**SCSS — breakpoints:** Use `$breakpoint-mobile` (1000px) for all responsive media queries. Never hardcode `1000px`.

**Global layout:** `body` has `overflow: hidden` globally (no page-level scroll). Each page is responsible for its own internal scroll areas. Body type is `clamp(1rem, 2.5dvh, 1.4rem)`.

**Motion:** Route changes use the View Transitions API (`withViewTransitions` + `onViewTransitionCreated` in `route-transition.ts`; CSS in `styles.scss`). `@angular/animations` is not a dependency; use CSS. Everything decorative must respect `prefers-reduced-motion` (a global rule covers CSS animations; JS-driven motion such as the 3D model's auto-rotate checks `matchMedia`).

**Images:** compressed `.webp` in `public/` with real `alt` (or `alt=""` when decorative), and `width`/`height` attributes where the CSS doesn't already fix the box. `og-image.jpg` is the one deliberate non-webp (link previews don't all support webp).

**ESLint rules:** Component selectors must use `app-` prefix in kebab-case; directive selectors must use `app` prefix in camelCase.

**Prettier:** Configured for HTML files only (Angular parser). TS/SCSS have no Prettier config.
