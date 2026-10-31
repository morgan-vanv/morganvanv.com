import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProjectArtLinkComponent } from './project-art-link.component';
import { Project } from '../constants/projects.const';

const base: Project = {
  id: 'p', name: 'Thing', status: 'live', description: 'Does stuff.',
  art: { kind: 'image', url: 'images/projects/thing.webp', alt: 'A thing' }, tags: [],
};

describe('ProjectArtLinkComponent', () => {
  let fixture: ComponentFixture<ProjectArtLinkComponent>;
  const link = () => (fixture.nativeElement as HTMLElement).querySelector('a');
  const words = () => link()?.textContent?.replace(/\s+/g, ' ').trim();

  async function mount(project: Project): Promise<void> {
    fixture.componentRef.setInput('project', project);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectArtLinkComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ProjectArtLinkComponent);
  });

  it('links the picture to the live site in a new tab, for pointers only', async () => {
    await mount({ ...base, liveUrl: 'https://example.github.io/thing/', liveLabel: 'Play it' });
    expect(link()?.getAttribute('href')).toBe('https://example.github.io/thing/');
    expect(link()?.getAttribute('target')).toBe('_blank');
    expect(link()?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link()?.getAttribute('tabindex')).toBe('-1');
    expect(link()?.getAttribute('aria-hidden')).toBe('true');
    expect(words()).toBe('[ play it › ]');
  });

  it('uses the project\'s own words when it has them', async () => {
    await mount({ ...base, liveUrl: 'https://example.github.io/thing/', liveLabel: 'Play it', artLabel: 'enter the castle' });
    expect(words()).toBe('[ enter the castle › ]');
  });

  it('goes to a page on this site when there is no live site', async () => {
    await mount({ ...base, more: { label: 'colophon', route: '/colophon' } });
    expect(link()?.getAttribute('href')).toBe('/colophon');
    expect(link()?.getAttribute('target')).toBeNull();
    expect(link()?.getAttribute('tabindex')).toBe('-1');
    expect(words()).toBe('[ colophon › ]');
  });

  it('renders nothing for a project with nowhere to go', async () => {
    await mount(base);
    expect(link()).toBeNull();
  });
});
