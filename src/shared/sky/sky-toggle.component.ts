import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SkyService } from './sky.service';

/**
 * Whose sky it is (Cincinnati or the visitor's own), shown in the sky menu.
 * One persistent button, so keyboard focus survives every state change; the
 * status line is a live region. Only the button's click ever asks for a
 * location. Copy is a draft for Morgan.
 */
@Component({
  selector: 'app-sky-toggle',
  template: `
    <p class="sky-toggle" [class.waiting]="!sky.ready()">
      <span>{{ where() }}</span>
      <span aria-hidden="true">·</span>
      <button type="button" (click)="toggle()">{{ action() }}</button>
      <span class="note" role="status">{{ note() }}</span>
    </p>
  `,
  styleUrl: './sky-toggle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkyToggleComponent {
  protected readonly sky = inject(SkyService);

  protected readonly where = computed(() => (this.sky.location().mine ? 'your sky, live' : 'the sky over Cincinnati, live'));
  protected readonly action = computed(() => {
    if (this.sky.status() === 'locating') return 'cancel';
    return this.sky.location().mine ? 'back to Cincinnati' : 'show my sky';
  });
  protected readonly note = computed(() => {
    switch (this.sky.status()) {
      case 'locating':
        return 'finding your sky…';
      case 'failed':
        return 'couldn\'t get a location';
      default:
        return '';
    }
  });

  protected toggle(): void {
    if (this.sky.status() === 'locating' || this.sky.location().mine) this.sky.showCincinnati();
    else this.sky.showMine();
  }
}
