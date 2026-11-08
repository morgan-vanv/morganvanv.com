import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StatsFmTopAlbum } from '../../../shared/services/stats-fm.service';

/**
 * The Music tile's art: this month's top album (stats.fm) in its sleeve, the record sliding out of it,
 * further when the tile is highlighted. A blank sleeve until the album arrives, or if it doesn't.
 */
@Component({
  selector: 'app-music-sleeve',
  template: `
    <span class="record" aria-hidden="true"></span>
    <span class="sleeve">
      @if (album(); as top) {
        <img [src]="top.album.image" [alt]="alt()" width="300" height="300" decoding="async" />
      }
    </span>
  `,
  styleUrl: './music-sleeve.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MusicSleeveComponent {
  readonly album = input<StatsFmTopAlbum | null>(null);

  readonly alt = computed(() => {
    const top = this.album();
    if (!top) return '';
    const artist = top.album.artists[0]?.name;
    return `My top album this month: ${top.album.name}${artist ? `, ${artist}` : ''}`;
  });
}
