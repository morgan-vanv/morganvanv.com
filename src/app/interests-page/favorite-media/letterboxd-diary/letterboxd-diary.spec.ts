import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIARY_SHOWN, LetterboxdDiaryComponent, diaryDay } from './letterboxd-diary';
import { LETTERBOXD_DIARY_URL } from '../../../../shared/letterboxd/letterboxd.service';
import { parseLetterboxdRss } from '../../../../shared/letterboxd/letterboxd';
import { LETTERBOXD_FEED_FIXTURE } from '../../../../shared/letterboxd/letterboxd-feed.fixture';

const DIARY = parseLetterboxdRss(LETTERBOXD_FEED_FIXTURE, 'https://letterboxd.com/morganvanv/', '2026-10-27T10:17:00Z');

describe('diaryDay', () => {
  it('splits a diary date for the rail, as written', () => {
    expect(diaryDay('2026-10-20')).toEqual({ month: 'Oct', day: '20' });
    expect(diaryDay('2026-01-01')).toEqual({ month: 'Jan', day: '1' });
  });
});

describe('LetterboxdDiaryComponent', () => {
  let fixture: ComponentFixture<LetterboxdDiaryComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(LetterboxdDiaryComponent);
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  async function flush(body: object) {
    http.expectOne(LETTERBOXD_DIARY_URL).flush(body);
    await fixture.whenStable();
  }

  it('renders nothing until the diary arrives, and nothing for the placeholder', async () => {
    expect(el().querySelector('.diary')).toBeNull();
    await flush({ note: 'Placeholder' });
    expect(el().querySelector('.diary')).toBeNull();
  });

  it('renders nothing for an empty diary', async () => {
    await flush({ ...DIARY, entries: [] });
    expect(el().querySelector('.diary')).toBeNull();
  });

  it('lists the entries newest first, each linking to Letterboxd, with the date rail', async () => {
    await flush(DIARY);
    const entries = [...el().querySelectorAll<HTMLAnchorElement>('a.diary-entry')];
    expect(entries.map(e => e.querySelector('.diary-title')?.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Days of Heaven 1978', 'You Can See Everything 2026', 'Eraserhead 1977', 'Test Watch & Co 1999', 'Test Rewatch 2001',
    ]);
    expect(entries[0].getAttribute('href')).toBe('https://letterboxd.com/morganvanv/film/days-of-heaven/');
    expect(entries[0].getAttribute('rel')).toBe('noopener noreferrer');
    const time = entries[0].querySelector('time');
    expect(time?.getAttribute('datetime')).toBe('2026-10-20');
    expect(time?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Oct 20');
    expect(el().querySelector('.diary-more a')?.getAttribute('href')).toBe('https://letterboxd.com/morganvanv/');
  });

  it('names each link by its title, date and marks, and lets the review describe it', async () => {
    await flush(DIARY);
    const [first] = el().querySelectorAll('a.diary-entry');
    const ids = first.getAttribute('aria-labelledby')!.split(' ');
    expect(ids.map(id => el().querySelector(`#${id}`)?.className)).toEqual(['diary-title', 'diary-date', 'diary-marks']);
    const review = el().querySelector(`#${first.getAttribute('aria-describedby')}`);
    expect(review?.textContent).toContain('reminds me of reading Steinbeck');
    const plainWatch = [...el().querySelectorAll('a.diary-entry')].find(e => e.textContent?.includes('Test Watch'))!;
    expect(plainWatch.getAttribute('aria-describedby')).toBeNull();
  });

  it('says the marks in words for screen readers, and keeps the review', async () => {
    await flush(DIARY);
    const [first] = el().querySelectorAll('a.diary-entry');
    expect(first.querySelector('.stars')?.textContent).toBe('★★★★★');
    const spoken = [...first.querySelectorAll('.visually-hidden')].map(s => s.textContent);
    expect(spoken).toEqual(['rated 5 out of 5 stars', ', liked']);
    expect(first.querySelector('.diary-review')?.textContent).toContain('reminds me of reading Steinbeck');
  });

  it('leaves out an unrated film’s stars, marks a rewatch, and keeps a spoiler review on Letterboxd', async () => {
    await flush(DIARY);
    const byTitle = (title: string) => [...el().querySelectorAll('a.diary-entry')].find(e => e.textContent?.includes(title))!;
    expect(byTitle('Eraserhead').querySelector('app-stars')).toBeNull();
    const rewatch = byTitle('Test Rewatch');
    expect(rewatch.textContent).toContain('a rewatch');
    expect(rewatch.querySelector('.diary-review--spoilers')).not.toBeNull();
    expect(rewatch.textContent).not.toContain('first paragraph');
    expect(byTitle('Test Watch').querySelector('.diary-review')).toBeNull();
  });

  it(`shows at most ${DIARY_SHOWN}`, async () => {
    await flush({ ...DIARY, entries: Array.from({ length: 20 }, (_, i) => ({ ...DIARY.entries[0], url: `${DIARY.entries[0].url}${i}/` })) });
    expect(el().querySelectorAll('a.diary-entry').length).toBe(DIARY_SHOWN);
  });
});
