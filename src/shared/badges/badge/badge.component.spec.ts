import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BadgeComponent, BadgePopover, placeFor } from './badge.component';

@Component({
  imports: [BadgeComponent],
  template: `
    <app-badge [name]="name()" [value]="value()" [href]="href()" [route]="route()" [label]="label"
      [popover]="popover()" [expanded]="expanded()" controls="panel" (pressed)="presses = presses + 1">
      <svg glyph class="test-glyph"></svg>
    </app-badge>
  `,
})
class HostComponent {
  readonly name = signal('Moon');
  readonly value = signal<string | readonly string[]>('99% · waning');
  readonly href = signal<string | null>(null);
  readonly route = signal<string | null>(null);
  readonly expanded = signal<boolean | null>(null);
  readonly popover = signal<BadgePopover | null>(null);
  readonly label = 'The Moon tonight: waning gibbous, 99% lit.';
  presses = 0;
}

describe('BadgeComponent', () => {
  async function render(setup: (host: HostComponent) => void = () => undefined) {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    setup(fixture.componentInstance);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('links out in a new tab with href, and carries the full text as its accessible name', async () => {
    const { el } = await render(host => host.href.set('https://example.com/'));
    const link = el.querySelector('a.badge');
    expect(link?.getAttribute('href')).toBe('https://example.com/');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
    expect(link?.getAttribute('aria-label')).toBe('The Moon tonight: waning gibbous, 99% lit.');
    expect(el.querySelector('.glyph .test-glyph')).not.toBeNull();
    expect(el.querySelector('.name')?.textContent?.trim()).toBe('Moon');
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('99% · waning');
  });

  it('links within the site with route', async () => {
    const { el } = await render(host => host.route.set('/social'));
    const link = el.querySelector('a.badge');
    expect(link?.getAttribute('href')).toBe('/social');
    expect(link?.getAttribute('target')).toBeNull();
  });

  it('is a button when it has neither, and says when it is pressed', async () => {
    const { fixture, el } = await render(host => host.expanded.set(false));
    const button = el.querySelector<HTMLButtonElement>('button.badge');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(button?.getAttribute('aria-controls')).toBe('panel');
    button?.click();
    expect(fixture.componentInstance.presses).toBe(1);
  });

  it('shows several values side by side', async () => {
    const { el } = await render(host => host.value.set(['97', '100', '100', '100']));
    expect([...el.querySelectorAll('.value span')].map(span => span.textContent?.trim())).toEqual(['97', '100', '100', '100']);
  });

  it('sets long names a touch tighter so they fit', async () => {
    const { el } = await render(host => host.name.set('Vinyl Collection'));
    expect(el.querySelector('.name')?.classList).toContain('long');
  });

  it('renders the popover hidden from assistive tech, rows and all', async () => {
    const { el } = await render(host => host.popover.set({
      title: 'The Moon, tonight',
      rows: [{ label: 'Lit', value: '99%' }],
      lines: ['A line.'],
      note: 'from the sky',
      cta: 'open the sky ☾',
    }));
    const popover = el.querySelector('.popover');
    expect(popover?.getAttribute('aria-hidden')).toBe('true');
    expect(popover?.querySelector('.popover-title')?.textContent).toBe('The Moon, tonight');
    expect(popover?.querySelector('.popover-row')?.textContent).toContain('99%');
    expect(popover?.textContent).toContain('A line.');
    expect(popover?.querySelector('.popover-note')?.textContent).toBe('from the sky');
    expect(popover?.querySelector('.popover-cta')?.textContent).toBe('open the sky ☾');
  });

  it('has no popover unless given one', async () => {
    const { el } = await render();
    expect(el.querySelector('.popover')).toBeNull();
  });

  it('Escape hides a showing popover without leaving the page, until focus moves on', async () => {
    const { fixture, el } = await render(host => {
      host.href.set('https://example.com/');
      host.popover.set({ title: 'The Moon, tonight' });
    });
    const link = el.querySelector<HTMLAnchorElement>('a.badge')!;
    link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    link.dispatchEvent(escape);
    await fixture.whenStable();
    expect(escape.defaultPrevented).toBe(true);
    expect(el.querySelector('.popover')?.classList).toContain('dismissed');

    link.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await fixture.whenStable();
    expect(el.querySelector('.popover')?.classList).not.toContain('dismissed');
  });

  it('while the pointer rests on it, Escape anywhere hides the popover instead of leaving the page', async () => {
    const { fixture, el } = await render(host => {
      host.href.set('https://example.com/');
      host.popover.set({ title: 'The Moon, tonight' });
    });
    const host = el.querySelector('app-badge')!;
    host.dispatchEvent(new MouseEvent('mouseenter'));
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(escape);
    await fixture.whenStable();
    expect(escape.defaultPrevented).toBe(true);
    expect(el.querySelector('.popover')?.classList).toContain('dismissed');

    // Once the pointer leaves, Escape is the page's again, and the popover can show next time.
    host.dispatchEvent(new MouseEvent('mouseleave'));
    await fixture.whenStable();
    expect(el.querySelector('.popover')?.classList).not.toContain('dismissed');
    const later = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });

  it('stops listening for Escape when it goes away', async () => {
    const { fixture, el } = await render(host => host.popover.set({ title: 'Gone soon' }));
    el.querySelector('app-badge')!.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.destroy();
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.body.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
  });

  it('leaves Escape alone when nothing is showing', async () => {
    const { el } = await render(host => host.href.set('https://example.com/'));
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    el.querySelector('a.badge')!.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
  });
});

describe('placeFor', () => {
  const rect = (left: number, top: number, right: number) => ({ left, top, right, bottom: top + 46, width: right - left, height: 46 }) as DOMRect;

  function badgeIn(container: DOMRect, badge: DOMRect) {
    const page = document.createElement('div');
    page.className = 'page-content';
    const el = document.createElement('span');
    page.appendChild(el);
    document.body.appendChild(page);
    vi.spyOn(page, 'getBoundingClientRect').mockReturnValue(container);
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(badge);
    return { el, done: () => page.remove() };
  }

  it('opens up and to the right when there is room', () => {
    const { el, done } = badgeIn(rect(0, 0, 1000), rect(100, 500, 232));
    expect(placeFor(el, 280, 200)).toEqual({ end: false, below: false });
    done();
  });

  it('opens to the left near the right edge of the page, and below near its top', () => {
    const { el, done } = badgeIn(rect(0, 100, 600), rect(450, 150, 582));
    expect(placeFor(el, 280, 200)).toEqual({ end: true, below: true });
    done();
  });
});

