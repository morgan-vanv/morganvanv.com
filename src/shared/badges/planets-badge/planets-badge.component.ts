import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { SkyService } from '../../sky/sky.service';

/** Civil dusk: below this the Sun's down far enough for "tonight" to be true. */
export const NIGHT_SUN_ALT = -6;

/** A height above the horizon in whole degrees, short and spelled out; anything up at all is at least 1. */
function degreesUp(alt: number): { short: string; long: string } {
  const n = Math.max(1, Math.round(alt));
  return { short: `${n}° up`, long: `${n} degree${n === 1 ? '' : 's'} up` };
}

/**
 * Up tonight: the naked-eye planets above the horizon right now, brightest first, from the sky's own
 * numbers. Opens the ☾ menu. Only after dusk, and hides when none are up.
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
    const detail = this.sky.upNow()?.detail;
    const planets = detail && detail.sunAlt < NIGHT_SUN_ALT ? detail.planets : [];
    if (!planets.length) return null;
    const [first, ...rest] = planets;
    const where = this.sky.location().mine ? 'over you' : 'over Cincinnati';
    return {
      value: rest.length ? `${first.name} +${rest.length}` : first.name,
      popover: {
        title: 'Planets up right now',
        rows: planets.map(p => ({ label: p.name, value: degreesUp(p.alt).short })),
        note: `naked-eye planets ${where}, brightest first`,
        cta: 'open the sky ☾',
      } satisfies BadgePopover,
      label: `Up tonight ${where}: ` +
        planets.map(p => `${p.name}, ${degreesUp(p.alt).long}`).join('; ') + '. Opens the sky menu.',
    };
  });
}
