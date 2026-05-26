import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';

const SUBTITLES = [
  'a real human man',
  'currently testing in production',
  'relentlessly creating shareholder value',
  'now navigable via keyboard! press those arrow keys!',
];

const CYCLE_INTERVAL_MS = 10000;
const FADE_DURATION_MS = 400;

@Component({
  selector: 'app-greeting-page',
  imports: [RouterLink, MatIconModule, MatIconButton],
  templateUrl: './greeting-page.component.html',
  styleUrl: './greeting-page.component.scss',
})
export class GreetingPageComponent implements OnInit, OnDestroy {
  private currentIndex = Math.floor(Math.random() * SUBTITLES.length);

  protected readonly subtitle = signal(SUBTITLES[this.currentIndex]);
  protected readonly subtitleVisible = signal(true);

  private intervalId?: ReturnType<typeof setInterval>;
  private timeoutId?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.intervalId = setInterval(() => this.cycleSubtitle(), CYCLE_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
    clearTimeout(this.timeoutId);
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
