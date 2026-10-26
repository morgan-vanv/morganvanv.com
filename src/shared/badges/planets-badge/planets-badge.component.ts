import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { SkyService } from '../../sky/sky.service';

/**
 * Up tonight: the naked-eye planets above the horizon right now, brightest first, from the sky's own
 * numbers. Opens the ☾ menu. Hides when none are up.
 */
@Component({
  selector: 'app-planets-badge',
  imports: [BadgeComponent],
  templateUrl: './planets-badge.component.html',
  styleUrl: './planets-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanetsBadgeComponent {
  protected readonly sky = inject(SkyService);

  readonly up = computed(() => {
    const planets = this.sky.upNow()?.detail?.planets ?? [];
    if (!planets.length) return null;
    const [first, ...rest] = planets;
    const where = this.sky.location().mine ? 'over you' : 'over Cincinnati';
    return {
      value: rest.length ? `${first.name} +${rest.length}` : first.name,
      popover: {
        title: 'Planets up right now',
        rows: planets.map(p => ({ label: p.name, value: `${Math.round(p.alt)}° up` })),
        note: `naked-eye planets ${where}, brightest first`,
        cta: 'open the sky ☾',
      } satisfies BadgePopover,
      label: `Planets up right now ${where}: ` +
        planets.map(p => `${p.name}, ${Math.round(p.alt)} degrees up`).join('; ') + '. Opens the sky menu.',
    };
  });
}
