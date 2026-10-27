import { VERSION } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AngularBadgeComponent } from './angular-badge.component';
import { SITE_CONFIG } from '../../config/site.config';

describe('AngularBadgeComponent', () => {
  it('reads the version from Angular itself, so ng update keeps it honest', async () => {
    const fixture = TestBed.createComponent(AngularBadgeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const badge = el.querySelector('a.badge');
    expect(el.querySelector('.value')?.textContent?.trim()).toBe(`Angular ${VERSION.major}`);
    expect(badge?.getAttribute('aria-label')?.startsWith(`Made with Angular ${VERSION.full},`)).toBe(true);
    expect(badge?.getAttribute('href')).toBe(SITE_CONFIG.repoUrl);
  });
});
