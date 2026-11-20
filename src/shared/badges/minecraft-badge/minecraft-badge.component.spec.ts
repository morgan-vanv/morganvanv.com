import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MinecraftBadgeComponent } from './minecraft-badge.component';
import { LabStatusService } from '../../lab-status/lab-status.service';
import { LabStatusId } from '../../constants/lab.const';

describe('MinecraftBadgeComponent', () => {
  let fixture: ComponentFixture<MinecraftBadgeComponent>;
  const state = signal<'up' | 'down' | null>(null);
  const online = signal<number | null>(null);
  const face = () => (fixture.nativeElement as HTMLElement).querySelector('.badge');

  beforeEach(async () => {
    state.set(null);
    online.set(null);
    TestBed.configureTestingModule({
      imports: [MinecraftBadgeComponent],
      providers: [{ provide: LabStatusService, useValue: { stateOf: (id: LabStatusId) => (id === 'minecraft' ? state() : null), minecraftOnline: online } }],
    });
    fixture = TestBed.createComponent(MinecraftBadgeComponent);
    await fixture.whenStable();
  });

  it('shows nothing until the status Worker has answered', () => {
    expect(face()).toBeNull();
  });

  it('wears the address over the count, and "0 online" when nobody is on', async () => {
    state.set('up');
    online.set(0);
    await fixture.whenStable();
    expect(face()?.querySelector('.mc-name')?.textContent?.trim()).toBe('mc.morganvanv.com');
    expect(face()?.textContent).toContain('0 online');
    expect(face()?.getAttribute('aria-label')?.startsWith('mc.morganvanv.com: 0 online right now.')).toBe(true);
  });

  it('says down while the Worker finds the server down', async () => {
    state.set('down');
    await fixture.whenStable();
    expect(face()?.textContent).toContain('down');
    expect(face()?.getAttribute('aria-label')).toContain('mc.morganvanv.com: down right now.');
  });
});
