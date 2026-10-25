import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, filter, fromEvent, map, merge, of, startWith, switchMap, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SITE_CONFIG } from '../config/site.config';
import { StatsFmService, StatsFmTrack } from './stats-fm.service';
import { relativeTime } from './relative-time';

export interface LastListened {
  trackName: string;
  artistName: string;
  imageUrl: string | null;
  trackUrl: string;
  /** True when stats.fm reports the track as playing right now. */
  isPlaying: boolean;
  /** When the stream ended (or, if playing, when it started), epoch ms. */
  at: number;
}

/** How often to ask stats.fm again while the tab is visible. */
export const POLL_INTERVAL_MS = 90_000;
/** Recent-streams responses are cached for less than the poll interval, so each poll really refetches. */
const RECENT_TTL_MS = 60_000;
/** How often the "N minutes ago" label is recomputed. */
const CLOCK_TICK_MS = 30_000;

/**
 * The one thing Morgan listened to most recently, kept fresh for everyone
 * who shows it (greeting subtitle, Music card, /now).
 *
 * Polls stats.fm every POLL_INTERVAL_MS, and again whenever the tab becomes
 * visible; pauses entirely while it's hidden. Tries the "currently playing"
 * endpoint first (so "right now" is actually true) and falls back to the
 * most recent finished stream. Any error or empty answer yields null, and
 * nothing renders.
 */
@Injectable({ providedIn: 'root' })
export class RecentStreamService {
  private readonly statsFm = inject(StatsFmService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly latest = signal<LastListened | null>(null);
  private readonly now = signal(Date.now());

  /** The latest stream, or null when unknown. */
  readonly lastListened = this.latest.asReadonly();

  /** "just now", "12 minutes ago", … for the latest stream. */
  readonly when = computed(() => {
    const item = this.latest();
    return item ? relativeTime(item.at, this.now()) : null;
  });

  /** One line for compact placements: "listening to X by Y right now" / "last listened: X by Y · 12 minutes ago". */
  readonly summary = computed(() => {
    const item = this.latest();
    if (!item) return null;
    return item.isPlaying
      ? `listening to ${item.trackName} by ${item.artistName} right now`
      : `last listened: ${item.trackName} by ${item.artistName} · ${this.when()}`;
  });

  constructor() {
    if (!this.isBrowser) return;

    const visible$ = fromEvent(document, 'visibilitychange').pipe(
      startWith(null),
      map(() => document.visibilityState === 'visible'),
    );

    visible$.pipe(
      switchMap(visible => visible ? timer(0, POLL_INTERVAL_MS) : of()),
      switchMap(() => this.fetch()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(item => {
      this.now.set(Date.now());
      this.latest.set(item);
    });

    merge(visible$, timer(CLOCK_TICK_MS, CLOCK_TICK_MS)).pipe(
      filter(() => document.visibilityState === 'visible'),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.now.set(Date.now()));
  }

  private fetch() {
    const user = SITE_CONFIG.handles.statsFm;
    return this.statsFm.getCurrentStream(user).pipe(
      catchError(() => of(null)),
      switchMap(current => {
        if (current?.isPlaying && current.track) {
          return of(toLastListened(current.track, Date.parse(current.date) || Date.now(), true));
        }
        return this.statsFm.getRecentStreams(user, 1, RECENT_TTL_MS).pipe(
          map(items => {
            const stream = items[0];
            return stream?.track ? toLastListened(stream.track, Date.parse(stream.endTime), false) : null;
          }),
          catchError(() => of(null)),
        );
      }),
    );
  }
}

function toLastListened(track: StatsFmTrack, at: number, isPlaying: boolean): LastListened {
  return {
    trackName: track.name,
    artistName: track.artists?.[0]?.name ?? 'Unknown artist',
    imageUrl: track.albums?.[0]?.image ?? null,
    trackUrl: `https://stats.fm/track/${track.id}`,
    isPlaying,
    at: Number.isFinite(at) ? at : Date.now(),
  };
}
