import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';
import { UNDER_CONSTRUCTION } from '../../constants/under-construction.const';

/** The classic, with a count: how many spots are still under construction. Retires itself at zero. */
@Component({
  selector: 'app-under-construction-badge',
  imports: [BadgeComponent],
  templateUrl: './under-construction-badge.component.html',
  styleUrl: './under-construction-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnderConstructionBadgeComponent {
  readonly count = UNDER_CONSTRUCTION.length;
  /** Goes to the first unfinished spot, whichever that is by then. */
  readonly route = UNDER_CONSTRUCTION[0]?.path ?? '/';
  readonly value = `${this.count} ${this.count === 1 ? 'spot' : 'spots'}`;

  readonly popover: BadgePopover = {
    title: 'Still under construction',
    rows: UNDER_CONSTRUCTION.map(spot => ({ label: spot.label, value: spot.where })),
    note: 'check back in sometime',
  };

  readonly label = `Under construction: ${this.value}, ` +
    UNDER_CONSTRUCTION.map(spot => spot.where === 'page' ? `the ${spot.label} page` : `${spot.label} on ${spot.where}`).join(', ') +
    `. Goes to ${UNDER_CONSTRUCTION[0]?.label ?? 'the start'}.`;
}
