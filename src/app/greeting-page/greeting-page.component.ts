import { Component, DestroyRef, Injector, afterNextRender, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { RecentStreamService } from '../../shared/services/recent-stream.service';
import { SkyService } from '../../shared/sky/sky.service';
import { GUEST_SUBTITLES_TOKEN, GreetingLine, taglines } from '../../shared/constants/subtitles.const';
import { FIRST_STATE, TYPE_TIMING, caretBlinks, creditShows, lineAt, shownText, step } from './typewriter';
import { GreetingDoorsComponent } from './greeting-doors/greeting-doors';

export type { GreetingLine } from '../../shared/constants/subtitles.const';

/**
 * The front door: Morgan's name over the open sky, a typed tagline under it (his lines, then the
 * visitors' he approved, with their handwritten credit), and two ways in: "come on in" to Home, or
 * "just look up" (the ☾ menu's look up). Two more are hidden in the painting (`app-greeting-doors`).
 */
@Component({
  selector: 'app-greeting-page',
  imports: [RouterLink, IconComponent, GreetingDoorsComponent],
  templateUrl: './greeting-page.component.html',
  styleUrl: './greeting-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GreetingPageComponent {
  private readonly recentStream = inject(RecentStreamService);
  private readonly sky = inject(SkyService);
  private readonly injector = inject(Injector);

  /** Morgan's own lines and the visitors' ones he approved, which never change while the page is open. */
  private readonly fixedLines: readonly GreetingLine[] = taglines(inject(GUEST_SUBTITLES_TOKEN));

  /** The fixed lines plus, once known, a live "last listened" line that rotates in with them. */
  protected readonly subtitles = computed<readonly GreetingLine[]>(() => {
    const live = this.recentStream.summary();
    return live ? [...this.fixedLines, { text: live, credit: null }] : this.fixedLines;
  });

  /**
   * Where the typewriter is (typewriter.ts). The prerendered page shows the first line whole, so
   * hydration matches; in the browser the next line typed is a random one, and on in order from there.
   */
  private readonly typing = signal(FIRST_STATE);
  protected readonly line = computed(() => lineAt(this.subtitles(), this.typing().index));
  protected readonly typed = computed(() => shownText(this.typing(), this.subtitles()));
  protected readonly blinking = computed(() => caretBlinks(this.typing()));
  protected readonly creditOn = computed(() => creditShows(this.typing(), this.subtitles()));

  private timer?: ReturnType<typeof setTimeout>;
  /** How long the current state lasts: a hidden tab drops the timer, and coming back waits this long again. */
  private wait: number = TYPE_TIMING.restMs;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.typing.update(state => ({ ...state, queued: Math.floor(Math.random() * this.fixedLines.length) }));
      const onVisibility = () => this.schedule(this.wait);
      document.addEventListener('visibilitychange', onVisibility);
      this.schedule(TYPE_TIMING.restMs);
      destroyRef.onDestroy(() => {
        clearTimeout(this.timer);
        document.removeEventListener('visibilitychange', onVisibility);
      });
    });
  }

  /** Waits, then takes the next step; nothing runs while the tab is hidden. */
  private schedule(delay: number): void {
    clearTimeout(this.timer);
    this.wait = delay;
    if (document.visibilityState === 'hidden') return;
    this.timer = setTimeout(() => {
      const next = step(this.typing(), this.subtitles(), { reducedMotion: reducedMotion(), random: Math.random });
      this.typing.set(next.state);
      this.schedule(next.delay);
    }, delay);
  }

  /** Hides the page, as the ☾ menu's "hide the page" does; focus goes to the ☾ (this button is about to be inert). */
  protected lookUp(): void {
    this.sky.enterLookUp();
    afterNextRender(() => {
      (document.querySelector<HTMLElement>('.sky-button') ?? document.querySelector<HTMLElement>('app-sky-look-up .back'))?.focus();
    }, { injector: this.injector });
  }
}

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
