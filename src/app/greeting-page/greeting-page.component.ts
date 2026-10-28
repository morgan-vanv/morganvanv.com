import { Component, DestroyRef, afterNextRender, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { RecentStreamService } from '../../shared/services/recent-stream.service';
import { GUEST_SUBTITLES_TOKEN, GreetingLine, taglines } from '../../shared/constants/subtitles.const';

export type { GreetingLine } from '../../shared/constants/subtitles.const';


const CYCLE_INTERVAL_MS = 10000;
const FADE_DURATION_MS = 400;

@Component({
  selector: 'app-greeting-page',
  imports: [RouterLink, IconComponent],
  templateUrl: './greeting-page.component.html',
  styleUrl: './greeting-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GreetingPageComponent {
  private readonly recentStream = inject(RecentStreamService);

  // The prerendered page always shows the first subtitle so hydration matches;
  // the browser then picks a random one and starts cycling.
  private readonly currentIndex = signal(0);

  /** Morgan's own lines and the visitors' ones he approved, which never change while the page is open. */
  private readonly fixedLines: readonly GreetingLine[] = taglines(inject(GUEST_SUBTITLES_TOKEN));

  /** The fixed lines plus, once known, a live "last listened" line that rotates in with them. */
  protected readonly subtitles = computed<readonly GreetingLine[]>(() => {
    const live = this.recentStream.summary();
    return live ? [...this.fixedLines, { text: live, credit: null }] : this.fixedLines;
  });

  protected readonly subtitle = computed(() => {
    const list = this.subtitles();
    return list[this.currentIndex() % list.length];
  });
  protected readonly subtitleVisible = signal(true);

  private intervalId?: ReturnType<typeof setInterval>;
  private timeoutId?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => {
      this.currentIndex.set(Math.floor(Math.random() * this.fixedLines.length));
      this.intervalId = setInterval(() => this.cycleSubtitle(), CYCLE_INTERVAL_MS);
    });
    inject(DestroyRef).onDestroy(() => {
      clearInterval(this.intervalId);
      clearTimeout(this.timeoutId);
    });
  }

  private cycleSubtitle(): void {
    this.subtitleVisible.set(false);
    this.timeoutId = setTimeout(() => {
      this.currentIndex.update(i => (i + 1) % this.subtitles().length);
      this.subtitleVisible.set(true);
    }, FADE_DURATION_MS);
  }
}
