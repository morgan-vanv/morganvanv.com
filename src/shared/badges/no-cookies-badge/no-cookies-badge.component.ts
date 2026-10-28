import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BadgeComponent, BadgePopover } from '../badge/badge.component';

/**
 * "No cookies · no trackers". True as long as nothing here sets a cookie or loads analytics: the
 * sky's choices and a shoutbox nick live in localStorage (only once a visitor makes them), API
 * responses, a "this visit's been counted" flag, "the avatar's said hello" and "the sky's been pointed out" flags in sessionStorage,
 * Morgan's own host key in his own browsers, and the visitor counter is one number with nothing about
 * anyone behind it. Adding analytics or anything that sets a cookie means
 * retiring this badge.
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
    note: 'Your sky settings and shoutbox nick stay in your browser. The visitor counter is just a number.',
    cta: 'humans.txt ↗',
  };

  readonly label = 'No cookies, no analytics and no trackers on this site; your sky settings and shoutbox nick stay in ' +
    'your browser, and the visitor counter is just a number. ' +
    'Opens humans.txt in a new tab.';
}
