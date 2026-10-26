import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LIGHTINGS, Lighting } from './sky-render';
import { UpNow } from './sky-up-now';

export interface SkyLocation {
  readonly lat: number;
  readonly lon: number;
  /** False for the default (Cincinnati), true once the visitor has asked for their own sky. */
  readonly mine: boolean;
}

export const CINCINNATI: SkyLocation = { lat: 39.1, lon: -84.51, mine: false };

/** localStorage key for the visitor's own sky, rounded to 0.1° (about 10 km): the sky doesn't need more. */
export const SKY_LOCATION_KEY = 'sky-location';

/** localStorage key for the chosen lighting. */
export const SKY_LIGHTING_KEY = 'sky-lighting';

export type LocateStatus = 'idle' | 'locating' | 'failed';

/** How long to wait for a location before saying it didn't work. */
export const LOCATE_GIVE_UP_MS = 20_000;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Parses a stored location, or null if it's missing or malformed. */
export function parseStoredLocation(raw: string | null): SkyLocation | null {
  if (!raw) return null;
  try {
    const { lat, lon } = JSON.parse(raw) as { lat?: unknown; lon?: unknown };
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return null;
    return { lat, lon, mine: true };
  } catch {
    return null;
  }
}

/**
 * Whose sky the background shows. Cincinnati unless the visitor clicks
 * "show mine"; that's the only thing that ever asks the browser for a
 * location. The answer is remembered (rounded) so later visits don't ask again.
 */
@Injectable({ providedIn: 'root' })
export class SkyService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly location = signal<SkyLocation>(CINCINNATI);
  readonly status = signal<LocateStatus>('idle');
  /** How the sky is lit; darkness unless the visitor picks otherwise. */
  readonly lighting = signal<Lighting>('darkness');
  /** True once the live sky has drawn its first frame (until then the painted sky shows). */
  readonly ready = signal(false);
  /** What's above the horizon at the last redraw, as text. */
  readonly upNow = signal<UpNow | null>(null);
  /** Whether the ☾ menu is open. Here rather than in the menu so the sky badges on /now can open it. */
  readonly menuOpen = signal(false);
  /** Bumped when something other than the ☾ button opens the menu, so the menu takes focus. */
  readonly menuFocusRequests = signal(0);

  private attempt = 0;

  constructor() {
    if (!this.isBrowser) return;
    const stored = parseStoredLocation(readStorage(SKY_LOCATION_KEY));
    if (stored) this.location.set(stored);
    const lighting = readStorage(SKY_LIGHTING_KEY);
    if (LIGHTINGS.includes(lighting as Lighting)) this.lighting.set(lighting as Lighting);
  }

  /** Opens the ☾ menu from elsewhere on the page (the Moon and Up tonight badges) and moves focus into it. */
  openMenu(): void {
    this.menuOpen.set(true);
    this.menuFocusRequests.update(count => count + 1);
  }

  setLighting(lighting: Lighting): void {
    this.lighting.set(lighting);
    writeStorage(SKY_LIGHTING_KEY, lighting === 'darkness' ? null : lighting);
  }

  showMine(): void {
    if (!this.isBrowser || !('geolocation' in navigator)) {
      this.status.set('failed');
      return;
    }
    // Each request gets a number; answers to an older (cancelled) request are ignored.
    const attempt = ++this.attempt;
    const isCurrent = () => attempt === this.attempt;
    this.status.set('locating');
    // The browser's own timeout only starts once permission is granted, and some
    // browsers never call back when the prompt is dismissed, so give up on our own.
    const giveUp = setTimeout(() => {
      if (isCurrent() && this.status() === 'locating') this.status.set('failed');
    }, LOCATE_GIVE_UP_MS);
    navigator.geolocation.getCurrentPosition(
      position => {
        clearTimeout(giveUp);
        if (!isCurrent()) return;
        const location = { lat: round1(position.coords.latitude), lon: round1(position.coords.longitude), mine: true };
        this.location.set(location);
        writeStorage(SKY_LOCATION_KEY, JSON.stringify({ lat: location.lat, lon: location.lon }));
        this.status.set('idle');
      },
      () => {
        clearTimeout(giveUp);
        if (isCurrent()) this.status.set('failed');
      },
      { maximumAge: 60 * 60 * 1000, timeout: 15_000 },
    );
  }

  /** Back to Cincinnati; also cancels a request that hasn't answered yet. */
  showCincinnati(): void {
    this.attempt++;
    this.location.set(CINCINNATI);
    this.status.set('idle');
    writeStorage(SKY_LOCATION_KEY, null);
  }
}

// Storage can be unavailable (private mode, blocked cookies); the sky just forgets.
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}
