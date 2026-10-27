import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApiCacheService } from './api-cache.service';
import { cachedJson } from './cached-json';

describe('cachedJson', () => {
  function signalFor<T>(response: Observable<unknown>, parse: (value: unknown) => T | null) {
    const get = vi.fn((url: string, ttl: number) => { void url; void ttl; return response; });
    TestBed.configureTestingModule({ providers: [{ provide: ApiCacheService, useValue: { get } }] });
    const data = TestBed.runInInjectionContext(() => cachedJson('/thing.json', 1000, parse));
    return { get, data };
  }
  const evenOrNull = (value: unknown) => (typeof value === 'number' && value % 2 === 0 ? value : null);

  it('asks the cache for the URL with the TTL, and holds the parsed answer', () => {
    const { get, data } = signalFor(of(42), evenOrNull);
    expect(get).toHaveBeenCalledWith('/thing.json', 1000);
    expect(data()).toBe(42);
  });

  it('is null until the answer arrives', () => {
    const answer = new Subject<unknown>();
    const { data } = signalFor(answer, evenOrNull);
    expect(data()).toBeNull();
    answer.next(8);
    expect(data()).toBe(8);
  });

  it('is null when the parser rejects the answer, or the request fails', () => {
    expect(signalFor(of(7), evenOrNull).data()).toBeNull();
    TestBed.resetTestingModule();
    expect(signalFor(throwError(() => new Error('404')), evenOrNull).data()).toBeNull();
  });
});
