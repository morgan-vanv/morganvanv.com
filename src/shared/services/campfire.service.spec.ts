import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Location } from '@angular/common';
import { COUNTED_HOST, CampfireService, SHOUT_POLL_MS, guestNick, shoutError, toShoutLog } from './campfire.service';
import { SITE_CONFIG } from '../config/site.config';

const BASE = SITE_CONFIG.campfireUrl;

describe('toShoutLog', () => {
  it('keeps well-formed shouts, oldest first, and the here count', () => {
    expect(toShoutLog({
      here: 3,
      shouts: [
        { id: 7, nick: 'b', text: 'two', at: '2026-10-27T05:01:00Z', host: true },
        { id: 3, nick: 'a', text: 'one', at: '2026-10-27T05:00:00Z' },
        { id: 'x', nick: 'c', text: 'bad id', at: '2026-10-27T05:02:00Z' },
        { id: 9, nick: 'd', text: 'bad time', at: 'yesterday-ish' },
        null,
      ],
    })).toEqual({
      here: 3,
      open: true,
      shouts: [
        { id: 3, nick: 'a', text: 'one', at: '2026-10-27T05:00:00Z', host: false },
        { id: 7, nick: 'b', text: 'two', at: '2026-10-27T05:01:00Z', host: true },
      ],
    });
  });

  it('refuses anything without a list of shouts, and drops a bad here', () => {
    expect(toShoutLog(null)).toBeNull();
    expect(toShoutLog({ shouts: 'no' })).toBeNull();
    expect(toShoutLog({ shouts: [], here: -1 })).toEqual({ shouts: [], here: null, open: true });
  });

  it('reads whether the fire is banked; only an explicit false closes it', () => {
    expect(toShoutLog({ shouts: [], here: 1, open: false })?.open).toBe(false);
    expect(toShoutLog({ shouts: [], here: 1, open: 'no' })?.open).toBe(true);
  });
});

describe('shoutError', () => {
  it('passes the campfire\'s own short message through', () => {
    expect(shoutError(new HttpErrorResponse({ status: 400, error: { error: 'That nick won\'t do.' } }))).toBe('That nick won\'t do.');
  });

  it('has its own words for a rate limit and for anything else', () => {
    expect(shoutError(new HttpErrorResponse({ status: 429 }))).toContain('few seconds');
    expect(shoutError(new Error('boom'))).toContain('Couldn\'t reach the campfire');
  });
});

describe('guestNick', () => {
  it('hands out a four-digit guest nick', () => {
    expect(guestNick(() => 0.0421)).toBe('guest_0421');
    expect(guestNick(() => 0.99999)).toBe('guest_9999');
  });
});

describe('CampfireService', () => {
  let service: CampfireService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CampfireService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('only reads the count away from the real site (dev, CI, previews)', () => {
    service.countVisit();
    http.expectOne(r => r.method === 'GET' && r.url === `${BASE}/visit`).flush({ count: 41 });
    expect(service.visitors()).toBe(41);
    expect(sessionStorage.getItem('campfire-counted')).toBeNull();
  });

  it('asks for the count once, and hides it on an error', () => {
    service.countVisit();
    service.countVisit();
    http.expectOne(`${BASE}/visit`).flush('down', { status: 503, statusText: 'Unavailable' });
    expect(service.visitors()).toBeNull();
  });

  it('stops polling when nothing watches any more', () => {
    vi.useFakeTimers();
    try {
      const stop = service.watchShouts();
      http.expectOne(r => r.url.startsWith(`${BASE}/shouts`)).flush({ shouts: [], here: 1 });
      vi.advanceTimersByTime(SHOUT_POLL_MS);
      http.expectOne(r => r.url.startsWith(`${BASE}/shouts`)).flush({ shouts: [], here: 1 });
      stop();
      vi.advanceTimersByTime(SHOUT_POLL_MS * 3);
      http.expectNone(r => r.url.startsWith(`${BASE}/shouts`));
    } finally {
      vi.useRealTimers();
    }
  });

  it('polls the shoutbox only while something watches it', async () => {
    http.expectNone(r => r.url.startsWith(`${BASE}/shouts`));
    const stop = service.watchShouts();
    const req = http.expectOne(r => r.url.startsWith(`${BASE}/shouts`));
    expect(req.request.url).toMatch(/\/shouts\?client=[0-9a-f-]{36}$/);
    req.flush({ shouts: [{ id: 1, nick: 'sam', text: 'hi', at: '2026-10-27T05:00:00Z' }], here: 2 });
    expect(service.shoutLog()?.shouts.map(s => s.text)).toEqual(['hi']);
    expect(service.shoutLog()?.here).toBe(2);
    stop();
    stop();
  });

  it('marks the campfire unreachable only when there is nothing to show', () => {
    const stop = service.watchShouts();
    http.expectOne(r => r.url.startsWith(`${BASE}/shouts`)).flush('down', { status: 503, statusText: 'Unavailable' });
    expect(service.unreachable()).toBe(true);
    stop();
  });

  it('says something, remembers the nick and refreshes the log', async () => {
    const stop = service.watchShouts();
    http.expectOne(r => r.url.startsWith(`${BASE}/shouts`)).flush({ shouts: [], here: 1 });
    const said = service.say('sam', 'hello', '');
    const post = http.expectOne(r => r.method === 'POST' && r.url === `${BASE}/shouts`);
    expect(post.request.body).toEqual({ nick: 'sam', text: 'hello', website: '' });
    expect(post.request.headers.has('Authorization')).toBe(false);
    post.flush({ shout: { id: 1 } }, { status: 201, statusText: 'Created' });
    expect(await said).toBeNull();
    expect(localStorage.getItem('campfire-nick')).toBe('sam');
    expect(service.savedNick()).toBe('sam');
    http.expectOne(r => r.method === 'GET' && r.url.startsWith(`${BASE}/shouts`)).flush({ shouts: [], here: 1 });
    stop();
  });

  it('banks the fire and lights it again, as the host, then refreshes', async () => {
    localStorage.setItem('campfire-host-key', 's3cret');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: COUNTED_HOST, useValue: 'morganvanv.com' }] });
    const host = TestBed.inject(CampfireService);
    const backend = TestBed.inject(HttpTestingController);
    const stop = host.watchShouts();
    backend.expectOne(r => r.url.startsWith(`${BASE}/shouts`)).flush({ shouts: [], here: 1, open: true });
    const banked = host.setOpen(false);
    const put = backend.expectOne(r => r.method === 'PUT' && r.url === `${BASE}/fire`);
    expect(put.request.body).toEqual({ open: false });
    expect(put.request.headers.get('Authorization')).toBe('Bearer s3cret');
    put.flush({ open: false });
    expect(await banked).toBeNull();
    expect(host.shoutLog()?.open).toBe(false);
    backend.expectOne(r => r.method === 'GET' && r.url.startsWith(`${BASE}/shouts`)).flush({ shouts: [], here: 1, open: false });
    stop();
    localStorage.removeItem('campfire-host-key');
  });

  it('passes on why the fire wouldn\'t bank', async () => {
    const tried = service.setOpen(false);
    http.expectOne(`${BASE}/fire`).flush({ error: 'That\'s not the host key.' }, { status: 401, statusText: 'Unauthorized' });
    expect(await tried).toBe('That\'s not the host key.');
  });

  it('forgets a host key the campfire no longer accepts, so the host controls go away', async () => {
    localStorage.setItem('campfire-host-key', 'old-key');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const host = TestBed.inject(CampfireService);
    const backend = TestBed.inject(HttpTestingController);
    expect(host.isHost()).toBe(true);
    const tried = host.remove(5);
    backend.expectOne(`${BASE}/shouts/5`).flush({ error: 'That\'s not the host key.' }, { status: 401, statusText: 'Unauthorized' });
    expect(await tried).toBe('That\'s not the host key.');
    expect(host.isHost()).toBe(false);
    expect(localStorage.getItem('campfire-host-key')).toBeNull();
    backend.verify();
  });

  it('keeps the host key through other failures (a rate limit, the campfire being down)', async () => {
    localStorage.setItem('campfire-host-key', 's3cret');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const host = TestBed.inject(CampfireService);
    const backend = TestBed.inject(HttpTestingController);
    const tried = host.setOpen(false);
    backend.expectOne(`${BASE}/fire`).flush(null, { status: 503, statusText: 'Unavailable' });
    await tried;
    expect(host.isHost()).toBe(true);
    backend.verify();
    localStorage.removeItem('campfire-host-key');
  });

  it('clears the last stretch of guest messages as the host, then refreshes the log', async () => {
    localStorage.setItem('campfire-host-key', 's3cret');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const host = TestBed.inject(CampfireService);
    const backend = TestBed.inject(HttpTestingController);
    const stop = host.watchShouts();
    backend.expectOne(r => r.url.startsWith(`${BASE}/shouts`) && r.method === 'GET').flush({ shouts: [], here: 1, open: true });
    const cleared = host.clearRecent(60);
    const del = backend.expectOne(r => r.method === 'DELETE' && r.url === `${BASE}/shouts`);
    expect(del.request.params.get('within')).toBe('60');
    expect(del.request.headers.get('Authorization')).toBe('Bearer s3cret');
    del.flush({ removed: 12 });
    expect(await cleared).toEqual({ removed: 12 });
    backend.expectOne(r => r.method === 'GET' && r.url.startsWith(`${BASE}/shouts`)).flush({ shouts: [], here: 1, open: true });
    stop();

    const refused = host.clearRecent(60);
    backend.expectOne(r => r.method === 'DELETE').flush({ error: 'Only the host can do that.' }, { status: 401, statusText: 'Unauthorized' });
    expect(await refused).toEqual({ error: 'Only the host can do that.' });
    expect(host.isHost()).toBe(false);
    backend.verify();
  });

  it('reports why a shout didn\'t go', async () => {
    const said = service.say('sam', 'hello', '');
    http.expectOne(`${BASE}/shouts`).flush({ error: 'Too many links.' }, { status: 400, statusText: 'Bad Request' });
    expect(await said).toBe('Too many links.');
  });

  it('keeps a host key from the address only once the campfire confirms it', async () => {
    const tidy = vi.spyOn(TestBed.inject(Location), 'replaceState');
    history.replaceState(null, '', '/social/#host=wrong');
    const wrong = service.captureHostKey();
    // The key comes straight out of the address bar.
    expect(tidy).toHaveBeenCalled();
    http.expectOne(`${BASE}/host`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await wrong;
    expect(service.isHost()).toBe(false);
    expect(localStorage.getItem('campfire-host-key')).toBeNull();

    history.replaceState(null, '', '/social/#host=s3cret');
    const right = service.captureHostKey();
    const check = http.expectOne(`${BASE}/host`);
    expect(check.request.headers.get('Authorization')).toBe('Bearer s3cret');
    check.flush(null, { status: 204, statusText: 'No Content' });
    await right;
    expect(localStorage.getItem('campfire-host-key')).toBe('s3cret');
    expect(service.isHost()).toBe(true);

    const removed = service.remove(5);
    const del = http.expectOne(`${BASE}/shouts/5`);
    expect(del.request.method).toBe('DELETE');
    expect(del.request.headers.get('Authorization')).toBe('Bearer s3cret');
    del.flush(null, { status: 204, statusText: 'No Content' });
    expect(await removed).toBeNull();

    history.replaceState(null, '', '/social/#host=%E0%A4%A');
    await service.captureHostKey();
    expect(service.isHost()).toBe(true);

    history.replaceState(null, '', '/social/#host=');
    await service.captureHostKey();
    expect(service.isHost()).toBe(false);
    expect(localStorage.getItem('campfire-host-key')).toBeNull();
    history.replaceState(null, '', '/');
  });
});

describe('CampfireService on the real site', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: COUNTED_HOST, useValue: location.hostname }],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('counts a visit once per tab session, then only reads', () => {
    // happy-dom reports itself as automated; a real visitor's browser doesn't.
    const webdriver = vi.spyOn(navigator, 'webdriver', 'get').mockReturnValue(false);
    TestBed.inject(CampfireService).countVisit();
    const post = http.expectOne(`${BASE}/visit`);
    expect(post.request.method).toBe('POST');
    post.flush({ count: 42 });
    expect(TestBed.inject(CampfireService).visitors()).toBe(42);
    expect(sessionStorage.getItem('campfire-counted')).toBe('1');

    // A new page load in the same tab: a fresh service, the same session.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: COUNTED_HOST, useValue: location.hostname }],
    });
    const again = TestBed.inject(HttpTestingController);
    TestBed.inject(CampfireService).countVisit();
    expect(again.expectOne(`${BASE}/visit`).request.method).toBe('GET');
    again.verify();
    http = again;
    webdriver.mockRestore();
  });

  it('never counts under automation', () => {
    const webdriver = vi.spyOn(navigator, 'webdriver', 'get').mockReturnValue(true);
    try {
      TestBed.inject(CampfireService).countVisit();
      expect(http.expectOne(`${BASE}/visit`).request.method).toBe('GET');
      expect(sessionStorage.getItem('campfire-counted')).toBeNull();
    } finally {
      webdriver.mockRestore();
    }
  });
});
