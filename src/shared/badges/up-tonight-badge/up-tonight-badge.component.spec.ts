import { TestBed } from '@angular/core/testing';
import { UpTonightBadgeComponent, clock } from './up-tonight-badge.component';
import { SkyService } from '../../sky/sky.service';
import { Tonight, TonightMoon, TonightPlanet, TonightStar } from '../../sky/sky-tonight';
import { UpNow } from '../../sky/sky-up-now';

const at = (iso: string) => new Date(iso);

/** 27 October 2026 over Cincinnati, by day: dusk 7:10 pm EDT, dawn 7:35 am. */
const DUSK = at('2026-10-27T23:10:00Z');
const DAWN = at('2026-10-28T11:35:00Z');
const PRIME = at('2026-10-28T01:10:00Z');

const planet = (over: Partial<TonightPlanet> & Pick<TonightPlanet, 'name'>): TonightPlanet => ({
  mag: 0, from: DUSK, until: DAWN, upAtStart: true, upAtEnd: true, altAtStart: 20, peak: at('2026-10-28T02:00:00Z'), peakAlt: 40, ...over,
});

const SATURN = planet({ name: 'Saturn', mag: 0.3, until: at('2026-10-28T09:50:00Z'), upAtEnd: false, altAtStart: 16, peak: at('2026-10-28T02:30:00Z') });
const JUPITER = planet({ name: 'Jupiter', mag: -2, from: at('2026-10-28T06:10:00Z'), upAtStart: false, altAtStart: -30, peak: DAWN });
const MOON: TonightMoon = {
  illuminated: 0.95,
  up: { from: at('2026-10-28T00:20:00Z'), until: DAWN, upAtStart: false, upAtEnd: true, altAtStart: -3, peak: at('2026-10-28T06:40:00Z'), peakAlt: 60 },
  bright: true,
};
const STARS: TonightStar[] = [
  { name: 'Vega', constellation: 'Lyr', mag: 0.03, alt: 55 },
  { name: 'Capella', constellation: 'Aur', mag: 0.08, alt: 30 },
  { name: 'Deneb', constellation: 'Cyg', mag: 1.25, alt: 70 },
];
const BY_DAY: Tonight = {
  dark: false, start: DUSK, end: DAWN, primeTime: PRIME, moon: MOON, planets: [SATURN, JUPITER], stars: STARS,
  constellations: ['Cygnus', 'Pegasus', 'Cassiopeia'], shower: null,
};
const NOTHING: Tonight = { ...BY_DAY, moon: { illuminated: 0.1, up: null, bright: false }, planets: [], stars: [], constellations: [] };

describe('UpTonightBadgeComponent', () => {
  async function render(night: Tonight | null, setup: (sky: SkyService) => void = () => undefined) {
    const sky = TestBed.inject(SkyService);
    sky.tonight.set(night);
    setup(sky);
    const fixture = TestBed.createComponent(UpTonightBadgeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const rows = [...el.querySelectorAll('.popover-row')].map(r => [...r.children].map(c => c.textContent?.trim()).join(' '));
    const lines = [...el.querySelectorAll('.popover > span')]
      .filter(s => !s.className)
      .map(s => s.textContent?.trim());
    return { sky, el, rows, lines, badge: el.querySelector<HTMLButtonElement>('button.badge') };
  }

  it('by day, shows tonight: the Moon and each planet\'s hours, the brightest stars, what\'s overhead, and when it gets dark', async () => {
    const { sky, el, rows, lines, badge } = await render(BY_DAY);
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('Moon +2');
    expect(el.querySelector('.popover-title')?.textContent?.trim()).toBe('In the Cincinnati sky tonight');
    expect(rows).toEqual(['Moon 95% lit, 8:20 pm–dawn', 'Saturn dusk–5:50 am', 'Jupiter 2:10 am–dawn']);
    expect(lines).toEqual(['Brightest: Vega, Capella, Deneb', 'Overhead: Cygnus, Pegasus, Cassiopeia', 'A bright Moon: only the bright stars show.']);
    expect(el.querySelector('.popover-note')?.textContent?.trim()).toBe('The sky\'s too bright yet. Dark from 7:10 pm.');
    expect(badge?.getAttribute('aria-label')).toBe(
      'Up tonight over Cincinnati: the Moon, 95% lit, from 8:20 pm until dawn; Saturn, from dusk until 5:50 am, highest 10:30 pm; '
      + 'Jupiter, from 2:10 am until dawn; the brightest stars are Vega, Capella, Deneb; overhead, Cygnus, Pegasus, Cassiopeia; '
      + 'a bright Moon, so only the bright stars show. The sky\'s too bright yet. Dark from 7:10 pm. Opens the sky menu.');
    badge?.click();
    expect(sky.menuOpen()).toBe(true);
  });

  it('says "all night" for a planet up from dusk to dawn, and mentions a shower peaking about now', async () => {
    const { rows, lines } = await render({
      ...BY_DAY, moon: null, planets: [planet({ name: 'Jupiter' })], stars: [], constellations: [],
      shower: { name: 'Orionids', peak: at('2026-10-21T00:00:00Z'), rate: 20 },
    });
    expect(rows).toEqual(['Jupiter all night']);
    expect(lines).toEqual(['Orionids peak Oct 21: up to 20 an hour']);
  });

  it('once it\'s dark, gives the height of the things up now (the live sky\'s), then later risers', async () => {
    const now = at('2026-10-28T03:00:00Z');
    const live: UpNow = {
      planets: ['Saturn'], moon: null, constellations: [],
      detail: { moon: { illuminated: 0.95, phase: 170, alt: 24.6 }, sunAlt: -40, planets: [{ name: 'Saturn', alt: 50.4 }] },
    };
    const { el, rows, badge } = await render(
      {
        ...BY_DAY, dark: true, start: now, primeTime: now,
        moon: { ...MOON, up: { ...MOON.up!, from: now, upAtStart: true, altAtStart: 20 } },
        planets: [{ ...SATURN, from: now, altAtStart: 49 }, JUPITER],
      },
      sky => sky.upNow.set(live),
    );
    expect(rows).toEqual(['Moon 95% lit, 25° up', 'Saturn 50° up', 'Jupiter 2:10 am–dawn']);
    expect(el.querySelector('.popover-note')?.textContent?.trim()).toBe('over Cincinnati until dawn at 7:35 am');
    expect(badge?.getAttribute('aria-label')).toMatch(/^Up tonight over Cincinnati: the Moon, 95% lit, 25 degrees up; Saturn, 50 degrees up, highest 10:30 pm; Jupiter, from 2:10 am until dawn; /);
    expect(badge?.getAttribute('aria-label')).toMatch(/\. Opens the sky menu\.$/);
  });

  it('says "your sky" and uses the browser\'s clock for a visitor\'s own sky', async () => {
    const { el, badge } = await render(BY_DAY, sky => sky.location.set({ lat: 51.5, lon: -0.1, mine: true }));
    expect(el.querySelector('.popover-title')?.textContent?.trim()).toBe('In your sky tonight');
    expect(badge?.getAttribute('aria-label')).toContain(`Dark from ${clock(DUSK)}.`);
    expect(badge?.getAttribute('aria-label')).toMatch(/^Up tonight over you: /);
  });

  it('with no Moon or planets, the face names the brightest star', async () => {
    const { el, rows, lines } = await render({ ...NOTHING, stars: STARS });
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('Vega');
    expect(rows).toEqual([]);
    expect(lines).toEqual(['Brightest: Vega, Capella, Deneb']);
  });

  it('stays, saying so, on a night with nothing to list', async () => {
    const { el, badge } = await render(NOTHING);
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('just stars');
    expect(badge?.getAttribute('aria-label')).toBe(
      'Up tonight over Cincinnati: Nothing above the horizon tonight but the stars. '
      + 'The sky\'s too bright yet. Dark from 7:10 pm. Opens the sky menu.');
  });

  it('says when there\'s no dark sky tonight at all', async () => {
    const { el } = await render({ dark: false, start: null, end: null, primeTime: null, moon: null, planets: [], stars: [], constellations: [], shower: null });
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
