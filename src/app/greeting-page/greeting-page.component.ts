import { Component, DestroyRef, afterNextRender, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';
import { RecentStreamService } from '../../shared/services/recent-stream.service';

export const SUBTITLES = [
  'a real human man',
  'currently testing in production',
  'relentlessly creating shareholder value',
  'now navigable via keyboard! press those arrow keys!',
  'probably clicking on virtual trees and rocks',
];

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

  /** The static jokes plus, once known, a live "last listened" line that rotates in with them. */
  protected readonly subtitles = computed(() => {
    const live = this.recentStream.summary();
    return live ? [...SUBTITLES, live] : SUBTITLES;
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
      this.currentIndex.set(Math.floor(Math.random() * SUBTITLES.length));
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
