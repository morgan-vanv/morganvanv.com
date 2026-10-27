import { TestBed } from '@angular/core/testing';
import { NoCookiesBadgeComponent } from './no-cookies-badge.component';

describe('NoCookiesBadgeComponent', () => {
  it('says so on its face and in full, and points at humans.txt', async () => {
    const fixture = TestBed.createComponent(NoCookiesBadgeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const badge = el.querySelector('a.badge');
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('no trackers');
    expect(badge?.getAttribute('aria-label')).toMatch(/^No cookies, no analytics and no trackers/);
    expect(badge?.getAttribute('href')).toBe('/humans.txt');
  });
});
