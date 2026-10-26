import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { ApiCacheService } from '../../services/api-cache.service';
import { SITE_CONFIG } from '../../config/site.config';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';

/** What the deploy job writes (`scripts/write-lighthouse-badge.mjs`): the homepage, as a phone. */
export interface LighthouseReport {
  scores: { performance: number; accessibility: number; bestPractices: number; seo: number };
  measuredAt: string;
}

export const LIGHTHOUSE_REPORT_URL = '/lighthouse.json';
const REPORT_TTL_MS = 60 * 60 * 1000;

const isScore = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 100;
const isReport = (value: unknown): value is LighthouseReport => {
  const report = value as LighthouseReport | null;
  return !!report?.scores && Object.values(report.scores).every(isScore) && Object.keys(report.scores).length === 4
    && !Number.isNaN(Date.parse(report.measuredAt));
};

/**
 * The 88×31 button with the site's own Lighthouse scores, measured at deploy.
 * Links to a live PageSpeed Insights run. Renders nothing until the report loads, or if there isn't one:
 * `public/lighthouse.json` is a placeholder the deploy overwrites, so local dev, PR checks and a deploy
 * whose measurement failed all show nothing (and log no 404).
 */
@Component({
  selector: 'app-lighthouse-badge',
  imports: [BadgeComponent],
  templateUrl: './lighthouse-badge.component.html',
  styleUrl: './lighthouse-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LighthouseBadgeComponent {
  private readonly api = inject(ApiCacheService);

  readonly psiUrl = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(`${SITE_CONFIG.url}/`)}`;

  readonly report = toSignal(
    this.api.get<unknown>(LIGHTHOUSE_REPORT_URL, REPORT_TTL_MS).pipe(
      map(value => (isReport(value) ? value : null)),
      catchError(() => of(null)),
    ),
    { initialValue: null },
  );

  readonly rows = computed(() => {
    const scores = this.report()?.scores;
    if (!scores) return [];
    return [
      { key: 'performance', label: 'Performance', value: scores.performance },
      { key: 'accessibility', label: 'Accessibility', value: scores.accessibility },
      { key: 'best-practices', label: 'Best practices', value: scores.bestPractices },
      { key: 'seo', label: 'SEO', value: scores.seo },
    ];
  });

  readonly measured = computed(() => {
    const at = this.report()?.measuredAt;
    return at ? new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  });

  readonly scores = computed(() => this.rows().map(row => String(row.value)));

  readonly popover = computed<BadgePopover>(() => ({
    title: 'Homepage, on a phone',
    rows: this.rows().map(row => ({ label: row.label, value: String(row.value) })),
    note: `measured at deploy · ${this.measured()}`,
    cta: 'check my homework ↗',
  }));

  readonly label = computed(() =>
    `Lighthouse scores for this site's homepage on a phone, measured ${this.measured()}: ` +
    this.rows().map(row => `${row.label.toLowerCase()} ${row.value}`).join(', ') +
    '. Opens a live PageSpeed Insights run in a new tab.',
  );
}
