import { afterNextRender, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Call from a page's constructor: when the page was opened with a fragment (`/home#home-contact`, `/social#server`),
 * bring that element's panel into view once it has rendered. The router's own anchor scrolling moves the window, but
 * every page scrolls inside the card (`base-page`'s `.page-content`), so pages do it themselves.
 */
export function scrollToFragmentOnLoad(): void {
  const fragment = inject(ActivatedRoute).snapshot.fragment;
  if (!fragment) return;
  afterNextRender(() => {
    const target = document.getElementById(fragment);
    (target?.closest('section') ?? target)?.scrollIntoView?.({ block: 'start' });
  });
}
