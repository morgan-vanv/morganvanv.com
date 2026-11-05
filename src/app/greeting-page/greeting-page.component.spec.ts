import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { GreetingPageComponent } from './greeting-page.component';
import { GUEST_SUBTITLES_TOKEN, SUBTITLES } from '../../shared/constants/subtitles.const';
import { GUEST_SUBTITLES } from '../../generated/guest-subtitles';
import { RecentStreamService } from '../../shared/services/recent-stream.service';
import { CampfireService } from '../../shared/services/campfire.service';
import { SkyService } from '../../shared/sky/sky.service';
import { TYPE_TIMING } from './typewriter';

const campfire = { configured: false, shoutLog: signal(null), watchShouts: () => () => undefined };

describe('GreetingPageComponent', () => {
  let fixture: ComponentFixture<GreetingPageComponent>;
  const summary = signal<string | null>(null);

  beforeEach(async () => {
    summary.set(null);
    await TestBed.configureTestingModule({
      imports: [GreetingPageComponent],
      providers: [
        provideRouter([]),
        { provide: RecentStreamService, useValue: { summary } },
        { provide: CampfireService, useValue: campfire },
        // Only Morgan's lines here, whatever content/subtitles/ holds; guest lines have their own tests below.
        { provide: GUEST_SUBTITLES_TOKEN, useValue: [] },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GreetingPageComponent);
    await fixture.whenStable();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const typed = () => el().querySelector('.tagline-typed')?.textContent;
  const spoken = () => el().querySelector('.tagline .visually-hidden')?.textContent?.trim();
  const texts = () => fixture.componentInstance['subtitles']().map(line => line.text);

  it('has the one <h1>: Morgan\'s name', () => {
    expect([...el().querySelectorAll('h1')].map(h => h.textContent)).toEqual(['Morgan Van Valkenburgh']);
  });

  it('prerenders the first line whole, with the caret blinking after it', () => {
    expect(typed()).toBe(SUBTITLES[0]);
    expect(el().querySelector('.tagline-typed .caret')?.classList).toContain('blink');
  });

  it('gives screen readers the whole line once, and hides the typing and caret from them', () => {
    expect(spoken()).toBe(SUBTITLES[0]);
    expect(el().querySelector('.tagline [aria-live]')).toBeNull();
    expect(el().querySelector('.tagline-box')?.getAttribute('aria-hidden')).toBe('true');
    expect(el().querySelector('.credit')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps every line in the tagline\'s box, invisibly, so it\'s sized for the longest and nothing shifts', () => {
    const sizers = [...el().querySelectorAll('.tagline-sizer')].map(sizer => sizer.textContent);
    expect(sizers).toEqual(SUBTITLES);
  });

  it('shows no credit under Morgan\'s own lines (its slot stays, empty)', () => {
    const credit = el().querySelector('.credit')!;
    expect(credit.textContent?.trim()).toBe('');
    expect(credit.classList).not.toContain('on');
  });

  it('rotates the live "last listened" line in with the jokes once it is known', async () => {
    summary.set('last listened: Song by Band · just now');
    await fixture.whenStable();
    expect(texts().length).toBe(SUBTITLES.length + 1);
    expect(texts().at(-1)).toBe('last listened: Song by Band · just now');
  });

  it('updates the live line in place when it changes', async () => {
    summary.set('listening to A by B right now');
    await fixture.whenStable();
    fixture.componentInstance['typing'].set({ index: SUBTITLES.length, chars: 0, phase: 'rest', queued: null });
    await fixture.whenStable();
    expect(typed()).toBe('listening to A by B right now');
    summary.set('last listened: A by B · 1 minute ago');
    await fixture.whenStable();
    expect(typed()).toBe('last listened: A by B · 1 minute ago');
    expect(spoken()).toBe('last listened: A by B · 1 minute ago');
  });

  it('links the way in to /home, with a keyboard hint', () => {
    const enter = el().querySelector<HTMLAnchorElement>('a.enter')!;
    expect(enter.getAttribute('href')).toBe('/home');
    expect(enter.textContent?.trim()).toBe('[come on in]');
    expect([...enter.querySelectorAll('.bracket')].every(b => b.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(el().querySelector('.hint kbd')?.textContent).toBe('→');
  });

  it('looks up from "or just look up", as the ☾ menu does', () => {
    const sky = TestBed.inject(SkyService);
    const button = el().querySelector<HTMLButtonElement>('button.look-up')!;
    expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe('or just look up ☾');
    expect(button.querySelector('.moon')?.getAttribute('aria-hidden')).toBe('true');
    button.click();
    expect(sky.lookingUp()).toBe(true);
  });

  it('puts the hidden doors after the ways in, in the tab order', async () => {
    TestBed.inject(SkyService).nightLights.set({ window: { x: 300, y: 600 }, fire: { x: 380, y: 610 }, size: 1 });
    window.dispatchEvent(new Event('resize'));
    await fixture.whenStable();
    const focusable = [...el().querySelectorAll<HTMLElement>('a[href], button')].filter(item => item.tabIndex >= 0);
    expect(focusable.map(item => item.getAttribute('aria-label') ?? item.textContent?.replace(/\s+/g, ' ').trim()))
      .toEqual(['[come on in]', 'or just look up ☾', 'Projects', 'Social']);
  });
});

describe('GreetingPageComponent typing', () => {
  let fixture: ComponentFixture<GreetingPageComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await TestBed.configureTestingModule({
      imports: [GreetingPageComponent],
      providers: [
        provideRouter([]),
        { provide: RecentStreamService, useValue: { summary: signal(null) } },
        { provide: CampfireService, useValue: campfire },
        { provide: GUEST_SUBTITLES_TOKEN, useValue: [{ text: 'a certified night owl', by: 'sam', added: '2026-10' }] },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GreetingPageComponent);
    fixture.autoDetectChanges();
    await vi.advanceTimersByTimeAsync(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const typed = () => el().querySelector('.tagline-typed')?.textContent;

  it('rests, erases, then types a random line next (here the visitor\'s), and fades its credit in', async () => {
    await vi.advanceTimersByTimeAsync(TYPE_TIMING.restMs - 100);
    expect(typed()).toBe(SUBTITLES[0]);
    await vi.advanceTimersByTimeAsync(200);
    expect(typed()!.length).toBeLessThan(SUBTITLES[0].length);
    expect(el().querySelector('.caret')?.classList).not.toContain('blink');
    await vi.advanceTimersByTimeAsync(5000);
    expect(typed()).toBe('a certified night owl');
    expect(el().querySelector('.credit')?.classList).toContain('on');
    expect(el().querySelector('.credit')?.textContent?.trim()).toBe('— suggested by sam');
    expect(el().querySelector('.tagline .visually-hidden')?.textContent?.trim()).toBe('a certified night owl — suggested by sam');
  });

  it('stops while the tab is hidden, and carries on when it\'s back', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(TYPE_TIMING.restMs * 3);
    expect(typed()).toBe(SUBTITLES[0]);
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(TYPE_TIMING.restMs + 100);
    expect(typed()).not.toBe(SUBTITLES[0]);
  });

  it('stops when the page goes', async () => {
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('GreetingPageComponent with visitors\' subtitles', () => {
  let fixture: ComponentFixture<GreetingPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GreetingPageComponent],
      providers: [
        provideRouter([]),
        { provide: RecentStreamService, useValue: { summary: signal(null) } },
        { provide: CampfireService, useValue: campfire },
        { provide: GUEST_SUBTITLES_TOKEN, useValue: [
          { text: 'a certified night owl', by: 'sam', added: '2026-10' },
          { text: 'professional cloud enjoyer', by: null, added: '2026-10' },
        ] },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GreetingPageComponent);
    await fixture.whenStable();
  });

  it('rotates approved guest lines in after Morgan\'s, each with a handwritten credit', async () => {
    const lines = fixture.componentInstance['subtitles']();
    expect(lines.slice(SUBTITLES.length)).toEqual([
      { text: 'a certified night owl', credit: '— suggested by sam' },
      { text: 'professional cloud enjoyer', credit: '— suggested by a stranger' },
    ]);
    fixture.componentInstance['typing'].set({ index: SUBTITLES.length, chars: 0, phase: 'rest', queued: null });
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.tagline-typed')?.textContent).toBe('a certified night owl');
    expect(el.querySelector('.credit')?.textContent?.trim()).toBe('— suggested by sam');
    expect(el.querySelector('.credit')?.classList).toContain('on');
  });

  it('still prerenders Morgan\'s first line', () => {
    expect(fixture.componentInstance['subtitles']()[0]).toEqual({ text: SUBTITLES[0], credit: null });
    expect((fixture.nativeElement as HTMLElement).querySelector('.tagline-typed')?.textContent).toBe(SUBTITLES[0]);
  });
});

describe('GreetingPageComponent guest lines, by default', () => {
  it('come from content/subtitles/, gathered at build time', () => {
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: RecentStreamService, useValue: { summary: signal(null) } },
      { provide: CampfireService, useValue: campfire },
    ] });
    expect(TestBed.inject(GUEST_SUBTITLES_TOKEN)).toBe(GUEST_SUBTITLES);
    const fixture = TestBed.createComponent(GreetingPageComponent);
    const lines = fixture.componentInstance['subtitles']();
    expect(lines.slice(SUBTITLES.length).map(line => line.text)).toEqual(GUEST_SUBTITLES.map(guest => guest.text));
  });
});
