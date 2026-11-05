import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProjectsPageComponent } from './projects-page.component';
import { PROJECTS } from '../../shared/constants/projects.const';

describe('ProjectsPageComponent', () => {
  let fixture: ComponentFixture<ProjectsPageComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ProjectsPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectsPageComponent);
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.match(r => new URL(r.url, 'http://localhost').hostname === 'api.github.com');
    http.verify();
  });

  it('has one h1, from the page header', () => {
    const headings = (fixture.nativeElement as HTMLElement).querySelectorAll('h1');
    expect(headings.length).toBe(1);
    expect(headings[0].textContent?.trim()).toBe('Projects');
  });

  it('shows every project as a poster, in order, and nothing under construction', () => {
    const el = fixture.nativeElement as HTMLElement;
    const names = [...el.querySelectorAll('app-project-poster .plate h2')].map(h => h.childNodes[0]?.textContent?.trim());
    expect(names).toEqual(PROJECTS.map(p => p.name));
    expect(el.querySelector('app-under-construction')).toBeNull();
  });

  it('counts the projects in the header, and not the slot', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(PROJECTS.length).toBe(5);
    expect(el.querySelector('app-page-header .desc')?.textContent).toContain('Five so far, none of them finished.');
    expect(el.querySelectorAll('.posters h2').length).toBe(PROJECTS.length);
  });

  it('ends the grid with the next-project slot, filling the rest of the last row of three', () => {
    const el = fixture.nativeElement as HTMLElement;
    const grid = el.querySelector<HTMLElement>('.posters');
    expect(grid?.style.getPropertyValue('--columns')).toBe('3');
    const slot = grid?.lastElementChild as HTMLElement;
    expect(slot.tagName.toLowerCase()).toBe('app-next-project-slot');
    // Five projects on three columns: one column left in the second row.
    expect(slot.style.getPropertyValue('--slot-span')).toBe('1');
  });

  it('links the homelab poster and its art to /lab', () => {
    const el = fixture.nativeElement as HTMLElement;
    const homelab = [...el.querySelectorAll('app-project-poster')].find(p => p.querySelector('h2')?.textContent?.trim() === 'The Homelab');
    expect(homelab?.querySelector('.rack')?.getAttribute('role')).toBe('img');
    expect(homelab?.querySelector('.art a.art-link')?.getAttribute('href')).toBe('/lab');
    expect([...homelab!.querySelectorAll('.links a')].map(a => a.getAttribute('href'))).toEqual(['/lab']);
  });
});
