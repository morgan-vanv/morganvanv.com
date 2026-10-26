import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OsrsCharacterPanelComponent } from './character-panel';
import { WomPlayer } from '../../../../shared/services/wise-old-man.service';

describe('OsrsCharacterPanelComponent', () => {
  let fixture: ComponentFixture<OsrsCharacterPanelComponent>;

  const skill = (level: number) => ({ metric: '', level, experience: 0, rank: 0, ehp: 0 });
  const player = {
    combatLevel: 117, ehp: 1210.4, ehb: 487.9, ttm: 247.2,
    latestSnapshot: { data: { skills: { overall: skill(2034), attack: skill(99), mining: skill(99), sailing: skill(42), cooking: skill(95) }, bosses: {}, activities: {} } },
  } as unknown as WomPlayer;

  beforeEach(async () => {
    // A stand-in for <model-viewer>, so the real one (three.js, WebGL) never loads in tests.
    if (!customElements.get('model-viewer')) customElements.define('model-viewer', class extends HTMLElement {});
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

  it('counts 99s (ignoring overall) and shows hours to max', () => {
    expect(fixture.componentInstance.maxed()).toEqual({ maxed: 2, total: 4 });
    expect(fixture.componentInstance.maxedPercent()).toBe(50);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('≈ 247 hrs to max');
  });

  it('hides hours to max once maxed', async () => {
    fixture.componentRef.setInput('player', { ...player, ttm: 0 });
    await fixture.whenStable();
    expect(fixture.componentInstance.hoursToMax()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('hrs to max');
  });
});
