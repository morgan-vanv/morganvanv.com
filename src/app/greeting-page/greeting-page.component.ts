import { Component, DestroyRef, afterNextRender, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/icon/icon.component';

const SUBTITLES = [
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
  // The prerendered page always shows the first subtitle so hydration matches;
  // the browser then picks a random one and starts cycling.
  private currentIndex = 0;

  protected readonly subtitle = signal(SUBTITLES[this.currentIndex]);
  protected readonly subtitleVisible = signal(true);

  private intervalId?: ReturnType<typeof setInterval>;
  private timeoutId?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => {
      this.currentIndex = Math.floor(Math.random() * SUBTITLES.length);
      this.subtitle.set(SUBTITLES[this.currentIndex]);
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
      this.currentIndex = (this.currentIndex + 1) % SUBTITLES.length;
      this.subtitle.set(SUBTITLES[this.currentIndex]);
      this.subtitleVisible.set(true);
    }, FADE_DURATION_MS);
  }
}
