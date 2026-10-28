import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { GUEST_SUBTITLES_TOKEN, GreetingLine, SKY_LINE, taglines } from '../../../shared/constants/subtitles.const';
import { SkyService } from '../../../shared/sky/sky.service';

/** How long a line stays up before the bubble fades. */
export const SAY_FOR_MS = 7000;
/** The hello waits this long after Home settles. */
export const HELLO_AFTER_MS = 1200;
/** Remembers, for this tab, that Home has said hello. */
export const HELLO_KEY = 'avatar-hello';

/**
 * Morgan's photo on Home, as a button: each press says one of the greeting's lines (his and the
 * visitors', shuffled) in a speech bubble, a visitor's with its handwritten credit. Once a visit it says
 * one on its own, a moment after Home loads: the line about the sky, while there are stars to see, so
 * first-time visitors hear about the best thing on the site; any line otherwise. The bubble fades after
 * a few seconds, or at once on Escape or a press anywhere else. Screen readers hear the lines someone
 * asked for, not the hello.
 */
@Component({
  selector: 'app-avatar-says',
  templateUrl: './avatar-says.html',
  styleUrl: './avatar-says.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape($event)',
    '(document:pointerdown)': 'onPointerDown($event)',
  },
})
export class AvatarSaysComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly sky = inject(SkyService);
  private readonly lines = taglines(inject(GUEST_SUBTITLES_TOKEN));

  /** What the bubble says, or null while it's hidden. */
  protected readonly line = signal<GreetingLine | null>(null);
  /** The last line someone asked for, for the live region. */
  protected readonly spoken = signal('');

  private order: number[] = [];
  private next = 0;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => {
      this.order = shuffled(this.lines.length);
      if (readFlag()) return;
      writeFlag();
      this.timer = setTimeout(() => {
        // The hello points at the sky while there's one to see: that line comes first, the rest stay shuffled.
        const skyLine = this.lines.findIndex(line => line.text === SKY_LINE);
        if (skyLine >= 0 && this.sky.starsShowing()) this.order = [skyLine, ...this.order.filter(i => i !== skyLine)];
        this.say(false);
      }, HELLO_AFTER_MS);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /** The photo was pressed: the next line, out loud. */
  protected press(): void {
    this.say(true);
  }

  protected onEscape(event: Event): void {
    if (!this.line()) return;
    // Handled here, so the site-wide Escape (back to the greeting) doesn't fire too.
    event.preventDefault();
    this.hide();
  }

  protected onPointerDown(event: Event): void {
    if (this.line() && !this.host.nativeElement.contains(event.target as Node | null)) this.hide();
  }

  private say(aloud: boolean): void {
    if (!this.lines.length) return;
    if (!this.order.length) this.order = shuffled(this.lines.length);
    const line = this.lines[this.order[this.next % this.order.length]];
    this.next++;
    this.line.set(line);
    if (aloud) this.spoken.set(line.credit ? `${line.text} ${line.credit}` : line.text);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.hide(), SAY_FOR_MS);
  }

  private hide(): void {
    clearTimeout(this.timer);
    this.line.set(null);
  }
}

/** 0…n-1 in a random order. */
function shuffled(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// Storage can be unavailable (private mode, blocked site data): then the hello just comes every time.
function readFlag(): boolean {
  try {
    return sessionStorage.getItem(HELLO_KEY) === '1';
  } catch {
    return false;
  }
}

function writeFlag(): void {
  try {
    sessionStorage.setItem(HELLO_KEY, '1');
  } catch {
    // Nothing to remember it in.
  }
}
