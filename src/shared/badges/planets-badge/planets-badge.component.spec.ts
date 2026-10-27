import { TestBed } from '@angular/core/testing';
import { PlanetsBadgeComponent, clock } from './planets-badge.component';
import { SkyService } from '../../sky/sky.service';
import { Tonight, TonightPlanet } from '../../sky/sky-tonight';
import { UpNow } from '../../sky/sky-up-now';

const at = (iso: string) => new Date(iso);

/** 27 October 2026 over Cincinnati, by day: dusk 7:10 pm EDT, dawn 7:35 am. */
const DUSK = at('2026-10-27T23:10:00Z');
const DAWN = at('2026-10-28T11:35:00Z');

const planet = (over: Partial<TonightPlanet> & Pick<TonightPlanet, 'name'>): TonightPlanet => ({
  mag: 0, from: DUSK, until: DAWN, upAtStart: true, upAtEnd: true, altAtStart: 20, ...over,
});

const SATURN = planet({ name: 'Saturn', mag: 0.3, until: at('2026-10-28T09:50:00Z'), upAtEnd: false, altAtStart: 16 });
const JUPITER = planet({ name: 'Jupiter', mag: -2, from: at('2026-10-28T06:10:00Z'), upAtStart: false, altAtStart: -30 });
const BY_DAY: Tonight = { dark: false, start: DUSK, end: DAWN, planets: [SATURN, JUPITER] };

describe('PlanetsBadgeComponent', () => {
  async function render(night: Tonight | null, setup: (sky: SkyService) => void = () => undefined) {
    const sky = TestBed.inject(SkyService);
    sky.tonight.set(night);
    setup(sky);
    const fixture = TestBed.createComponent(PlanetsBadgeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const rows = [...el.querySelectorAll('.popover-row')].map(r => [...r.children].map(c => c.textContent?.trim()).join(' '));
    return { sky, el, rows, badge: el.querySelector<HTMLButtonElement>('button.badge') };
  }

  it('by day, shows tonight: when each planet is up, and when it gets dark', async () => {
    const { sky, el, rows, badge } = await render(BY_DAY);
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('Saturn +1');
    expect(el.querySelector('.popover-title')?.textContent?.trim()).toBe('In the Cincinnati sky tonight');
    expect(rows).toEqual(['Saturn dusk–5:50 am', 'Jupiter 2:10 am–dawn']);
    expect(badge?.getAttribute('aria-label')).toBe(
      'Up tonight over Cincinnati: Saturn, from dusk until 5:50 am; Jupiter, from 2:10 am until dawn. '
      + 'The sky\'s too bright to see them yet. Dark from 7:10 pm. Opens the sky menu.');
    badge?.click();
    expect(sky.menuOpen()).toBe(true);
  });

  it('says "all night" for a planet up from dusk to dawn', async () => {
    const { rows } = await render({ ...BY_DAY, planets: [planet({ name: 'Jupiter' })] });
    expect(rows).toEqual(['Jupiter all night']);
  });

  it('once it\'s dark, gives the height of the planets up now (the live sky\'s), then later risers', async () => {
    const now = at('2026-10-28T03:00:00Z');
    const live: UpNow = {
      planets: ['Saturn'], moon: null, constellations: [],
      detail: { moon: { illuminated: 1, phase: 180, alt: 20 }, sunAlt: -40, planets: [{ name: 'Saturn', alt: 50.4 }] },
    };
    const { el, rows, badge } = await render(
      { dark: true, start: now, end: DAWN, planets: [{ ...SATURN, from: now, altAtStart: 49 }, JUPITER] },
      sky => sky.upNow.set(live),
    );
    expect(rows).toEqual(['Saturn 50° up', 'Jupiter 2:10 am–dawn']);
    expect(el.querySelector('.popover-note')?.textContent?.trim()).toBe('naked-eye planets over Cincinnati until dawn at 7:35 am');
    expect(badge?.getAttribute('aria-label')).toBe(
      'Up tonight over Cincinnati: Saturn, 50 degrees up; Jupiter, from 2:10 am until dawn. Opens the sky menu.');
  });

  it('says "your sky" and uses the browser\'s clock for a visitor\'s own sky', async () => {
    const { el, badge } = await render(BY_DAY, sky => sky.location.set({ lat: 51.5, lon: -0.1, mine: true }));
    expect(el.querySelector('.popover-title')?.textContent?.trim()).toBe('In your sky tonight');
    expect(badge?.getAttribute('aria-label')).toContain(`Dark from ${clock(DUSK)}.`);
    expect(badge?.getAttribute('aria-label')).toMatch(/^Up tonight over you: /);
  });

  it('stays, saying so, on a night with no planets', async () => {
    const { el, badge } = await render({ ...BY_DAY, planets: [] });
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('just stars');
    expect(badge?.getAttribute('aria-label')).toBe(
      'Up tonight over Cincinnati: No naked-eye planets above the horizon tonight. '
      + 'The sky\'s too bright to see them yet. Dark from 7:10 pm. Opens the sky menu.');
  });

  it('says when there\'s no dark sky tonight at all', async () => {
    const { el } = await render({ dark: false, start: null, end: null, planets: [] });
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('no dark sky');
  });

  it('hides before the sky has the numbers', async () => {
    expect((await render(null)).badge).toBeNull();
  });

  it('tells the time to the nearest five minutes, on a given clock', () => {
    expect(clock(at('2026-10-27T23:12:29Z'), 'America/New_York')).toBe('7:10 pm');
    expect(clock(at('2026-10-28T11:58:00Z'), 'America/New_York')).toBe('8 am');
    expect(clock(at('2026-10-28T11:58:00Z'), 'Europe/London')).toBe('12 pm');
  });
});
