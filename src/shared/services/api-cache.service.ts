import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, finalize, of, shareReplay, tap } from 'rxjs';

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const PREFIX = 'api-cache:';

interface CacheEntry<T> {
  expires: number;
  data: T;
}

/**
 * GET with a sessionStorage cache, so hopping between pages with the arrow
 * keys doesn't re-fetch every live panel. Falls through to the network if
 * storage is unavailable (private mode, quota) or the entry has expired.
 * Two readers asking for the same URL while a request is in flight share it
 * (the /now card and the "latest push" line both read one GitHub repo). A
 * shared request runs to the end even if every reader leaves first, so the
 * answer still lands in the cache; the first reader's TTL is the one written.
 */
@Injectable({ providedIn: 'root' })
export class ApiCacheService {
  private readonly http = inject(HttpClient);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));
  private readonly inFlight = new Map<string, Observable<unknown>>();

  /** GET `url`, serving a cached copy younger than `ttlMs`. A TTL of 0 bypasses the cache. */
  get<T>(url: string, ttlMs = DEFAULT_TTL_MS): Observable<T> {
    // Prerendered pages show the loading state; live data is fetched in the browser.
    if (this.isServer) return EMPTY;
    if (ttlMs <= 0) return this.http.get<T>(url);
    const cached = this.read<T>(url);
    if (cached !== undefined) return of(cached);
    const pending = this.inFlight.get(url) as Observable<T> | undefined;
    if (pending) return pending;
    const request = this.http.get<T>(url).pipe(
      tap(data => this.write(url, data, ttlMs)),
      finalize(() => this.inFlight.delete(url)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.inFlight.set(url, request);
    return request;
  }

  private read<T>(url: string): T | undefined {
    try {
      const raw = sessionStorage.getItem(PREFIX + url);
      if (!raw) return undefined;
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (entry.expires < Date.now()) {
        sessionStorage.removeItem(PREFIX + url);
        return undefined;
      }
      return entry.data;
    } catch {
      return undefined;
    }
  }

  private write<T>(url: string, data: T, ttlMs: number): void {
    try {
      const entry: CacheEntry<T> = { expires: Date.now() + ttlMs, data };
      sessionStorage.setItem(PREFIX + url, JSON.stringify(entry));
    } catch {
      // Storage full or unavailable; the network result still flows through.
    }
  }
}
