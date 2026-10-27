import { Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { ApiCacheService } from './api-cache.service';

/**
 * A cached GET (`ApiCacheService`) as a signal: null until the answer arrives, and null for good if
 * the request fails or `parse` rejects what came back. Null during prerender, too, so anything built on
 * it renders nothing until the browser has real data. Call it where `inject()` works (a field initializer).
 */
export function cachedJson<T>(url: string, ttlMs: number, parse: (value: unknown) => T | null): Signal<T | null> {
  return toSignal(
    inject(ApiCacheService).get<unknown>(url, ttlMs).pipe(
      map(parse),
      catchError(() => of(null)),
    ),
    { initialValue: null },
  );
}
