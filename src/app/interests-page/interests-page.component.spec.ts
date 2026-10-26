import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { InterestsPageComponent } from './interests-page.component';

const HOUR = 3_600_000;

describe('InterestsPageComponent', () => {
  let component: InterestsPageComponent;
  let fixture: ComponentFixture<InterestsPageComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [InterestsPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(InterestsPageComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('formats playtime in whole units', () => {
    expect(component.formatPlaytime(210 * HOUR + 59 * 60_000)).toBe('210 hrs');
    expect(component.formatPlaytime(1_234 * HOUR)).toBe('1,234 hrs');
    expect(component.formatPlaytime(2 * HOUR)).toBe('2 hrs');
    expect(component.formatPlaytime(HOUR + 30 * 60_000)).toBe('1 hr');
    expect(component.formatPlaytime(45 * 60_000)).toBe('45 min');
  });

  it('numbers the top songs and highlights the top three', async () => {
    // Open the Music section so its content renders.
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await fixture.whenStable();

    const req = http.match(r => r.url.includes('/top/tracks'))[0];
    const track = (i: number) => ({
      position: i + 1, streams: 10 - i, playedMs: 0,
      track: { id: i, name: `Song ${i}`, durationMs: 1, explicit: false, spotifyPreview: null, artists: [{ name: 'Band' }], albums: [] },
    });
    req.flush({ items: [0, 1, 2, 3].map(track) });
    await fixture.whenStable();

    const ranks = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.stats-rank')];
    expect(ranks.map(r => r.textContent?.trim())).toEqual(['1', '2', '3', '4']);
    expect(ranks.map(r => r.classList.contains('top'))).toEqual([true, true, true, false]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Band · 10 plays');
  });

  it('hides the page header while a section is open', async () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-page-header h1')?.textContent).toBe('Interests');

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(el.querySelector('app-page-header')).toBeNull();
    // Still exactly one h1, for screen readers.
    expect([...el.querySelectorAll('h1')].map(h => h.textContent)).toEqual(['Interests']);
  });

  it('switches the visible top list with the tabs', async () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const active = () => [...el.querySelectorAll('.stats-column.is-active')].map(c => c.id);
    expect(active()).toEqual(['music-list-songs']);

    const albums = [...el.querySelectorAll<HTMLButtonElement>('.list-tab')].find(t => t.textContent?.trim() === 'Albums')!;
    albums.click();
    await fixture.whenStable();
    expect(active()).toEqual(['music-list-albums']);
    expect(albums.getAttribute('aria-selected')).toBe('true');
  });
});
