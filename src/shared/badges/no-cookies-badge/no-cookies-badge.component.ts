import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';

/**
 * "No cookies · no trackers". True as long as nothing here sets a cookie or loads analytics: the
 * sky's choices live in localStorage (only once a visitor makes one) and API responses in
 * sessionStorage. Adding analytics or anything that sets a cookie means retiring this badge.
 */
@Component({
  selector: 'app-no-cookies-badge',
  imports: [BadgeComponent],
  templateUrl: './no-cookies-badge.component.html',
  styleUrl: './no-cookies-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoCookiesBadgeComponent {
  readonly popover: BadgePopover = {
    title: 'Nothing to accept',
    lines: ['No cookies, no analytics, no trackers.'],
    note: 'Your sky settings stay in your browser.',
    cta: 'humans.txt ↗',
  };

  readonly label = 'No cookies, no analytics and no trackers on this site; your sky settings stay in your browser. ' +
    'Opens humans.txt in a new tab.';
}
