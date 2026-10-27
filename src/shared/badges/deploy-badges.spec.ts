import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { ApiCacheService } from '../services/api-cache.service';
import { PageWeightBadgeComponent, gauge } from './page-weight-badge/page-weight-badge.component';
import { BuildBadgeComponent, SITE_STATUS_URL, daysAgo, toStatus } from './build-badge/build-badge.component';
import { LIGHTHOUSE_REPORT_URL } from './lighthouse-badge/lighthouse-report.service';

async function render<T>(component: Type<T>, response: Observable<unknown>) {
  const get = vi.fn((url: string, ttl: number) => { void url; void ttl; return response; });
  TestBed.configureTestingModule({ imports: [component], providers: [{ provide: ApiCacheService, useValue: { get } }] });
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return { get, el, badge: el.querySelector('a.badge') };
}

describe('the Page weight badge', () => {
  // PR #90's phone run of the homepage, with today's ceilings.
  const report = {
    scores: { performance: 97, accessibility: 100, bestPractices: 100, seo: 100 },
    weight: { total: 381, script: 246, totalCeiling: 1400, scriptCeiling: 750 },
    measuredAt: '2026-10-26T20:00:00Z',
  };

  it('shows the homepage weight from the same report as the Lighthouse badge', async () => {
    const { get, el, badge } = await render(PageWeightBadgeComponent, of(report));
    expect(get).toHaveBeenCalledWith(LIGHTHOUSE_REPORT_URL, expect.any(Number));
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('381 KB');
    expect(badge?.getAttribute('aria-label')).toBe(
      "Page weight: this site's homepage weighs 381 KB on a phone, 246 KB of it JavaScript, against a 1,400 KB ceiling; measured Oct 26. " +
      'Opens a live PageSpeed Insights run in a new tab.',
    );
    expect(el.querySelector('.popover')?.textContent).toContain('246 / 750 KB');
  });

  it('hides for a report without weights (older deploys) or no report at all', async () => {
    const { weight: _, ...older } = report;
    void _;
    expect((await render(PageWeightBadgeComponent, of(older))).badge).toBeNull();
    TestBed.resetTestingModule();
    expect((await render(PageWeightBadgeComponent, throwError(() => new Error('404')))).badge).toBeNull();
  });

  it('points the gauge at the real ratio', () => {
    expect(gauge(0).needleEnd).toBe('5 16');
    expect(gauge(1).needleEnd).toBe('19 16');
    expect(gauge(0.5).needleEnd).toBe('12 9');
    expect(gauge(3).arcEnd).toBe('20 16');
  });
});

describe('the Build badge', () => {
  const status = {
    commit: { sha: '7da0685a1b2c3d4e5f60718293a4b5c6d7e8f901', number: 371 },
    pr: {
      number: 90,
      url: 'https://github.com/morgan-vanv/morganvanv.com/pull/90',
      checks: [
        { name: 'Lint', ok: true }, { name: 'Build', ok: true }, { name: 'Test', ok: true },
        { name: 'Lighthouse', ok: true }, { name: 'CodeQL', ok: true },
      ],
    },
    tests: { passed: 206, total: 206, lines: 89.63 },
    deploys: { lastFailureAt: '2026-02-18T03:47:00Z' },
    measuredAt: '2026-10-26T20:00:00Z',
  };

  it('shows the commit number and the checks, and links to the PR that built it', async () => {
    const { get, el, badge } = await render(BuildBadgeComponent, of(status));
    expect(get).toHaveBeenCalledWith(SITE_STATUS_URL, expect.any(Number));
    expect([...el.querySelectorAll('.value span')].map(s => s.textContent?.trim())).toEqual(['#371', '5/5']);
    expect(el.querySelectorAll('svg circle.g-gold').length).toBe(5);
    expect(badge?.getAttribute('href')).toBe('https://github.com/morgan-vanv/morganvanv.com/pull/90');
    const label = badge?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Build: this page is commit 371, 7da0685, built by pull request 90: 5 of 5 checks passed');
    expect(label).toContain('206 of 206 tests passed, 89.6% of lines covered');
    expect(el.querySelector('.popover')?.textContent).toContain('Lint · Build · Test');
  });

  it('shows a failed check as an LED that is out', async () => {
    const failed = { ...status, pr: { ...status.pr, checks: [{ name: 'Lint', ok: true }, { name: 'Build', ok: false }] } };
    const { el } = await render(BuildBadgeComponent, of(failed));
    expect([...el.querySelectorAll('.value span')].map(s => s.textContent?.trim())).toEqual(['#371', '1/2']);
    expect(el.querySelectorAll('svg circle.led-off').length).toBe(1);
    expect(el.querySelector('a.badge')?.getAttribute('aria-label')).toContain('Build failed');
  });

  it('gets by on the commit alone, and hides without one', async () => {
    const bare = toStatus({ commit: status.commit, measuredAt: status.measuredAt, pr: { number: 'x' } });
    expect(bare?.pr).toBeUndefined();
    expect(toStatus({ note: 'Placeholder' })).toBeNull();
    expect(toStatus({ commit: { sha: 'not-a-sha', number: 3 } })).toBeNull();
    const { badge } = await render(BuildBadgeComponent, of({ note: 'Placeholder' }));
    expect(badge).toBeNull();
  });

  it('counts days since the last failed deploy from now, not from the deploy', () => {
    const now = Date.parse('2026-10-26T23:00:00Z');
    expect(daysAgo('2026-02-18T03:47:00Z', now)).toBe('250 days ago');
    expect(daysAgo('2026-10-25T20:00:00Z', now)).toBe('yesterday');
    expect(daysAgo('2026-10-26T20:00:00Z', now)).toBe('today');
    expect(daysAgo('whenever', now)).toBe('');
  });
});
