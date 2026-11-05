import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * How many columns the "next project" slot spans so it fills the rest of the last row: one, two, or
 * (when the projects fill their rows exactly) the whole row, where it lies down as a short strip.
 */
export function nextSlotSpan(projectCount: number, columns: number): number {
  return columns - (projectCount % columns);
}

/**
 * The last thing on /projects: an empty poster frame for whatever Morgan starts next. Not a project
 * (not in PROJECTS, not counted, no h2): a dashed poster with the under-construction sign for art and
 * a way to suggest one through the contact form on Home. The page tells it how wide it is.
 */
@Component({
  selector: 'app-next-project-slot',
  imports: [RouterLink],
  templateUrl: './next-project-slot.html',
  styleUrl: './next-project-slot.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--slot-span]': 'span()',
    '[class.strip]': 'strip()',
  },
})
export class NextProjectSlotComponent {
  /** Grid columns to span on wide screens (tablets and phones stack it like the rest). */
  readonly span = input(1);
  /** How many columns the grid has there. */
  readonly columns = input(3);
  /** The whole row: the art beside the words instead of above them. */
  readonly strip = computed(() => this.span() >= this.columns());
}
