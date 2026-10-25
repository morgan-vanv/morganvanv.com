import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { GreetingPageComponent, SUBTITLES } from './greeting-page.component';
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

  it('renders one of the static subtitles', () => {
    expect(SUBTITLES).toContain(shown());
  });

  it('rotates the live "last listened" line in with the jokes once it is known', async () => {
    summary.set('last listened: Song by Band · just now');
    await fixture.whenStable();
    const list = fixture.componentInstance['subtitles']();
    expect(list.length).toBe(SUBTITLES.length + 1);
    expect(list.at(-1)).toBe('last listened: Song by Band · just now');
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
});
