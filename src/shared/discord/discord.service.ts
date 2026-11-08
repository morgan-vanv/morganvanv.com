import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EMPTY, catchError, fromEvent, interval, map, of, startWith, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SITE_CONFIG } from '../config/site.config';
import { ApiCacheService } from '../services/api-cache.service';
import { DISCORD_POLL_MS, DiscordSummary, toDiscordSummary } from './discord';

/**
 * Morgan's Discord server, kept fresh while a page showing it is open (`/social`'s panel, `/now`'s
 * "Hanging out" row): asked at once, then every DISCORD_POLL_MS while the tab is visible, and again
 * whenever it becomes visible; paused while it's hidden (the `LabStatusService` pattern). Provided by
 * each page, so it stops when the page goes. The feed is never cached in the browser (it lists people
 * by name); only the summary, counts and game names, is kept, in memory. Null until a good answer
 * arrives, or if Discord doesn't give one: then nothing shows.
 */
@Injectable()
export class DiscordService {
  private readonly api = inject(ApiCacheService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly latest = signal<DiscordSummary | null>(null);

  /** The last good summary, or null. */
  readonly summary = this.latest.asReadonly();

  constructor() {
    if (!this.isBrowser) return;

    const visible$ = fromEvent(document, 'visibilitychange').pipe(
      startWith(null),
      map(() => document.visibilityState === 'visible'),
    );

    // Hiding the tab cancels the chain, a request in flight included. A failed poll keeps the last good
    // summary rather than blanking what's on screen.
    visible$.pipe(
      switchMap(visible => visible
        ? interval(DISCORD_POLL_MS).pipe(
          startWith(0),
          switchMap(() => this.api.get<unknown>(SITE_CONFIG.discord.widgetUrl, 0).pipe(
            map(toDiscordSummary),
            catchError(() => of(null)),
          )),
        )
        : EMPTY),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(summary => {
      if (summary) this.latest.set(summary);
    });
  }
}
