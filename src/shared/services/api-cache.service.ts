import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';

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
 */
@Injectable({ providedIn: 'root' })
export class ApiCacheService {
  private readonly http = inject(HttpClient);

  get<T>(url: string, ttlMs = DEFAULT_TTL_MS): Observable<T> {
    const cached = this.read<T>(url);
    if (cached !== undefined) return of(cached);
    return this.http.get<T>(url).pipe(tap(data => this.write(url, data, ttlMs)));
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
