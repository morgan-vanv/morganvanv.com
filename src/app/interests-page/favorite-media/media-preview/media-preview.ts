import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LetterboxdService } from '../../../../shared/letterboxd/letterboxd.service';
import { watchedWhen } from '../../../../shared/letterboxd/letterboxd';
import { StarsComponent } from '../../../../shared/stars/stars.component';

/**
 * The collapsed Favorite Media tile's preview: the last film in Morgan's Letterboxd diary, the way the
 * Music tile shows the last song. Not a link (the tile is the control). Nothing without a diary.
 */
@Component({
  selector: 'app-media-preview',
  imports: [StarsComponent],
  template: `
    @if (latest(); as entry) {
      <span class="last-watched">
        <span class="label">Last watched@if (when()) {<span class="when"> · {{ when() }}</span>}</span>
        <span class="title">{{ entry.title }}@if (entry.year) {<span class="year"> {{ entry.year }}</span>}</span>
        @if (entry.rating) {<app-stars [rating]="entry.rating" />}
      </span>
    }
  `,
  styleUrl: './media-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaPreviewComponent {
  readonly latest = inject(LetterboxdService).latest;
  readonly when = computed(() => {
    const watched = this.latest()?.watched;
    return watched ? watchedWhen(watched) : '';
  });
}
