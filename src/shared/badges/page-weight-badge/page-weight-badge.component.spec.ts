import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { ApiCacheService } from '../../services/api-cache.service';
import { PageWeightBadgeComponent, gauge } from './page-weight-badge.component';
import { LIGHTHOUSE_REPORT_URL } from '../lighthouse-badge/lighthouse-report.service';

describe('PageWeightBadgeComponent', () => {
  // PR #90's phone run of the homepage, with today's ceilings.
  const report = {
    scores: { performance: 97, accessibility: 100, bestPractices: 100, seo: 100 },
    weight: { total: 381, script: 246, totalCeiling: 1400, scriptCeiling: 750 },
    measuredAt: '2026-10-26T20:00:00Z',
  };

  async function render(response: Observable<unknown>) {
    const get = vi.fn((url: string, ttl: number) => { void url; void ttl; return response; });
    TestBed.configureTestingModule({ providers: [{ provide: ApiCacheService, useValue: { get } }] });
    const fixture = TestBed.createComponent(PageWeightBadgeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { get, el, badge: el.querySelector('a.badge') };
  }

  it('shows the homepage weight from the same report as the Lighthouse badge', async () => {
    const { get, el, badge } = await render(of(report));
    expect(get).toHaveBeenCalledWith(LIGHTHOUSE_REPORT_URL, expect.any(Number));
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('381 KB');
    expect(badge?.getAttribute('aria-label')).toBe(
      "Page weight: this site's homepage weighs 381 KB on a phone, 246 KB of it JavaScript, against a 1,400 KB ceiling; measured Oct 26. " +
      'Opens a live PageSpeed Insights run in a new tab.',
    );
    expect(el.querySelector('.popover')?.textContent).toContain('246 / 750 KB');
  });

  it('hides for a report without weights (older deploys), with broken weights, or with no report at all', async () => {
    const { weight: _, ...older } = report;
    void _;
    expect((await render(of(older))).badge).toBeNull();
    TestBed.resetTestingModule();
    expect((await render(of({ ...report, weight: { ...report.weight, total: -1 } }))).badge).toBeNull();
    TestBed.resetTestingModule();
    expect((await render(throwError(() => new Error('404')))).badge).toBeNull();
  });

  it('points the gauge at the real ratio, pinned to the dial', () => {
    expect(gauge(0).needleEnd).toBe('5 16');
    expect(gauge(0.5).needleEnd).toBe('12 9');
    expect(gauge(1).needleEnd).toBe('19 16');
    expect(gauge(3).arcEnd).toBe('20 16');
    expect(gauge(-1).arcEnd).toBe('4 16');
  });
});
