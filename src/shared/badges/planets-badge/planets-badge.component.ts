import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { SkyService } from '../../sky/sky.service';

/**
 * Up tonight: the naked-eye planets above the horizon right now, brightest first, from the sky's own
 * numbers. Opens the ☾ menu. Only after dusk (the Sun below −6°), and hides when none are up.
 */
/** Civil dusk: below this the Sun's down far enough for "tonight" to be true. */
export const NIGHT_SUN_ALT = -6;

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
    const detail = this.sky.upNow()?.detail;
    const planets = detail && detail.sunAlt < NIGHT_SUN_ALT ? detail.planets : [];
    if (!planets.length) return null;
    const [first, ...rest] = planets;
    const where = this.sky.location().mine ? 'over you' : 'over Cincinnati';
    return {
      value: rest.length ? `${first.name} +${rest.length}` : first.name,
      popover: {
        title: 'Planets up right now',
        rows: planets.map(p => ({ label: p.name, value: `${Math.max(1, Math.round(p.alt))}° up` })),
        note: `naked-eye planets ${where}, brightest first`,
        cta: 'open the sky ☾',
      } satisfies BadgePopover,
      label: `Up tonight ${where}: ` +
        planets.map(p => `${p.name}, ${Math.max(1, Math.round(p.alt))} degrees up`).join('; ') + '. Opens the sky menu.',
    };
  });
}
