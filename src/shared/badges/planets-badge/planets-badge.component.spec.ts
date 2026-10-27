import { TestBed } from '@angular/core/testing';
import { PlanetsBadgeComponent } from './planets-badge.component';
import { SkyService } from '../../sky/sky.service';
import { UpNow } from '../../sky/sky-up-now';

/** The night after the October 2026 full Moon, over Cincinnati, as the sky reports it. */
const TONIGHT: UpNow = {
  planets: ['Saturn'],
  moon: 'Moon, 99% lit',
  constellations: [],
  detail: {
    moon: { illuminated: 0.987, phase: 191.7, alt: 23.4 },
    sunAlt: -38,
    planets: [{ name: 'Saturn', alt: 35.2 }],
  },
};

describe('PlanetsBadgeComponent', () => {
  const withDetail = (over: Partial<NonNullable<UpNow['detail']>>): UpNow => ({ ...TONIGHT, detail: { ...TONIGHT.detail!, ...over } });

  async function render(up: UpNow | null, setup: (sky: SkyService) => void = () => undefined) {
    const sky = TestBed.inject(SkyService);
    sky.upNow.set(up);
    setup(sky);
    const fixture = TestBed.createComponent(PlanetsBadgeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { sky, el, badge: el.querySelector<HTMLButtonElement>('button.badge') };
  }

  it('lists the planets up, and opens the sky menu', async () => {
    const { sky, el, badge } = await render(TONIGHT);
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('Saturn');
    expect(badge?.getAttribute('aria-label')).toBe('Up tonight over Cincinnati: Saturn, 35 degrees up. Opens the sky menu.');
    badge?.click();
    expect(sky.menuOpen()).toBe(true);
  });

  it('counts the rest when several are up, and says "over you" for a visitor\'s own sky', async () => {
    const planets = [{ name: 'Jupiter', alt: 40 }, { name: 'Saturn', alt: 20 }, { name: 'Mars', alt: 0.2 }];
    const { el, badge } = await render(withDetail({ planets }), sky => sky.location.set({ lat: 51.5, lon: -0.1, mine: true }));
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('Jupiter +2');
    expect(badge?.getAttribute('aria-label')).toMatch(/^Up tonight over you: .*Mars, 1 degree up/);
    expect(el.querySelectorAll('.popover-row').length).toBe(3);
  });

  it('waits for dusk: planets above the horizon in daylight are not "tonight"', async () => {
    expect((await render(withDetail({ sunAlt: 20 }))).badge).toBeNull();
  });

  it('hides when none are up, or before the sky has the numbers', async () => {
    expect((await render(withDetail({ planets: [] }))).badge).toBeNull();
    TestBed.resetTestingModule();
    expect((await render({ ...TONIGHT, detail: null })).badge).toBeNull();
  });
});
