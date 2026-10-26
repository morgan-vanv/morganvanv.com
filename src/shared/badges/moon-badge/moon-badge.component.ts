import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { SkyService } from '../../sky/sky.service';
import { litPath, phaseName, phaseShort } from './moon-phase';

/**
 * The Moon's real phase, from the same numbers the sky draws it with (so `?sky-at=` moves it too).
 * Opens the ☾ menu. Nothing until the sky has computed the Moon (astronomy-engine loads in the browser).
 */
@Component({
  selector: 'app-moon-badge',
  imports: [BadgeComponent],
  templateUrl: './moon-badge.component.html',
  styleUrl: './moon-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoonBadgeComponent {
  protected readonly sky = inject(SkyService);

  readonly moon = computed(() => {
    const moon = this.sky.upNow()?.detail?.moon;
    if (!moon) return null;
    const lit = Math.round(moon.illuminated * 100);
    const name = phaseName(moon.phase);
    const height = Math.round(moon.alt);
    return {
      value: `${lit}% · ${phaseShort(moon.phase)}`,
      path: litPath(moon.phase),
      popover: {
        title: 'The Moon, tonight',
        rows: [
          { label: 'Phase', value: name },
          { label: 'Lit', value: `${lit}%` },
          { label: 'Height', value: height > 0 ? `${height}° up` : 'below the horizon' },
        ],
        note: this.sky.location().mine ? 'from your sky' : 'from the sky over Cincinnati',
        cta: 'open the sky ☾',
      } satisfies BadgePopover,
      label: `The Moon tonight: ${name}, ${lit}% lit, ` +
        (height > 0 ? `${height} degrees above the horizon.` : 'below the horizon.') + ' Opens the sky menu.',
    };
  });
}
