import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SkyService } from './sky.service';

/**
 * The one control for the live sky: whose sky it is. Hidden until the sky
 * has actually drawn, so it never offers something that isn't there.
 * Copy is a draft for Morgan.
 */
@Component({
  selector: 'app-sky-toggle',
  template: `
    @if (sky.ready()) {
      <p class="sky-toggle">
        @switch (sky.status()) {
          @case ('locating') {
            <span>finding your sky…</span>
          }
          @default {
            <span>{{ sky.location().mine ? 'your sky, live' : 'the sky over Cincinnati, live' }}</span>
            <span aria-hidden="true">·</span>
            @if (sky.location().mine) {
              <button type="button" (click)="sky.showCincinnati()">back to Cincinnati</button>
            } @else {
              <button type="button" (click)="sky.showMine()">show my sky</button>
            }
            @if (sky.status() === 'failed') {
              <span class="note" role="status">(couldn't get a location)</span>
            }
          }
        }
      </p>
    }
  `,
  styleUrl: './sky-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkyToggleComponent {
  protected readonly sky = inject(SkyService);
}
