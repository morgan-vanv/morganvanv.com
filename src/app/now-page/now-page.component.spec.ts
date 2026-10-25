import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { NowPageComponent, formatDay } from './now-page.component';
import { LastListened, RecentStreamService } from '../../shared/services/recent-stream.service';
import { COMMUNITY_PHOTOS } from '../../shared/constants/community-photos.const';
import { NOW_CONTENT } from './now.content';

describe('formatDay', () => {
  it('formats plain dates and ISO timestamps in UTC', () => {
    expect(formatDay('2026-10-25')).toBe('October 25, 2026');
    expect(formatDay('2026-01-01T03:00:00Z')).toBe('January 1, 2026');
  });

  it('returns an empty string for junk', () => {
    expect(formatDay('')).toBe('');
    expect(formatDay('not a date')).toBe('');
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

  it('shows the note, its date, and the static rows before any live data', () => {
    expect(text()).toContain(NOW_CONTENT.paragraphs[0]);
    expect(text()).toContain('updated October 25, 2026');
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
    const reqs = http.match(r => r.url.includes('runeprofile.com') && r.url.includes('/activities'));
    expect(reqs.length).toBe(2);
    const created = new Date().toISOString();
    for (const req of reqs) {
      req.flush(req.request.url.includes('valuable_drop')
        ? { activities: [{ type: 'valuable_drop', createdAt: created, data: { itemId: 1, value: 4_200_000 }, enriched: { itemName: 'Tanzanite fang' } }], nextCursor: null, hasMore: false }
        : { activities: [{ type: 'level_up', createdAt: created, data: { name: 'Slayer', level: 87 }, enriched: {} }], nextCursor: null, hasMore: false });
    }
    await fixture.whenStable();
    const playing = fixture.componentInstance.rows().find(r => r.key === 'playing');
    expect(playing?.title).toBe('Slayer 87');
    expect(playing?.detail).toBe('Old School RuneScape · latest drop: Tanzanite fang — 4.2M gp');
  });

  it('skips Playing when RuneProfile fails', async () => {
    for (const req of http.match(r => r.url.includes('/activities'))) req.flush('down', { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();
    expect(rowKeys()).not.toContain('playing');
  });
});
