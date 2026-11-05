import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { EMPTY, catchError, filter, fromEvent, interval, map, merge, of, startWith, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SITE_CONFIG } from '../../shared/config/site.config';
import { ApiCacheService } from '../../shared/services/api-cache.service';
import { relativeTime } from '../../shared/services/relative-time';
import { LabStatusId } from '../../shared/constants/lab.const';
import { LAB_STATUS_POLL_MS, LabStatus, toLabStatus } from './lab-status';

/** How often "checked N minutes ago" is recomputed. */
const CLOCK_TICK_MS = 30_000;

/**
 * The status Worker's answer, kept fresh while `/lab` is open: asked at once, then every
 * LAB_STATUS_POLL_MS while the tab is visible, and again whenever it becomes visible; paused while
 * it's hidden (the pattern `RecentStreamService` uses). Provided by the Lab page, so it stops when the
 * page goes. A failed or untrustworthy answer is null, and the page shows no pills for it.
 */
@Injectable()
export class LabStatusService {
  private readonly api = inject(ApiCacheService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly latest = signal<LabStatus | null>(null);
  private readonly now = signal(Date.now());

  /** The last trustworthy answer, or null. */
  readonly status = this.latest.asReadonly();

  /** "3 minutes ago", once there's a status to go by. */
  readonly checkedAgo = computed(() => {
    const status = this.latest();
    return status ? relativeTime(Date.parse(status.checkedAt), this.now()) : '';
  });

  constructor() {
    if (!this.isBrowser) return;

    const visible$ = fromEvent(document, 'visibilitychange').pipe(
      startWith(null),
      map(() => document.visibilityState === 'visible'),
    );

    // The fetch lives inside the visibility branch, so hiding the tab cancels the chain, a request in
    // flight included. Each poll really asks (no cache): the Worker already reuses its own checks.
    visible$.pipe(
      switchMap(visible => visible
        ? interval(LAB_STATUS_POLL_MS).pipe(
          startWith(0),
          switchMap(() => this.api.get<unknown>(SITE_CONFIG.labStatusUrl, 0).pipe(
            map(toLabStatus),
            catchError(() => of(null)),
          )),
        )
        : EMPTY),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(status => {
      this.now.set(Date.now());
      this.latest.set(status);
    });

    merge(visible$, interval(CLOCK_TICK_MS)).pipe(
      filter(() => document.visibilityState === 'visible'),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.now.set(Date.now()));
  }

  /** "up" or "down", or null (no pill) until the Worker has answered properly. */
  stateOf(id: LabStatusId): 'up' | 'down' | null {
    return this.latest()?.services[id] ?? null;
  }
}
