import { TestBed } from '@angular/core/testing';
import { MoonBadgeComponent } from './moon-badge.component';
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

describe('MoonBadgeComponent', () => {
  async function render(up: UpNow | null, setup: (sky: SkyService) => void = () => undefined) {
    const sky = TestBed.inject(SkyService);
    sky.upNow.set(up);
    setup(sky);
    const fixture = TestBed.createComponent(MoonBadgeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { sky, el, badge: el.querySelector<HTMLButtonElement>('button.badge') };
  }

  it('shows the phase and how much is lit, and opens the sky menu', async () => {
    const { sky, el, badge } = await render(TONIGHT);
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('99% · waning');
    expect(badge?.getAttribute('aria-label')).toBe('Moon: waning gibbous, 99% lit, 23 degrees above the horizon. Opens the sky menu.');
    expect(el.querySelector('.popover-note')?.textContent).toBe('from the sky over Cincinnati');
    // Waning: the lit limb is on the left.
    expect(el.querySelector('svg path')?.getAttribute('d')).toMatch(/^M12 4 A8 8 0 0 0 12 20/);
    badge?.click();
    expect(sky.menuOpen()).toBe(true);
    expect(sky.menuFocusRequests()).toBe(1);
  });

  it('says when it is below the horizon', async () => {
    const { el, badge } = await render({ ...TONIGHT, detail: { ...TONIGHT.detail!, moon: { ...TONIGHT.detail!.moon, alt: -12 } } });
    expect(badge?.getAttribute('aria-label')).toContain('below the horizon');
    expect(el.querySelector('.popover')?.textContent).toContain('below the horizon');
  });

  it('mirrors the lit side south of the equator, and calls a barely-risen Moon up', async () => {
    const barelyUp = { ...TONIGHT, detail: { ...TONIGHT.detail!, moon: { ...TONIGHT.detail!.moon, alt: 0.3 } } };
    const { el, badge } = await render(barelyUp, sky => sky.location.set({ lat: -33.9, lon: 151.2, mine: true }));
    expect(el.querySelector('svg path')?.getAttribute('transform')).toBe('translate(24 0) scale(-1 1)');
    expect(badge?.getAttribute('aria-label')).toContain('1 degree above the horizon');
    expect(el.querySelector('.popover-note')?.textContent).toBe('from your sky');
  });

  it('draws no lit part at new moon', async () => {
    const { el } = await render({ ...TONIGHT, detail: { ...TONIGHT.detail!, moon: { illuminated: 0, phase: 0, alt: 10 } } });
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('0% · new');
    expect(el.querySelector('svg path')).toBeNull();
  });

  it('hides until the sky has the numbers', async () => {
    expect((await render(null)).badge).toBeNull();
  });
});
