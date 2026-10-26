import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { TitleStrategy, provideRouter, withViewTransitions } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideClientHydration, withEventReplay, withNoHttpTransferCache } from '@angular/platform-browser';

import { routes } from './app.routes';
import { onViewTransitionCreated } from '../shared/route-transition';
import { SeoTitleStrategy } from '../shared/services/seo.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withViewTransitions({ onViewTransitionCreated })),
    { provide: TitleStrategy, useClass: SeoTitleStrategy },
    // Live panels must always be live, so nothing fetched at prerender time
    // is carried over to the browser.
    provideClientHydration(withEventReplay(), withNoHttpTransferCache()),
    provideHttpClient(),
  ]
};
