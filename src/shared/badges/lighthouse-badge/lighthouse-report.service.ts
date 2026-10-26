import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { ApiCacheService } from '../../services/api-cache.service';

/** What the deploy job writes (`scripts/write-lighthouse-badge.mjs`): the homepage, as a phone. */
export interface LighthouseReport {
  scores: { performance: number; accessibility: number; bestPractices: number; seo: number };
  /** In KB, with the ceilings `lighthouserc.cjs` holds every page to. Absent in older reports. */
  weight?: { total: number; script: number; totalCeiling: number; scriptCeiling: number };
  measuredAt: string;
}

export const LIGHTHOUSE_REPORT_URL = '/lighthouse.json';
const REPORT_TTL_MS = 60 * 60 * 1000;

const isScore = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 100;
const isKb = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

export function isReport(value: unknown): value is LighthouseReport {
  const report = value as LighthouseReport | null;
  return !!report?.scores && Object.values(report.scores).every(isScore) && Object.keys(report.scores).length === 4
    && !Number.isNaN(Date.parse(report.measuredAt));
}

export function hasWeight(report: LighthouseReport | null): report is LighthouseReport & Required<Pick<LighthouseReport, 'weight'>> {
  const weight = report?.weight;
  return !!weight && [weight.total, weight.script, weight.totalCeiling, weight.scriptCeiling].every(isKb);
}

/**
 * The deploy's Lighthouse report, fetched once for both badges that read it (Lighthouse and Page weight).
 * Null until it loads, and when there isn't one: `public/lighthouse.json` is a placeholder the deploy
 * overwrites, so local dev, PR checks and a deploy whose measurement failed all get null.
 */
@Injectable({ providedIn: 'root' })
export class LighthouseReportService {
  private readonly api = inject(ApiCacheService);

  readonly report = toSignal(
    this.api.get<unknown>(LIGHTHOUSE_REPORT_URL, REPORT_TTL_MS).pipe(
      map(value => (isReport(value) ? value : null)),
      catchError(() => of(null)),
    ),
    { initialValue: null },
  );
}

/** "Oct 26", for the popovers. */
export function measuredDay(report: LighthouseReport | null): string {
  return report ? new Date(report.measuredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
}
