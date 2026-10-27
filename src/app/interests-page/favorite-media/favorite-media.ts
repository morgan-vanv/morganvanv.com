import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FAVORITE_MEDIA, FavoriteMedia, MEDIA_SHELVES, MediaKind } from '../../../shared/constants/favorite-media.const';
import { LetterboxdDiaryComponent } from './letterboxd-diary/letterboxd-diary';

export interface Shelf {
  kind: MediaKind;
  label: string;
  items: readonly FavoriteMedia[];
  countLabel: string;
}

/**
 * The Favorite Media section: the hand-picked wall (one shelf each for films, TV and books, four covers
 * each, side by side on wide screens and one at a time on tablets and phones), then Morgan's Letterboxd
 * diary as its own feed. A card is a cover, a title and a short blurb; nothing else.
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
      const items = this.items().filter(item => item.kind === kind);
      return { kind, label, items, countLabel: `${items.length} ${items.length === 1 ? 'pick' : 'picks'}` };
    })
    .filter(shelf => shelf.items.length > 0));

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
