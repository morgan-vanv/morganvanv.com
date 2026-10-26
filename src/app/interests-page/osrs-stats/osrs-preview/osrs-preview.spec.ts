import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OsrsPreviewComponent } from './osrs-preview';

describe('OsrsPreviewComponent', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [OsrsPreviewComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('shows combat, total, 99s and EHP once the player loads', async () => {
    const fixture = TestBed.createComponent(OsrsPreviewComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.stats')).toBeNull();

    const skill = (level: number) => ({ level });
    TestBed.inject(HttpTestingController).expectOne(r => r.url.includes('/players/')).flush({
      combatLevel: 124, ehp: 816.9, ehb: 293.9,
      latestSnapshot: { data: { skills: { overall: skill(2240), attack: skill(99), defence: skill(97) }, bosses: {}, activities: {} } },
    });
    await fixture.whenStable();

    const stats = [...el.querySelectorAll('.stat')].map(s => `${s.querySelector('dt')?.textContent} ${s.querySelector('dd')?.textContent}`);
    expect(stats).toEqual(['Combat 124', 'Total 2,240', '99s 1', 'EHP 817']);
  });

  it('renders nothing if the request fails', async () => {
    const fixture = TestBed.createComponent(OsrsPreviewComponent);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne(r => r.url.includes('/players/')).flush('nope', { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.stats')).toBeNull();
  });
});
