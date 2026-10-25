import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OsrsBossGridComponent } from './boss-grid';

describe('OsrsBossGridComponent', () => {
  let fixture: ComponentFixture<OsrsBossGridComponent>;

  beforeEach(async () => {
  await TestBed.configureTestingModule({ imports: [OsrsBossGridComponent] }).compileComponents();
  fixture = TestBed.createComponent(OsrsBossGridComponent);
  });

  it('drops bosses with no kills and sorts the rest alphabetically', async () => {
  fixture.componentRef.setInput('bosses', {
  zulrah: { metric: 'zulrah', kills: 12, rank: 1, ehb: 0 },
  kraken: { metric: 'kraken', kills: 0, rank: -1, ehb: 0 },
  abyssal_sire: { metric: 'abyssal_sire', kills: 1500, rank: 1, ehb: 0 },
  });
  await fixture.whenStable();
  expect(fixture.componentInstance.rows().map(r => r.name)).toEqual(['Abyssal Sire', 'Zulrah']);
  expect(fixture.componentInstance.rows()[0].kills).toBe('1,500');
  });
});
