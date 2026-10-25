# Copilot Instructions

Personal website built with Angular 21, Angular Material, and SCSS. Deployed to GitHub Pages via GitHub Actions.

## Commands

```bash
npm start            # dev server at http://localhost:4200
npm run build        # production build
npm test             # run all tests (Karma/Jasmine)
npm run lint         # ESLint (TS + HTML)
```

**Single test file:**
```bash
ng test --include='src/app/home-page/home-page.component.spec.ts'
```

**CI test command** (headless, no watch):
```bash
npm test -- --watch=false --browsers=ChromeHeadless --no-progress
```

## Architecture

```
src/
  app/               # Page components (one folder per route)
  shared/            # Reusable components, services, and styles
    base-page/       # Shell component wrapping CustomNavbarComponent
    custom-navbar/   # Navigation bar
    services/        # Angular services (e.g. WiseOldManService, RuneProfileService)
    route-transition.ts  # Shared animation trigger
    shared-styles.scss   # Shared utility mixins (e.g. scrollbar-styled)
  styles.scss        # Global styles and color variables
```

**Page structure:** Each route has its own folder under `src/app/<name>-page/`. Pages import `BasePageComponent` to get the navbar. The `App` component (`src/app/app.ts`) applies route animations via `@routeAnimations`. Complex pages may contain nested sub-components in subfolders (e.g. `interests-page/osrs-stats/`).

**Routing:** Main routes are declared once in `MAIN_ROUTES` (`src/shared/main-routes.ts`). Their order drives arrow-key navigation (`KeyboardNavService`), route titles, and slide direction. The navbar does **not** read `MAIN_ROUTES`; it has its own hardcoded `navLinks` array in `src/shared/custom-navbar/custom-navbar.component.ts` that must be updated separately. `src/app/app.routes.ts` maps each path to a lazy `loadComponent` via `lazyRouteComponents` and derives `data.animation` from the route's index with `getMainRouteAnimation()` (the greeting route is `0`). Don't hand-write `animation` values.

## Conventions

**Standalone components:** All components are standalone (Angular 19+ default). Never use NgModule. Do **not** explicitly set `standalone: true` — it is redundant and omitted by convention.

**Dependency injection:** Use `inject()` function — not constructor injection.
```ts
private myService = inject(MyService);
```
For navigation, prefer `routerLink` directive over imperative `Router.navigate()` whenever possible.

**New pages:** Import `BasePageComponent` (not `CustomNavbarComponent` directly) to get the shared navbar. Add the route to `MAIN_ROUTES` in `src/shared/main-routes.ts` (position = nav order) add its entry to `lazyRouteComponents` in `app.routes.ts` (the `MainRoutePath` type will fail the build if you forget this), and add a matching link to `navLinks` in `custom-navbar.component.ts` (nothing enforces this one, so it is easy to miss).

**Component metadata style:** Use `styleUrl` (singular) and `templateUrl`. Imports should have spaces after `{`. Top-level page components follow the `*.component.ts/html/scss` naming convention. Sub-components generated via Angular CLI (e.g. `ng generate component`) may omit the `.component.` infix — both patterns exist in the codebase.
```ts
@Component({
  selector: 'app-my-page',
  imports: [BasePageComponent],
  templateUrl: './my-page.component.html',
  styleUrl: './my-page.component.scss',
})
```

**SCSS — global variables:** Import and use the global color variables and breakpoint rather than hardcoding values.
```scss
@use '../../styles' as *;
// Available: $background-color, $background-sky-color, $main-color, $accent-color, $breakpoint-mobile
```
A `--accent-color` CSS custom property is also set on `body` for use in inline template styles (e.g. `[style.--brand-color]="'var(--accent-color)'"`).

**Data-driven lists:** Use typed arrays in the component class + `@for` loops in templates for any repeated structural elements (nav links, social links, cards, etc.). Avoid duplicating identical markup blocks.
```ts
readonly items: Item[] = [{ ... }, { ... }];
```
```html
@for (item of items; track item.id) { ... }
```

**SCSS — shared utilities:** Use `@include shared.scrollbar-styled` in any scrollable container's SCSS to apply the shared scrollbar styles. Import it with `@use '../../shared/shared-styles.scss' as shared;`.

**SCSS — breakpoints:** Use `$breakpoint-mobile` (1000px) for all responsive media queries. Never hardcode `1000px`.

**Global layout:** `body` has `overflow: hidden` globally (no page-level scroll). Each page is responsible for its own internal scroll areas. The two-column home layout uses `flex: 0 0 40%` on the left panel and `flex: 1` on the right scrollable panel.

**Route animations:** Defined in `src/shared/route-transition.ts` and applied in `app.ts` via `@routeAnimations`. `withViewTransitions()` is intentionally **not** used alongside this to avoid conflicts.

**ESLint rules:** Component selectors must use `app-` prefix in kebab-case; directive selectors must use `app` prefix in camelCase.

**Prettier:** Configured for HTML files only (Angular parser). TS/SCSS have no Prettier config.
