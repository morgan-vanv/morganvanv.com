import { InjectionToken } from '@angular/core';
import { GUEST_SUBTITLES } from '../../generated/guest-subtitles';
import { GuestSubtitle } from '../visitor-content/visitor-content';

/** The greeting's rotating lines under Morgan's name. The first is the one prerendered. */
export const SUBTITLES: readonly string[] = [
  'a real human man',
  'currently testing in production',
  'relentlessly creating shareholder value',
  'now navigable via keyboard! press those arrow keys!',
  'probably clicking on virtual trees and rocks',
];

/**
 * The visitors' lines Morgan approved, oldest first: one file each in content/subtitles/, gathered at build
 * time (scripts/build-visitor-content.mjs). A token so specs can supply their own.
 */
export const GUEST_SUBTITLES_TOKEN = new InjectionToken<readonly GuestSubtitle[]>('GUEST_SUBTITLES', {
  providedIn: 'root',
  factory: () => GUEST_SUBTITLES,
});

/** "— suggested by sam", or "— suggested by a stranger" when they stayed anonymous. */
export function guestCredit(by: string | null): string {
  return `— suggested by ${by ?? 'a stranger'}`;
}

/** One of the greeting's lines; visitors' lines carry a handwritten credit. */
export interface GreetingLine {
  readonly text: string;
  readonly credit: string | null;
}

/** Morgan's lines, then the visitors' he approved, as the greeting and the avatar on Home say them. */
export function taglines(guests: readonly GuestSubtitle[]): readonly GreetingLine[] {
  return [
    ...SUBTITLES.map(text => ({ text, credit: null })),
    ...guests.map(guest => ({ text: guest.text, credit: guestCredit(guest.by) })),
  ];
}
