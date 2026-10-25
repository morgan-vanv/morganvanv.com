import { ActivatedRouteSnapshot } from '@angular/router';
import type { ViewTransitionInfo } from '@angular/router';
import { directionBetween, onViewTransitionCreated } from './route-transition';

function snapshot(animation: number): ActivatedRouteSnapshot {
  return { data: { animation }, firstChild: null } as unknown as ActivatedRouteSnapshot;
}

function fakeTransition() {
  let finish!: () => void;
  const finished = new Promise<void>(resolve => { finish = resolve; });
  const transition = { finished } as unknown as ViewTransitionInfo['transition'];
  return { transition, finish };
}

describe('directionBetween', () => {
  it('slides vertically to and from the greeting page', () => {
    expect(directionBetween(0, 3)).toBe('vertical');
    expect(directionBetween(3, 0)).toBe('vertical');
  });

  it('slides right when moving forward and left when moving back', () => {
    expect(directionBetween(1, 2)).toBe('right');
    expect(directionBetween(4, 2)).toBe('left');
  });
});

describe('onViewTransitionCreated', () => {
  const html = document.documentElement;
  afterEach(() => { delete html.dataset['transition']; });

  it('sets the direction on <html> and clears it when the transition finishes', async () => {
    const { transition, finish } = fakeTransition();
    onViewTransitionCreated({ transition, from: snapshot(1), to: snapshot(2) });
    expect(html.dataset['transition']).toBe('right');
    finish();
    await new Promise(r => setTimeout(r, 0));
    expect(html.dataset['transition']).toBeUndefined();
  });

  it('an older transition finishing late does not clear a newer one\'s direction', async () => {
    const first = fakeTransition();
    const second = fakeTransition();
    onViewTransitionCreated({ transition: first.transition, from: snapshot(1), to: snapshot(2) });
    onViewTransitionCreated({ transition: second.transition, from: snapshot(2), to: snapshot(1) });
    expect(html.dataset['transition']).toBe('left');
    first.finish();
    await new Promise(r => setTimeout(r, 0));
    expect(html.dataset['transition']).toBe('left');
    second.finish();
    await new Promise(r => setTimeout(r, 0));
    expect(html.dataset['transition']).toBeUndefined();
  });
});
