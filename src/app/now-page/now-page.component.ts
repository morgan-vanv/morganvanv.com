import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { catchError, map, of } from 'rxjs';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { RecentStreamService } from '../../shared/services/recent-stream.service';
import { RuneProfileService, RpActivity } from '../../shared/services/rune-profile.service';
import { relativeTime } from '../../shared/services/relative-time';
import { ACHIEVEMENT_ACTIVITY_TYPES, DROP_ACTIVITY_TYPES, WOM_USERNAME } from '../../shared/constants/osrs-stats.const';
import { COMMUNITY_PHOTOS } from '../../shared/constants/community-photos.const';
import { SITE_CONFIG } from '../../shared/config/site.config';
import { achievementIcon, achievementLabel, dropIcon, dropLabel } from '../interests-page/osrs-stats/osrs-format';
import { BUILD_INFO } from '../../build-info';
import { NOW_CONTENT_TOKEN } from './now.content';
import { PROJECTS } from '../../shared/constants/projects.const';
import { ProjectCardComponent } from '../../shared/project-card/project-card.component';
import { LighthouseBadgeComponent } from '../../shared/badges/lighthouse-badge/lighthouse-badge.component';
import { MoonBadgeComponent } from '../../shared/badges/moon-badge/moon-badge.component';
import { PlanetsBadgeComponent } from '../../shared/badges/planets-badge/planets-badge.component';
import { WeatherBadgeComponent } from '../../shared/badges/weather-badge/weather-badge.component';
import { AngularBadgeComponent } from '../../shared/badges/angular-badge/angular-badge.component';
import { PageWeightBadgeComponent } from '../../shared/badges/page-weight-badge/page-weight-badge.component';
import { BuildBadgeComponent } from '../../shared/badges/build-badge/build-badge.component';
import { NoCookiesBadgeComponent } from '../../shared/badges/no-cookies-badge/no-cookies-badge.component';
import { OwnButtonBadgeComponent } from '../../shared/badges/own-button-badge/own-button-badge.component';
import { LetterboxdService } from '../../shared/letterboxd/letterboxd.service';
import { watchedWhen } from '../../shared/letterboxd/letterboxd';
import { StarsComponent } from '../../shared/stars/stars.component';

export interface NowRow {
  key: string;
  label: string;
  iconUrl: string | null;
  /** Photos and album art are cropped to fill; game icons are drawn pixelated. */
  iconStyle: 'cover' | 'pixel';
  /** Shown in place of the icon when there is none. */
  glyph: string;
  title: string;
  detail?: string;
  /** Gold stars ahead of the detail (Letterboxd's 0.5–5). */
  rating?: number;
  when?: string;
  /** External link, or an in-site path when `internal`. */
  href?: string;
  internal?: boolean;
  live?: boolean;
}

/**
 * Formats a YYYY-MM-DD date, or an ISO timestamp, as "October 25, 2026".
 * Uses the calendar date as written: a commit stamped 2026-10-25T21:33-04:00
 * happened on the 25th where it was made, even though it's the 26th in UTC.
 * Deterministic, so prerendered and hydrated output agree.
 */
export function formatDay(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(value);
  if (!match) return '';
  const date = new Date(`${match[1]}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** How much of a review the Watching row quotes; the rest is a click away on Letterboxd. */
const REVIEW_CLIP = 90;

/** Cuts text to about `max` characters at a word boundary, with an ellipsis. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  // Back up to the end of a word: a space or punctuation right after it.
  let end = max;
  while (end > max * 0.6 && !/[\s.,;:!?]/.test(text[end])) end--;
  if (end <= max * 0.6) end = max;
  return `${text.slice(0, end).replace(/[\s.,;:!?-]+$/, '')}…`;
}

/**
 * The IndieWeb "now page": Morgan's note at the top, then rows that fill in
 * on their own. The note, community and site rows are prerendered; listening
 * and playing arrive in the browser. Rows with no data don't render.
 */
@Component({
  selector: 'app-now-page',
  imports: [BasePageComponent, PageHeaderComponent, RouterLink, NgTemplateOutlet, ProjectCardComponent, StarsComponent,
    WeatherBadgeComponent, MoonBadgeComponent, PlanetsBadgeComponent,
    OwnButtonBadgeComponent, AngularBadgeComponent, NoCookiesBadgeComponent, PageWeightBadgeComponent, LighthouseBadgeComponent, BuildBadgeComponent],
  templateUrl: './now-page.component.html',
  styleUrl: './now-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NowPageComponent {
  private readonly recentStream = inject(RecentStreamService);
  private readonly runeProfile = inject(RuneProfileService);
  private readonly letterboxd = inject(LetterboxdService);

  /** Morgan's note; hidden, along with its date, while it has no paragraphs. */
  private readonly content = inject(NOW_CONTENT_TOKEN);
  readonly note = this.content.paragraphs;
  readonly projects = PROJECTS;
  readonly projectCountLabel = `${PROJECTS.length} ${PROJECTS.length === 1 ? 'project' : 'projects'}`;
  readonly updated = formatDay(this.content.updated);

  private readonly latestAchievement = toSignal(this.latestActivity(ACHIEVEMENT_ACTIVITY_TYPES), { initialValue: null });
  private readonly latestDrop = toSignal(this.latestActivity(DROP_ACTIVITY_TYPES), { initialValue: null });

  private readonly listening = computed<NowRow | null>(() => {
    const item = this.recentStream.lastListened();
    if (!item) return null;
    return {
      key: 'listening', label: 'Listening', iconUrl: item.imageUrl, iconStyle: 'cover', glyph: '♪',
      title: item.trackName, detail: item.artistName,
      when: item.isPlaying ? 'right now' : this.recentStream.when() ?? undefined,
      href: item.trackUrl, live: item.isPlaying,
    };
  });

  private readonly playing = computed<NowRow | null>(() => {
    const achievement = this.latestAchievement();
    const drop = this.latestDrop();
    const latest = achievement ?? drop;
    if (!latest) return null;
    return {
      key: 'playing', label: 'Playing', iconUrl: achievement ? achievementIcon(achievement) : dropIcon(latest), iconStyle: 'pixel', glyph: '⚔',
      title: achievement ? achievementLabel(achievement) : dropLabel(latest),
      detail: achievement && drop ? `Old School RuneScape · latest drop: ${dropLabel(drop)}` : 'Old School RuneScape',
      when: relativeTime(Date.parse(latest.createdAt)) || undefined,
      href: `https://www.runeprofile.com/${WOM_USERNAME}`,
    };
  });

  private readonly watching = computed<NowRow | null>(() => {
    const entry = this.letterboxd.latest();
    if (!entry) return null;
    const review = entry.review && !entry.spoilers ? `“${clip(entry.review.replace(/\s+/g, ' '), REVIEW_CLIP)}”` : null;
    const detail = [entry.year, entry.rewatch ? 'rewatch' : null, entry.liked ? 'liked' : null, review]
      .filter(part => part !== null).join(' · ');
    return {
      key: 'watching', label: 'Watching', iconUrl: null, iconStyle: 'cover', glyph: '▶',
      title: entry.title, detail: detail || undefined, rating: entry.rating ?? undefined,
      when: entry.watched ? watchedWhen(entry.watched) || undefined : undefined,
      href: entry.url,
    };
  });

  private readonly community: NowRow | null = (() => {
    const newest = COMMUNITY_PHOTOS.at(-1);
    if (!newest) return null;
    return {
      key: 'community', label: 'Community', iconUrl: newest.thumbUrl, iconStyle: 'cover', glyph: '✿',
      title: newest.caption ?? 'A new photo',
      detail: 'newest photo on the community wall', href: '/social', internal: true,
    };
  })();

  private readonly site: NowRow | null = BUILD_INFO.sha ? {
    key: 'site', label: 'Site', iconUrl: null, iconStyle: 'pixel', glyph: '</>',
    title: BUILD_INFO.message,
    detail: `last change · ${BUILD_INFO.sha.slice(0, 7)}`,
    when: formatDay(BUILD_INFO.date) || undefined,
    href: `${SITE_CONFIG.repoUrl}/commit/${BUILD_INFO.sha}`,
  } : null;

  readonly rows = computed(() =>
    [this.listening(), this.playing(), this.watching(), this.community, this.site].filter((row): row is NowRow => row !== null)
  );

  private latestActivity(types: readonly RpActivity['type'][]) {
    return this.runeProfile.getActivities(WOM_USERNAME, types).pipe(
      map(response => response.activities?.[0] ?? null),
      catchError(() => of(null)),
    );
  }
}
