/**
 * The Favorite Media wall on /interests: films, TV and books Morgan picked by hand. Nothing here is
 * fetched or ranked; the order below is the order on the wall. (What he's watched lately is a separate
 * feed, from Letterboxd: src/shared/letterboxd/.)
 *
 * Adding one: an entry below, and optionally its cover as `public/media/<id>.webp`, encoded from a
 * full-size original at 240×360 (2:3; it's shown at about 120px wide). Without a cover the card sets
 * the title in type instead, which is fine too.
 */
export type MediaKind = 'film' | 'tv' | 'book';

export interface FavoriteMedia {
  /** Unique and URL-safe; also the cover's file name. */
  id: string;
  kind: MediaKind;
  title: string;
  year?: number;
  /** Director, creator or author. */
  by?: string;
  /** `/media/<id>.webp`, 2:3. */
  cover?: string;
  /** Why it's here, in Morgan's words. A line or two. */
  note?: string;
  /** Where the card links: its Letterboxd, Goodreads or similar page. */
  href?: string;
}

/** The wall's shelves, in order. A shelf with nothing on it isn't shown. */
export const MEDIA_SHELVES: readonly { kind: MediaKind; label: string }[] = [
  { kind: 'film', label: 'Films' },
  { kind: 'tv', label: 'TV' },
  { kind: 'book', label: 'Books' },
];

// [TODO: Morgan] the picks themselves: title, year, who made it, and a line on why, for each.
export const FAVORITE_MEDIA: readonly FavoriteMedia[] = [];
