import { Component, ChangeDetectionStrategy, computed, input, signal } from '@angular/core';
import { LAB_LOG, LAB_LOG_TAIL, labLogTail } from '../../../shared/constants/lab-log.const';

/**
 * The lab log on /lab (look B of the lab-log mockups, "tail -f"): Morgan's one-liners about the homelab as a
 * terminal tail inside a panel. The last `LAB_LOG_TAIL` lines show, oldest first and the newest last, the
 * two oldest of them faded as if scrolled up to; a gold block caret blinks after a resting line. "[ the whole
 * log › ]" unfolds every entry in place (`aria-expanded`) and becomes "[ just the latest › ]". No dates, no
 * times: the order carries it. Decorative lines (the prompt, the resting line and the caret) are hidden from
 * screen readers; the entries are a plain ordered list.
 */
@Component({
  selector: 'app-lab-log',
  templateUrl: './lab-log.component.html',
  styleUrl: './lab-log.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabLogComponent {
  /** The log, oldest first; `LAB_LOG` unless a test says otherwise. */
  readonly entries = input<readonly string[]>(LAB_LOG);
  /** How many show until the whole log is asked for. */
  readonly tail = input(LAB_LOG_TAIL);

  /** Whether every entry is showing. */
  protected readonly all = signal(false);

  protected readonly total = computed(() => this.entries().length);
  protected readonly folded = computed(() => this.total() > this.tail());
  protected readonly shown = computed(() => this.all() ? this.entries() : labLogTail(this.entries(), this.tail()));
  /** "the last 8 of 23", or just the count once everything shows (or there was never more). */
  protected readonly countLine = computed(() => {
    const total = this.total();
    const entries = total === 1 ? 'entry' : 'entries';
    return this.folded() && !this.all() ? `the last ${this.shown().length} of ${total}` : `${total} ${entries}`;
  });

  /** The two oldest lines on screen fade, like lines scrolled up to; never with fewer than three showing. */
  protected fade(index: number): number | null {
    if (this.shown().length < 3) return null;
    return index === 0 ? 0.4 : index === 1 ? 0.6 : null;
  }

  protected toggle(): void {
    this.all.update(all => !all);
  }
}
