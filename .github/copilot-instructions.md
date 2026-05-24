# Copilot Instructions

Personal website built with Angular 20, Angular Material, and SCSS. Deployed to GitHub Pages via GitHub Actions.

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
  shared/            # Reusable components and styles
    base-page/       # Shell component wrapping CustomNavbarComponent
    custom-navbar/   # Navigation bar
    route-transition.ts  # Shared animation trigger
    shared-styles.scss   # Shared utility classes (e.g. .scrollbar-styled)
  styles.scss        # Global styles and color variables
  _theme-colors.scss # Angular Material color palettes (generated, edit with caution)
```

**Page structure:** Each route has its own folder under `src/app/<name>-page/`. Pages import `BasePageComponent` to get the navbar. The `AppComponent` applies route animations via `@routeAnimations`.

**Routing:** Defined in `src/app/app.routes.ts`. Every route requires a `data: { animation: 'UniqueName' }` property for the slide transition to work.

## Conventions

**Standalone components:** All components use `standalone: true`. Never use NgModule.

**Dependency injection:** Use `inject()` function — not constructor injection.
```ts
private router = inject(Router);
```

**New pages:** Import `BasePageComponent` (not `CustomNavbarComponent` directly) to get the shared navbar. Register the route in `app.routes.ts` with an `animation` data key.

**SCSS — global variables:** Import and use the global color variables rather than hardcoding hex values.
```scss
@use '../../styles' as *;
// Available: $background-color, $background-sky-color, $main-color, $accent-color
```

**SCSS — shared utilities:** Use `.scrollbar-styled` from `src/shared/shared-styles.scss` on any scrollable container.

**ESLint rules:** Component selectors must use `app-` prefix in kebab-case; directive selectors must use `app` prefix in camelCase.

**Prettier:** Configured for HTML files only (Angular parser). TS/SCSS have no Prettier config.
