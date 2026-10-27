import { InjectionToken, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LIGHTINGS, Lighting } from './sky-render';
import { UpNow } from './sky-up-now';
import { StarAround, StarOnScreen, UnnamedStar, VisitorName, brightest, nearestTo, stepAround } from './sky-naming';
import { FACE_SOUTH, LookView, clampView, spokenView } from './sky-view';
import { VisitorStar } from '../visitor-content/visitor-content';
import { VISITOR_STARS } from '../../generated/visitor-stars';

/**
 * The stars visitors named and Morgan approved: one file each in content/stars/, gathered at build time
 * (scripts/build-visitor-content.mjs). A token so specs can supply their own.
 */
export const VISITOR_STARS_TOKEN = new InjectionToken<readonly VisitorStar[]>('VISITOR_STARS', {
  providedIn: 'root',
  factory: () => VISITOR_STARS,
});

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
  /** What opened the menu from elsewhere, so Escape can hand focus back to it. */
  menuOpener: HTMLElement | null = null;

  /** Look up: the page fades away and the whole window is sky. */
  readonly lookingUp = signal(false);
  /** The name-a-star panel is open (only while looking up). */
  readonly naming = signal(false);
  /** Stars with no name yet (catalogue minus proper names minus visitor names), brightest first; set when the sky loads. */
  readonly unnamed = signal<readonly UnnamedStar[]>([]);
  /** Stars visitors have named (approved by Morgan, from content/stars/), with what they're near; set when the sky loads. */
  readonly visitorNames = signal<readonly VisitorName[]>([]);
  /** Unnamed stars a visitor can see and pick right now, left to right, in CSS pixels (set by the sky while naming). */
  readonly candidates = signal<readonly StarOnScreen[]>([]);
  /** The star being named. */
  readonly selected = signal<UnnamedStar | null>(null);
  /** Where the selected star is on screen (CSS pixels), for its ring; null when it isn't up. */
  readonly selectedPoint = signal<{ x: number; y: number } | null>(null);
  /** A name for the selected star has just been sent (the ring sparkles). */
  readonly sent = signal(false);
  /** What started naming, so closing the panel can hand focus back. */
  namingOpener: HTMLElement | null = null;
  /** Unnamed stars above the horizon all the way round, in azimuth order (set by the sky while naming), for ‹ ›. */
  readonly around = signal<readonly StarAround[]>([]);
  /** Bumped when ‹ › pick a star, so the sky turns to bring it into view. */
  readonly showSelected = signal(0);
  /** Bumped when the naming panel has rendered (it loads on first use), so the sky can see what it covers. */
  readonly namingPanelShown = signal(0);

  /** Free look: which way the visitor is facing and how far up (the sky keeps it current as it turns). Always south to start. */
  readonly view = signal<LookView>(FACE_SOUTH);
  /** A view the compass buttons have asked for; the sky turns to it, then clears it. The count makes asking twice turn twice. */
  readonly viewRequest = signal<{ readonly view: LookView; readonly count: number } | null>(null);
  /** Said politely after a turn: "facing west, 270°, looking up 15°". */
  readonly viewAnnouncement = signal('');
  /** Free look is on: looking up, loaded, and with a sky to turn. Until then there's no compass and nothing to drag. */
  readonly freeLooking = signal(false);
  /**
   * Whether the sky can turn to show a star (set by the sky while free look is on). ‹ › pass over
   * stars it can't: low ones behind the hills, or that only fit under a phone's bottom sheet.
   */
  showable: ((star: StarAround) => boolean) | null = null;

  private attempt = 0;
  private requests = 0;

  constructor() {
    if (!this.isBrowser) return;
    const stored = parseStoredLocation(readStorage(SKY_LOCATION_KEY));
    if (stored) this.location.set(stored);
    const lighting = readStorage(SKY_LIGHTING_KEY);
    if (LIGHTINGS.includes(lighting as Lighting)) this.lighting.set(lighting as Lighting);
  }

  /** Opens the ☾ menu from elsewhere on the page (the Moon and Up tonight badges) and moves focus into it. */
  openMenu(): void {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    this.menuOpener = active instanceof HTMLElement && active !== document.body ? active : null;
    this.menuOpen.set(true);
    this.menuFocusRequests.update(count => count + 1);
  }

  /** Hides the page (and closes the ☾ menu, so the first touch lands on the sky). */
  enterLookUp(): void {
    if (!this.lookingUp()) this.faceSouthNow();
    this.menuOpen.set(false);
    this.lookingUp.set(true);
  }

  /** Back to the page (and to facing south); closes the naming panel too. */
  leaveLookUp(): void {
    this.lookingUp.set(false);
    this.faceSouthNow();
    this.stopNaming();
  }

  /** Turns left (negative) or right by some degrees, from wherever the last turn was heading. */
  turn(degrees: number): void {
    const from = this.viewRequest()?.view ?? this.view();
    this.requestView({ facing: from.facing + degrees, tilt: from.tilt });
  }

  /** Tilts up (positive) or down by some degrees, between the horizon and the zenith. */
  tilt(degrees: number): void {
    const from = this.viewRequest()?.view ?? this.view();
    this.requestView({ facing: from.facing, tilt: from.tilt + degrees });
  }

  faceSouth(): void {
    this.requestView(FACE_SOUTH);
  }

  /** Says where the visitor is now looking (the same words twice still get said: a no-break space tells them apart). */
  announceView(view: LookView): void {
    const text = spokenView(view);
    this.viewAnnouncement.set(this.viewAnnouncement() === text ? `${text}\u00a0` : text);
  }

  private requestView(view: LookView): void {
    const target = clampView(view);
    this.viewRequest.set({ view: target, count: ++this.requests });
    this.announceView(target);
  }

  /** Free look starts (and ends) facing south, with no turn pending. */
  private faceSouthNow(): void {
    this.view.set(FACE_SOUTH);
    this.viewRequest.set(null);
  }

  toggleLookUp(): void {
    if (this.lookingUp()) this.leaveLookUp();
    else this.enterLookUp();
  }

  /** Looks up with the naming panel open; the sky selects the brightest candidate once it knows what's on screen. */
  startNaming(opener: HTMLElement | null = null): void {
    this.namingOpener = opener;
    this.menuOpen.set(false);
    this.sent.set(false);
    this.enterLookUp();
    this.naming.set(true);
  }

  /** Closes the panel (still looking up). */
  stopNaming(): void {
    this.naming.set(false);
    this.selected.set(null);
    this.selectedPoint.set(null);
    this.candidates.set([]);
    this.around.set([]);
    this.sent.set(false);
  }

  select(star: UnnamedStar | null): void {
    if (star !== this.selected()) this.sent.set(false);
    this.selected.set(star);
  }

  /**
   * The sky has worked out what can be picked. The selection stays put (the sky
   * drops it only once the star has set or left the screen), so nothing changes
   * under a visitor who's typing; with nothing selected, the brightest is picked.
   */
  setCandidates(list: readonly StarOnScreen[]): void {
    this.candidates.set(list);
    if (!this.selected() && !this.sent()) this.select(brightest(list)?.star ?? null);
  }

  /**
   * ‹ (−1) or › (+1): the next unnamed star above the horizon round the sky by
   * azimuth (on screen or not), from the selected one or from where the visitor
   * is facing. The sky turns to bring it into view; stars no view can show are
   * passed over, and after a whole lap without one it gives up.
   */
  step(direction: 1 | -1): void {
    const list = this.around();
    let from = this.selected();
    for (let tries = list.length; tries > 0; tries--) {
      const next = stepAround(list, from, direction, this.view().facing);
      if (!next) return;
      if (!this.showable || this.showable(next)) {
        this.select(next.star);
        this.showSelected.update(count => count + 1);
        return;
      }
      from = next.star;
    }
  }

  /** Selects the candidate nearest a point (CSS pixels) within `reach`; false if there's none. */
  selectNear(x: number, y: number, reach: number): boolean {
    const hit = nearestTo(this.candidates(), x, y, reach);
    if (hit) this.select(hit.star);
    return !!hit;
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
