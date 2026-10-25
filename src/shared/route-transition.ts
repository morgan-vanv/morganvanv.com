import { ActivatedRouteSnapshot } from '@angular/router';
import type { ViewTransitionInfo } from '@angular/router';

export type TransitionDirection = 'left' | 'right' | 'vertical';

const DATA_ATTR = 'transition';

/** The transition that currently owns the data attribute, so an older one finishing late can't clear a newer one's direction. */
let owner: ViewTransitionInfo['transition'] | null = null;

function animationIndex(snapshot: ActivatedRouteSnapshot): number {
  let node: ActivatedRouteSnapshot | null = snapshot;
  while (node) {
    const value = node.data['animation'];
    if (typeof value === 'number') return value;
    node = node.firstChild;
  }
  return 0;
}

/**
 * Picks the slide direction for a route change. The greeting page (index 0)
 * always slides vertically; main pages slide horizontally based on their
 * order in MAIN_ROUTES. The direction is exposed as
 * `<html data-transition="…">` for the ::view-transition CSS in styles.scss.
 */
export function directionBetween(from: number, to: number): TransitionDirection {
  if (from === 0 || to === 0) return 'vertical';
  return to > from ? 'right' : 'left';
}

export function onViewTransitionCreated({ transition, from, to }: ViewTransitionInfo): void {
  const direction = directionBetween(animationIndex(from), animationIndex(to));
  const html = document.documentElement;
  owner = transition;
  html.dataset[DATA_ATTR] = direction;
  transition.finished
    .catch(() => undefined) // a skipped transition rejects; that's fine
    .then(() => {
      if (owner === transition) {
        owner = null;
        delete html.dataset[DATA_ATTR];
      }
    });
}
