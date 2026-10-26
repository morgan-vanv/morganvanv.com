import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MoonBadgeComponent } from './moon-badge/moon-badge.component';
import { PlanetsBadgeComponent } from './planets-badge/planets-badge.component';
import { SkyService } from '../sky/sky.service';
import { UpNow } from '../sky/sky-up-now';

// The night after the October 2026 full Moon, over Cincinnati, as the sky reports it.
const tonight: UpNow = {
  planets: ['Saturn'],
  moon: 'Moon, 99% lit',
  constellations: [],
  detail: {
    moon: { illuminated: 0.987, phase: 191.7, alt: 23.4 },
    planets: [{ name: 'Saturn', alt: 35.2 }],
  },
};

describe('the sky badges', () => {
  async function render<T>(component: Type<T>, up: UpNow | null) {
    TestBed.configureTestingModule({ imports: [component] });
    const sky = TestBed.inject(SkyService);
    sky.upNow.set(up);
    const fixture = TestBed.createComponent(component);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { sky, el, badge: el.querySelector<HTMLButtonElement>('button.badge') };
  }

  it('Moon shows the phase and how much is lit, and opens the sky menu', async () => {
    const { sky, el, badge } = await render(MoonBadgeComponent, tonight);
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('99% · waning');
    expect(badge?.getAttribute('aria-label')).toBe(
      'The Moon tonight: waning gibbous, 99% lit, 23 degrees above the horizon. Opens the sky menu.',
    );
    expect(el.querySelector('svg path')?.getAttribute('d')).toMatch(/^M12 4 A8 8 0 0 0 12 20/);
    badge?.click();
    expect(sky.menuOpen()).toBe(true);
    expect(sky.menuFocusRequests()).toBe(1);
  });

  it('Up tonight lists the planets up, and opens the sky menu', async () => {
    const { sky, el, badge } = await render(PlanetsBadgeComponent, tonight);
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('Saturn');
    expect(badge?.getAttribute('aria-label')).toContain('Saturn, 35 degrees up');
    badge?.click();
    expect(sky.menuOpen()).toBe(true);
  });

  it('Up tonight counts the rest when several are up', async () => {
    const detail = { ...tonight.detail!, planets: [{ name: 'Jupiter', alt: 40 }, { name: 'Saturn', alt: 20 }, { name: 'Mars', alt: 5 }] };
    const { el } = await render(PlanetsBadgeComponent, { ...tonight, detail });
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('Jupiter +2');
  });

  it('both hide until the sky has the numbers, and Up tonight hides when no planet is up', async () => {
    expect((await render(MoonBadgeComponent, null)).badge).toBeNull();
    TestBed.resetTestingModule();
    expect((await render(PlanetsBadgeComponent, { ...tonight, detail: null })).badge).toBeNull();
    TestBed.resetTestingModule();
    expect((await render(PlanetsBadgeComponent, { ...tonight, detail: { ...tonight.detail!, planets: [] } })).badge).toBeNull();
  });
});
