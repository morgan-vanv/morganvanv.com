import { InjectionToken } from '@angular/core';

/** The greeting's rotating lines under Morgan's name. The first is the one prerendered. */
export const SUBTITLES: readonly string[] = [
  'a real human man',
  'currently testing in production',
  'relentlessly creating shareholder value',
  'now navigable via keyboard! press those arrow keys!',
  'probably clicking on virtual trees and rocks',
];

/** Longest subtitle a visitor can suggest: it has to fit under the name on a phone. */
export const SUBTITLE_MAX_LENGTH = 60;
/** Longest name a visitor can be credited as. */
export const CREDIT_MAX_LENGTH = 24;

/**
 * A line a visitor suggested through the Contact form's "suggest a subtitle" mode and Morgan
 * approved. Each suggestion arrives in Discord with an `approve:` line: paste it into
 * `GUEST_SUBTITLES` below, in a PR like any other change.
 */
export interface GuestSubtitle {
  readonly text: string;
  /** How they asked to be credited; null for anonymous ("a stranger"). */
  readonly by: string | null;
  /** When it was approved, YYYY-MM. */
  readonly added: string;
}

export const GUEST_SUBTITLES: readonly GuestSubtitle[] = [];

/** The approved guest lines; a token so specs can supply their own. */
export const GUEST_SUBTITLES_TOKEN = new InjectionToken<readonly GuestSubtitle[]>('GUEST_SUBTITLES', {
  providedIn: 'root',
  factory: () => GUEST_SUBTITLES,
});

/** "— suggested by sam", or "— suggested by a stranger" when they stayed anonymous. */
export function guestCredit(by: string | null): string {
  return `— suggested by ${by ?? 'a stranger'}`;
}
