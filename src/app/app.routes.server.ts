import { RenderMode, ServerRoute } from '@angular/ssr';

/** Every route is prerendered to static HTML at build time; there is no runtime server. */
export const serverRoutes: ServerRoute[] = [
  { path: '**', renderMode: RenderMode.Prerender },
];
