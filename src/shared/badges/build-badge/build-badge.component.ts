import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { cachedJson } from '../../services/cached-json';
import { SITE_CONFIG } from '../../config/site.config';
import { BUILD_INFO } from '../../../build-info';

/** What the deploy job writes (`scripts/write-site-status.mjs`): what built the page you're looking at. */
export interface SiteStatus {
  /** `number`: how many commits master's history holds up to this one. */
  commit: { sha: string; number: number };
  pr?: { number: number; url: string; checks: { name: string; ok: boolean }[] };
  tests?: { passed: number; total: number; lines?: number };
  deploys?: { lastFailureAt: string | null };
  measuredAt: string;
}

export const SITE_STATUS_URL = '/site-status.json';
const STATUS_TTL_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** The commit is the one thing it can't do without; the rest are dropped if they don't look right. */
export function toStatus(value: unknown): SiteStatus | null {
  const status = value as SiteStatus | null;
  const commit = status?.commit;
  if (!commit || typeof commit.sha !== 'string' || !/^[0-9a-f]{7,40}$/.test(commit.sha) || !isCount(commit.number) || commit.number < 1) {
    return null;
  }
  const pr = status.pr;
  const tests = status.tests;
  const deploys = status.deploys;
  return {
    commit,
    measuredAt: status.measuredAt,
    ...(pr && isCount(pr.number) && typeof pr.url === 'string' && Array.isArray(pr.checks) ? {
      pr: { ...pr, checks: pr.checks.filter(c => typeof c?.name === 'string' && typeof c?.ok === 'boolean') },
    } : {}),
    ...(tests && isCount(tests.passed) && isCount(tests.total) ? { tests } : {}),
    ...(deploys && (deploys.lastFailureAt === null || typeof deploys.lastFailureAt === 'string') ? { deploys } : {}),
  };
}

/** "250 days ago", counted from now (the file was written at deploy, the visitor reads it later). */
export function daysAgo(iso: string, now = Date.now()): string {
  const days = Math.floor((now - Date.parse(iso)) / DAY_MS);
  if (Number.isNaN(days)) return '';
  if (days <= 0) return 'today';
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/**
 * Build: the commit this page was built from (its number on master), and how the pull request that
 * merged it fared: one LED per check, tests and coverage, and the days since a deploy last failed.
 * All looked up once at deploy, so it costs the visitor one small same-origin request.
 */
@Component({
  selector: 'app-build-badge',
  imports: [BadgeComponent],
  templateUrl: './build-badge.component.html',
  styleUrl: './build-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildBadgeComponent {
  private readonly status = cachedJson(SITE_STATUS_URL, STATUS_TTL_MS, toStatus);

  readonly build = computed(() => {
    const status = this.status();
    // site-status.json is cached for an hour; after a deploy it can describe a build this page isn't.
    // (Development builds carry an all-zero placeholder sha, which matches nothing; skip the check there.)
    if (!status || (!/^0*$/.test(BUILD_INFO.sha) && status.commit.sha !== BUILD_INFO.sha)) return null;
    const { commit, pr, tests, deploys } = status;
    const checks = pr?.checks ?? [];
    const passed = checks.filter(c => c.ok).length;
    const sha = commit.sha.slice(0, 7);
    const lastFailure = deploys ? (deploys.lastFailureAt ? daysAgo(deploys.lastFailureAt) : 'none on record') : null;

    // Checks two or three to a row: "Lint · Build · Test  ✓ ✓ ✓".
    const checkRows = [];
    for (let i = 0; i < checks.length; i += 3) {
      const group = checks.slice(i, i + 3);
      checkRows.push({ label: group.map(c => c.name).join(' · '), value: group.map(c => (c.ok ? '✓' : '✕')).join(' ') });
    }
    const coverage = typeof tests?.lines === 'number' ? ` · ${tests.lines.toFixed(1)}% lines` : '';

    return {
      value: checks.length ? [`#${commit.number}`, `${passed}/${checks.length}`] : [`#${commit.number}`],
      leds: checks.slice(0, 5).map((check, i, all) => ({ ok: check.ok, cy: 12 + (i - (all.length - 1) / 2) * 4.6 })),
      href: pr?.url ?? `${SITE_CONFIG.repoUrl}/commit/${commit.sha}`,
      popover: {
        title: pr ? `Commit #${commit.number}, built by PR #${pr.number}` : `Commit #${commit.number}`,
        rows: [
          ...checkRows,
          ...(tests ? [{ label: 'Tests', value: `${tests.passed}/${tests.total}${coverage}` }] : []),
          ...(lastFailure ? [{ label: 'Last failed deploy', value: lastFailure }] : []),
        ],
        note: `${sha} · checked at deploy`,
        cta: pr ? 'see the PR ↗' : 'see the commit ↗',
      } satisfies BadgePopover,
      label: `Build: this page is commit ${commit.number}, ${sha}` +
        (pr ? `, built by pull request ${pr.number}` : '') +
        (checks.length ? `: ${passed} of ${checks.length} checks passed (${checks.map(c => `${c.name} ${c.ok ? 'passed' : 'failed'}`).join(', ')})` : '') +
        (tests ? `; ${tests.passed} of ${tests.total} tests passed${typeof tests.lines === 'number' ? `, ${tests.lines.toFixed(1)}% of lines covered` : ''}` : '') +
        (lastFailure ? `; last failed deploy: ${lastFailure}` : '') +
        `. Opens the ${pr ? 'pull request' : 'commit'} on GitHub in a new tab.`,
    };
  });
}
