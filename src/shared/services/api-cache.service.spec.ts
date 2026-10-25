import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ApiCacheService } from './api-cache.service';

const URL = 'https://example.test/thing';

describe('ApiCacheService', () => {
  let service: ApiCacheService;
  let http: HttpTestingController;

  beforeEach(() => {
  sessionStorage.clear();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  service = TestBed.inject(ApiCacheService);
  http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
  vi.restoreAllMocks();
  http.verify();
  });

  it('fetches once, then serves the cached value', async () => {
  const first = firstValueFrom(service.get<{ ok: boolean }>(URL));
  http.expectOne(URL).flush({ ok: true });
  expect(await first).toEqual({ ok: true });

  const second = await firstValueFrom(service.get<{ ok: boolean }>(URL));
  expect(second).toEqual({ ok: true });
  http.expectNone(URL);
  });

  it('refetches after the entry expires', async () => {
  vi.useFakeTimers();
  const first = firstValueFrom(service.get(URL, 1000));
  http.expectOne(URL).flush(1);
  await first;

  vi.advanceTimersByTime(1001);
  const second = firstValueFrom(service.get(URL, 1000));
  http.expectOne(URL).flush(2);
  expect(await second).toBe(2);
  vi.useRealTimers();
  });

  it('bypasses the cache entirely when the TTL is 0', async () => {
    const first = firstValueFrom(service.get(URL, 0));
    http.expectOne(URL).flush(1);
    await first;
    const second = firstValueFrom(service.get(URL, 0));
    http.expectOne(URL).flush(2);
    expect(await second).toBe(2);
  });

  it('does not cache failed requests', async () => {
  const first = firstValueFrom(service.get(URL));
  http.expectOne(URL).flush('nope', { status: 500, statusText: 'Server Error' });
  await expect(first).rejects.toBeTruthy();

  const second = firstValueFrom(service.get(URL));
  http.expectOne(URL).flush('ok');
  expect(await second).toBe('ok');
  });
});
