import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FAVORITE_MEDIA, FavoriteMedia, MEDIA_SHELVES, MediaKind, PICKS_PER_SHELF } from '../../../shared/constants/favorite-media.const';
import { LetterboxdDiaryComponent } from './letterboxd-diary/letterboxd-diary';

export interface Shelf {
  kind: MediaKind;
  label: string;
  items: readonly FavoriteMedia[];
  /** Empty slots that keep a short shelf's grid even (one per pick still to come). */
  blanks: readonly number[];
  countLabel: string;
}

/** Shelves sit two across on wide screens (Films | TV over Books | Albums), each a row of four. */
const SHELF_COLUMNS = 2;

/**
 * The Favorite Media section: the hand-picked wall (a shelf each for films, TV, books and albums, four
 * covers each; two shelves across on wide screens, one at a time on tablets and phones), then Morgan's
 * Letterboxd diary as its own feed. A card is a cover, a title, who made it (books and albums) and a
 * short blurb when there is one.
 */
@Component({
  selector: 'app-favorite-media',
  imports: [NgTemplateOutlet, LetterboxdDiaryComponent],
  templateUrl: './favorite-media.html',
  styleUrl: './favorite-media.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoriteMediaComponent {
  /** What's on the wall; the constant, except in tests. */
  readonly items = input<readonly FavoriteMedia[]>(FAVORITE_MEDIA);

  readonly shelves = computed<Shelf[]>(() => MEDIA_SHELVES
    .map(({ kind, label }) => {
      const items = this.items().filter(item => item.kind === kind).slice(0, PICKS_PER_SHELF);
      const blanks = Array.from({ length: PICKS_PER_SHELF - items.length }, (_, i) => i);
      return { kind, label, items, blanks, countLabel: `${items.length} ${items.length === 1 ? 'pick' : 'picks'}` };
    })
    .filter(shelf => shelf.items.length > 0));

  readonly columns = computed(() => Math.min(this.shelves().length, SHELF_COLUMNS));

  private readonly picked = signal<MediaKind | null>(null);
  /** The shelf shown on tablets and phones: the one picked, else the first. */
  readonly activeKind = computed(() => {
    const kinds = this.shelves().map(shelf => shelf.kind);
    const picked = this.picked();
    return picked && kinds.includes(picked) ? picked : kinds[0] ?? null;
  });

  show(kind: MediaKind): void {
    this.picked.set(kind);
  }
}
