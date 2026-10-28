import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { existsSync } from 'node:fs';
import { ProjectCardComponent } from './project-card.component';
import { PINNED_PROJECT, PROJECTS, Project } from '../constants/projects.const';

const project: Project = {
  id: 'p', name: 'Thing', subtitle: 'Part Two', status: 'live', description: 'Does stuff.', quote: 'Hello.',
  art: { kind: 'image', url: 'images/projects/thing.webp', alt: 'A thing' },
  liveUrl: 'https://example.github.io/thing/', liveLabel: 'Play it',
  repo: { owner: 'someone', name: 'thing' }, tags: ['TypeScript'],
};
const REPO_URL = 'https://api.github.com/repos/someone/thing';

describe('ProjectCardComponent', () => {
  let fixture: ComponentFixture<ProjectCardComponent>;
  let http: HttpTestingController;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const links = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('a')].map(a => [a.textContent?.trim(), a.getAttribute('href')]);

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ProjectCardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ProjectCardComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('project', project);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('renders the project with its play and source links', () => {
    http.expectOne(REPO_URL).flush({ html_url: '', pushed_at: new Date().toISOString() });
    expect(text()).toContain('Thing');
    expect(text()).toContain('Part Two');
    expect(text()).toContain('“Hello.”');
    expect(links()).toEqual([
      ['Play it ↗', 'https://example.github.io/thing/'],
      ['Source ↗', 'https://github.com/someone/thing'],
    ]);
  });

  it('shows when the repo was last pushed to', async () => {
    http.expectOne(REPO_URL).flush({ html_url: '', pushed_at: new Date(Date.now() - 3 * 3_600_000).toISOString() });
    await fixture.whenStable();
    expect(text()).toContain('updated 3 hours ago');
  });

  it('just omits the date when GitHub fails or sends junk', async () => {
    http.expectOne(REPO_URL).flush('rate limited', { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    expect(text()).not.toContain('updated');
  });
});

describe('PROJECTS', () => {
  it('every project has a status, alt text for its art, and a screenshot in public/ when it has one', () => {
    for (const p of PROJECTS) {
      expect(p.status.length, p.id).toBeGreaterThan(0);
      expect(p.art.alt.length, p.id).toBeGreaterThan(10);
      if (p.art.kind === 'image') expect(existsSync(`public/${p.art.url}`), p.art.url).toBe(true);
    }
  });

  it('the pinned project has a screenshot, since the /now card has no other art', () => {
    expect(PINNED_PROJECT.art.kind).toBe('image');
    expect(PROJECTS).toContain(PINNED_PROJECT);
  });

  it('ids are unique and every project has a repo', () => {
    expect(new Set(PROJECTS.map(p => p.id)).size).toBe(PROJECTS.length);
    for (const p of PROJECTS) expect(p.repo.owner && p.repo.name, p.id).toBeTruthy();
  });
});
