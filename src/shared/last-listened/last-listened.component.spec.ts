import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LastListenedComponent } from './last-listened.component';
import { RecentStreamService } from '../services/recent-stream.service';

describe('LastListenedComponent', () => {
  const item = { trackName: 'knots', artistName: 'matt proxy', imageUrl: null, trackUrl: 'https://stats.fm/track/1', isPlaying: false };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LastListenedComponent],
      providers: [{ provide: RecentStreamService, useValue: { lastListened: signal(item), when: signal('1 hour ago') } }],
    });
  });

  it('links the band to the track', async () => {
    const fixture = TestBed.createComponent(LastListenedComponent);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a.last-listened');
    expect(link?.getAttribute('href')).toBe(item.trackUrl);
    expect(link?.textContent).toContain('knots');
  });

  it('is plain text in the tile preview, since the tile is the control', async () => {
    const fixture = TestBed.createComponent(LastListenedComponent);
    fixture.componentRef.setInput('preview', true);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a')).toBeNull();
    expect(el.querySelector('.last-listened')?.textContent).toContain('matt proxy');
  });
});
