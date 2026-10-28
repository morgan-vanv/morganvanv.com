import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ProjectPosterComponent } from './project-poster.component';
import { Project } from '../constants/projects.const';

const base: Project = {
  id: 'p', name: 'Thing', subtitle: 'Part Two', status: 'live', description: 'Does stuff.', quote: 'Hello.',
  art: { kind: 'image', url: 'images/projects/thing.webp', alt: 'A thing' },
  liveUrl: 'https://example.github.io/thing/', liveLabel: 'Play it',
  repo: { owner: 'someone', name: 'thing' }, tags: ['TypeScript'],
};
const REPO_URL = 'https://api.github.com/repos/someone/thing';

describe('ProjectPosterComponent', () => {
  let fixture: ComponentFixture<ProjectPosterComponent>;
  let http: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const links = () => [...el().querySelectorAll('a')].map(a => [a.textContent?.trim(), a.getAttribute('href')]);

  async function mount(project: Project): Promise<void> {
    fixture = TestBed.createComponent(ProjectPosterComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('project', project);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ProjectPosterComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => http.verify());

  it('shows a screenshot with its alt text, the status, the plate and the links', async () => {
    await mount(base);
    http.expectOne(REPO_URL).flush({ html_url: '', pushed_at: new Date(Date.now() - 3 * 3_600_000).toISOString() });
    await fixture.whenStable();
    expect(el().querySelector('img.shot')?.getAttribute('alt')).toBe('A thing');
    expect(el().querySelector('.status')?.textContent?.trim()).toBe('live');
    expect(el().querySelector('.plate h2')?.textContent?.trim()).toBe('Thing');
    expect(text()).toContain('Part Two');
    expect(text()).toContain('“Hello.”');
    expect(text()).toContain('updated 3 hours ago');
    expect(links()).toEqual([
      ['Play it ↗', 'https://example.github.io/thing/'],
      ['Source ↗', 'https://github.com/someone/thing'],
    ]);
  });

  it('draws a chat log, line by line, in place of a screenshot', async () => {
    await mount({
      ...base, liveUrl: undefined,
      art: {
        kind: 'chat', alt: 'A chat',
        lines: [
          { from: 'guest', name: 'someone', command: '/roast', text: '@morgan' },
          { from: 'bot', name: 'Bot', text: 'ok: ', strong: 'ouch', cards: true },
        ],
      },
    });
    http.expectOne(REPO_URL).flush({ html_url: '', pushed_at: new Date().toISOString() });
    const chat = el().querySelector('.chat');
    expect(chat?.getAttribute('role')).toBe('img');
    expect(chat?.getAttribute('aria-label')).toBe('A chat');
    expect(el().querySelector('img.shot')).toBeNull();
    const messages = [...el().querySelectorAll('.msg')];
    expect(messages.length).toBe(2);
    expect(messages[0].querySelector('.command')?.textContent).toBe('/roast');
    expect(messages[1].classList.contains('bot')).toBe(true);
    expect(messages[1].querySelector('.app')?.textContent).toBe('APP');
    expect(messages[1].querySelector('strong')?.textContent).toBe('ouch');
    expect(messages[1].querySelectorAll('.card-button').length).toBe(3);
    expect(links()).toEqual([['Source ↗', 'https://github.com/someone/thing']]);
  });

  it('draws the site miniature and links to a page on this site', async () => {
    await mount({ ...base, liveUrl: undefined, art: { kind: 'site', alt: 'This site' }, more: { label: 'colophon', route: '/colophon' } });
    http.expectOne(REPO_URL).flush({ html_url: '', pushed_at: new Date().toISOString() });
    expect(el().querySelector('.mini')?.getAttribute('aria-label')).toBe('This site');
    expect(links()).toEqual([
      ['[ colophon › ]', '/colophon'],
      ['Source ↗', 'https://github.com/someone/thing'],
    ]);
  });

  it('just omits the date when GitHub fails', async () => {
    await mount(base);
    http.expectOne(REPO_URL).flush('rate limited', { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    expect(text()).not.toContain('updated');
  });
});
