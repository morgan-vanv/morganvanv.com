import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { ApiCacheService } from '../../services/api-cache.service';
import { BuildBadgeComponent, SITE_STATUS_URL, SiteStatus, daysAgo, toStatus } from './build-badge.component';

describe('BuildBadgeComponent', () => {
  const status: SiteStatus = {
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

  async function render(response: Observable<unknown>) {
    const get = vi.fn((url: string, ttl: number) => { void url; void ttl; return response; });
    TestBed.configureTestingModule({ providers: [{ provide: ApiCacheService, useValue: { get } }] });
    const fixture = TestBed.createComponent(BuildBadgeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const values = () => [...el.querySelectorAll('.value span')].map(s => s.textContent?.trim());
    return { get, el, values, badge: el.querySelector('a.badge') };
  }

  it('shows the commit number and the checks, and links to the PR that built it', async () => {
    const { get, el, values, badge } = await render(of(status));
    expect(get).toHaveBeenCalledWith(SITE_STATUS_URL, expect.any(Number));
    expect(values()).toEqual(['#371', '5/5']);
    expect(el.querySelectorAll('svg circle.g-gold').length).toBe(5);
    expect(badge?.getAttribute('href')).toBe('https://github.com/morgan-vanv/morganvanv.com/pull/90');
    const label = badge?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Build: this page is commit 371, 7da0685, built by pull request 90: 5 of 5 checks passed');
    expect(label).toContain('206 of 206 tests passed, 89.6% of lines covered');
    const popover = el.querySelector('.popover')?.textContent ?? '';
    expect(popover).toContain('Lint · Build · Test');
    expect(popover).toContain('Lighthouse · CodeQL');
    expect(popover).toContain('206/206 · 89.6% lines');
  });

  it('shows a failed check as an LED that is out', async () => {
    const failed = { ...status, pr: { ...status.pr!, checks: [{ name: 'Lint', ok: true }, { name: 'Build', ok: false }] } };
    const { el, values } = await render(of(failed));
    expect(values()).toEqual(['#371', '1/2']);
    expect(el.querySelectorAll('svg circle.led-off').length).toBe(1);
    expect(el.querySelector('a.badge')?.getAttribute('aria-label')).toContain('Build failed');
    expect(el.querySelector('.popover')?.textContent).toContain('✓ ✕');
  });

  it('fits an LED for each of six checks', async () => {
    const six = { ...status, pr: { ...status.pr!, checks: [...status.pr!.checks, { name: 'Layout', ok: true }] } };
    const { el, values } = await render(of(six));
    expect(values()).toEqual(['#371', '6/6']);
    const cys = [...el.querySelectorAll('svg circle.g-gold')].map(c => Number(c.getAttribute('cy')));
    expect(cys.length).toBe(6);
    expect(Math.min(...cys) - 1.7).toBeGreaterThanOrEqual(0);
    expect(Math.max(...cys) + 1.7).toBeLessThanOrEqual(24);
  });

  it('gets by on the commit alone: a commit glyph, a link to the commit, no rows it has no data for', async () => {
    const { el, values, badge } = await render(of({ commit: status.commit, measuredAt: status.measuredAt }));
    expect(values()).toEqual(['#371']);
    expect(el.querySelector('svg circle.g-line-gold')).not.toBeNull();
    expect(badge?.getAttribute('href')).toBe(`https://github.com/morgan-vanv/morganvanv.com/commit/${status.commit.sha}`);
    expect(el.querySelector('.popover-cta')?.textContent).toBe('see the commit ↗');
    expect(el.querySelectorAll('.popover-row').length).toBe(0);
  });

  it('says so when no deploy has ever failed', async () => {
    const { el } = await render(of({ ...status, deploys: { lastFailureAt: null } }));
    expect(el.querySelector('.popover')?.textContent).toContain('none on record');
  });

  it('hides for the placeholder', async () => {
    expect((await render(of({ note: 'Placeholder' }))).badge).toBeNull();
  });
});

describe('toStatus', () => {
  const commit = { sha: '7da0685', number: 371 };

  it('needs a real commit', () => {
    expect(toStatus(null)).toBeNull();
    expect(toStatus({ commit: { sha: 'not-a-sha', number: 3 } })).toBeNull();
    expect(toStatus({ commit: { sha: '7da0685', number: 0 } })).toBeNull();
    expect(toStatus({ commit })).toEqual({ commit, measuredAt: undefined });
  });

  it('drops parts that do not look right, and checks that are not checks', () => {
    const status = toStatus({
      commit,
      pr: { number: 90, url: 'https://example.com/90', checks: [{ name: 'Lint', ok: true }, { name: 'Odd' }] },
      tests: { passed: 'lots', total: 3 },
      deploys: { lastFailureAt: 5 },
    });
    expect(status?.pr?.checks).toEqual([{ name: 'Lint', ok: true }]);
    expect(status?.tests).toBeUndefined();
    expect(status?.deploys).toBeUndefined();
    expect(toStatus({ commit, pr: { number: 'x' } })?.pr).toBeUndefined();
  });
});

describe('daysAgo', () => {
  it('counts from now, not from the deploy', () => {
    const now = Date.parse('2026-10-26T23:00:00Z');
    expect(daysAgo('2026-02-18T03:47:00Z', now)).toBe('250 days ago');
    expect(daysAgo('2026-10-25T20:00:00Z', now)).toBe('yesterday');
    expect(daysAgo('2026-10-26T20:00:00Z', now)).toBe('today');
    expect(daysAgo('whenever', now)).toBe('');
  });
});
