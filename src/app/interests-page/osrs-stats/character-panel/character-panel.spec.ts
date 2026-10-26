import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OsrsCharacterPanelComponent } from './character-panel';
import { WomPlayer } from '../../../../shared/services/wise-old-man.service';

describe('OsrsCharacterPanelComponent', () => {
  let fixture: ComponentFixture<OsrsCharacterPanelComponent>;

  const player = {
    combatLevel: 117, ehp: 1210.4, ehb: 487.9,
    latestSnapshot: { data: { skills: { overall: { metric: 'overall', level: 2034, experience: 0, rank: 0, ehp: 0 } }, bosses: {}, activities: {} } },
  } as unknown as WomPlayer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OsrsCharacterPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(OsrsCharacterPanelComponent);
    fixture.componentRef.setInput('player', player);
    await fixture.whenStable();
  });

  it('shows combat, total level, EHP and EHB as headline stats', () => {
    expect(fixture.componentInstance.headline().map(s => `${s.label} ${s.value}`)).toEqual([
      'Combat 117', 'Total 2,034', 'EHP 1,210', 'EHB 488',
    ]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('2,034');
  });
});
