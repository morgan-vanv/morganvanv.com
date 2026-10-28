import { DestroyRef, Injectable, InjectionToken, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DOCUMENT, Location, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, EMPTY, catchError, combineLatest, distinctUntilChanged, firstValueFrom, fromEvent, interval, map, of, startWith, switchMap } from 'rxjs';
import { SITE_CONFIG } from '../config/site.config';

/** One message in the shoutbox, as the campfire returns it. */
export interface Shout {
  readonly id: number;
  readonly nick: string;
  readonly text: string;
  /** ISO time it was said. */
  readonly at: string;
  /** Said by Morgan (with the host key). */
  readonly host: boolean;
}

export interface ShoutLog {
  readonly shouts: readonly Shout[];
  /** Visitors on the Social page in the last minute, this one included. */
  readonly here: number | null;
  /** False while Morgan has banked the fire: guests can read, not post. */
  readonly open: boolean;
}

/** How often the shoutbox asks for news while it's on screen and the tab is visible. */
export const SHOUT_POLL_MS = 20_000;
/** Only real visits to the real site are counted: not dev servers, CI's Lighthouse runs or previews. */
export const COUNTED_HOST = new InjectionToken<string>('COUNTED_HOST', { providedIn: 'root', factory: () => SITE_CONFIG.domain });
const COUNTED_KEY = 'campfire-counted';
const HOST_KEY = 'campfire-host-key';
const NICK_KEY = 'campfire-nick';

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Keeps the shouts that look right, oldest first; anything malformed is dropped. */
export function toShoutLog(value: unknown): ShoutLog | null {
  const body = value as { shouts?: unknown; here?: unknown; open?: unknown } | null;
  if (!body || !Array.isArray(body.shouts)) return null;
  const shouts = body.shouts
    .filter((s): s is Shout => !!s && isCount(s.id) && typeof s.nick === 'string' && typeof s.text === 'string'
      && typeof s.at === 'string' && !Number.isNaN(Date.parse(s.at)))
    .map(s => ({ id: s.id, nick: s.nick, text: s.text, at: s.at, host: s.host === true }))
    .sort((a, b) => a.id - b.id);
  // Before backend 1.1 there was no switch: anything but an explicit false is open.
  return { shouts, here: isCount(body.here) ? body.here : null, open: body.open !== false };
}

/** The error the campfire gave, or a dry stand-in. */
export function shoutError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const message = (error.error as { error?: unknown } | null)?.error;
    if (typeof message === 'string' && message.length <= 140) return message;
    if (error.status === 429) return 'Easy there. Give the fire a few seconds.';
  }
  return 'Couldn\'t reach the campfire. Try again in a bit?';
}

/** A fresh guest nick, like an IRC client would hand out. */
export function guestNick(random = Math.random): string {
  return `guest_${String(Math.floor(random() * 10_000)).padStart(4, '0')}`;
}

/**
 * The campfire: a small Cloudflare Worker (in morganvanv.com-backend) that keeps the site's two pieces of
 * shared state, the visitor count and the shoutbox. Nothing here sets a cookie or sends anything about the
 * visitor: one session flag so a visit counts once, a random per-tab id for "here now", and the visitor's
 * chosen nick in localStorage.
 */
@Injectable({ providedIn: 'root' })
export class CampfireService {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly location = inject(Location);
  private readonly countedHost = inject(COUNTED_HOST);
  private readonly base = SITE_CONFIG.campfireUrl;

  /** Whether the site knows where its campfire is. Without one, its features stay hidden. */
  readonly configured = !!this.base;

  private readonly count = signal<number | null>(null);
  /** Visits so far, or null until known (and on any error). */
  readonly visitors = this.count.asReadonly();
  private visitorsAsked = false;

  private readonly log = signal<ShoutLog | null>(null);
  private readonly failed = signal(false);
  /** The latest shouts, or null until the first answer. */
  readonly shoutLog = this.log.asReadonly();
  /** True once a poll has failed with nothing to show. */
  readonly unreachable = computed(() => this.failed() && !this.log());

  /** Morgan's key, set once by visiting /social/#host=<key>; turns on posting as "morgan" and deleting. */
  private readonly key = signal<string | null>(null);
  readonly isHost = computed(() => !!this.key());

  private readonly watchers = new BehaviorSubject(0);
  private readonly refresh = new BehaviorSubject<void>(undefined);
  private readonly clientId = this.isBrowser && typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : null;

  constructor() {
    if (!this.isBrowser || !this.configured) return;
    this.key.set(this.readStorage(localStorage, HOST_KEY));

    const visible$ = fromEvent(document, 'visibilitychange').pipe(
      startWith(null),
      map(() => document.visibilityState === 'visible'),
    );
    const active$ = combineLatest([this.watchers.pipe(map(n => n > 0)), visible$]).pipe(
      map(([watched, visible]) => watched && visible),
      distinctUntilChanged(),
    );
    combineLatest([active$, this.refresh]).pipe(
      // The first poll goes out at once (not on the next tick), then every SHOUT_POLL_MS.
      switchMap(([active]) => active ? interval(SHOUT_POLL_MS).pipe(startWith(0), switchMap(() => this.fetchShouts())) : EMPTY),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(log => {
      if (log) {
        this.log.set(log);
        this.failed.set(false);
      } else {
        this.failed.set(true);
      }
    });
  }

  /**
   * Counts this visit, once per tab session, on the real site only; elsewhere (dev, CI) it just reads the
   * count. Called once at startup.
   */
  countVisit(): void {
    if (!this.isBrowser || !this.configured) return;
    const counted = this.readStorage(sessionStorage, COUNTED_KEY) === '1';
    const here = this.document.defaultView;
    if (counted || here?.location.hostname !== this.countedHost || here.navigator.webdriver) {
      this.loadVisitors();
      return;
    }
    this.visitorsAsked = true;
    this.writeStorage(sessionStorage, COUNTED_KEY, '1');
    this.http.post<unknown>(`${this.base}/visit`, null).pipe(catchError(() => of(null)))
      .subscribe(body => this.count.set(this.readCount(body)));
  }

  /** Reads the count without adding to it. */
  private loadVisitors(): void {
    if (!this.isBrowser || !this.configured || this.visitorsAsked) return;
    this.visitorsAsked = true;
    this.http.get<unknown>(`${this.base}/visit`).pipe(catchError(() => of(null)))
      .subscribe(body => this.count.set(this.readCount(body)));
  }

  /** Starts polling the shoutbox for as long as the returned stop function isn't called. */
  watchShouts(): () => void {
    this.watchers.next(this.watchers.value + 1);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      this.watchers.next(this.watchers.value - 1);
    };
  }

  /** Says something; resolves to null on success or the reason it didn't go. */
  async say(nick: string, text: string, website: string): Promise<string | null> {
    try {
      await firstValueFrom(this.http.post(`${this.base}/shouts`, { nick, text, website }, { headers: this.authHeaders() }));
      this.writeStorage(localStorage, NICK_KEY, nick);
      this.refresh.next();
      return null;
    } catch (error) {
      this.forgetRefusedKey(error);
      return shoutError(error);
    }
  }

  /** Host only: banks the fire (guests can read, not post) or lights it again. */
  async setOpen(open: boolean): Promise<string | null> {
    try {
      await firstValueFrom(this.http.put(`${this.base}/fire`, { open }, { headers: this.authHeaders() }));
      this.log.update(log => log && { ...log, open });
      this.refresh.next();
      return null;
    } catch (error) {
      this.forgetRefusedKey(error);
      return shoutError(error);
    }
  }

  /** Host only: takes a message down. */
  async remove(id: number): Promise<string | null> {
    try {
      await firstValueFrom(this.http.delete(`${this.base}/shouts/${id}`, { headers: this.authHeaders() }));
      this.log.update(log => log && { ...log, shouts: log.shouts.filter(s => s.id !== id) });
      return null;
    } catch (error) {
      this.forgetRefusedKey(error);
      return shoutError(error);
    }
  }

  /** The nick this visitor used last, or a fresh guest one. */
  savedNick(): string {
    return (this.isBrowser && this.readStorage(localStorage, NICK_KEY)) || guestNick();
  }

  /**
   * Picks up `#host=<key>` from the address (on any page; App calls this at startup) and takes it out of the address bar, so it isn't left in
   * history or a shared link. The key is kept in this browser only once the campfire confirms it
   * (`GET /host`), so a link carrying a wrong key can't replace the real one. `#host=` forgets it.
   */
  async captureHostKey(): Promise<void> {
    if (!this.isBrowser) return;
    const hash = this.document.defaultView?.location.hash ?? '';
    const match = /^#host=(.*)$/.exec(hash);
    if (!match) return;
    this.location.replaceState(this.location.path(false));
    if (!this.configured) return;

    let key: string | null;
    try {
      key = decodeURIComponent(match[1]).trim() || null;
    } catch {
      return;
    }
    if (key === null) {
      this.writeStorage(localStorage, HOST_KEY, null);
      this.key.set(null);
      return;
    }
    const ok = await firstValueFrom(this.http.get(`${this.base}/host`, {
      headers: new HttpHeaders({ Authorization: `Bearer ${key}` }),
      observe: 'response',
    }).pipe(map(response => response.status === 204), catchError(() => of(false))));
    if (!ok) return;
    this.writeStorage(localStorage, HOST_KEY, key);
    this.key.set(key);
  }

  /**
   * A host key the campfire refuses (401: it was changed, or this browser kept an old one) is forgotten,
   * so the host controls go away instead of failing on every press. Visit /social/#host=<new key> again.
   */
  private forgetRefusedKey(error: unknown): void {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !this.key()) return;
    this.writeStorage(localStorage, HOST_KEY, null);
    this.key.set(null);
  }

  private fetchShouts() {
    const query = this.clientId ? `?client=${this.clientId}` : '';
    return this.http.get<unknown>(`${this.base}/shouts${query}`).pipe(
      map(toShoutLog),
      catchError(() => of(null)),
    );
  }

  private readCount(body: unknown): number | null {
    const count = (body as { count?: unknown } | null)?.count;
    return isCount(count) ? count : null;
  }

  private authHeaders(): HttpHeaders | undefined {
    const key = this.key();
    return key ? new HttpHeaders({ Authorization: `Bearer ${key}` }) : undefined;
  }

  private readStorage(storage: Storage, key: string): string | null {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(storage: Storage, key: string, value: string | null): void {
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch {
      // Private windows and blocked storage: the feature still works, it just forgets.
    }
  }
}
