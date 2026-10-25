import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RecentStreamService } from './recent-stream.service';
import { SITE_CONFIG } from '../config/site.config';

const USER = SITE_CONFIG.handles.statsFm;
const CURRENT_URL = `https://api.stats.fm/api/v1/users/${USER}/streams/current`;
const RECENT_URL = `https://api.stats.fm/api/v1/users/${USER}/streams/recent?limit=1`;

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** The service polls on timer(0, …), which fires on the next macrotask. */
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

const track = (id: number, name: string) => ({
  id, name, durationMs: 1, explicit: false, spotifyPreview: null,
  artists: [{ id: 1, name: 'Some Band', image: '', genres: [], followers: 0, spotifyPopularity: 0 }],
  albums: [{ id: 1, name: 'Album', image: 'https://img/album.jpg' }],
});

describe('RecentStreamService', () => {
  let http: HttpTestingController;
  let service: RecentStreamService;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(RecentStreamService);
    await tick();
  });

  afterEach(() => {
    setVisibility('visible');
    http.verify();
  });

  it('prefers the currently playing track and marks it as playing', async () => {
    http.expectOne(CURRENT_URL).flush({ item: { date: new Date().toISOString(), isPlaying: true, progressMs: 1, track: track(7, 'Live One') } });
    await tick();
    expect(service.lastListened()).toMatchObject({ trackName: 'Live One', artistName: 'Some Band', isPlaying: true, trackUrl: 'https://stats.fm/track/7' });
    expect(service.summary()).toBe('listening to Live One by Some Band right now');
  });

  it('falls back to the most recent finished stream when nothing is playing', async () => {
    http.expectOne(CURRENT_URL).flush(null);
    const endTime = new Date(Date.now() - 12 * 60_000).toISOString();
    http.expectOne(RECENT_URL).flush({ items: [{ platform: 'spotify', endTime, track: track(3, 'Old One') }] });
    await tick();
    expect(service.lastListened()).toMatchObject({ trackName: 'Old One', isPlaying: false, imageUrl: 'https://img/album.jpg' });
    expect(service.summary()).toBe('last listened: Old One by Some Band · 12 minutes ago');
  });

  it('falls back to recent when the current endpoint is private, and yields null when that fails too', async () => {
    http.expectOne(CURRENT_URL).flush('private', { status: 403, statusText: 'Forbidden' });
    http.expectOne(RECENT_URL).flush('nope', { status: 500, statusText: 'Error' });
    await tick();
    expect(service.lastListened()).toBeNull();
    expect(service.summary()).toBeNull();
  });

  it('hiding the tab cancels an in-flight fetch, including its fallback request', async () => {
    const pending = http.expectOne(CURRENT_URL);
    setVisibility('hidden');
    expect(pending.cancelled).toBe(true);
    http.expectNone(RECENT_URL);

    setVisibility('visible');
    await tick();
    http.expectOne(CURRENT_URL).flush(null);
    http.expectOne(RECENT_URL).flush({ items: [] });
  });

  it('yields null when there are no streams at all', async () => {
    http.expectOne(CURRENT_URL).flush(null);
    http.expectOne(RECENT_URL).flush({ items: [] });
    await tick();
    expect(service.lastListened()).toBeNull();
  });
});
