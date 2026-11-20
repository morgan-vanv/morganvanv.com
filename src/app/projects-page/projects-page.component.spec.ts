import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProjectsPageComponent } from './projects-page.component';
import { PROJECTS } from '../../shared/constants/projects.const';
import { SITE_CONFIG } from '../../shared/config/site.config';

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
    http.match(SITE_CONFIG.labStatusUrl);
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

  it('has no Homelab poster any more: it\'s a page of its own in the nav', () => {
    expect(PROJECTS.map(p => p.id)).not.toContain('homelab');
    expect(PROJECTS.map(p => p.more?.route)).not.toContain('/lab');
  });

  it('shows the Minecraft server as the game\'s server list, with its live count, linking to its panel on Social', async () => {
    const el = fixture.nativeElement as HTMLElement;
    const poster = [...el.querySelectorAll('app-project-poster')].find(p => p.querySelector('h2')?.textContent?.trim() === 'mc.morganvanv.com');
    expect(poster?.querySelector('.server-list')?.getAttribute('role')).toBe('img');
    expect(poster?.querySelector('.art a.art-link')?.getAttribute('href')).toBe('/social#server');
    expect(poster?.querySelector('.count')).toBeNull();
    http.expectOne(SITE_CONFIG.labStatusUrl).flush({
      checkedAt: '2026-11-20T15:00:00.000Z',
      services: { vtt: 'up', jellyfin: 'up', minecraft: 'up' },
      players: { minecraft: 2 },
    });
    await fixture.whenStable();
    expect(poster?.querySelector('.count')?.textContent).toBe('2 online');
  });
});
