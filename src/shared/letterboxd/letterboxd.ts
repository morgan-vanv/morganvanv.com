/**
 * Morgan's Letterboxd diary: parsed from his RSS feed at deploy time (scripts/write-letterboxd.mjs, which
 * runs this file straight from Node), and validated again in the browser when the site reads
 * /letterboxd.json. No imports, and only erasable TypeScript, so Node can run it without a build step.
 *
 * The feed (letterboxd.com/<user>/rss/) holds his 50 most recent diary entries plus up to 50 lists.
 * Lists are dropped. Poster images are dropped too: Letterboxd's terms rule out in-line linking to them.
 */

export interface DiaryEntry {
  /** The film's title, as Letterboxd lists it. */
  title: string;
  year: number | null;
  /** The diary date, YYYY-MM-DD; null for a review logged without one. */
  watched: string | null;
  /** 0.5 to 5 in half steps; null when unrated. */
  rating: number | null;
  liked: boolean;
  rewatch: boolean;
  /** Plain text; paragraphs separated by a blank line. Null for a watch logged without words. */
  review: string | null;
  /** Morgan marked the review as containing spoilers. */
  spoilers: boolean;
  /** The entry on letterboxd.com. */
  url: string;
}

export interface Diary {
  /** Morgan's profile on letterboxd.com. */
  profileUrl: string;
  /** When the deploy read the feed (ISO). */
  fetchedAt: string;
  /** Newest diary date first. */
  entries: DiaryEntry[];
}

export const DIARY_LIMIT = 50;
const LETTERBOXD_ORIGIN = 'https://letterboxd.com/';
// Letterboxd's marker, as of 2026-10-27: `<p><em>This review may contain spoilers.</em></p>` after the
// poster. Matched loosely (any paragraph that says so), so a small markup change can't leak a spoiler.
const SPOILER_NOTE = /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?may contain spoilers(?:(?!<\/p>)[\s\S])*?<\/p>/gi;
const SPOILER_WORDS = /may contain spoilers/i;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

/** Decodes HTML/XML character references in one pass, so `&amp;lt;` stays `&lt;`. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? whole;
  });
}

/** The text of the first `<name>` element in an item: CDATA as is, anything else entity-decoded. */
function element(item: string, name: string): string | null {
  const match = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`).exec(item);
  if (!match) return null;
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(match[1]);
  return (cdata ? cdata[1] : decodeEntities(match[1])).trim();
}

/**
 * Removes every tag, again and again until none is left (so `<scr<b>ipt>` can't reassemble into one).
 * The result is only ever shown as text, never as HTML, but it should be tag-free all the same.
 */
export function stripTags(html: string): string {
  let text = html;
  for (let previous = ''; text !== previous;) {
    previous = text;
    text = text.replace(/<[^<>]*>/g, '');
  }
  return text.replace(/[<>]/g, '');
}

/** A review's HTML (the feed's `description`) as plain text, without the poster or the spoiler note. */
export function reviewText(html: string): { text: string | null; spoilers: boolean } {
  const spoilers = SPOILER_WORDS.test(html);
  const text = decodeEntities(stripTags(
    html
      .replace(SPOILER_NOTE, '')
      .replace(/<br\s*\/?>/gi, '\n')
      // Paragraphs, blockquotes and list items end in a blank line; the collapse below tidies extras.
      .replace(/<\/(p|blockquote|li|div|h[1-6])>/gi, '\n\n'),
  ))
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text: text || null, spoilers };
}

/** A real calendar date, YYYY-MM-DD (so not 2026-13-45). */
const isDay = (value: unknown): value is string => {
  const match = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
};
const isYear = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 1800 && value < 3000;
const isRating = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0.5 && value <= 5 && Number.isInteger(value * 2);
const isLetterboxdUrl = (value: unknown): value is string => typeof value === 'string' && value.startsWith(LETTERBOXD_ORIGIN);

/** Newest diary date first; entries without one keep their feed order, after the dated ones. */
function byWatchedDesc(a: DiaryEntry, b: DiaryEntry): number {
  if (a.watched === b.watched) return 0;
  if (!a.watched) return 1;
  if (!b.watched) return -1;
  return a.watched < b.watched ? 1 : -1;
}

/** Parses the RSS feed's diary entries (watches and reviews, not lists). Unusable items are skipped. */
export function parseLetterboxdRss(xml: string, profileUrl: string, fetchedAt: string): Diary {
  const entries: DiaryEntry[] = [];
  for (const [, item] of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)) {
    const kind = /^letterboxd-(watch|review)-\d+$/.exec(element(item, 'guid') ?? '')?.[1];
    const url = element(item, 'link');
    const title = element(item, 'letterboxd:filmTitle');
    if (!kind || !title || !isLetterboxdUrl(url)) continue;

    const year = Number(element(item, 'letterboxd:filmYear'));
    const watched = element(item, 'letterboxd:watchedDate');
    const rating = Number(element(item, 'letterboxd:memberRating'));
    const review = kind === 'review' ? reviewText(element(item, 'description') ?? '') : { text: null, spoilers: false };
    entries.push({
      title,
      year: isYear(year) ? year : null,
      watched: isDay(watched) ? watched : null,
      rating: isRating(rating) ? rating : null,
      liked: element(item, 'letterboxd:memberLike') === 'Yes',
      rewatch: element(item, 'letterboxd:rewatch') === 'Yes',
      review: review.text,
      spoilers: review.spoilers,
      url,
    });
  }
  return { profileUrl, fetchedAt, entries: entries.sort(byWatchedDesc).slice(0, DIARY_LIMIT) };
}

function toEntry(value: unknown): DiaryEntry | null {
  const entry = value as Partial<DiaryEntry> | null;
  if (!entry || typeof entry.title !== 'string' || !entry.title || !isLetterboxdUrl(entry.url)) return null;
  return {
    title: entry.title,
    year: isYear(entry.year) ? entry.year : null,
    watched: isDay(entry.watched) ? entry.watched : null,
    rating: isRating(entry.rating) ? entry.rating : null,
    liked: entry.liked === true,
    rewatch: entry.rewatch === true,
    review: typeof entry.review === 'string' && entry.review ? entry.review : null,
    spoilers: entry.spoilers === true,
    url: entry.url,
  };
}

/**
 * Checks what /letterboxd.json held (or the live site's copy, at deploy): null for the committed
 * placeholder or anything malformed, so whatever reads it just hides.
 */
export function toDiary(value: unknown): Diary | null {
  const diary = value as Partial<Diary> | null;
  if (!diary || !Array.isArray(diary.entries) || !isLetterboxdUrl(diary.profileUrl)
    || typeof diary.fetchedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(diary.fetchedAt)
    || Number.isNaN(Date.parse(diary.fetchedAt))) return null;
  const seen = new Set<string>();
  const entries = diary.entries
    .map(toEntry)
    .filter((entry): entry is DiaryEntry => entry !== null && !seen.has(entry.url) && !!seen.add(entry.url))
    .slice(0, DIARY_LIMIT);
  return { profileUrl: diary.profileUrl, fetchedAt: diary.fetchedAt, entries };
}

const relativeDays = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * When a diary date was, from where the visitor is: "today", "yesterday", "5 days ago", then
 * "October 20, 2026" after a month. Diary dates are calendar days, so this counts days, not hours.
 */
export function watchedWhen(day: string, now: Date = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return '';
  const then = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - then) / 86_400_000);
  if (Number.isNaN(days)) return '';
  if (days >= 0 && days <= 30) return relativeDays.format(-days, 'day');
  return new Date(then).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** "★★★½": the rating as Letterboxd draws it. Purely visual; pair it with `ratingLabel`. */
export function ratingStars(rating: number): string {
  return '★'.repeat(Math.floor(rating)) + (rating % 1 ? '½' : '');
}

/** "3.5 out of 5 stars", for screen readers. */
export function ratingLabel(rating: number): string {
  return `${rating} out of 5 stars`;
}
