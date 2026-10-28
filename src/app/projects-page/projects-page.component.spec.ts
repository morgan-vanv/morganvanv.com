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
    const names = [...el.querySelectorAll('app-project-poster .plate h2')].map(h => h.textContent?.trim());
    expect(names).toEqual(PROJECTS.map(p => p.name));
    expect(el.querySelector('app-under-construction')).toBeNull();
  });
});
