import { SkySegment, SkyTarget, hitTest } from './sky-render';
import { CONSTELLATION_NAMES } from './sky-up-now';

/**
 * Hovering the sky names what's under the pointer. Only over open sky: anything
 * a visitor might be reading or clicking blocks it, so the labels never get in
 * the way of the page. The labels are decorative; the sky menu's "up right now"
 * list carries the same information as text.
 */
export const HOVER_BLOCKERS =
  'a, button, input, label, select, textarea, h1, h2, h3, p, li, img, model-viewer, .page-container, app-sky-menu';

export function isOpenSky(target: EventTarget | null): boolean {
  return target instanceof Element && !target.closest(HOVER_BLOCKERS);
}

export interface SkyHover {
  readonly target: SkyTarget | null;
  readonly figure: string | null;
}

export const NO_HOVER: SkyHover = { target: null, figure: null };

export function sameHover(a: SkyHover, b: SkyHover): boolean {
  return a.figure === b.figure && a.target?.name === b.target?.name && a.target?.kind === b.target?.kind;
}

/** What's at a point in art pixels. */
export function hoverAt(x: number, y: number, targets: readonly SkyTarget[], segments: readonly SkySegment[]): SkyHover {
  return hitTest(x, y, targets, segments);
}

/** "Regulus · Leo", "Jupiter", "the Moon · 99% lit", or just "Orion" for a figure. */
export function hoverLabel(hover: SkyHover): string | null {
  const { target, figure } = hover;
  if (target) {
    const extra = target.kind === 'star' && target.constellation ? constellationName(target.constellation) : target.detail;
    return extra ? `${target.name} · ${extra}` : target.name;
  }
  return figure ? constellationName(figure) : null;
}

function constellationName(id: string): string {
  return CONSTELLATION_NAMES[id] ?? id;
}
