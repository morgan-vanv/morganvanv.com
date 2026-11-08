import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FAVORITE_MEDIA, MediaKind } from '../../../shared/constants/favorite-media.const';

/**
 * The Favorite Media tile's art: a fan of covers off the wall, the first film, show and book and then
 * the second film (the 2:3 ones; albums are square). Decorative: the wall itself names them.
 */
@Component({
  selector: 'app-media-fan',
  template: `
    @for (cover of covers; track cover) {
      <img class="cover" [src]="cover" alt="" width="400" height="600" decoding="async" />
    }
  `,
  styleUrl: './media-fan.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaFanComponent {
  readonly covers = fanCovers();
}

export function fanCovers(): string[] {
  const of = (kind: MediaKind) => FAVORITE_MEDIA.filter(pick => pick.kind === kind && pick.cover).map(pick => pick.cover!);
  const [films, tv, books] = [of('film'), of('tv'), of('book')];
  return [films[0], tv[0], books[0], films[1]].filter((cover): cover is string => !!cover);
}
