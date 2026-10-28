import { ChangeDetectionStrategy, Component, ElementRef, InjectionToken, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
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

/** How many letters show before "older letters". */
export const NEWEST_SHOWN = 2;

/** The tilts a note can sit at, in degrees: small enough to read straight, enough to look set down by hand. */
export const NOTE_TILTS = [-1.2, -0.8, -0.5, 0.5, 0.8, 1.1] as const;

/**
 * A letter's tilt, from its id, so a note always sits the same way (and the prerendered page matches the
 * hydrated one).
 */
export function noteTilt(id: string): string {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return `${NOTE_TILTS[hash % NOTE_TILTS.length]}deg`;
}

/** "3 letters", "1 letter", or "empty, for now" (draft copy). */
export function letterCountLabel(count: number): string {
  return count ? `${count} letter${count === 1 ? '' : 's'}` : 'empty, for now';
}

/**
 * The mailbag on /social: questions visitors sent through the Contact form, and Morgan's answers.
 *
 * Each letter is a folded note: the question and the date on top, the answer folded away under a crease
 * until the visitor unfolds it (a real button with `aria-expanded`; the folded answer is `inert`, so it's
 * out of the tab order and the accessibility tree until it's open).
 *
 * The question is the visitor's exact words and only ever renders as text. The answer is HTML made at
 * build time from Morgan's Markdown (renderAnswer: a small allowlist of tags, everything escaped first),
 * and Angular's sanitizer checks it again on the way in. Everything is static, so it's all in the
 * prerendered page; older letters are there too, just hidden until asked for.
 */
@Component({
  selector: 'app-mailbag',
  imports: [RouterLink, IconComponent],
  templateUrl: './mailbag.html',
  styleUrl: './mailbag.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MailbagComponent {
  private readonly injector = inject(Injector);
  private readonly toggle = viewChild<ElementRef<HTMLButtonElement>>('toggle');

  protected readonly letters = inject(MAILBAG_TOKEN).map(letter => ({
    ...letter,
    askedLabel: dayLabel(letter.asked),
    tilt: noteTilt(letter.id),
  }));
  protected readonly newestShown = NEWEST_SHOWN;
  protected readonly olderCount = Math.max(0, this.letters.length - NEWEST_SHOWN);
  protected readonly countLabel = letterCountLabel(this.letters.length);
  protected readonly showOlder = signal(false);
  /** The ids of the letters unfolded right now; every letter starts folded. */
  protected readonly unfolded = signal<ReadonlySet<string>>(new Set());

  protected toggleLetter(id: string): void {
    this.unfolded.update(open => {
      const next = new Set(open);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  protected toggleOlder(): void {
    const closing = this.showOlder();
    this.showOlder.set(!closing);
    // Folding the older letters away pulls the button up past them: keep it in view.
    if (closing) {
      afterNextRender(() => this.toggle()?.nativeElement.scrollIntoView?.({ block: 'nearest' }), { injector: this.injector });
    }
  }
}
