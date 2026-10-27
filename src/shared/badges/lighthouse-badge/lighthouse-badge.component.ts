import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SITE_CONFIG } from '../../config/site.config';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { LighthouseReportService, measuredDay } from './lighthouse-report.service';

/** A live PageSpeed Insights run of the homepage; the Page weight badge links there too. */
export const PSI_URL = `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(`${SITE_CONFIG.url}/`)}`;

/**
 * The 88×31 button with the site's own Lighthouse scores, measured at deploy.
 * Links to a live PageSpeed Insights run. Renders nothing until the report loads, or if there isn't one
 * (see `LighthouseReportService`).
 */
@Component({
  selector: 'app-lighthouse-badge',
  imports: [BadgeComponent],
  templateUrl: './lighthouse-badge.component.html',
  styleUrl: './lighthouse-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LighthouseBadgeComponent {
  readonly psiUrl = PSI_URL;
  readonly report = inject(LighthouseReportService).report;

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

  readonly measured = computed(() => measuredDay(this.report()));

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
