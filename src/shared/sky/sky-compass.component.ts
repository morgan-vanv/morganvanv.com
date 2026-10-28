import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IconComponent } from '../icon/icon.component';
import { SkyService } from './sky.service';
import { TURN_STEP, compassText } from './sky-view';

/**
 * Free look's compass, shown while looking up: which way the sky is turned
 * ("facing NNW · 338°") and buttons that turn it, for anyone who'd rather not
 * (or can't) drag. Buttons, not arrow keys: ← →
 * stay page navigation. A polite live region says where each turn leaves you.
 * Small, so it's in main (unlike the panorama and the dragging, which load with
 * the first look up); shown only once free look is on. Copy is a draft for Morgan.
 */
@Component({
  selector: 'app-sky-compass',
  imports: [IconComponent],
  templateUrl: './sky-compass.component.html',
  styleUrl: './sky-compass.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkyCompassComponent {
  protected readonly sky = inject(SkyService);
  protected readonly reading = computed(() => compassText(this.sky.view()));
  protected readonly turnStep = TURN_STEP;
}
