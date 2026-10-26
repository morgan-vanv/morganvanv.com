import { Type, VERSION } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PhotoWallBadgeComponent } from './photo-wall-badge/photo-wall-badge.component';
import { AngularBadgeComponent } from './angular-badge/angular-badge.component';
import { NoCookiesBadgeComponent } from './no-cookies-badge/no-cookies-badge.component';
import { UnderConstructionBadgeComponent } from './under-construction-badge/under-construction-badge.component';
import { COMMUNITY_PHOTOS } from '../constants/community-photos.const';
import { UNDER_CONSTRUCTION } from '../constants/under-construction.const';
import { SITE_CONFIG } from '../config/site.config';

// The badges whose data ships with the site, so they're prerendered rather than filled in later.
async function render<T>(component: Type<T>) {
  TestBed.configureTestingModule({ imports: [component], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { el, badge: el.querySelector('.badge'), value: el.querySelector('.value')?.textContent?.trim() };
}

describe('the static badges', () => {
  it('Photo Wall counts the community photos and names the newest', async () => {
    const { badge, value, el } = await render(PhotoWallBadgeComponent);
    expect(value).toBe(`${COMMUNITY_PHOTOS.length} photos`);
    expect(el.querySelector('.name')?.textContent?.trim()).toBe('Photo Wall');
    expect(badge?.getAttribute('href')).toBe('/social');
    expect(badge?.getAttribute('aria-label')).toContain(`newest: ${COMMUNITY_PHOTOS.at(-1)?.caption}`);
  });

  it('Made with Angular reads the version from Angular itself', async () => {
    const { badge, value } = await render(AngularBadgeComponent);
    expect(value).toBe(`Angular ${VERSION.major}`);
    expect(badge?.getAttribute('aria-label')).toContain(VERSION.full);
    expect(badge?.getAttribute('href')).toBe(SITE_CONFIG.repoUrl);
  });

  it('No cookies links to humans.txt', async () => {
    const { badge, value } = await render(NoCookiesBadgeComponent);
    expect(value).toBe('no trackers');
    expect(badge?.getAttribute('href')).toBe('/humans.txt');
  });

  it('Under construction counts the list the pages read, and names every spot', async () => {
    const { badge, value, el } = await render(UnderConstructionBadgeComponent);
    expect(value).toBe(`${UNDER_CONSTRUCTION.length} spots`);
    expect(badge?.getAttribute('href')).toBe('/projects');
    const label = badge?.getAttribute('aria-label') ?? '';
    for (const spot of UNDER_CONSTRUCTION) expect(label).toContain(spot.label);
    expect(el.querySelectorAll('.popover-row').length).toBe(UNDER_CONSTRUCTION.length);
  });
});
