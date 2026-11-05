import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LabPageComponent } from './lab-page.component';
import { SIDE_ROUTES } from '../../shared/main-routes';

describe('LabPageComponent', () => {
  let fixture: ComponentFixture<LabPageComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LabPageComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LabPageComponent);
    await fixture.whenStable();
  });

  it('has one h1, from the page header', () => {
    const headings = el().querySelectorAll('h1');
    expect(headings.length).toBe(1);
    expect(headings[0].textContent?.trim()).toBe('Lab');
  });

  it('is under construction for now', () => {
    expect(el().querySelector('app-under-construction img')?.getAttribute('src')).toBe('/under-construction.gif');
  });

  it('is a side page off Projects', () => {
    expect(SIDE_ROUTES.find(r => r.path === 'lab')).toEqual(expect.objectContaining({ title: 'Lab', parent: 'projects' }));
  });
});
