/**
 * The Favorite Media wall on /interests: films, TV, books and albums Morgan picked by hand. Nothing here
 * is fetched or ranked; the order below is the order on the wall. (What he's watched lately is a separate
 * feed, from Letterboxd: src/shared/letterboxd/.)
 *
 * Up to four picks per shelf (Morgan, 2026-10-27); a shelf with fewer keeps the rest of its four slots
 * as blank spaces, so the grid stays even while picks are still to come. A test holds each to four.
 *
 * Adding one: an entry below, and its cover as `public/media/<id>.webp`, encoded from a full-size
 * original at 400×600 (2:3), or 400×400 for an album (square). Without a cover the card sets the title
 * in type instead.
 */
export type MediaKind = 'film' | 'tv' | 'book' | 'album';

export interface FavoriteMedia {
  /** Unique and URL-safe; also the cover's file name. */
  id: string;
  kind: MediaKind;
  title: string;
  /** Who made it, shown under the title: the author of a book, the artist of an album. */
  by?: string;
  /** A short blurb, in Morgan's words: a line, maybe two. */
  blurb?: string;
  /** `/media/<id>.webp`: 2:3, or square for an album. */
  cover?: string;
  /** Where the card links: its Letterboxd, Goodreads or similar page. */
  href?: string;
}

export const PICKS_PER_SHELF = 4;

/** The wall's shelves, in order. A shelf with nothing on it isn't shown. */
export const MEDIA_SHELVES: readonly { kind: MediaKind; label: string }[] = [
  { kind: 'film', label: 'Films' },
  { kind: 'tv', label: 'TV' },
  { kind: 'book', label: 'Books' },
  { kind: 'album', label: 'Albums' },
];

// Morgan's picks, 2026-10-27. [TODO: Morgan] two more books; blurbs, links and covers if he wants them.
export const FAVORITE_MEDIA: readonly FavoriteMedia[] = [
  { id: 'good-will-hunting', kind: 'film', title: 'Good Will Hunting' },
  { id: 'blade-runner-2049', kind: 'film', title: 'Blade Runner 2049' },
  { id: 'monty-python-and-the-holy-grail', kind: 'film', title: 'Monty Python and the Holy Grail' },
  { id: 'o-brother-where-art-thou', kind: 'film', title: 'O Brother, Where Art Thou?' },

  { id: 'avatar-the-last-airbender', kind: 'tv', title: 'Avatar: The Last Airbender' },
  { id: 'the-sopranos', kind: 'tv', title: 'The Sopranos' },
  { id: 'the-wire', kind: 'tv', title: 'The Wire' },
  { id: 'atlanta', kind: 'tv', title: 'Atlanta' },

  { id: 'thinking-fast-and-slow', kind: 'book', title: 'Thinking, Fast and Slow', by: 'Daniel Kahneman' },
  { id: 'east-of-eden', kind: 'book', title: 'East of Eden', by: 'John Steinbeck' },

  { id: 'modal-soul', kind: 'album', title: 'Modal Soul', by: 'Nujabes' },
  { id: 'blonde', kind: 'album', title: 'Blonde', by: 'Frank Ocean' },
  { id: 'all-my-heroes-are-cornballs', kind: 'album', title: 'All My Heroes Are Cornballs', by: 'JPEGMAFIA' },
  { id: 'donuts', kind: 'album', title: 'Donuts', by: 'J Dilla' },
];
