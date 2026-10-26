import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { LighthouseReportService, hasWeight, measuredDay } from '../lighthouse-badge/lighthouse-report.service';
import { PSI_URL } from '../lighthouse-badge/lighthouse-badge.component';

/** Where the gauge's needle points for a page `ratio` of the way to its ceiling (0 left, 1 right). */
export function gauge(ratio: number, cx = 12, cy = 16): { arcEnd: string; needleEnd: string } {
  const r = Math.min(Math.max(ratio, 0), 1);
  const angle = Math.PI * (1 - r);
  const point = (radius: number) => `${+(cx + radius * Math.cos(angle)).toFixed(2)} ${+(cy - radius * Math.sin(angle)).toFixed(2)}`;
  return { arcEnd: point(8), needleEnd: point(7) };
}

/**
 * How much the homepage weighs on a phone, from the same deploy-time Lighthouse run as the Lighthouse
 * badge, against the ceiling Lighthouse CI holds every page to. The glyph is a gauge with the real ratio.
 */
@Component({
  selector: 'app-page-weight-badge',
  imports: [BadgeComponent],
  templateUrl: './page-weight-badge.component.html',
  styleUrl: './page-weight-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageWeightBadgeComponent {
  private readonly report = inject(LighthouseReportService).report;
  readonly href = PSI_URL;

  readonly weight = computed(() => {
    const report = this.report();
    if (!hasWeight(report)) return null;
    const { total, script, totalCeiling, scriptCeiling } = report.weight;
    const fmt = (kb: number) => kb.toLocaleString('en-US');
    const day = measuredDay(report);
    return {
      value: `${fmt(total)} KB`,
      gauge: gauge(total / totalCeiling),
      popover: {
        title: 'Homepage, on a phone',
        rows: [
          { label: 'Weight', value: `${fmt(total)} KB` },
          { label: 'Ceiling', value: `${fmt(totalCeiling)} KB` },
          { label: 'JavaScript', value: `${fmt(script)} / ${fmt(scriptCeiling)} KB` },
        ],
        note: `measured at deploy · ${day}`,
        cta: 'check my homework ↗',
      } satisfies BadgePopover,
      label: `This site's homepage weighs ${fmt(total)} KB on a phone, ${fmt(script)} KB of it JavaScript, ` +
        `against a ${fmt(totalCeiling)} KB ceiling; measured ${day}. Opens a live PageSpeed Insights run in a new tab.`,
    };
  });
}
