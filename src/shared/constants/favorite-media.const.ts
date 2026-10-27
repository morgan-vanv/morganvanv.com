/**
 * The Favorite Media wall on /interests: films, TV and books Morgan picked by hand. Nothing here is
 * fetched or ranked; the order below is the order on the wall. (What he's watched lately is a separate
 * feed, from Letterboxd: src/shared/letterboxd/.)
 *
 * Four picks per shelf (Morgan, 2026-10-27): the shelves are laid out as 2×2 grids of covers, and a
 * test holds each shelf to four (or none, while it's empty).
 *
 * Adding one: an entry below, and its cover as `public/media/<id>.webp`, encoded from a full-size
 * original at 400×600 (2:3; shown up to about 200px wide). Without a cover the card sets the title
 * in type instead.
 */
export type MediaKind = 'film' | 'tv' | 'book';

export interface FavoriteMedia {
  /** Unique and URL-safe; also the cover's file name. */
  id: string;
  kind: MediaKind;
  title: string;
  /** A short blurb, in Morgan's words: a line, maybe two. */
  blurb?: string;
  /** `/media/<id>.webp`, 2:3. */
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
];

// [TODO: Morgan] the picks: four films, four shows, four books, each with a title and a short blurb.
export const FAVORITE_MEDIA: readonly FavoriteMedia[] = [];
