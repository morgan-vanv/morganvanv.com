import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LetterboxdService } from '../../../../shared/letterboxd/letterboxd.service';
import { StarsComponent } from '../../../../shared/stars/stars.component';

/** How many diary entries the section shows; the rest are a link away. */
export const DIARY_SHOWN = 9;

/** "Oct" and "20" for the date rail, from a YYYY-MM-DD diary date (as written, no time zone games). */
export function diaryDay(day: string): { month: string; day: string } {
  const date = new Date(`${day}T00:00:00Z`);
  return {
    month: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
    day: String(date.getUTCDate()),
  };
}

/**
 * Morgan's Letterboxd diary, its own feed under the wall: newest first, with a Letterboxd-style date
 * rail, gold stars, ♥ and ↻, and the review. A spoiler-marked review stays on Letterboxd. Renders
 * nothing without a diary (the placeholder in dev and PR checks, or a deploy that couldn't read the feed).
 */
@Component({
  selector: 'app-letterboxd-diary',
  imports: [StarsComponent],
  templateUrl: './letterboxd-diary.html',
  styleUrl: './letterboxd-diary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LetterboxdDiaryComponent {
  readonly diary = inject(LetterboxdService).diary;
  readonly entries = computed(() => (this.diary()?.entries ?? []).slice(0, DIARY_SHOWN).map(entry => ({
    ...entry,
    date: entry.watched ? diaryDay(entry.watched) : null,
  })));
}
