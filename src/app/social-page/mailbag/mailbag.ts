import { ChangeDetectionStrategy, Component, InjectionToken, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../shared/icon/icon.component';
import { MAILBAG } from '../../../generated/mailbag';
import { MailbagLetter, dayLabel } from '../../../shared/visitor-content/visitor-content';

/**
 * The questions Morgan answered, newest first: one file each in content/mailbag/, gathered at build time
 * (scripts/build-visitor-content.mjs). A token so specs can supply their own.
 */
export const MAILBAG_TOKEN = new InjectionToken<readonly MailbagLetter[]>('MAILBAG', {
  providedIn: 'root',
  factory: () => MAILBAG,
});

/** How many cards show on each side of the one in front; the rest wait out of sight. */
export const SIDE_CARDS = 2;

/** How far a swipe has to travel sideways (CSS px) to turn the rolodex. */
export const SWIPE_PX = 40;

/**
 * Where a card sits in the rolodex, by its distance from the front one (negative: newer, to the left).
 * `x` is in units of the stage's `--spread`, `rotate` in degrees (cards on either side turn their inner
 * edge away, so they fan toward the front), and `depth` is its stacking order.
 */
export interface CardPose {
  readonly x: number;
  readonly rotate: number;
  readonly scale: number;
  readonly opacity: number;
  readonly depth: number;
  readonly shown: boolean;
}

export function cardPose(offset: number): CardPose {
  const away = Math.abs(offset);
  const side = Math.sign(offset);
  if (away === 0) {
    return { x: 0, rotate: 0, scale: 1, opacity: 1, depth: SIDE_CARDS + 1, shown: true };
  }
  // Out of sight: just past the last shown card, so it slides in from there rather than from nowhere.
  const steps = Math.min(away, SIDE_CARDS + 1) - 1;
  return {
    x: side * (1 + steps * 0.37),
    rotate: -side * 42,
    scale: 0.86 - steps * 0.06,
    opacity: away > SIDE_CARDS ? 0 : away === 1 ? 0.8 : 0.45,
    depth: Math.max(0, SIDE_CARDS + 1 - away),
    shown: away <= SIDE_CARDS,
  };
}

/** "3 letters", "1 letter", or "empty, for now" (draft copy). */
export function letterCountLabel(count: number): string {
  return count ? `${count} letter${count === 1 ? '' : 's'}` : 'empty, for now';
}

/**
 * The mailbag on /social: questions visitors sent through the Contact form, and Morgan's answers, as a
 * rolodex of folded notes. The newest faces you; up to SIDE_CARDS older ones fan away to the right (and
 * newer ones to the left once you've turned it), so the panel stays the same height however many letters
 * there are. ‹ › turn it, as do a swipe and a click on a side card; there are no arrow keys, because ← →
 * change page everywhere on the site.
 *
 * Only the front card is live: the others are `inert` (out of the tab order and the accessibility tree),
 * and their click targets are mouse-and-touch only, since ‹ › and the polite "2 / 5" are the way round for
 * everyone. The front note shows the question and the date; its answer is folded under a crease until the
 * visitor unfolds it (a real button with `aria-expanded`), and turning the rolodex folds it back up.
 *
 * The question is the visitor's exact words and only ever renders as text. The answer is HTML made at
 * build time from Morgan's Markdown (renderAnswer: a small allowlist of tags, everything escaped first),
 * and Angular's sanitizer checks it again on the way in. Everything is static, so every letter is in the
 * prerendered page, the newest in front.
 */
@Component({
  selector: 'app-mailbag',
  imports: [RouterLink, IconComponent],
  templateUrl: './mailbag.html',
  styleUrl: './mailbag.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MailbagComponent {
  protected readonly letters = inject(MAILBAG_TOKEN).map(letter => ({ ...letter, askedLabel: dayLabel(letter.asked) }));
  protected readonly countLabel = letterCountLabel(this.letters.length);

  /** The letter in front (0 is the newest). */
  protected readonly current = signal(0);
  /** Whether the front letter's answer is unfolded; turning the rolodex folds it again. */
  protected readonly unfolded = signal(false);
  protected readonly poses = computed(() => this.letters.map((_, i) => cardPose(i - this.current())));
  protected readonly position = computed(() => `${this.current() + 1} / ${this.letters.length}`);
  protected readonly atNewest = computed(() => this.current() === 0);
  protected readonly atOldest = computed(() => this.current() === this.letters.length - 1);

  private swipeStart: { x: number; y: number; id: number } | null = null;

  protected show(index: number): void {
    const next = Math.max(0, Math.min(this.letters.length - 1, index));
    if (next !== this.current()) {
      this.current.set(next);
      this.unfolded.set(false);
    }
  }

  protected newer(): void {
    this.show(this.current() - 1);
  }

  protected older(): void {
    this.show(this.current() + 1);
  }

  protected toggleUnfolded(): void {
    this.unfolded.update(open => !open);
  }

  // A sideways swipe on the stage turns it (touch and pen; a mouse has the side cards and ‹ ›). The stage
  // is `touch-action: pan-y`, so up and down still scroll the page.
  protected swipeDown(event: PointerEvent): void {
    this.swipeStart = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY, id: event.pointerId };
  }

  protected swipeUp(event: PointerEvent): void {
    const start = this.swipeStart;
    this.swipeStart = null;
    if (!start || start.id !== event.pointerId) {
      return;
    }
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) {
        this.older();
      } else {
        this.newer();
      }
    }
  }

  protected swipeCancel(): void {
    this.swipeStart = null;
  }
}
