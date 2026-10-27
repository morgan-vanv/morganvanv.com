import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { GreetingPageComponent } from './greeting-page.component';
import { GUEST_SUBTITLES_TOKEN, SUBTITLES } from '../../shared/constants/subtitles.const';
import { GUEST_SUBTITLES } from '../../generated/guest-subtitles';
import { RecentStreamService } from '../../shared/services/recent-stream.service';

describe('GreetingPageComponent', () => {
  let fixture: ComponentFixture<GreetingPageComponent>;
  const summary = signal<string | null>(null);

  beforeEach(async () => {
    summary.set(null);
    await TestBed.configureTestingModule({
      imports: [GreetingPageComponent],
      providers: [provideRouter([]), { provide: RecentStreamService, useValue: { summary } }],
    }).compileComponents();
    fixture = TestBed.createComponent(GreetingPageComponent);
    await fixture.whenStable();
  });

  const shown = () => (fixture.nativeElement as HTMLElement).querySelector('.subtitle')?.textContent?.trim();
  const texts = () => fixture.componentInstance['subtitles']().map(line => line.text);

  it('renders one of the static subtitles', () => {
    expect(SUBTITLES).toContain(shown());
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
    fixture.componentInstance['currentIndex'].set(SUBTITLES.length);
    await fixture.whenStable();
    expect(shown()).toBe('listening to A by B right now');
    summary.set('last listened: A by B · 1 minute ago');
    await fixture.whenStable();
    expect(shown()).toBe('last listened: A by B · 1 minute ago');
  });

  it('shows no credit under Morgan\'s own lines', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('.credit')).toBeNull();
  });

  it('links the way in to /home, with a keyboard hint', () => {
    const el = fixture.nativeElement as HTMLElement;
    const enter = el.querySelector<HTMLAnchorElement>('a.enter')!;
    expect(enter.getAttribute('href')).toBe('/home');
    expect(enter.textContent?.trim()).toBe('[come on in]');
    expect([...enter.querySelectorAll('.bracket')].every(b => b.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(el.querySelector('.hint kbd')?.textContent).toBe('→');
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
    fixture.componentInstance['currentIndex'].set(SUBTITLES.length);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.subtitle')?.firstChild?.textContent?.trim()).toBe('a certified night owl');
    expect(el.querySelector('.subtitle .credit')?.textContent).toBe('— suggested by sam');
  });

  it('still prerenders Morgan\'s first line', () => {
    expect(fixture.componentInstance['subtitles']()[0]).toEqual({ text: SUBTITLES[0], credit: null });
  });
});

describe('GreetingPageComponent guest lines, by default', () => {
  it('come from content/subtitles/, gathered at build time', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: RecentStreamService, useValue: { summary: signal(null) } }] });
    expect(TestBed.inject(GUEST_SUBTITLES_TOKEN)).toBe(GUEST_SUBTITLES);
    const fixture = TestBed.createComponent(GreetingPageComponent);
    const lines = fixture.componentInstance['subtitles']();
    expect(lines.slice(SUBTITLES.length).map(line => line.text)).toEqual(GUEST_SUBTITLES.map(guest => guest.text));
  });
});
