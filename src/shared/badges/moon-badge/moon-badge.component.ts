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
    const up = moon.alt > 0;
    const height = Math.max(1, Math.round(moon.alt));
    return {
      value: `${lit}% · ${phaseShort(moon.phase)}`,
      path: litPath(moon.phase),
      popover: {
        title: 'The Moon, right now',
        rows: [
          { label: 'Phase', value: name },
          { label: 'Lit', value: `${lit}%` },
          { label: 'Height', value: up ? `${height}° up` : 'below the horizon' },
        ],
        note: this.sky.location().mine ? 'from your sky' : 'from the sky over Cincinnati',
        cta: 'open the sky ☾',
      } satisfies BadgePopover,
      label: `Moon: ${name}, ${lit}% lit, ` +
        (up ? `${height} degree${height === 1 ? '' : 's'} above the horizon.` : 'below the horizon.') + ' Opens the sky menu.',
      // Seen from south of the equator the lit side is the other one.
      southern: this.sky.location().lat < 0,
    };
  });
}
