import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { NowPageComponent, clip, formatDay } from './now-page.component';
import { LastListened, RecentStreamService } from '../../shared/services/recent-stream.service';
import { COMMUNITY_PHOTOS } from '../../shared/constants/community-photos.const';
import { NOW_CONTENT_TOKEN } from './now.content';
import { PROJECTS } from '../../shared/constants/projects.const';
import { LETTERBOXD_DIARY_URL } from '../../shared/letterboxd/letterboxd.service';
import { parseLetterboxdRss } from '../../shared/letterboxd/letterboxd';
import { LETTERBOXD_FEED_FIXTURE } from '../../shared/letterboxd/letterboxd-feed.fixture';

/** Matches RuneProfile activity requests by parsed host and path, not by substring. */
function isRuneProfileActivities(req: { url: string }): boolean {
  // A base, since same-origin requests (the Lighthouse badge's /lighthouse.json) are relative.
  const url = new URL(req.url, 'http://localhost');
  return url.hostname === 'api.runeprofile.com' && url.pathname.endsWith('/activities');
}

describe('formatDay', () => {
  it('formats plain dates and ISO timestamps by the calendar date as written', () => {
    expect(formatDay('2026-10-25')).toBe('October 25, 2026');
    expect(formatDay('2026-01-01T03:00:00Z')).toBe('January 1, 2026');
    // An evening commit in Eastern time is still that day, not the next UTC day.
    expect(formatDay('2026-10-25T21:33:57-04:00')).toBe('October 25, 2026');
  });

  it('returns an empty string for junk', () => {
    expect(formatDay('')).toBe('');
    expect(formatDay('not a date')).toBe('');
  });
});

describe('clip', () => {
  it('leaves short text alone and cuts long text at a word, with an ellipsis', () => {
    expect(clip('short', 10)).toBe('short');
    expect(clip('a thinker of a movie, truly', 20)).toBe('a thinker of a movie…');
    expect(clip('supercalifragilistic', 5)).toBe('super…');
  });
});

describe('NowPageComponent', () => {
  let fixture: ComponentFixture<NowPageComponent>;
  let http: HttpTestingController;
  const lastListened = signal<LastListened | null>(null);

  const rowKeys = () => fixture.componentInstance.rows().map(r => r.key);
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    sessionStorage.clear();
    lastListened.set(null);
    await TestBed.configureTestingModule({
      imports: [NowPageComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: RecentStreamService, useValue: { lastListened, when: signal('12 minutes ago') } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NowPageComponent);
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  it('has one h1, from the page header', () => {
    const headings = (fixture.nativeElement as HTMLElement).querySelectorAll('h1');
    expect(headings.length).toBe(1);
    expect(headings[0].textContent?.trim()).toBe('Now');
  });

  it('puts the 88×31 buttons in their own panel, one labelled row per cluster', () => {
    const panel = (fixture.nativeElement as HTMLElement).querySelector('.buttons-panel');
    expect(panel?.querySelector('h2')?.textContent).toContain('Buttons');
    expect([...panel!.querySelectorAll('.cluster-label')].map(h => h.textContent?.trim())).toEqual(['tonight', 'this site']);
    // Morgan's order, left to right.
    const rows = [...panel!.querySelectorAll('.strip')].map(strip => [...strip.children].map(badge => badge.tagName.toLowerCase()));
    expect(rows).toEqual([
      ['app-weather-badge', 'app-moon-badge', 'app-planets-badge'],
      ['app-own-button-badge', 'app-angular-badge', 'app-no-cookies-badge', 'app-page-weight-badge', 'app-lighthouse-badge', 'app-build-badge'],
    ]);
    // The ones whose data ships with the site are there from the start; the Lighthouse badge waits for its report.
    expect(panel?.querySelector('app-own-button-badge .badge')).not.toBeNull();
    expect(panel?.querySelector('app-lighthouse-badge .badge')).toBeNull();
  });

  it('lists the projects under Building, with a count', () => {
    expect(text()).toContain('Building');
    const count = (fixture.nativeElement as HTMLElement).querySelector('#now-building .range-label');
    expect(count?.textContent?.trim()).toBe(`${PROJECTS.length} ${PROJECTS.length === 1 ? 'project' : 'projects'}`);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('app-project-card').length).toBe(PROJECTS.length);
    http.match(r => new URL(r.url, 'http://localhost').hostname === 'api.github.com');
  });

  it('hides the note and its date while the note is empty, and shows the static rows', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('.note')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('[pageMeta]')).toBeNull();
    expect(text()).not.toContain('updated October');
    expect(text()).toContain("What I'm up to now");
    expect(rowKeys()).toEqual(['community', 'site']);
    expect(text()).toContain(COMMUNITY_PHOTOS.at(-1)!.caption!);
  });

  it('adds Listening first once a stream is known', async () => {
    lastListened.set({ trackName: 'Song', artistName: 'Band', imageUrl: null, trackUrl: 'https://stats.fm/track/1', isPlaying: false, at: Date.now() });
    await fixture.whenStable();
    expect(rowKeys()).toEqual(['listening', 'community', 'site']);
    expect(fixture.componentInstance.rows()[0].when).toBe('12 minutes ago');
  });

  it('builds Playing from the latest achievement, with the latest drop as detail', async () => {
    const reqs = http.match(isRuneProfileActivities);
    expect(reqs.length).toBe(2);
    const created = new Date().toISOString();
    for (const req of reqs) {
      req.flush(new URL(req.request.url).searchParams.get('activityTypes')?.split(',').includes('valuable_drop')
        ? { activities: [{ type: 'valuable_drop', createdAt: created, data: { itemId: 1, value: 4_200_000 }, enriched: { itemName: 'Tanzanite fang' } }], nextCursor: null, hasMore: false }
        : { activities: [{ type: 'level_up', createdAt: created, data: { name: 'Slayer', level: 87 }, enriched: {} }], nextCursor: null, hasMore: false });
    }
    await fixture.whenStable();
    const playing = fixture.componentInstance.rows().find(r => r.key === 'playing');
    expect(playing?.title).toBe('Slayer 87');
    expect(playing?.detail).toBe('Old School RuneScape · latest drop: Tanzanite fang — 4.2M gp');
  });

  function flushActivities(achievements: unknown[], drops: unknown[]): void {
    for (const req of http.match(isRuneProfileActivities)) {
      const isDrops = new URL(req.request.url).searchParams.get('activityTypes')?.split(',').includes('valuable_drop');
      req.flush({ activities: isDrops ? drops : achievements, nextCursor: null, hasMore: false });
    }
  }

  it('builds Playing from a drop alone, with the item icon', async () => {
    flushActivities([], [{ type: 'valuable_drop', createdAt: new Date().toISOString(), data: { itemId: 4151, value: 1_500_000 }, enriched: { itemName: 'Abyssal whip' } }]);
    await fixture.whenStable();
    const playing = fixture.componentInstance.rows().find(r => r.key === 'playing');
    expect(playing?.title).toBe('Abyssal whip — 1.5M gp');
    expect(playing?.detail).toBe('Old School RuneScape');
    expect(playing?.iconUrl).toBe('https://static.runelite.net/cache/item/icon/4151.png');
  });

  it('uses the achievement icon and a relative time when an achievement exists', async () => {
    flushActivities([{ type: 'quest_completed', createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(), data: { questId: 1 }, enriched: { questName: 'Dragon Slayer II' } }], []);
    await fixture.whenStable();
    const playing = fixture.componentInstance.rows().find(r => r.key === 'playing');
    expect(playing?.iconUrl).toBe('osrs/icons/quests-icon.webp');
    expect(playing?.when).toBe('3 hours ago');
  });

  it('a malformed timestamp drops the time but keeps every row rendering', async () => {
    flushActivities([{ type: 'level_up', createdAt: 'garbage', data: { name: 'Slayer', level: 87 }, enriched: {} }], []);
    await fixture.whenStable();
    expect(rowKeys()).toEqual(['playing', 'community', 'site']);
    expect(fixture.componentInstance.rows()[0].when).toBeUndefined();
  });

  it('shows a glyph instead of a broken image when a row has no icon', async () => {
    lastListened.set({ trackName: 'Song', artistName: 'Band', imageUrl: null, trackUrl: 'https://stats.fm/track/1', isPlaying: true, at: Date.now() });
    await fixture.whenStable();
    const glyphs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.thumb--glyph')].map(g => g.textContent?.trim());
    expect(glyphs).toEqual(['♪', '</>']);
  });

  const diary = parseLetterboxdRss(LETTERBOXD_FEED_FIXTURE, 'https://letterboxd.com/morganvanv/', '2026-10-27T10:17:00Z');
  const flushDiary = (body: object) => {
    for (const req of http.match(r => r.url === LETTERBOXD_DIARY_URL)) req.flush(body);
  };

  it('adds Watched from the newest Letterboxd entry, after Playing and before Community', async () => {
    flushDiary(diary);
    await fixture.whenStable();
    expect(rowKeys()).toEqual(['watched', 'community', 'site']);
    const watched = fixture.componentInstance.rows()[0];
    expect(watched).toMatchObject({
      title: 'Days of Heaven', rating: 5, href: 'https://letterboxd.com/morganvanv/film/days-of-heaven/',
      detail: '1978 · liked · “visually stunning movie that reminds me of reading Steinbeck in all the best ways”',
    });
    const row = (fixture.nativeElement as HTMLElement).querySelector('.now-row');
    expect(row?.querySelector('.stars')?.textContent).toBe('★★★★★');
    expect(row?.querySelector('.detail .visually-hidden')?.textContent).toBe('rated 5 out of 5 stars');
    expect(row?.querySelector('.thumb--glyph')?.textContent?.trim()).toBe('▶');
  });

  it('keeps a spoiler review off /now, and says rewatch', async () => {
    flushDiary({ ...diary, entries: [{ ...diary.entries[0], spoilers: true, rewatch: true, liked: false, rating: null }] });
    await fixture.whenStable();
    const watched = fixture.componentInstance.rows()[0];
    expect(watched.detail).toBe('1978 · rewatch');
    expect(watched.rating).toBeUndefined();
  });

  it('skips Watched for the placeholder or an empty diary', async () => {
    flushDiary({ note: 'Placeholder' });
    await fixture.whenStable();
    expect(rowKeys()).not.toContain('watched');
  });

  it('skips Playing when RuneProfile fails', async () => {
    for (const req of http.match(isRuneProfileActivities)) req.flush('down', { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(rowKeys()).not.toContain('playing');
  });
});

describe('NowPageComponent with a note', () => {
  it('shows the note and its updated date once there is text', async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NowPageComponent],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: RecentStreamService, useValue: { lastListened: signal(null), when: signal(null) } },
        { provide: NOW_CONTENT_TOKEN, useValue: { updated: '2026-11-02', paragraphs: ['Mostly building a castle.', 'And a website.'] } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(NowPageComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect([...el.querySelectorAll('.note p')].map(p => p.textContent)).toEqual(['Mostly building a castle.', 'And a website.']);
    expect(el.querySelector('app-page-header [pageMeta]')?.textContent?.trim()).toBe('updated November 2, 2026');
  });
});
