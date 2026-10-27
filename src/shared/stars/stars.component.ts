import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ratingLabel, ratingStars } from '../letterboxd/letterboxd';

/**
 * A star rating the way Letterboxd draws it (★★★½), in gold, with the number in words for screen
 * readers: the stars themselves are hidden from them, since "black star, black star…" helps nobody.
 */
@Component({
  selector: 'app-stars',
  template: `<span class="stars" aria-hidden="true">{{ stars() }}</span><span class="visually-hidden">{{ label() }}</span>`,
  styles: `
    :host { display: inline; }
    .stars { color: var(--accent-color); font-size: 1.15em; letter-spacing: 0.05em; line-height: 1; white-space: nowrap; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarsComponent {
  /** 0.5 to 5, in half steps. */
  readonly rating = input.required<number>();
  readonly stars = computed(() => ratingStars(this.rating()));
  readonly label = computed(() => `rated ${ratingLabel(this.rating())}`);
}
