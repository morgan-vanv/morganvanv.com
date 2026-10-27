import { Injectable, computed } from '@angular/core';
import { cachedJson } from '../services/cached-json';
import { DiaryEntry, toDiary } from './letterboxd';

export const LETTERBOXD_DIARY_URL = '/letterboxd.json';
/** The deploy refreshes it daily, so half an hour per tab session is plenty. */
const DIARY_TTL_MS = 30 * 60 * 1000;

/**
 * Morgan's Letterboxd diary, fetched once for everything that shows it (Favorite Media on /interests,
 * the Watched row on /now). Null until it loads, and for the placeholder `public/letterboxd.json` that
 * local dev, PR checks and a deploy that couldn't read the feed all get: whatever reads it hides.
 */
@Injectable({ providedIn: 'root' })
export class LetterboxdService {
  readonly diary = cachedJson(LETTERBOXD_DIARY_URL, DIARY_TTL_MS, toDiary);
  /** The newest diary entry, or null when there's no diary or it's empty. */
  readonly latest = computed<DiaryEntry | null>(() => this.diary()?.entries[0] ?? null);
}
