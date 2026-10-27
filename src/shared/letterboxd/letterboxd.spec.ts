import { DIARY_LIMIT, decodeEntities, parseLetterboxdRss, ratingLabel, ratingStars, reviewText, toDiary, watchedWhen } from './letterboxd';
import { LETTERBOXD_FEED_FIXTURE } from './letterboxd-feed.fixture';

const PROFILE = 'https://letterboxd.com/morganvanv/';
const FETCHED = '2026-10-27T10:17:00Z';

describe('parseLetterboxdRss', () => {
  const diary = parseLetterboxdRss(LETTERBOXD_FEED_FIXTURE, PROFILE, FETCHED);

  it('keeps diary entries, drops lists, and sorts by diary date, newest first', () => {
    expect(diary.profileUrl).toBe(PROFILE);
    expect(diary.fetchedAt).toBe(FETCHED);
    expect(diary.entries.map(e => [e.title, e.watched])).toEqual([
      ['Days of Heaven', '2026-10-20'],
      ['You Can See Everything', '2026-10-16'],
      ['Eraserhead', '2026-10-13'],
      ['Test Watch & Co', '2026-10-01'],
      ['Test Rewatch', '2026-09-30'],
    ]);
  });

  it('reads a review: year, rating, like, text without the poster, entities decoded', () => {
    expect(diary.entries[0]).toEqual({
      title: 'Days of Heaven', year: 1978, watched: '2026-10-20', rating: 5, liked: true, rewatch: false,
      review: 'visually stunning movie that reminds me of reading Steinbeck in all the best ways', spoilers: false,
      url: 'https://letterboxd.com/morganvanv/film/days-of-heaven/',
    });
    const eraserhead = diary.entries.find(e => e.title === 'Eraserhead');
    expect(eraserhead?.rating).toBeNull();
    expect(eraserhead?.review).toContain('they weren\'t understanding');
    expect(eraserhead?.review).toContain('this movie.\nworked perfectly!');
  });

  it('gives a plain watch no review text, and keeps half stars', () => {
    const watch = diary.entries.find(e => e.title === 'Test Watch & Co');
    expect(watch?.review).toBeNull();
    expect(watch?.rating).toBe(2.5);
    expect(watch?.liked).toBe(false);
  });

  it('flags spoilers and rewatches, and keeps paragraphs apart', () => {
    const rewatch = diary.entries.find(e => e.title === 'Test Rewatch');
    expect(rewatch?.rewatch).toBe(true);
    expect(rewatch?.spoilers).toBe(true);
    expect(rewatch?.review).toBe('first paragraph\n\nsecond & last');
  });

  it('skips items whose link is not on letterboxd.com, and copes with an empty feed', () => {
    const elsewhere = LETTERBOXD_FEED_FIXTURE.replaceAll('https://letterboxd.com/morganvanv/film/', 'https://example.com/');
    expect(parseLetterboxdRss(elsewhere, PROFILE, FETCHED).entries).toEqual([]);
    expect(parseLetterboxdRss('', PROFILE, FETCHED).entries).toEqual([]);
  });
});

describe('reviewText and decodeEntities', () => {
  it('decodes numeric and named references once', () => {
    expect(decodeEntities('it&#039;s &amp;lt; &#x2014; &hellip; &bogus;')).toBe('it\'s &lt; — … &bogus;');
  });

  it('drops the spoiler note wherever it sits and however it is marked up', () => {
    expect(reviewText('<p><img src="x"/></p> <p><em>This review may contain spoilers.</em></p> <p>it was him</p>'))
      .toEqual({ text: 'it was him', spoilers: true });
    expect(reviewText('<p class="note"><strong>This review may contain spoilers</strong></p><p>twist</p>'))
      .toEqual({ text: 'twist', spoilers: true });
  });

  it('keeps blockquotes and list items apart from the paragraphs around them', () => {
    expect(reviewText('<p>one</p><blockquote><p>quoted</p></blockquote><p>two</p>').text).toBe('one\n\nquoted\n\ntwo');
    expect(reviewText('<ul><li>a</li><li>b</li></ul>').text).toBe('a\n\nb');
  });

  it('returns null text when there are no words left', () => {
    expect(reviewText('<p><img src="x"/></p>')).toEqual({ text: null, spoilers: false });
  });
});

describe('toDiary', () => {
  const diary = parseLetterboxdRss(LETTERBOXD_FEED_FIXTURE, PROFILE, FETCHED);

  it('accepts what the deploy writes, round-tripped through JSON', () => {
    expect(toDiary(JSON.parse(JSON.stringify(diary)))).toEqual(diary);
  });

  it('rejects the placeholder and junk', () => {
    expect(toDiary({ note: 'Placeholder' })).toBeNull();
    expect(toDiary(null)).toBeNull();
    expect(toDiary({ ...diary, profileUrl: 'https://evil.example/' })).toBeNull();
    expect(toDiary({ ...diary, fetchedAt: 'yesterday' })).toBeNull();
  });

  it('rejects impossible dates and years, and a fetchedAt that is not a timestamp', () => {
    const odd = { ...diary, entries: [{ ...diary.entries[0], watched: '2026-13-45', year: -5 }] };
    expect(toDiary(odd)?.entries[0]).toMatchObject({ watched: null, year: null });
    expect(toDiary({ ...diary, fetchedAt: '1' })).toBeNull();
  });

  it('keeps one of each entry when a copy repeats itself', () => {
    expect(toDiary({ ...diary, entries: [diary.entries[0], diary.entries[0], diary.entries[1]] })?.entries.length).toBe(2);
  });

  it('drops malformed entries and caps the list', () => {
    const repeats = Array.from({ length: DIARY_LIMIT + 5 }, (_, i) => ({ ...diary.entries[0], url: `${diary.entries[0].url}${i}/` }));
    const many = { ...diary, entries: [{ title: 'x', url: 'javascript:alert(1)' }, ...repeats] };
    const checked = toDiary(many);
    expect(checked?.entries.length).toBe(DIARY_LIMIT);
    expect(checked?.entries[0].title).toBe('Days of Heaven');
  });

  it('cleans up out-of-range fields rather than trusting them', () => {
    const odd = { ...diary, entries: [{ ...diary.entries[0], rating: 7, watched: 'soon', review: '', liked: 'yes' }] };
    expect(toDiary(odd)?.entries[0]).toMatchObject({ rating: null, watched: null, review: null, liked: false });
  });
});

describe('watchedWhen', () => {
  // Late evening, local time: still the 27th wherever the tests run.
  const now = new Date(2026, 9, 27, 23, 30);

  it('counts calendar days', () => {
    expect(watchedWhen('2026-10-27', now)).toBe('today');
    expect(watchedWhen('2026-10-26', now)).toBe('yesterday');
    expect(watchedWhen('2026-10-20', now)).toBe('7 days ago');
  });

  it('gives a date after a month, or for a date ahead of the visitor’s clock', () => {
    expect(watchedWhen('2026-08-01', now)).toBe('August 1, 2026');
    expect(watchedWhen('2026-10-28', now)).toBe('October 28, 2026');
  });

  it('returns an empty string for junk', () => {
    expect(watchedWhen('soon', now)).toBe('');
  });
});

describe('ratingStars and ratingLabel', () => {
  it('draws whole and half stars, and says them in words', () => {
    expect(ratingStars(5)).toBe('★★★★★');
    expect(ratingStars(3.5)).toBe('★★★½');
    expect(ratingStars(0.5)).toBe('½');
    expect(ratingLabel(3.5)).toBe('3.5 out of 5 stars');
    expect(ratingLabel(1)).toBe('1 out of 5 stars');
  });
});
