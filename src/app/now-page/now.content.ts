import { InjectionToken } from '@angular/core';

/**
 * The hand-written part of /now. Edit the text and bump `updated` whenever
 * things change; everything else on the page updates on its own.
 *
 * While `paragraphs` is empty the note and its "updated" date are hidden.
 * To bring them back, add one or more paragraphs, e.g.:
 *
 *   paragraphs: [
 *     'A few sentences about what I\'m focused on these days.',
 *   ],
 *
 * `updated` is a plain YYYY-MM-DD date.
 */
export interface NowContent {
  updated: string;
  paragraphs: readonly string[];
}

export const NOW_CONTENT: NowContent = {
  updated: '2026-10-25',
  paragraphs: [],
};

/** How the /now page gets its note: the constant above by default; tests can provide their own. */
export const NOW_CONTENT_TOKEN = new InjectionToken<NowContent>('NOW_CONTENT', { factory: () => NOW_CONTENT });
