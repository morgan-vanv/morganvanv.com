import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { LighthouseBadgeComponent, LIGHTHOUSE_REPORT_URL } from './lighthouse-badge.component';
import { ApiCacheService } from '../services/api-cache.service';

describe('LighthouseBadgeComponent', () => {
  const report = {
    scores: { performance: 99, accessibility: 100, bestPractices: 96, seo: 100 },
    measuredAt: '2026-10-26T20:00:00Z',
  };

  async function render(response: Observable<unknown>) {
    const get = vi.fn(() => response);
    TestBed.configureTestingModule({
      imports: [LighthouseBadgeComponent],
      providers: [{ provide: ApiCacheService, useValue: { get } }],
    });
    const fixture = TestBed.createComponent(LighthouseBadgeComponent);
    await fixture.whenStable();
    return { el: fixture.nativeElement as HTMLElement, get };
  }

  it('shows the four scores and links to a live PageSpeed Insights run', async () => {
    const { el, get } = await render(of(report));
    expect(get).toHaveBeenCalledWith(LIGHTHOUSE_REPORT_URL, expect.any(Number));

    const link = el.querySelector('a.badge');
    expect(link?.getAttribute('href')).toBe('https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fmorganvanv.com%2F');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect([...el.querySelectorAll('.scores span')].map(span => span.textContent?.trim())).toEqual(['99', '100', '96', '100']);
  });

  it('says everything in its accessible name, since the visible text is tiny', async () => {
    const { el } = await render(of(report));
    const label = el.querySelector('a.badge')?.getAttribute('aria-label') ?? '';
    expect(label).toContain('performance 99');
    expect(label).toContain('best practices 96');
    expect(label).toContain('seo 100');
    expect(label).toContain('Oct 26');
    expect(el.querySelector('.popover')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders nothing when there is no report (local dev, or a failed measurement)', async () => {
    const { el } = await render(throwError(() => new Error('404')));
    expect(el.querySelector('a')).toBeNull();
  });

  it('renders nothing for a malformed report', async () => {
    const { el } = await render(of({ scores: { performance: 'fast' }, measuredAt: 'whenever' }));
    expect(el.querySelector('a')).toBeNull();
  });
});
