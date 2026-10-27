import { ChangeDetectionStrategy, Component, ElementRef, InjectionToken, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
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

/** "3 letters", "1 letter", or "empty, for now" (draft copy). */
export function letterCountLabel(count: number): string {
  return count ? `${count} letter${count === 1 ? '' : 's'}` : 'empty, for now';
}

/**
 * The mailbag on /social: questions visitors sent through the Contact form, and Morgan's answers.
 *
 * The question is the visitor's exact words and only ever renders as text. The answer is HTML made at
 * build time from Morgan's Markdown (renderAnswer: a small allowlist of tags, everything escaped first),
 * and Angular's sanitizer checks it again on the way in. Everything is static, so it's all in the
 * prerendered page; older letters are there too, just hidden until asked for.
 */
@Component({
  selector: 'app-mailbag',
  imports: [RouterLink],
  templateUrl: './mailbag.html',
  styleUrl: './mailbag.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MailbagComponent {
  private readonly injector = inject(Injector);
  private readonly toggle = viewChild<ElementRef<HTMLButtonElement>>('toggle');

  protected readonly letters = inject(MAILBAG_TOKEN).map(letter => ({ ...letter, askedLabel: dayLabel(letter.asked) }));
  protected readonly newestShown = NEWEST_SHOWN;
  protected readonly olderCount = Math.max(0, this.letters.length - NEWEST_SHOWN);
  protected readonly countLabel = letterCountLabel(this.letters.length);
  protected readonly showOlder = signal(false);

  protected toggleOlder(): void {
    const closing = this.showOlder();
    this.showOlder.set(!closing);
    // Folding the older letters away pulls the button up past them: keep it in view.
    if (closing) {
      afterNextRender(() => this.toggle()?.nativeElement.scrollIntoView?.({ block: 'nearest' }), { injector: this.injector });
    }
  }
}
